"""Shared by tests/test_golden.py and scripts/validate_golden.py (docs/04 section 8, item 8).

The golden case runs the REAL recorded Horizons Sun and Earth series for one polar point over three
days through the engine's visibility, event and metric code with a FIXED synthetic skyline (the real
DEM is not in git), plus a skyline cast over a FIXED synthetic DEM for the ray caster. Nothing
random, no network. Any change to the numbers is drift and needs an ADR.
"""

from __future__ import annotations

import hashlib
import json
from datetime import datetime
from pathlib import Path
from typing import Any

import httpx
import numpy as np
from lunar_engine import ENGINE_VERSION
from lunar_engine.ephemeris import HorizonsClient
from lunar_engine.ephemeris.client import EARTH, SUN, cache_key, observer_params
from lunar_engine.geometry import great_circle_destination
from lunar_engine.links import south_polar_xy
from lunar_engine.metrics import (
    AU_KM,
    BodySeries,
    both_up,
    earth_metrics,
    neither,
    sun_fraction_series,
    sun_metrics,
)
from lunar_engine.skyline import Skyline, cast_skyline
from lunar_engine.terrain import DemTile

HERE = Path(__file__).parent
CACHE = HERE / "fixtures" / "horizons_cache"
GOLDEN_PATH = HERE / "fixtures" / "golden" / "pole_3day.json"

SITE = {"lon_east_deg": 0.0, "lat_deg": -85.0, "alt_km": 0.0}
WINDOW = ("2026-12-01 00:00", "2026-12-04 00:00", "10m")
DEM_LAT, DEM_LON = -89.5, 40.0


def requests() -> dict[str, dict[str, str]]:
    a, b, step = WINDOW
    return {
        "sun": observer_params(SUN, SITE["lon_east_deg"], SITE["lat_deg"], 0.0, a, b, step),
        "earth": observer_params(EARTH, SITE["lon_east_deg"], SITE["lat_deg"], 0.0, a, b, step),
    }


def synthetic_skyline() -> Skyline:
    """A fixed wavy skyline (degrees), not terrain."""
    az = np.arange(0.0, 360.0, 0.25)
    el = 0.8 + 0.7 * np.sin(np.radians(3.0 * az)) + 0.5 * np.sin(np.radians(7.0 * az + 30.0))
    return Skyline(az, el, np.full(az.size, 16000.0), 16000.0, 1.0, 0.0, -0.0005)


def _series(client: HorizonsClient, params: dict[str, str]) -> tuple[BodySeries, dict[str, Any]]:
    table, prov = client.observer(params)
    rows = table.rows
    s = BodySeries(
        [r.time_utc for r in rows],
        np.array([r.azimuth_deg for r in rows], dtype=np.float64),
        np.array([r.elevation_deg for r in rows], dtype=np.float64),
        np.array([r.delta_au * AU_KM for r in rows], dtype=np.float64),  # type: ignore[operator]
    )
    payload = client.raw(params)
    return s, {
        "request_sha256": cache_key(params),
        "response_result_sha256": hashlib.sha256(payload["result"].encode()).hexdigest(),
        "api_version": prov["api_version"],
        "rows": len(rows),
        "frame": prov["frame_header"].get("Center pole/equ"),
    }


def _iso(t: datetime) -> str:
    return t.strftime("%Y-%m-%dT%H:%M:%SZ")


def _ivs(spans: list[Any]) -> list[list[str]]:
    return [[_iso(s.start_utc), _iso(s.end_utc)] for s in spans]


