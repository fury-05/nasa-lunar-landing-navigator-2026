"""Site metrics over a window (P2-06, docs/04 section 5). Deterministic, no machine learning.

Definitions are explicit because small choices change numbers:

* Sun "up" means the visible fraction of the Sun disc is at least `sun_threshold` (default 0.5,
  which is the disc centre on the skyline). Events are interpolated from the fraction series.
* Earth link available means the Earth disc CENTRE is above the skyline plus `mask_deg` (default 0).
* Power index uses the disc-centre elevation and scales the visible fraction: a horizontal deck
  gets f * max(sin(el), 0), a vertical sun-tracking array gets f * cos(el) for el in [0, 90],
  both multiplied by (1 AU / distance)^2 relative to the 1361 W/m2 solar constant. The result is a
  relative index in W/m2 on the array plane, not a lander power budget.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime

import numpy as np
import numpy.typing as npt

from lunar_engine.events import HermiteSeries, Interval, combine, complement, intervals_above
from lunar_engine.skyline import Skyline
from lunar_engine.visibility import disc_visibility_array

F64 = npt.NDArray[np.float64]
SOLAR_CONSTANT_W_M2 = 1361.0
AU_KM = 149_597_870.7
SUN_RADIUS_KM = 695_700.0
EARTH_RADIUS_KM = 6371.0


@dataclass(frozen=True)
class BodySeries:
    """Topocentric sky positions from Horizons (lunar_engine.ephemeris), one row per time."""

    times: list[datetime]
    azimuth_deg: F64
    elevation_deg: F64
    distance_km: F64

    def __post_init__(self) -> None:
        n = len(self.times)
        if not (len(self.azimuth_deg) == len(self.elevation_deg) == len(self.distance_km) == n):
            raise ValueError("series columns must have equal length")
        if n < 2:
            raise ValueError("need at least two samples")


def angular_radius_series(radius_km: float, distance_km: F64) -> F64:
    out: F64 = np.degrees(np.arcsin(radius_km / distance_km))
    return out


@dataclass(frozen=True)
class SunMetrics:
    visible_share: float  # share of the window with Sun fraction >= threshold
    sunlight_hours: float
    longest_dark_hours: float
    longest_dark_open: bool  # the longest dark span touches an edge of the window
    elevation_min_deg: float
    elevation_mean_deg: float
    elevation_max_deg: float
    power_index_horizontal_w_m2: float  # time-mean over the window
    power_index_tracking_w_m2: float
    sun_intervals: list[Interval]
    dark_intervals: list[Interval]


@dataclass(frozen=True)
class EarthMetrics:
    visible_share: float
    visible_hours: float
    longest_outage_hours: float
    longest_outage_open: bool
    windows: list[Interval]
    outages: list[Interval]


def _spans_hours(spans: list[Interval]) -> float:
    return sum(s.duration_s for s in spans) / 3600.0


def _longest(spans: list[Interval]) -> tuple[float, bool]:
    if not spans:
        return 0.0, False
    s = max(spans, key=lambda i: i.duration_s)
    return s.duration_s / 3600.0, s.open_start or s.open_end


def sun_fraction_series(
    sun: BodySeries, skyline: Skyline, skyline_offset_deg: float = 0.0, slices: int = 65
) -> F64:
    rho = angular_radius_series(SUN_RADIUS_KM, sun.distance_km)
    return disc_visibility_array(
        skyline, sun.azimuth_deg, sun.elevation_deg, rho, slices, skyline_offset_deg
    )


def sun_metrics(
    sun: BodySeries,
    skyline: Skyline,
    sun_threshold: float = 0.5,
    skyline_offset_deg: float = 0.0,
    slices: int = 65,
    step_s: float = 60.0,
) -> SunMetrics:
    """Sun metrics over the whole window of `sun`. Time integrals use `step_s` resampling."""
    if not 0.0 < sun_threshold <= 1.0:
        raise ValueError("sun_threshold must be in (0, 1]")
    frac = sun_fraction_series(sun, skyline, skyline_offset_deg, slices)
    series = HermiteSeries(sun.times, frac)
    # Interpolated fraction can overshoot [0, 1] slightly; the thresholds are inside that range.
    up = intervals_above(series, sun_threshold - 1e-12)
    dark = complement(up, sun.times[0], sun.times[-1])
    total_s = (sun.times[-1] - sun.times[0]).total_seconds()
    grid = np.arange(0.0, total_s + 1e-9, step_s)
    el_series = HermiteSeries(sun.times, sun.elevation_deg)
    dist_series = HermiteSeries(sun.times, sun.distance_km)
    frac_grid = np.clip(series.at_array(grid), 0.0, 1.0)
    el_grid = el_series.at_array(grid)
    scale = (AU_KM / dist_series.at_array(grid)) ** 2 * SOLAR_CONSTANT_W_M2
    el_rad = np.radians(el_grid)
    horizontal = frac_grid * np.maximum(np.sin(el_rad), 0.0) * scale
    tracking = frac_grid * np.where((el_grid >= 0) & (el_grid <= 90), np.cos(el_rad), 0.0) * scale
    longest, longest_open = _longest(dark)
    return SunMetrics(
        visible_share=_spans_hours(up) * 3600.0 / total_s if total_s > 0 else 0.0,
        sunlight_hours=_spans_hours(up),
        longest_dark_hours=longest,
        longest_dark_open=longest_open,
        elevation_min_deg=float(el_grid.min()),
        elevation_mean_deg=float(el_grid.mean()),
        elevation_max_deg=float(el_grid.max()),
        power_index_horizontal_w_m2=float(horizontal.mean()),
        power_index_tracking_w_m2=float(tracking.mean()),
        sun_intervals=up,
        dark_intervals=dark,
    )


def earth_metrics(
    earth: BodySeries, skyline: Skyline, mask_deg: float = 0.0, skyline_offset_deg: float = 0.0
) -> EarthMetrics:
    """Direct-to-Earth availability: Earth disc centre above the skyline plus a mask angle."""
    sky_at_earth = skyline.at_array(earth.azimuth_deg) + skyline_offset_deg + mask_deg
    margin = earth.elevation_deg - sky_at_earth
    series = HermiteSeries(earth.times, margin)
    windows = intervals_above(series, 0.0)
    outages = complement(windows, earth.times[0], earth.times[-1])
    total_s = (earth.times[-1] - earth.times[0]).total_seconds()
    longest, longest_open = _longest(outages)
    return EarthMetrics(
        visible_share=_spans_hours(windows) * 3600.0 / total_s if total_s > 0 else 0.0,
        visible_hours=_spans_hours(windows),
        longest_outage_hours=longest,
        longest_outage_open=longest_open,
        windows=windows,
        outages=outages,
    )


def both_up(sun: SunMetrics, earth: EarthMetrics) -> list[Interval]:
    """Periods with both Sun and an Earth link, the best operating periods."""
    return combine(sun.sun_intervals, earth.windows)


def neither(sun: SunMetrics, earth: EarthMetrics, start: datetime, end: datetime) -> list[Interval]:
    """Periods with neither Sun nor an Earth link."""
    return combine(sun.dark_intervals, earth.outages) if start < end else []



