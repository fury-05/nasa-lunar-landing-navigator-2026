"""Sensitivity band and robust or fragile verdicts (P2-07, docs/04 section 6).

Every metric is computed three times with the skyline moved by -delta, 0 and +delta degrees. A
higher skyline hides more of the Sun and Earth, so +delta is the pessimistic run. A verdict is
robust only if all three runs agree.

What counts as "viable" is NOT defined by the project documents. Viability is therefore judged
against explicit `Criteria` that the caller supplies. `PLACEHOLDER_CRITERIA` exists so the UI has
something to show; its numbers are an assumption, are marked `pending-source`, and must be replaced
by the mission's own requirements (todo/APPROVALS.md A8).
"""

from __future__ import annotations

import math
from collections.abc import Callable
from dataclasses import dataclass, field, replace

import numpy as np

from lunar_engine.metrics import (
    BodySeries,
    EarthMetrics,
    SunMetrics,
    earth_metrics,
    sun_metrics,
)
from lunar_engine.skyline import Skyline
from lunar_engine.terrain_status import (
    REQUIRED_RANGE_M,
    TerrainStatus,
    terrain_status,
    unseen_bound_deg,
)

MIN_DELTA_DEG = 0.1  # docs/04: never below 0.1 degrees until validated
# Initial error budget assumptions from docs/04 section 7. Upper end of the DEM range is used so
# the band is wide rather than falsely tight, until P2-12 measures real values.
ASSUMED_SKYLINE_ERROR_DEG = 0.2
ASSUMED_FRAME_ERROR_DEG = 0.03


def default_delta_deg(
    skyline_error_deg: float = ASSUMED_SKYLINE_ERROR_DEG,
    frame_error_deg: float = ASSUMED_FRAME_ERROR_DEG,
) -> float:
    """sqrt(skyline_error^2 + frame_error^2), never below 0.1 degrees."""
    if skyline_error_deg < 0 or frame_error_deg < 0:
        raise ValueError("errors must not be negative")
    return max(MIN_DELTA_DEG, math.hypot(skyline_error_deg, frame_error_deg))


@dataclass(frozen=True)
class Criteria:
    """Targets a site must meet over the window. `marginal_factor` relaxes them for 'marginal'."""

    min_sun_share: float
    max_dark_hours: float
    min_earth_share: float
    max_outage_hours: float
    marginal_factor: float = 0.8
    status: str = "user-supplied"

    def __post_init__(self) -> None:
        if not (0.0 <= self.min_sun_share <= 1.0 and 0.0 <= self.min_earth_share <= 1.0):
            raise ValueError("shares must be within [0, 1]")
        if self.max_dark_hours < 0 or self.max_outage_hours < 0:
            raise ValueError("hour limits must not be negative")
        if not 0.0 < self.marginal_factor <= 1.0:
            raise ValueError("marginal_factor must be in (0, 1]")


# ASSUMPTION, pending-source: round numbers chosen only so the interface can demonstrate verdicts.
PLACEHOLDER_CRITERIA = Criteria(
    min_sun_share=0.5,
    max_dark_hours=120.0,
    min_earth_share=0.5,
    max_outage_hours=120.0,
    status="pending-source: placeholder planning criteria, not mission requirements",
)


def verdict(sun: SunMetrics, earth: EarthMetrics, c: Criteria) -> str:
    """'viable', 'marginal' or 'not viable' for one set of metrics."""
    f = c.marginal_factor
    full = (
        sun.visible_share >= c.min_sun_share
        and sun.longest_dark_hours <= c.max_dark_hours
        and earth.visible_share >= c.min_earth_share
        and earth.longest_outage_hours <= c.max_outage_hours
    )
    if full:
        return "viable"
    relaxed = (
        sun.visible_share >= c.min_sun_share * f
        and sun.longest_dark_hours <= c.max_dark_hours / f
        and earth.visible_share >= c.min_earth_share * f
        and earth.longest_outage_hours <= c.max_outage_hours / f
    )
    return "marginal" if relaxed else "not viable"


@dataclass(frozen=True)
class Band:
    low: float
    nominal: float
    high: float

    @property
    def width(self) -> float:
        return self.high - self.low


Run = tuple[SunMetrics, EarthMetrics]


def _band(runs: tuple[Run, Run, Run], pick: Callable[[Run], float]) -> Band:
    pess, nom, opt = (pick(r) for r in runs)  # runs at +delta, 0, -delta
    return Band(min(pess, nom, opt), nom, max(pess, nom, opt))


@dataclass(frozen=True)
class Assessment:
    delta_deg: float
    pessimistic: Run  # skyline raised by delta
    nominal: Run
    optimistic: Run  # skyline lowered by delta
    verdicts: tuple[str, str, str]  # pessimistic, nominal, optimistic
    nominal_verdict: str
    robust: bool
    sunlight_hours: Band
    sun_share: Band
    earth_share: Band
    longest_dark_hours: Band
    longest_outage_hours: Band
    criteria_status: str
    terrain: TerrainStatus
    assumptions: list[str] = field(default_factory=list)
    # viable, marginal, not_viable or upper_bound_terrain_incomplete
    verdict_state: str = "not_viable"
    verdict_conclusive: bool = True  # False when only an upper bound that could still fall
    band_basis: list[str] = field(default_factory=list)


