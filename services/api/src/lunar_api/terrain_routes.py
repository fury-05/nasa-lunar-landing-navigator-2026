"""GET /sites/{site_id}/terrain: a small local height grid for the 3D view (issue #77, P5-01).

Reads only a window around the site from the best available tier (site tile, 5 m mosaic, 20 m
LDEM, in that order per sample) and downsamples to at most 128 x 128. Heights are returned as
stored in the DEM, metres above the reference sphere. A cell with no data in any tier is null, never
filled. When no terrain covers the site the answer is a 404 problem document.
"""

from __future__ import annotations

import threading
from typing import Annotated, Any

import numpy as np
from fastapi import APIRouter, Depends, Query
from lunar_engine.far_data import load_far_tiers
from lunar_engine.links import south_polar_xy
from lunar_engine.local_terrain import LocalGrid, local_grid, local_xy, sample_array
from lunar_engine.terrain import DemTile, read_window

from lunar_api.errors import ApiError
from lunar_api.jobs import find_tile
from lunar_api.routes import ERRORS, clean, get_settings, get_store, provenance, site_or_404
from lunar_api.schemas import TerrainTileOut
from lunar_api.settings import Settings
from lunar_api.store import SiteStore

router = APIRouter(prefix="/api/v1")

READ_HALF_M = 3_500.0  # covers the rotated 4 km square (half diagonal 2.83 km) plus a margin
_CACHE: dict[tuple[str, float, int], dict[str, Any]] = {}
_CACHE_LOCK = threading.Lock()
_CACHE_MAX = 16


def _median(tile: DemTile | None, grid_xy: tuple[Any, Any]) -> float | None:
    if tile is None:
        return None
    v = sample_array(tile, grid_xy[0], grid_xy[1])
    v = v[np.isfinite(v)]
    return float(np.median(v)) if v.size else None


def build_terrain(
    settings: Settings, site_id: str, lat: float, lon: float, window_m: float, max_n: int
) -> dict[str, Any] | None:
    """The response body (without provenance) or None when no terrain covers the site."""
    cx, cy = south_polar_xy(lat, lon)
    site_tile = None
    tile_path = find_tile(settings.dem_dir, lat, lon)
    if tile_path is not None:
        try:
            site_tile = read_window(tile_path, cx, cy, READ_HALF_M)
        except ValueError:
            site_tile = None
    far = load_far_tiers(
        settings.far_dir,
        site_tile,
        lat,
        lon,
        max_range_m=READ_HALF_M - 1_000.0,
        mosaic_half_m=READ_HALF_M,
        err_reduce=1,
    )
    grid: LocalGrid | None = local_grid(far.tiers, lat, lon, window_m, max_n)
    if grid is None:
        return None
    off = (np.arange(grid.rows) - (grid.rows - 1) / 2.0) * grid.spacing_m
    east, north = np.meshgrid(off, -off)
    xy = local_xy(lat, lon, east, north)
    err_m = _median(far.err, xy)
    twenty = [t for t in far.tiers if t.name == "ldem-20m"]
    interpolated: float | None = None
    basis = "not available: no EFFRES product covers the tier that supplied this grid"
    if far.effres is not None and twenty and grid.native_resolution_m == twenty[0].tile.pixel_m:
        e = sample_array(far.effres, xy[0], xy[1])
        e = e[np.isfinite(e)]
        if e.size:
            interpolated = float(np.mean(e > far.effres.pixel_m))
            basis = (
                "share of samples whose effective resolution (EFFRES product) is coarser than "
                f"the {far.effres.pixel_m:.0f} m pixel, so the value is smoothed or interpolated"
            )
    h = grid.heights_m
    return {
        "site_id": site_id,
        "rows": grid.rows,
        "cols": grid.cols,
        "spacing_m": grid.spacing_m,
        "window_m": window_m,
        "native_resolution_m": grid.native_resolution_m,
        "interpolated_fraction": interpolated,
        "interpolated_basis": basis,
        "height_error_m": err_m,
        "height_error_basis": (
            "median over the window of the ERR product (LDEM surface height error, metres)"
            if err_m is not None
            else "not available: no ERR product covers this site"
        ),
        "finite_fraction": grid.finite_fraction,
        "heights_m": [None if not np.isfinite(v) else round(float(v), 3) for v in h.ravel()],
        "centre": {"lat_deg": lat, "lon_east_deg": lon},
        "tier_share": grid.tier_share,
        "source": "NASA GSFC PGDA LOLA DEMs ("
        + ", ".join(sorted(set(far.files)) or ["site tile"])
        + "); last-resort source, ADR-0003 and ADR-0007",
        "_files": far.files,
    }


@router.get("/sites/{site_id}/terrain", response_model=TerrainTileOut, responses=ERRORS)
def get_terrain(
    site_id: str,
    store: Annotated[SiteStore, Depends(get_store)],
    settings: Annotated[Settings, Depends(get_settings)],
    window_m: Annotated[float, Query(ge=500.0, le=8000.0)] = 4000.0,
    max_n: Annotated[int, Query(ge=16, le=128)] = 128,
) -> dict[str, Any]:
    _, meta = site_or_404(store, site_id)
    key = (site_id, window_m, max_n)
    sig = (str(settings.dem_dir), str(settings.far_dir))
    with _CACHE_LOCK:
        hit = _CACHE.get(key)
    if hit is not None and hit["sig"] == sig:
        body = hit["body"]
    else:
        body = build_terrain(
            settings, site_id, meta["lat_deg"], meta["lon_east_deg"], window_m, max_n
        )
        if body is None:
            raise ApiError(
                404,
                "Terrain unavailable",
                f"No elevation data covers site '{site_id}'. No terrain is invented.",
                "terrain-unavailable",
            )
        with _CACHE_LOCK:
            if len(_CACHE) >= _CACHE_MAX:
                _CACHE.pop(next(iter(_CACHE)))
            _CACHE[key] = {"sig": sig, "body": body}
    out = {k: v for k, v in body.items() if not k.startswith("_")}
    out["provenance"] = provenance(
        meta,
        {"site_id": site_id, "window_m": window_m, "max_n": max_n},
        ["height grid placed by great-circle offsets from the site; row 0 is local north"],
    )
    return clean(out)
