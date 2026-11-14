"""Public read-only routes backed by precomputed bundles (P3-03, docs/05).

Every response carries a `provenance` block. Numbers that cannot be computed are null with a
reason, never NaN. Limits come from `Settings`.
"""

from __future__ import annotations

import json
import math
from datetime import UTC, datetime, timedelta
from pathlib import Path
from typing import Annotated, Any

from fastapi import APIRouter, Depends, Query, Request
from lunar_engine import ENGINE_VERSION
from lunar_engine.compare import SiteSky, assess_window, compare, deltas, slip_matrix
from lunar_engine.events import HermiteSeries, Interval, find_events, time_remaining
from lunar_engine.links import quickmap_link
from lunar_engine.metrics import sun_fraction_series
from lunar_engine.sensitivity import PLACEHOLDER_CRITERIA, Assessment, Criteria
from pydantic import BaseModel, Field, field_validator

from lunar_api.errors import ApiError
from lunar_api.schemas import (
    AssessOut,
    AttributionOut,
    CompareOut,
    Problem,
    QuickmapOut,
    RegistryRow,
    SiteDetail,
    SiteList,
    SkylineOut,
    SlipOut,
    StateOut,
    TimelineOut,
)
from lunar_api.settings import Settings
from lunar_api.store import SiteStore

router = APIRouter(prefix="/api/v1")
ERRORS: dict[int | str, dict[str, Any]] = {
    404: {"model": Problem, "description": "Not found"},
    422: {"model": Problem, "description": "Invalid input"},
}


def get_settings() -> Settings:
    return Settings.from_env()


def get_store(settings: Annotated[Settings, Depends(get_settings)]) -> SiteStore:
    return SiteStore(settings.data_dir)


# ---- helpers ----------------------------------------------------------------------------------


def _clean(x: Any) -> Any:
    """Make a value JSON safe: NaN and infinity become null."""
    if isinstance(x, float):
        return x if math.isfinite(x) else None
    if isinstance(x, dict):
        return {k: _clean(v) for k, v in x.items()}
    if isinstance(x, (list, tuple)):
        return [_clean(v) for v in x]
    if isinstance(x, datetime):
        return x.astimezone(UTC).strftime("%Y-%m-%dT%H:%M:%SZ")
    return x


def clean(x: dict[str, Any]) -> dict[str, Any]:
    """JSON-safe copy: NaN and infinity become null, times become Z strings."""
    out: dict[str, Any] = _clean(x)
    return out


def parse_utc(text: str, field: str) -> datetime:
    try:
        t = datetime.fromisoformat(text.replace("Z", "+00:00"))
    except ValueError as exc:
        raise ApiError(
            422,
            "Invalid input",
            f"{field} is not an ISO 8601 time.",
            "validation",
            [{"field": field, "message": "expected e.g. 2026-12-01T00:00:00Z"}],
        ) from exc
    return t.replace(tzinfo=UTC) if t.tzinfo is None else t.astimezone(UTC)


def provenance(
    meta: dict[str, Any], inputs: dict[str, Any], assumptions: list[str]
) -> dict[str, Any]:
    return {
        "sources": [
            {
                "id": "horizons",
                "url": "https://ssd.jpl.nasa.gov/horizons/",
                "retrieved_at": meta["built_at_utc"],
                "version": ",".join(meta["horizons"]["sun"]["api_versions"]),
            },
            {
                "id": "lola-dem",
                "url": "https://pgda.gsfc.nasa.gov/products/78",
                "retrieved_at": None,
                "version": meta["dem"].get("file"),
            },
        ],
        "engine_version": ENGINE_VERSION,
        "frame_note": "Horizons MEAN_ME frame and PGDA MOON_ME DEM treated as equal; "
        "up to about 0.03 degrees of orientation uncertainty is assumed.",
        "assumptions": list(meta.get("assumptions", [])) + assumptions,
        "uncertainty": {
            "skyline_deg": 0.2,
            "frame_deg": 0.03,
            "status": "assumed, not yet measured",
        },
        "reproduce": {
            "inputs": inputs,
            "data_versions": {
                "dem_sha256": meta["dem"].get("sha256"),
                "built_at_utc": meta["built_at_utc"],
                "horizons_request_sha256": meta["horizons"]["sun"]["request_sha256"][:1],
            },
        },
    }


def site_or_404(store: SiteStore, site_id: str) -> tuple[SiteSky, dict[str, Any]]:
    try:
        return store.get(site_id)
    except KeyError as exc:
        raise ApiError(
            404, "Site not found", f"No precomputed site '{site_id}'.", "site-not-found"
        ) from exc