def verdict_state_of(nominal: str, status: TerrainStatus) -> tuple[str, bool]:
    """Public verdict label and whether it is conclusive.

    With incomplete terrain every figure is an upper bound: missing relief can only lower sunlight
    and the Earth link. A 'not viable' result therefore stays conclusive; a better one does not.
    """
    if status.complete:
        return nominal.replace(" ", "_"), True
    return "upper_bound_terrain_incomplete", nominal == "not viable"


def _band_basis(
    skyline: Skyline, status: TerrainStatus, delta: float, delta_given: bool, required_m: float
) -> list[str]:
    out: list[str] = []
    if delta_given:
        out.append(f"band half-width of {delta:.3f} degrees set by the caller")
    elif skyline.dem_error_deg is not None:
        out.append(
            f"DEM vertical error measured along the rays: {skyline.dem_error_deg:.3f} degrees "
            f"(ERR product), combined with an assumed frame error of {ASSUMED_FRAME_ERROR_DEG} "
            f"degrees: half-width {delta:.3f} degrees"
        )
    else:
        out.append(
            f"DEM error is an assumed {ASSUMED_SKYLINE_ERROR_DEG} degrees, not measured "
            f"(the ERR product is not yet applied); half-width {delta:.3f} degrees"
        )
    if not status.available:
        out.append(
            "terrain unavailable: the horizon is a bare sphere, so the result is an upper bound "
            "and the band cannot cover the missing relief"
        )
    elif not status.complete:
        if skyline.unseen_relief_m is None:
            out.append(
                f"terrain reached only {status.reach_km_min:.1f} to {status.reach_km_max:.1f} km "
                f"of the required {status.required_km:.0f} km; the largest plausible unseen "
                "relief is pending-source, so the pessimistic edge does NOT include it and the "
                "result is an upper bound"
            )
        else:
            out.append(
                f"terrain reached only {status.reach_km_min:.1f} to {status.reach_km_max:.1f} km "
                f"of the required {status.required_km:.0f} km; the pessimistic edge raises the "
                f"skyline over the uncovered azimuths to unseen relief of "
                f"{skyline.unseen_relief_m:.0f} m above the reference sphere starting where the "
                "data ended (highest terrain in the wider data beyond the cast area)"
            )
    return out


def assess(
    sun: BodySeries,
    earth: BodySeries,
    skyline: Skyline,
    criteria: Criteria = PLACEHOLDER_CRITERIA,
    delta_deg: float | None = None,
    sun_threshold: float = 0.5,
    mask_deg: float = 0.0,
    required_range_m: float = REQUIRED_RANGE_M,
) -> Assessment:
    status = terrain_status(skyline, required_range_m)
    if delta_deg is None:
        delta = default_delta_deg(
            ASSUMED_SKYLINE_ERROR_DEG if skyline.dem_error_deg is None else skyline.dem_error_deg
        )
    else:
        delta = delta_deg
    if delta < 0:
        raise ValueError("delta must not be negative")
    pess_sky = skyline
    bound = unseen_bound_deg(skyline, skyline.unseen_relief_m, required_range_m)
    if bound is not None and status.available:
        pess_sky = replace(skyline, elevation_deg=np.fmax(skyline.elevation_deg, bound))
    runs = []
    for off, sky in ((+delta, pess_sky), (0.0, skyline), (-delta, skyline)):
        runs.append(
            (
                sun_metrics(sun, sky, sun_threshold, skyline_offset_deg=off),
                earth_metrics(earth, sky, mask_deg, skyline_offset_deg=off),
            )
        )
    pess, nom, opt = runs
    triple = (pess, nom, opt)
    verdicts = (verdict(*pess, criteria), verdict(*nom, criteria), verdict(*opt, criteria))
    state, conclusive = verdict_state_of(verdicts[1], status)
    return Assessment(
        delta_deg=delta,
        pessimistic=pess,
        nominal=nom,
        optimistic=opt,
        verdicts=verdicts,
        nominal_verdict=verdicts[1],
        robust=len(set(verdicts)) == 1,
        sunlight_hours=_band(triple, lambda r: r[0].sunlight_hours),
        sun_share=_band(triple, lambda r: r[0].visible_share),
        earth_share=_band(triple, lambda r: r[1].visible_share),
        longest_dark_hours=_band(triple, lambda r: r[0].longest_dark_hours),
        longest_outage_hours=_band(triple, lambda r: r[1].longest_outage_hours),
        criteria_status=criteria.status,
        terrain=status,
        assumptions=[
            f"skyline offset band of plus and minus {delta:.3f} degrees "
            f"(frame error assumed {ASSUMED_FRAME_ERROR_DEG} degrees, not yet measured, P2-12)",
            f"Sun counts as up when at least {sun_threshold:.0%} of its disc is visible",
            f"Earth link needs the disc centre above the skyline plus {mask_deg} degrees",
            f"viability criteria: {criteria.status}",
        ],
        verdict_state=state,
        verdict_conclusive=conclusive,
        band_basis=_band_basis(skyline, status, delta, delta_deg is not None, required_range_m),
    )
