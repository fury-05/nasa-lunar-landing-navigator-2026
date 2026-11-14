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
from dataclasses import dataclass, field

from lunar_engine.metrics import (
    BodySeries,
    EarthMetrics,
    SunMetrics,
    earth_metrics,
    sun_metrics,
)
from lunar_engine.skyline import Skyline

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
    assumptions: list[str] = field(default_factory=list)


def assess(
    sun: BodySeries,
    earth: BodySeries,
    skyline: Skyline,
    criteria: Criteria = PLACEHOLDER_CRITERIA,
    delta_deg: float | None = None,
    sun_threshold: float = 0.5,
    mask_deg: float = 0.0,
) -> Assessment:
    delta = default_delta_deg() if delta_deg is None else delta_deg
    if delta < 0:
        raise ValueError("delta must not be negative")
    runs = []
    for off in (+delta, 0.0, -delta):
        runs.append(
            (
                sun_metrics(sun, skyline, sun_threshold, skyline_offset_deg=off),
                earth_metrics(earth, skyline, mask_deg, skyline_offset_deg=off),
            )
        )
    pess, nom, opt = runs
    triple = (pess, nom, opt)
    verdicts = (verdict(*pess, criteria), verdict(*nom, criteria), verdict(*opt, criteria))
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
        assumptions=[
            f"skyline offset band of plus and minus {delta:.3f} degrees "
            f"(assumed skyline error {ASSUMED_SKYLINE_ERROR_DEG} and frame error "
            f"{ASSUMED_FRAME_ERROR_DEG} degrees, not yet measured, P2-12)",
            f"Sun counts as up when at least {sun_threshold:.0%} of its disc is visible",
            f"Earth link needs the disc centre above the skyline plus {mask_deg} degrees",
            f"viability criteria: {criteria.status}",
        ],
    )