def spans_json(spans: list[Interval]) -> list[dict[str, Any]]:
    return [
        {"start": s.start_utc, "end": s.end_utc, "open_start": s.open_start, "open_end": s.open_end}
        for s in spans
    ]


def seconds(d: timedelta | None) -> int | None:
    return None if d is None else int(d.total_seconds())


def band(b: Any) -> dict[str, float]:
    return {"low": b.low, "nominal": b.nominal, "high": b.high}


def assessment_json(a: Assessment) -> dict[str, Any]:
    return {
        "verdict": a.nominal_verdict,
        "verdict_by_run": {
            "pessimistic": a.verdicts[0],
            "nominal": a.verdicts[1],
            "optimistic": a.verdicts[2],
        },
        "robust": a.robust,
        "delta_deg": a.delta_deg,
        "criteria_status": a.criteria_status,
        "sunlight_hours": band(a.sunlight_hours),
        "sun_share": band(a.sun_share),
        "earth_share": band(a.earth_share),
        "longest_dark_hours": band(a.longest_dark_hours),
        "longest_outage_hours": band(a.longest_outage_hours),
        "elevation_deg": {
            "min": a.nominal[0].elevation_min_deg,
            "mean": a.nominal[0].elevation_mean_deg,
            "max": a.nominal[0].elevation_max_deg,
        },
        "power_index_w_m2": {
            "horizontal": a.nominal[0].power_index_horizontal_w_m2,
            "tracking": a.nominal[0].power_index_tracking_w_m2,
        },
        "assumptions": a.assumptions,
    }


def window_args(
    site: SiteSky, start: str, end: str, settings: Settings
) -> tuple[datetime, datetime]:
    a, b = parse_utc(start, "start"), parse_utc(end, "end")
    if b <= a:
        raise ApiError(
            422,
            "Invalid window",
            "end must be after start.",
            "validation",
            [{"field": "end", "message": "must be after start"}],
        )
    if b - a > timedelta(days=settings.max_window_days):
        raise ApiError(
            422,
            "Window too long",
            f"At most {settings.max_window_days} days per request.",
            "window-too-long",
            [{"field": "end", "message": "window too long"}],
        )
    if a < site.sun.times[0] or b > site.sun.times[-1]:
        raise ApiError(
            422,
            "Outside precomputed coverage",
            f"This site is precomputed from {site.sun.times[0]:%Y-%m-%dT%H:%MZ} to "
            f"{site.sun.times[-1]:%Y-%m-%dT%H:%MZ}.",
            "outside-coverage",
            [{"field": "start", "message": "outside coverage"}],
        )
    return a, b


class CriteriaIn(BaseModel):
    min_sun_share: float = Field(ge=0, le=1)
    max_dark_hours: float = Field(ge=0)
    min_earth_share: float = Field(ge=0, le=1)
    max_outage_hours: float = Field(ge=0)

    def build(self) -> Criteria:
        return Criteria(
            self.min_sun_share,
            self.max_dark_hours,
            self.min_earth_share,
            self.max_outage_hours,
            status="user-supplied for this request",
        )


def criteria_of(c: CriteriaIn | None) -> Criteria:
    return c.build() if c else PLACEHOLDER_CRITERIA


# ---- sites ------------------------------------------------------------------------------------


@router.get("/sites", response_model=SiteList, responses=ERRORS)
def list_sites(store: Annotated[SiteStore, Depends(get_store)]) -> dict[str, Any]:
    items = []
    for sid in store.ids():
        m = store.meta(sid)
        items.append(
            {
                "id": sid,
                "lat_deg": m["lat_deg"],
                "lon_east_deg": m["lon_east_deg"],
                "coordinate_status": "derived-tile-centre",
                "window": m["window"],
                "built_at_utc": m["built_at_utc"],
                "terrain_coverage": {
                    "covered_fraction": m["skyline"]["covered_fraction"],
                    "min_reach_m": m["skyline"]["min_reach_m"],
                    "max_reach_m": m["skyline"]["max_reach_m"],
                },
            }
        )
    return clean(
        {"count": len(items), "sites": items, "notice": "Planning tool, not for flight operations."}
    )


@router.get("/sites/{site_id}", response_model=SiteDetail, responses=ERRORS)
def get_site(site_id: str, store: Annotated[SiteStore, Depends(get_store)]) -> dict[str, Any]:
    _, meta = site_or_404(store, site_id)
    return clean({**meta, "quickmap": quickmap_link(meta["lat_deg"], meta["lon_east_deg"])})


