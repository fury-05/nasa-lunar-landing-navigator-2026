"""Lander profile and suitability checks (P6-01 and P6-02, issues #84 and #85).

A `Lander` is a small set of user-supplied numbers. The library ships NO real spacecraft: the only
values it carries are `PLACEHOLDER_LANDER`, which equal the web page placeholders and are labelled
`pending-source`. Nothing in this repository sources lander parameters.

The arithmetic is deliberately simple and says so:

* usable energy = battery capacity x (1 - reserve fraction), in watt hours;
* dark survival = usable energy / constant survival load, in hours;
* the lander is compared with the longest dark spell and the longest Earth outage of a window,
  each as a band (optimistic, nominal, pessimistic) from the skyline sensitivity run of
  `lunar_engine.sensitivity.assess`. The pessimistic edge is the skyline raised by the error
  budget, i.e. the longest dark spell and outage of the worst run.

There is NO charging model, NO thermal model, NO battery ageing and NO sunlit power budget.
`array_power_w` and the survival temperature limits are only stored and echoed.

The slope estimate is a finite difference on the local height grid. It resolves slopes at the grid
baseline (tens of metres), not at lander scale (metres), and carries the DEM height error as an
explicit, conservative slope error. It is an indicator, not a landing-safety assessment.
"""

from __future__ import annotations

import math
from dataclasses import dataclass, fields
from typing import Literal

import numpy as np
import numpy.typing as npt

from lunar_engine.sensitivity import Assessment, Band

F64 = npt.NDArray[np.float64]

PLACEHOLDER_SOURCE = (
    "placeholder: pending-source. Illustrative round numbers, not a real spacecraft"
)

CheckStatus = Literal["pass", "marginal", "fail", "not_assessed"]
Verdict = Literal["pass", "marginal", "fail", "upper_bound_terrain_incomplete"]


@dataclass(frozen=True)
class FieldSpec:
    unit: str
    lo: float | None
    hi: float | None
    doc: str
    required: bool


LANDER_FIELDS: dict[str, FieldSpec] = {
    "battery_capacity_wh": FieldSpec(
        "Wh",
        0.0,
        1e7,
        "Nameplate energy of the battery. Ageing and temperature are not modelled.",
        True,
    ),
    "reserve_fraction": FieldSpec(
        "fraction", 0.0, 1.0, "Share of the capacity that must stay unused (0 to 1).", True
    ),
    "survival_load_w": FieldSpec(
        "W",
        0.0,
        1e6,
        "Constant power draw while the Sun is down. Zero means it never depletes.",
        True,
    ),
    "autonomy_without_earth_h": FieldSpec(
        "h", 0.0, 1e5, "Longest time the lander can run with no Earth contact.", True
    ),
    "source": FieldSpec(
        "text",
        None,
        None,
        "Where these numbers come from (a document, a team decision, or a placeholder label).",
        True,
    ),
    "array_power_w": FieldSpec(
        "W", 0.0, 1e7, "Solar array output. Stored and echoed only: no charging model.", False
    ),
    "slope_limit_deg": FieldSpec(
        "deg",
        0.0,
        90.0,
        "Largest ground slope the lander tolerates. Enables the slope check.",
        False,
    ),
    "min_survival_temp_c": FieldSpec(
        "degC",
        -273.15,
        1000.0,
        "Coldest survivable temperature. Stored and echoed only: no thermal model.",
        False,
    ),
    "max_survival_temp_c": FieldSpec(
        "degC",
        -273.15,
        1000.0,
        "Hottest survivable temperature. Stored and echoed only: no thermal model.",
        False,
    ),
}


def _finite_in(name: str, v: float | None) -> None:
    spec = LANDER_FIELDS[name]
    if v is None:
        if spec.required:
            raise ValueError(f"{name} is required")
        return
    if not math.isfinite(v):
        raise ValueError(f"{name} must be a finite number")
    if spec.lo is None or spec.hi is None:
        raise ValueError(f"{name} has no numeric range")
    if not spec.lo <= v <= spec.hi:
        raise ValueError(f"{name} must be within [{spec.lo}, {spec.hi}] {spec.unit}")


@dataclass(frozen=True)
class Lander:
    battery_capacity_wh: float
    reserve_fraction: float
    survival_load_w: float
    autonomy_without_earth_h: float
    source: str
    array_power_w: float | None = None
    slope_limit_deg: float | None = None
    min_survival_temp_c: float | None = None
    max_survival_temp_c: float | None = None

    def __post_init__(self) -> None:
        for f in fields(self):
            if f.name != "source":
                _finite_in(f.name, getattr(self, f.name))
        if not self.source.strip():
            raise ValueError("source must say where the lander numbers come from")
        lo, hi = self.min_survival_temp_c, self.max_survival_temp_c
        if lo is not None and hi is not None and lo > hi:
            raise ValueError("min_survival_temp_c must not exceed max_survival_temp_c")