def _synthetic_dem_case() -> dict[str, Any]:
    """Ray caster on a fixed synthetic DEM: a 200 m cone 3 km east and a 120 m disc 2 km south."""
    half, px = 6000.0, 10.0
    sx, sy = south_polar_xy(DEM_LAT, DEM_LON)
    n = int(2 * half / px)
    cols = sx - half + (np.arange(n) + 0.5) * px
    rows = sy + half - (np.arange(n) + 0.5) * px
    xx, yy = np.meshgrid(cols, rows)
    la, lo = great_circle_destination(DEM_LAT, DEM_LON, 90.0, 3000.0)
    cx, cy = south_polar_xy(la, lo)
    cone = np.maximum(0.0, 200.0 * (1.0 - np.hypot(xx - cx, yy - cy) / 500.0))
    la, lo = great_circle_destination(DEM_LAT, DEM_LON, 180.0, 2000.0)
    dx, dy = south_polar_xy(la, lo)
    disc = np.where(np.hypot(xx - dx, yy - dy) <= 150.0, 120.0, 0.0)
    tile = DemTile((cone + disc).astype(np.float32), sx - half, sy + half, px, "synthetic-golden")
    sky = cast_skyline(tile, DEM_LAT, DEM_LON, 1.0, 5000.0, 1.0)
    pick = [0, 45, 90, 135, 180, 225, 270, 315]
    return {
        "description": "200 m cone 3 km east and 120 m disc 2 km south, 10 m pixels, eye 1 m",
        "azimuths_deg": pick,
        "skyline_deg": [round(float(sky.elevation_deg[a]), 6) for a in pick],
        "max_deg": round(float(sky.elevation_deg.max()), 6),
        "mean_deg": round(float(sky.elevation_deg.mean()), 6),
    }


def compute(client: HorizonsClient) -> dict[str, Any]:
    reqs = requests()
    sun, sun_in = _series(client, reqs["sun"])
    earth, earth_in = _series(client, reqs["earth"])
    sky = synthetic_skyline()
    sm = sun_metrics(sun, sky)
    em = earth_metrics(earth, sky)
    frac = sun_fraction_series(sun, sky)
    both = both_up(sm, em)
    none = neither(sm, em, sun.times[0], sun.times[-1])
    pick = list(range(0, len(sun.times), 36))
    return {
        "inputs": {"sun": sun_in, "earth": earth_in, "site": SITE, "window_utc": list(WINDOW)},
        "skyline": "synthetic wavy skyline, see golden_support.synthetic_skyline",
        "sun_metrics": {
            "sunlight_hours": sm.sunlight_hours,
            "visible_share": sm.visible_share,
            "longest_dark_hours": sm.longest_dark_hours,
            "elevation_min_deg": sm.elevation_min_deg,
            "elevation_mean_deg": sm.elevation_mean_deg,
            "elevation_max_deg": sm.elevation_max_deg,
            "power_horizontal_w_m2": sm.power_index_horizontal_w_m2,
            "power_tracking_w_m2": sm.power_index_tracking_w_m2,
            "sun_intervals": _ivs(sm.sun_intervals),
            "dark_intervals": _ivs(sm.dark_intervals),
        },
        "earth_metrics": {
            "visible_hours": em.visible_hours,
            "visible_share": em.visible_share,
            "longest_outage_hours": em.longest_outage_hours,
            "windows": _ivs(em.windows),
        },
        "combined": {"both_intervals": _ivs(both), "neither_intervals": _ivs(none)},
        "sun_fraction_samples": {
            "sample_indices": pick,
            "times_utc": [_iso(sun.times[i]) for i in pick],
            "fraction": [float(frac[i]) for i in pick],
        },
        "synthetic_dem_skyline": _synthetic_dem_case(),
    }


def make_client() -> HorizonsClient:
    def offline(request: httpx.Request) -> httpx.Response:
        raise AssertionError(f"fixture missing, would hit network: {request.url}")

    return HorizonsClient(cache_dir=CACHE, transport=httpx.MockTransport(offline))


def golden_document(client: HorizonsClient, adr: str, history: list[str]) -> dict[str, Any]:
    return {
        "schema": 1,
        "purpose": "docs/04 section 8 item 8. Drift in any value below needs an ADR.",
        "engine_version_when_recorded": ENGINE_VERSION,
        "adr": adr,
        "adr_history": history,
        "golden": compute(client),
    }


def load_golden() -> dict[str, Any]:
    out: dict[str, Any] = json.loads(GOLDEN_PATH.read_text(encoding="utf8"))
    return out
