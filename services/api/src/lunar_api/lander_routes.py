"""POST /api/v1/lander/assess: does a lander profile survive a site and window? (P6-02, #85).

The power and communication checks reuse the very same `assess_window` result as GET
/sites/{id}/assess, so the dark-spell and outage bands, the terrain completeness and the
upper-bound rule are the engine's, not reimplemented here. The slope check reads a small local
height grid (the terrain route's builder) and is `not_assessed` whenever no terrain covers the
site. There is no thermal model.
"""

from __future__ import annotations

import threading
from typing import Annotated, Any, Literal

from fastapi import APIRouter, Depends
from lunar_engine.compare import assess_window
from lunar_engine.lander import (
    Lander,
    SlopeEstimate,
    assess_lander,
    dark_survival_hours,
    slope_estimate,
    usable_energy_wh,
)
from lunar_engine.sensitivity import PLACEHOLDER_CRITERIA, Criteria
from pydantic import BaseModel, ConfigDict, Field, model_validator

from lunar_api.errors import ApiError
from lunar_api.routes import (
    ERRORS,
    MAX_HOURS,
    clean,
    criteria_echo,
    get_settings,
    get_store,
    provenance,
    site_or_404,
    terrain_warnings,
    window_args,
)
from lunar_api.schemas import Band, CriteriaOut, Provenance, TerrainOut
from lunar_api.settings import Settings
from lunar_api.store import SiteStore
from lunar_api.terrain_routes import build_terrain

router = APIRouter(prefix="/api/v1")

LABEL = "Planning tool, not for flight operations."
SLOPE_GRID_WINDOW_M = 500.0  # local height grid read for the slope check
SLOPE_PATCH_M = 200.0  # square around the site that the slope check examines
_SLOPE_CACHE: dict[tuple[str, str, str], tuple[SlopeEstimate | None, str]] = {}
_SLOPE_LOCK = threading.Lock()


class LanderIn(BaseModel):
    """Lander profile. Units and ranges mirror `lunar_engine.lander.LANDER_FIELDS`."""

    model_config = ConfigDict(allow_inf_nan=False)

    battery_capacity_wh: float = Field(ge=0, le=1e7, description="Battery energy, Wh.")
    reserve_fraction: float = Field(ge=0, le=1, description="Unused share of the capacity.")
    survival_load_w: float = Field(ge=0, le=1e6, description="Constant night load, W.")
    autonomy_without_earth_h: float = Field(
        ge=0, le=1e5, description="Longest run without Earth contact, h."
    )
    source: str = Field(
        min_length=1,
        max_length=200,
        description="Where these numbers come from, or a placeholder label.",
    )
    array_power_w: float | None = Field(
        default=None, ge=0, le=1e7, description="Echoed only, no charging model."
    )
    slope_limit_deg: float | None = Field(
        default=None, ge=0, le=90, description="Enables the slope check."
    )
    min_survival_temp_c: float | None = Field(
        default=None, ge=-273.15, le=1000, description="Echoed only, no thermal model."
    )
    max_survival_temp_c: float | None = Field(
        default=None, ge=-273.15, le=1000, description="Echoed only, no thermal model."
    )

    @model_validator(mode="after")
    def _consistent(self) -> LanderIn:
        if not self.source.strip():
            raise ValueError("source must say where the lander numbers come from")
        lo, hi = self.min_survival_temp_c, self.max_survival_temp_c
        if lo is not None and hi is not None and lo > hi:
            raise ValueError("min_survival_temp_c must not exceed max_survival_temp_c")
        return self

    def build(self) -> Lander:
        return Lander(**self.model_dump())


class MissionNeedsIn(BaseModel):
    """Same names and meaning as the optional query parameters of GET /sites/{id}/assess."""

    model_config = ConfigDict(allow_inf_nan=False)

    min_sun_fraction: float | None = Field(default=None, ge=0, le=1)
    max_dark_hours: float | None = Field(default=None, ge=0, le=MAX_HOURS)
    min_earth_fraction: float | None = Field(default=None, ge=0, le=1)
    max_outage_hours: float | None = Field(default=None, ge=0, le=MAX_HOURS)


class LanderAssessIn(BaseModel):
    site_id: str = Field(min_length=1, max_length=64)
    start: str
    end: str
    lander: LanderIn
    mission_needs: MissionNeedsIn | None = None


class CheckOut(BaseModel):
    id: Literal["power", "communication", "terrain_slope", "thermal", "mission_needs"]
    title: str
    status: Literal["pass", "marginal", "fail", "not_assessed"]
    reasoning: str
    unit: str | None
    available: float | None
    required_nominal: float | None
    required_pessimistic: float | None
    margin_nominal: float | None
    margin_pessimistic: float | None


class LanderEcho(LanderIn):
    usable_energy_wh: float
    dark_survival_hours: float | None


class SlopeOut(BaseModel):
    max_slope_deg: float
    mean_slope_deg: float
    pessimistic_deg: float
    slope_error_deg: float | None
    baseline_m: float
    patch_m: float
    valid_fraction: float
    native_resolution_m: float
    height_error_m: float | None