PLACEHOLDER_LANDER = Lander(
    battery_capacity_wh=1000.0,
    reserve_fraction=0.2,
    survival_load_w=10.0,
    autonomy_without_earth_h=48.0,
    source=PLACEHOLDER_SOURCE,
)


def usable_energy_wh(lander: Lander) -> float:
    return lander.battery_capacity_wh * (1.0 - lander.reserve_fraction)


def dark_survival_hours(lander: Lander) -> float | None:
    """Hours the usable energy lasts at the survival load; None when the load is zero."""
    if lander.survival_load_w <= 0.0:
        return None
    return usable_energy_wh(lander) / lander.survival_load_w


@dataclass(frozen=True)
class DarkSurvival:
    survival_hours: float | None
    # survival minus dark spell; low is the worst case (longest dark spell). None for zero load.
    margin_hours: Band | None
    energy_needed_wh: Band  # load x dark spell, per band edge


def dark_survival_margin(lander: Lander, longest_dark_hours: Band) -> DarkSurvival:
    """Compare survival time with the dark-spell band. The pessimistic side uses `high`."""
    s = dark_survival_hours(lander)
    load = lander.survival_load_w
    need = Band(
        longest_dark_hours.low * load,
        longest_dark_hours.nominal * load,
        longest_dark_hours.high * load,
    )
    if s is None:
        return DarkSurvival(None, None, need)
    margin = Band(
        s - longest_dark_hours.high, s - longest_dark_hours.nominal, s - longest_dark_hours.low
    )
    return DarkSurvival(s, margin, need)


# ---- slope ------------------------------------------------------------------------------------

MIN_VALID_FRACTION = 0.5


@dataclass(frozen=True)
class SlopeEstimate:
    max_slope_deg: float
    mean_slope_deg: float
    baseline_m: float  # distance spanned by one central difference (two grid cells)
    patch_m: float  # side of the square around the site that was examined
    valid_fraction: float  # share of the patch with a finite slope
    native_resolution_m: float  # pixel size of the DEM tier behind the grid
    height_error_m: float | None  # DEM height error (ERR product) used for the slope error
    slope_error_deg: float | None

    @property
    def pessimistic_deg(self) -> float:
        return min(90.0, self.max_slope_deg + (self.slope_error_deg or 0.0))


def slope_estimate(
    heights_m: F64,
    spacing_m: float,
    patch_m: float,
    native_resolution_m: float,
    height_error_m: float | None,
) -> SlopeEstimate | None:
    """Steepest and mean central-difference slope within `patch_m` of the grid centre.

    Slope error: each height has error e, so a difference over a baseline b has error sqrt(2) e / b
    in gradient. Independent errors are assumed, which is conservative (DEM errors are partly
    correlated between neighbours, which would shrink it). Returns None when fewer than half of the
    patch cells have a slope, rather than a number from too little data.
    """
    if spacing_m <= 0 or patch_m <= 0:
        raise ValueError("spacing and patch size must be positive")
    h = np.asarray(heights_m, dtype=float)
    if h.ndim != 2 or min(h.shape) < 3:
        return None
    gy, gx = np.gradient(h, spacing_m)
    grad = np.hypot(gx, gy)
    rows, cols = h.shape
    yy, xx = np.meshgrid(
        (np.arange(rows) - (rows - 1) / 2.0) * spacing_m,
        (np.arange(cols) - (cols - 1) / 2.0) * spacing_m,
        indexing="ij",
    )
    half = patch_m / 2.0 + 1e-9
    in_patch = (np.abs(xx) <= half) & (np.abs(yy) <= half)
    interior = np.zeros_like(in_patch)
    interior[1:-1, 1:-1] = True
    cells = in_patch & interior
    if not cells.any():
        return None
    g = grad[cells]
    ok = np.isfinite(g)
    valid = float(np.mean(ok))
    if valid < MIN_VALID_FRACTION:
        return None
    g = g[ok]
    slopes = np.degrees(np.arctan(g))
    baseline = 2.0 * spacing_m
    err: float | None = None
    if height_error_m is not None and math.isfinite(height_error_m) and height_error_m >= 0:
        gmax = float(g.max())
        err = math.degrees(math.sqrt(2.0) * height_error_m / baseline / (1.0 + gmax * gmax))
    return SlopeEstimate(
        float(slopes.max()),
        float(slopes.mean()),
        baseline,
        patch_m,
        valid,
        native_resolution_m,
        height_error_m,
        err,
    )


# ---- suitability ------------------------------------------------------------------------------


@dataclass(frozen=True)
class CheckResult:
    id: str
    title: str
    status: CheckStatus
    reasoning: str
    unit: str | None = None
    available: float | None = None  # what the lander offers (hours, degrees)
    required_nominal: float | None = None
    required_pessimistic: float | None = None
    margin_nominal: float | None = None
    margin_pessimistic: float | None = None


