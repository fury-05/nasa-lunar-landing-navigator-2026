"""Compare sites and the slip matrix (P2-08, docs/05 `/compare` and `/slip-matrix`).

The engine does not fetch data. A `SiteSky` bundles what is already known about one site: its
skyline and the Sun and Earth series covering at least the longest window requested. Callers (the
API and the precompute pipeline) build `SiteSky` objects from Horizons and the DEM. A window is a
slice of those series, so a slip of N days is the same series read N days later, not a new call.
"""

from __future__ import annotations

import bisect
from dataclasses import dataclass
from datetime import datetime, timedelta

import numpy as np

from lunar_engine.metrics import BodySeries
from lunar_engine.sensitivity import PLACEHOLDER_CRITERIA, Assessment, Criteria, assess
from lunar_engine.skyline import Skyline
from lunar_engine.terrain_status import TerrainStatus

GLYPHS = {"viable": "check", "marginal": "tilde", "not viable": "cross"}


@dataclass(frozen=True)
class SiteSky:
    site_id: str
    skyline: Skyline
    sun: BodySeries
    earth: BodySeries


def slice_series(series: BodySeries, start: datetime, end: datetime) -> BodySeries:
    """Samples with start <= t <= end. Raises if the window is not inside the series."""
    if start < series.times[0] or end > series.times[-1]:
        raise ValueError("window is outside the series coverage")
    if end <= start:
        raise ValueError("window must have positive length")
    a = bisect.bisect_left(series.times, start)
    b = bisect.bisect_right(series.times, end)
    if b - a < 2:
        raise ValueError("window holds fewer than two samples")
    return BodySeries(
        series.times[a:b], series.azimuth_deg[a:b], series.elevation_deg[a:b],
        series.distance_km[a:b],
    )


def assess_window(
    site: SiteSky, start: datetime, end: datetime, criteria: Criteria = PLACEHOLDER_CRITERIA,
    delta_deg: float | None = None, sun_threshold: float = 0.5, mask_deg: float = 0.0,
) -> Assessment:
    return assess(
        slice_series(site.sun, start, end), slice_series(site.earth, start, end), site.skyline,
        criteria, delta_deg, sun_threshold, mask_deg,
    )


@dataclass(frozen=True)
class CompareRow:
    site_id: str
    window_index: int
    start_utc: datetime
    end_utc: datetime
    assessment: Assessment


@dataclass(frozen=True)
class Delta:
    """Difference of site B minus site A for one metric, with which side is better."""

    metric: str
    a: float
    b: float
    difference: float
    better: str  # "a", "b" or "tie"


def compare(
    sites: list[SiteSky], windows: list[tuple[datetime, datetime]],
    criteria: Criteria = PLACEHOLDER_CRITERIA, delta_deg: float | None = None,
) -> list[CompareRow]:
    """Metric matrix: every site against every window, in site-major order."""
    if not sites or not windows:
        raise ValueError("need at least one site and one window")
    if len({s.site_id for s in sites}) != len(sites):
        raise ValueError("site ids must be unique")
    return [
        CompareRow(s.site_id, wi, w[0], w[1], assess_window(s, w[0], w[1], criteria, delta_deg))
        for s in sites
        for wi, w in enumerate(windows)
    ]


_HIGHER_IS_BETTER = {
    "sunlight_hours": True,
    "sun_share": True,
    "earth_share": True,
    "longest_dark_hours": False,
    "longest_outage_hours": False,
}


def deltas(a: Assessment, b: Assessment, tolerance: float = 1e-9) -> list[Delta]:
    """Nominal metric differences between two assessments (B minus A)."""
    out: list[Delta] = []
    for name, higher_better in _HIGHER_IS_BETTER.items():
        va, vb = getattr(a, name).nominal, getattr(b, name).nominal
        diff = vb - va
        if abs(diff) <= tolerance:
            better = "tie"
        else:
            better = "b" if (diff > 0) == higher_better else "a"
        out.append(Delta(name, va, vb, diff, better))
    return out


@dataclass(frozen=True)
class SlipCell:
    site_id: str
    offset_days: float
    start_utc: datetime
    end_utc: datetime
    verdict: str
    glyph: str
    robust: bool  # False draws the cell outlined (fragile)
    sunlight_hours: float
    earth_share: float
    # same fields as Assessment, so a cell can show the upper-bound state without another call
    terrain: TerrainStatus
    verdict_state: str
    verdict_conclusive: bool


def slip_matrix(
    sites: list[SiteSky], start: datetime, offsets_days: list[float], duration_days: float,
    criteria: Criteria = PLACEHOLDER_CRITERIA, delta_deg: float | None = None,
) -> list[list[SlipCell]]:
    """Grid of sites by start-date offsets. Row i is sites[i]; column j is offsets_days[j]."""
    if duration_days <= 0:
        raise ValueError("duration_days must be positive")
    if not sites or not offsets_days:
        raise ValueError("need at least one site and one offset")
    rows: list[list[SlipCell]] = []
    for s in sites:
        row: list[SlipCell] = []
        for off in offsets_days:
            a = start + timedelta(days=off)
            b = a + timedelta(days=duration_days)
            res = assess_window(s, a, b, criteria, delta_deg)
            row.append(
                SlipCell(
                    s.site_id, off, a, b, res.nominal_verdict, GLYPHS[res.nominal_verdict],
                    res.robust, res.sunlight_hours.nominal, res.earth_share.nominal,
                    res.terrain, res.verdict_state, res.verdict_conclusive,
                )
            )
        rows.append(row)
    return rows


def best_start(row: list[SlipCell]) -> SlipCell | None:
    """The robust viable cell with the most sunlight, else any viable, else None."""
    viable = [c for c in row if c.verdict == "viable"]
    if not viable:
        return None
    robust = [c for c in viable if c.robust]
    pool = robust or viable
    return max(pool, key=lambda c: (c.sunlight_hours, c.earth_share, -c.offset_days))


def shift_sensitivity(row: list[SlipCell]) -> float:
    """Largest change in sunlight hours between neighbouring offsets (how fast a slip bites)."""
    if len(row) < 2:
        return 0.0
    vals = np.array([c.sunlight_hours for c in sorted(row, key=lambda c: c.offset_days)])
    return float(np.max(np.abs(np.diff(vals))))