@router.get("/sites/{site_id}/skyline", response_model=SkylineOut, responses=ERRORS)
def get_skyline(
    site_id: str,
    store: Annotated[SiteStore, Depends(get_store)],
    step_deg: Annotated[float, Query(ge=0.25, le=10.0)] = 1.0,
) -> dict[str, Any]:
    site, meta = site_or_404(store, site_id)
    sky = site.skyline
    stored_step = float(sky.azimuth_deg[1] - sky.azimuth_deg[0])  # the bundle's own step, not 0.25
    stride = max(1, round(step_deg / stored_step))
    az = sky.azimuth_deg[::stride]
    return clean(
        {
            "site_id": site_id,
            "eye_height_m": sky.eye_height_m,
            "azimuth_step_deg": float(az[1] - az[0]) if len(az) > 1 else stored_step,
            "azimuth_deg": [float(v) for v in az],
            "elevation_deg": [round(float(v), 4) for v in sky.elevation_deg[::stride]],
            "reach_m": [round(float(v)) for v in sky.reach_m[::stride]],
            "requested_range_m": sky.max_range_m,
            "covered_fraction": sky.covered_fraction(),
            "coverage_note": "Where reach_m is below requested_range_m the DEM ended; "
            "terrain beyond "
            "is unknown and the real skyline can only be higher.",
            "provenance": provenance(meta, {"site_id": site_id, "step_deg": step_deg}, []),
        }
    )


@router.get("/sites/{site_id}/assess", response_model=AssessOut, responses=ERRORS)
def get_assess(
    request: Request,
    site_id: str,
    start: str,
    end: str,
    store: Annotated[SiteStore, Depends(get_store)],
    settings: Annotated[Settings, Depends(get_settings)],
) -> dict[str, Any]:
    site, meta = site_or_404(store, site_id)
    a, b = window_args(site, start, end, settings)
    res = assess_window(site, a, b)
    return clean(
        {
            "site_id": site_id,
            "start_utc": a,
            "end_utc": b,
            **assessment_json(res),
            "provenance": provenance(meta, {"site_id": site_id, "start": a, "end": b}, []),
        }
    )