class LanderAssessOut(BaseModel):
    site_id: str
    start_utc: str
    end_utc: str
    verdict: Literal["pass", "marginal", "fail", "upper_bound_terrain_incomplete"]
    conclusive: bool
    summary: str
    checks: list[CheckOut]
    lander: LanderEcho
    terrain: TerrainOut
    band_basis: list[str]
    longest_dark_hours: Band
    longest_outage_hours: Band
    slope: SlopeOut | None
    mission_needs: CriteriaOut
    warnings: list[str]
    assumptions: list[str]
    label: str
    provenance: Provenance


def _criteria(needs: MissionNeedsIn | None) -> tuple[Criteria, bool]:
    asked = needs.model_dump() if needs else {}
    user_chosen = any(v is not None for v in asked.values())
    base = PLACEHOLDER_CRITERIA

    def pick(key: str, default: float) -> float:
        v = asked.get(key)
        return default if v is None else float(v)

    status = base.status
    if user_chosen:
        status = "user-chosen mission needs for this request" + (
            "; fields not given use the pending-source placeholder defaults"
            if any(v is None for v in asked.values())
            else ""
        )
    return (
        Criteria(
            pick("min_sun_fraction", base.min_sun_share),
            pick("max_dark_hours", base.max_dark_hours),
            pick("min_earth_fraction", base.min_earth_share),
            pick("max_outage_hours", base.max_outage_hours),
            status=status,
        ),
        user_chosen,
    )


def _slope_for(
    settings: Settings, site_id: str, meta: dict[str, Any]
) -> tuple[SlopeEstimate | None, str]:
    """Slope from the local height grid, or (None, why not). Never guessed."""
    if meta.get("terrain_unavailable"):
        return None, "No terrain data covers this site."
    key = (site_id, str(settings.dem_dir), str(settings.far_dir))
    with _SLOPE_LOCK:
        hit = _SLOPE_CACHE.get(key)
    if hit is not None:
        return hit
    try:
        body = build_terrain(
            settings, site_id, meta["lat_deg"], meta["lon_east_deg"], SLOPE_GRID_WINDOW_M, 128
        )
    except (ValueError, OSError):
        return None, "The elevation data for this site could not be read."
    if body is None:
        out: tuple[SlopeEstimate | None, str] = (
            None,
            "No elevation data covers this site's surroundings.",
        )
    else:
        import numpy as np

        heights = np.array(
            [np.nan if v is None else v for v in body["heights_m"]], dtype=float
        ).reshape(body["rows"], body["cols"])
        est = slope_estimate(
            heights,
            body["spacing_m"],
            SLOPE_PATCH_M,
            body["native_resolution_m"],
            body["height_error_m"],
        )
        out = (
            (est, "")
            if est is not None
            else (None, "Too much of the height grid around the site has no data.")
        )
    with _SLOPE_LOCK:
        if len(_SLOPE_CACHE) >= 16:
            _SLOPE_CACHE.pop(next(iter(_SLOPE_CACHE)))
        _SLOPE_CACHE[key] = out
    return out


@router.post("/lander/assess", response_model=LanderAssessOut, responses=ERRORS)
def post_lander_assess(
    body: LanderAssessIn,
    store: Annotated[SiteStore, Depends(get_store)],
    settings: Annotated[Settings, Depends(get_settings)],
) -> dict[str, Any]:
    site, meta = site_or_404(store, body.site_id)
    a, b = window_args(site, body.start, body.end, settings)
    try:
        lander = body.lander.build()
    except ValueError as exc:
        raise ApiError(
            422, "Invalid input", str(exc), "validation", [{"field": "lander", "message": str(exc)}]
        ) from exc
    criteria, user_needs = _criteria(body.mission_needs)
    res = assess_window(site, a, b, criteria)
    slope, why = _slope_for(settings, body.site_id, meta)
    suit = assess_lander(lander, res, slope, user_needs, why)
    t = res.terrain
    warnings = terrain_warnings(meta) + [
        w for w in suit.warnings if w not in terrain_warnings(meta)
    ]
    out = {
        "site_id": body.site_id,
        "start_utc": a,
        "end_utc": b,
        "verdict": suit.verdict,
        "conclusive": suit.conclusive,
        "summary": suit.summary,
        "checks": [c.__dict__ for c in suit.checks],
        "lander": {
            **body.lander.model_dump(),
            "usable_energy_wh": usable_energy_wh(lander),
            "dark_survival_hours": dark_survival_hours(lander),
        },
        "terrain": {
            "available": t.available,
            "complete": t.complete,
            "reach_km_min": t.reach_km_min,
            "reach_km_median": t.reach_km_median,
            "reach_km_max": t.reach_km_max,
            "required_km": t.required_km,
            "covered_fraction": t.covered_fraction,
        },
        "band_basis": res.band_basis,
        "longest_dark_hours": _band(res.longest_dark_hours),
        "longest_outage_hours": _band(res.longest_outage_hours),
        "slope": None
        if slope is None
        else {**slope.__dict__, "pessimistic_deg": slope.pessimistic_deg},
        "mission_needs": criteria_echo(criteria, user_needs),
        "warnings": warnings,
        "assumptions": suit.assumptions + res.assumptions,
        "label": LABEL,
        "provenance": provenance(
            meta,
            {
                "site_id": body.site_id,
                "start": a,
                "end": b,
                "lander": body.lander.model_dump(),
                "mission_needs": body.mission_needs.model_dump() if body.mission_needs else None,
            },
            suit.assumptions,
        ),
    }
    return clean(out)


def _band(b: Any) -> dict[str, float]:
    return {"low": b.low, "nominal": b.nominal, "high": b.high}