@dataclass(frozen=True)
class Suitability:
    verdict: Verdict
    conclusive: bool
    summary: str
    checks: list[CheckResult]
    lander: Lander
    warnings: list[str]
    assumptions: list[str]


def _h(x: float) -> str:
    return f"{x:.1f}"


def _spell_check(
    cid: str,
    title: str,
    band: Band,
    available: float | None,
    open_span: bool,
    what: str,
    limit_text: str,
    extra: str,
) -> CheckResult:
    """Shared logic: a spell (dark or outage) of `band` hours against an allowance in hours."""
    if available is None:
        return CheckResult(
            cid,
            title,
            "pass",
            f"The survival load is zero, so the battery never depletes during {what}. {extra}",
            "h",
            None,
            band.nominal,
            band.high,
        )
    m_nom, m_pes = available - band.nominal, available - band.high
    if available < band.nominal:
        status: CheckStatus = "fail"
        text = (
            f"The longest {what} is {_h(band.nominal)} hours (up to {_h(band.high)} h in the "
            f"pessimistic run), but {limit_text} {_h(available)} hours. It falls short by "
            f"{_h(-m_nom)} hours even in the nominal run."
        )
    elif available < band.high:
        status = "marginal"
        text = (
            f"The longest {what} is {_h(band.nominal)} hours nominally and {_h(band.high)} hours "
            f"in the pessimistic run; {limit_text} {_h(available)} hours. It fits nominally "
            f"(margin {_h(m_nom)} h) but not at the pessimistic skyline edge "
            f"(margin {_h(m_pes)} h)."
        )
    else:
        status = "pass"
        text = (
            f"The longest {what} is {_h(band.nominal)} hours nominally and {_h(band.high)} hours "
            f"in the pessimistic run; {limit_text} {_h(available)} hours, a margin of "
            f"{_h(m_pes)} hours at the pessimistic edge."
        )
    if status == "pass" and open_span:
        status = "marginal"
        text += (
            " The longest spell touches the start or end of the chosen window, so it may be "
            "longer than shown: widen the window to confirm."
        )
    return CheckResult(
        cid,
        title,
        status,
        f"{text} {extra}".strip(),
        "h",
        available,
        band.nominal,
        band.high,
        m_nom,
        m_pes,
    )


def power_check(lander: Lander, a: Assessment) -> CheckResult:
    ds = dark_survival_margin(lander, a.longest_dark_hours)
    open_span = any(r[0].longest_dark_open for r in (a.pessimistic, a.nominal, a.optimistic))
    usable = usable_energy_wh(lander)
    extra = (
        f"Usable energy is {usable:.0f} Wh of {lander.battery_capacity_wh:.0f} Wh "
        f"({lander.reserve_fraction:.0%} reserve); the worst dark spell needs "
        f"{ds.energy_needed_wh.high:.0f} Wh at {lander.survival_load_w:g} W. "
        "Charging, battery ageing and temperature effects are not modelled."
    )
    return _spell_check(
        "power",
        "Power through the longest dark spell",
        a.longest_dark_hours,
        ds.survival_hours,
        open_span,
        "dark spell (Sun below the horizon)",
        "the usable battery lasts",
        extra,
    )


def communication_check(lander: Lander, a: Assessment) -> CheckResult:
    open_span = any(r[1].longest_outage_open for r in (a.pessimistic, a.nominal, a.optimistic))
    return _spell_check(
        "communication",
        "Direct-to-Earth outage",
        a.longest_outage_hours,
        lander.autonomy_without_earth_h,
        open_span,
        "Earth outage (no direct link)",
        "the lander can run without contact for",
        "Only line of sight to Earth is assessed, not link budget or antenna pointing.",
    )


def slope_check(lander: Lander, slope: SlopeEstimate | None, reason_missing: str) -> CheckResult:
    title = "Terrain slope"
    if lander.slope_limit_deg is None:
        return CheckResult(
            "terrain_slope",
            title,
            "not_assessed",
            "Not assessed: no slope limit was given for this lander.",
        )
    if slope is None:
        return CheckResult(
            "terrain_slope",
            title,
            "not_assessed",
            f"Not assessed: no slope data could be derived honestly for this site. "
            f"{reason_missing}",
        )
    lim, nom, pes = lander.slope_limit_deg, slope.max_slope_deg, slope.pessimistic_deg
    caveat = (
        f"The slope is a finite difference over {slope.baseline_m:.0f} m on a DEM with "
        f"{slope.native_resolution_m:.0f} m pixels; slope at scales finer than "
        f"{slope.baseline_m:.0f} m (a lander footprint) is not resolved, so steeper local ground "
        "may exist."
    )
    err = (
        f" Including the DEM height error ({slope.height_error_m:.1f} m) the steepest slope could "
        f"be {pes:.1f} degrees."
        if slope.slope_error_deg is not None
        else " The DEM height error is not available here, so there is no pessimistic edge."
    )
    base = (
        f"Steepest slope within {slope.patch_m:.0f} m of the site is {nom:.1f} degrees; "
        f"the limit is {lim:g} degrees."
    )
    if nom > lim:
        status: CheckStatus = "fail"
        text = f"{base} It exceeds the limit."
    elif pes > lim:
        status = "marginal"
        text = f"{base} It is inside the limit nominally but not at the error edge."
    else:
        status = "pass"
        text = f"{base} It is inside the limit."
    return CheckResult(
        "terrain_slope",
        title,
        status,
        f"{text}{err} {caveat}",
        "deg",
        lim,
        nom,
        pes,
        lim - nom,
        lim - pes,
    )