@router.get("/sites/{site_id}/timeline", response_model=TimelineOut, responses=ERRORS)
def get_timeline(
    site_id: str,
    start: str,
    end: str,
    store: Annotated[SiteStore, Depends(get_store)],
    settings: Annotated[Settings, Depends(get_settings)],
    step_min: Annotated[int, Query(ge=10, le=60)] = 10,
) -> dict[str, Any]:
    site, meta = site_or_404(store, site_id)
    a, b = window_args(site, start, end, settings)
    if step_min % 10 != 0:
        raise ApiError(
            422,
            "Invalid step",
            "step_min must be a multiple of 10 (the stored step).",
            "validation",
            [{"field": "step_min", "message": "multiple of 10"}],
        )
    idx = [i for i, t in enumerate(site.sun.times) if a <= t <= b][:: step_min // 10]
    frac = sun_fraction_series(site.sun, site.skyline)
    sky_at_earth = site.skyline.at_array(site.earth.azimuth_deg)
    res = assess_window(site, a, b)
    rows = [
        {
            "t": site.sun.times[i],
            "sun": {
                "az_deg": float(site.sun.azimuth_deg[i]),
                "el_deg": float(site.sun.elevation_deg[i]),
                "visible_fraction": float(frac[i]),
            },
            "earth": {
                "az_deg": float(site.earth.azimuth_deg[i]),
                "el_deg": float(site.earth.elevation_deg[i]),
                "margin_deg": float(site.earth.elevation_deg[i] - sky_at_earth[i]),
            },
        }
        for i in idx
    ]
    return clean(
        {
            "site_id": site_id,
            "start_utc": a,
            "end_utc": b,
            "step_min": step_min,
            "count": len(rows),
            "series": rows,
            "sun_intervals": spans_json(res.nominal[0].sun_intervals),
            "dark_intervals": spans_json(res.nominal[0].dark_intervals),
            "earth_windows": spans_json(res.nominal[1].windows),
            "earth_outages": spans_json(res.nominal[1].outages),
            "metrics": assessment_json(res),
            "provenance": provenance(
                meta, {"site_id": site_id, "start": a, "end": b, "step_min": step_min}, []
            ),
        }
    )


@router.get("/sites/{site_id}/state", response_model=StateOut, responses=ERRORS)
def get_state(
    site_id: str, t: str, store: Annotated[SiteStore, Depends(get_store)]
) -> dict[str, Any]:
    site, meta = site_or_404(store, site_id)
    now = parse_utc(t, "t")
    if now < site.sun.times[0] or now > site.sun.times[-1]:
        raise ApiError(
            422,
            "Outside precomputed coverage",
            "t is outside the precomputed window.",
            "outside-coverage",
            [{"field": "t", "message": "outside coverage"}],
        )
    frac = HermiteSeries(site.sun.times, sun_fraction_series(site.sun, site.skyline))
    margin = HermiteSeries(
        site.earth.times, site.earth.elevation_deg - site.skyline.at_array(site.earth.azimuth_deg)
    )
    sun_now, earth_now = frac.at(now), margin.at(now)
    sun_events = find_events(frac, 0.5)
    earth_events = find_events(margin, 0.0)
    left_sun = time_remaining(now, sun_events, "set")
    left_earth = time_remaining(now, earth_events, "set")
    sunrise = time_remaining(now, sun_events, "rise")
    earthrise = time_remaining(now, earth_events, "rise")
    return clean(
        {
            "site_id": site_id,
            "t": now,
            "sun": {
                "visible_fraction": min(max(sun_now, 0.0), 1.0),
                "up": sun_now >= 0.5,
                "seconds_to_sunset": seconds(left_sun) if sun_now >= 0.5 else None,
                "seconds_to_sunrise": seconds(sunrise) if sun_now < 0.5 else None,
                "note_if_null": "no such event before the end of the precomputed window",
            },
            "earth": {
                "margin_deg": earth_now,
                "link_available": earth_now >= 0.0,
                "seconds_to_earthset": seconds(left_earth) if earth_now >= 0.0 else None,
                "seconds_to_earthrise": seconds(earthrise) if earth_now < 0.0 else None,
            },
            "definitions": [
                "sunset: visible Sun fraction falls below 0.5 (disc centre on the skyline)",
                "earthset: Earth disc centre drops below the skyline",
            ],
            "provenance": provenance(meta, {"site_id": site_id, "t": now}, []),
        }
    )


# ---- compare and slip matrix ------------------------------------------------------------------


class WindowIn(BaseModel):
    start: str
    end: str


class CompareIn(BaseModel):
    sites: list[str] = Field(min_length=1)
    windows: list[WindowIn] = Field(min_length=1, max_length=8)
    criteria: CriteriaIn | None = None

    @field_validator("sites")
    @classmethod
    def _unique(cls, v: list[str]) -> list[str]:
        if len(set(v)) != len(v):
            raise ValueError("site ids must be unique")
        return v


@router.post("/compare", response_model=CompareOut, responses=ERRORS)
def post_compare(
    body: CompareIn,
    store: Annotated[SiteStore, Depends(get_store)],
    settings: Annotated[Settings, Depends(get_settings)],
) -> dict[str, Any]:
    if len(body.sites) > settings.max_compare_sites:
        raise ApiError(
            422,
            "Too many sites",
            f"At most {settings.max_compare_sites} sites.",
            "too-many-sites",
            [{"field": "sites", "message": "too many"}],
        )
    loaded = [site_or_404(store, s) for s in body.sites]
    wins = []
    for w in body.windows:
        a = parse_utc(w.start, "windows.start")
        b = parse_utc(w.end, "windows.end")
        wins.append((a, b))
    for site, _ in loaded:
        for a, b in wins:
            window_args(site, a.isoformat(), b.isoformat(), settings)
    rows = compare([s for s, _ in loaded], wins, criteria_of(body.criteria))
    out_rows = [
        {
            "site_id": r.site_id,
            "window_index": r.window_index,
            "start_utc": r.start_utc,
            "end_utc": r.end_utc,
            **assessment_json(r.assessment),
        }
        for r in rows
    ]
    pairwise = []
    if len(body.sites) == 2:
        for wi in range(len(wins)):
            ra = next(r for r in rows if r.site_id == body.sites[0] and r.window_index == wi)
            rb = next(r for r in rows if r.site_id == body.sites[1] and r.window_index == wi)
            pairwise.append(
                {
                    "window_index": wi,
                    "b_minus_a": [
                        {
                            "metric": d.metric,
                            "a": d.a,
                            "b": d.b,
                            "difference": d.difference,
                            "better": d.better,
                        }
                        for d in deltas(ra.assessment, rb.assessment)
                    ],
                }
            )
    return clean(
        {
            "rows": out_rows,
            "pairwise": pairwise,
            "provenance": provenance(loaded[0][1], body.model_dump(), []),
        }
    )


class SlipIn(BaseModel):
    sites: list[str] = Field(min_length=1)
    start: str
    offsets_days: list[float] = Field(min_length=1, max_length=40)
    duration_days: float = Field(gt=0, le=400)
    criteria: CriteriaIn | None = None


@router.post("/slip-matrix", response_model=SlipOut, responses=ERRORS)
def post_slip(
    body: SlipIn,
    store: Annotated[SiteStore, Depends(get_store)],
    settings: Annotated[Settings, Depends(get_settings)],
) -> dict[str, Any]:
    if len(body.sites) > settings.max_compare_sites:
        raise ApiError(
            422,
            "Too many sites",
            f"At most {settings.max_compare_sites} sites.",
            "too-many-sites",
            [{"field": "sites", "message": "too many"}],
        )
    loaded = [site_or_404(store, s) for s in body.sites]
    start = parse_utc(body.start, "start")
    for site, _ in loaded:
        for off in body.offsets_days:
            a = start + timedelta(days=off)
            window_args(
                site, a.isoformat(), (a + timedelta(days=body.duration_days)).isoformat(), settings
            )
    grid = slip_matrix(
        [s for s, _ in loaded],
        start,
        body.offsets_days,
        body.duration_days,
        criteria_of(body.criteria),
    )
    return clean(
        {
            "sites": body.sites,
            "offsets_days": body.offsets_days,
            "cells": [
                [
                    {
                        "offset_days": c.offset_days,
                        "start_utc": c.start_utc,
                        "end_utc": c.end_utc,
                        "verdict": c.verdict,
                        "glyph": c.glyph,
                        "robust": c.robust,
                        "sunlight_hours": c.sunlight_hours,
                        "earth_share": c.earth_share,
                    }
                    for c in row
                ]
                for row in grid
            ],
            "provenance": provenance(loaded[0][1], body.model_dump(), []),
        }
    )


@router.get("/links/quickmap", response_model=QuickmapOut, responses=ERRORS)
def get_quickmap(
    store: Annotated[SiteStore, Depends(get_store)],
    site: str,
    t: str | None = None,
    shadows: bool = False,
) -> dict[str, Any]:
    _, meta = site_or_404(store, site)
    when = parse_utc(t, "t").strftime("%Y-%m-%dT%H:%M:%SZ") if t else None
    return {
        "site_id": site,
        "url": quickmap_link(
            meta["lat_deg"], meta["lon_east_deg"], time_utc=when, show_shadows=shadows
        ),
        "note": "Opens the public QuickMap viewer. The coordinates are a derived tile centre.",
    }


# ---- attribution ------------------------------------------------------------------------------

ATTRIBUTION_PATHS = (
    Path(__file__).resolve().parents[4] / "data" / "attribution.json",  # repository checkout
    Path("/opt/lunar/current/data/attribution.json"),  # deployed release
)


def load_attribution() -> dict[str, Any]:
    for p in ATTRIBUTION_PATHS:
        if p.exists():
            doc: dict[str, Any] = json.loads(p.read_text(encoding="utf8"))
            return doc
    raise ApiError(
        503,
        "Attribution unavailable",
        "The credits file is missing on this server.",
        "attribution-missing",
    )


@router.get("/attribution", response_model=AttributionOut, responses=ERRORS)
def get_attribution() -> dict[str, Any]:
    doc = load_attribution()
    credits = [
        {
            "id": s["id"],
            "name": s["name"],
            "publisher": s["publisher"],
            "url": s["url"],
            "credit": s["citation"],
            "usage_statement": s["usage_statement"],
            "retrieved_at": s["retrieved_at"],
            "terms_confirmed": "pending-source" not in s["usage_statement"],
        }
        for s in doc["sources"]
    ]
    return {
        "notice": doc["notice"],
        "count": len(credits),
        "unconfirmed_terms": [c["id"] for c in credits if not c["terms_confirmed"]],
        "sources": credits,
        "software": "Third party software licences are listed in THIRD_PARTY_LICENSES.",
    }


@router.get("/attribution/{source_id}", response_model=RegistryRow, responses=ERRORS)
def get_attribution_one(source_id: str) -> dict[str, Any]:
    for s in load_attribution()["sources"]:
        if s["id"] == source_id:
            return dict(s)
    raise ApiError(
        404, "Source not found", f"No attribution entry '{source_id}'.", "source-not-found"
    )