def thermal_check(lander: Lander) -> CheckResult:
    lim = ""
    if lander.min_survival_temp_c is not None or lander.max_survival_temp_c is not None:
        lim = (
            f" The survival limits given ({lander.min_survival_temp_c} to "
            f"{lander.max_survival_temp_c} degC) are echoed only."
        )
    return CheckResult(
        "thermal",
        "Thermal survival",
        "not_assessed",
        "Not assessed: there is no thermal model, so surface and lander temperatures are not "
        f"computed.{lim}",
    )


def mission_needs_check(a: Assessment, user_needs_given: bool) -> CheckResult:
    title = "Mission needs (sunlight and Earth share)"
    if not user_needs_given:
        return CheckResult(
            "mission_needs",
            title,
            "not_assessed",
            "Not assessed: no mission needs were given, and the placeholder criteria are not "
            "mission requirements.",
        )
    nominal, pess = a.verdicts[1], a.verdicts[0]
    if nominal == "not viable":
        status: CheckStatus = "fail"
    elif nominal == "viable" and pess == "viable":
        status = "pass"
    else:
        status = "marginal"
    return CheckResult(
        "mission_needs",
        title,
        status,
        f"Against the needs you gave, the nominal run is '{nominal}' and the pessimistic run is "
        f"'{pess}' (sunlight share {a.sun_share.nominal:.0%}, Earth share "
        f"{a.earth_share.nominal:.0%}).",
    )


def assess_lander(
    lander: Lander,
    a: Assessment,
    slope: SlopeEstimate | None,
    user_needs_given: bool,
    slope_missing_reason: str = "",
) -> Suitability:
    """Combine the checks. Terrain completeness is taken from `a`, exactly as /assess does."""
    checks = [
        power_check(lander, a),
        communication_check(lander, a),
        slope_check(lander, slope, slope_missing_reason),
        thermal_check(lander),
        mission_needs_check(a, user_needs_given),
    ]
    assessed = [c.status for c in checks if c.status != "not_assessed"]
    base: Literal["pass", "marginal", "fail"]
    if "fail" in assessed:
        base = "fail"
    elif "marginal" in assessed:
        base = "marginal"
    else:
        base = "pass"
    warnings: list[str] = []
    verdict: Verdict
    conclusive = True
    if a.terrain.complete or base == "fail":
        verdict = base
    else:
        # Missing relief can only shorten sunlight and the Earth link, so a failure stays a
        # failure, but nothing better than an upper bound can be claimed (as in verdict_state_of).
        verdict = "upper_bound_terrain_incomplete"
        conclusive = False
    if not a.terrain.complete:
        warnings.append(
            "Terrain data is incomplete for this site, so sunlight and Earth visibility are an "
            "upper bound: the real dark spells and outages can only be longer."
        )
    warnings.append(
        "No thermal model: temperature survival is not assessed. Planning tool, not for flight "
        "operations."
    )
    if lander.source == PLACEHOLDER_SOURCE:
        warnings.append(
            "The lander numbers are placeholders (pending-source), not a real spacecraft."
        )
    assumptions = [
        "Constant survival load during darkness; usable energy is capacity x (1 - reserve).",
        "A dark spell is a period with less than half of the Sun disc visible above the skyline.",
        "The pessimistic edge is the skyline raised by the error budget of the sensitivity band.",
        "array_power_w and the survival temperatures are echoed only: no charging or thermal "
        "model.",
    ]
    names = {"pass": "passes", "marginal": "is marginal", "fail": "fails"}
    if verdict == "upper_bound_terrain_incomplete":
        summary = (
            f"The assessed checks give '{base}' at best, but terrain data is incomplete, so this "
            "is an upper bound, not a confirmed result."
        )
    else:
        summary = f"This lander {names[base]} on the checks that could be assessed."
    return Suitability(verdict, conclusive, summary, checks, lander, warnings, assumptions)
