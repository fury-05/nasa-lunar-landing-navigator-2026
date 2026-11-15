"""A small local terrain grid around a site for the 3D view (issue #77, P5-01).

The grid is in the site's own frame: row 0 is the NORTH edge, column 0 the WEST edge, rows go
south and columns go east, with the site at the centre. This is not the polar stereographic grid:
that grid's +y equals local north only at longitude 0, so every sample is placed by great-circle
destination from the site (east/north offset to azimuth and distance) and then projected, the same
way the skyline caster places its samples. Heights are metres above the 1737.4 km reference sphere,
exactly as stored in the DEM; nothing is detrended.
"""

from __future__ import annotations

import math
from dataclasses import dataclass, field

import numpy as np
import numpy.typing as npt

from lunar_engine.geometry import R_MOON_M
from lunar_engine.terrain import DemTier, DemTile

F64 = npt.NDArray[np.float64]


def sample_array(tile: DemTile, x: F64, y: F64) -> F64:
    """Vectorised bilinear height (same rules as `DemTile.sample`): NaN outside or next to NaN."""
    fx = (x - tile.x0) / tile.pixel_m - 0.5
    fy = (tile.y0 - y) / tile.pixel_m - 0.5
    ok = (fx >= 0.0) & (fy >= 0.0) & (fx <= tile.width - 1) & (fy <= tile.height - 1)
    i0 = np.clip(np.floor(np.where(ok, fx, 0.0)).astype(int), 0, tile.width - 1)
    j0 = np.clip(np.floor(np.where(ok, fy, 0.0)).astype(int), 0, tile.height - 1)
    i1 = np.minimum(i0 + 1, tile.width - 1)
    j1 = np.minimum(j0 + 1, tile.height - 1)
    tx, ty = fx - i0, fy - j0
    h = tile.heights.astype(np.float64)
    top = h[j0, i0] * (1 - tx) + h[j0, i1] * tx
    bot = h[j1, i0] * (1 - tx) + h[j1, i1] * tx
    out: F64 = np.where(ok, top * (1 - ty) + bot * ty, np.nan)
    return out


def local_xy(
    lat_deg: float, lon_east_deg: float, east_m: F64, north_m: F64, radius_m: float = R_MOON_M
) -> tuple[F64, F64]:
    """Polar stereographic (x, y) of points given as metres east and north of the site."""
    az = np.arctan2(east_m, north_m)
    ang = np.hypot(east_m, north_m) / radius_m
    lat1, lon1 = math.radians(lat_deg), math.radians(lon_east_deg)
    lat2 = np.arcsin(np.sin(lat1) * np.cos(ang) + math.cos(lat1) * np.sin(ang) * np.cos(az))
    lon2 = lon1 + np.arctan2(
        np.sin(az) * np.sin(ang) * math.cos(lat1), np.cos(ang) - math.sin(lat1) * np.sin(lat2)
    )
    rho = 2.0 * radius_m * np.tan((lat2 + math.pi / 2.0) / 2.0)
    return rho * np.sin(lon2), rho * np.cos(lon2)


@dataclass
class LocalGrid:
    rows: int
    cols: int
    spacing_m: float
    heights_m: F64  # shape (rows, cols), row 0 north, col 0 west
    native_resolution_m: float  # pixel size of the tier that supplied most samples
    tier_share: dict[str, float]  # share of samples taken from each tier
    finite_fraction: float
    notes: list[str] = field(default_factory=list)


def local_grid(
    tiers: list[DemTier],
    lat_deg: float,
    lon_east_deg: float,
    window_m: float = 4000.0,
    max_n: int = 128,
) -> LocalGrid | None:
    """Sample `window_m` square around the site, finest valid tier per sample (like the skyline).

    The grid has n x n samples with n = min(max_n, window/pixel + 1) of the finest tier, spaced
    window/(n-1) apart, so the stated spacing is exact. Returns None when no tier has any data.
    """
    if not tiers or window_m <= 0 or max_n < 3:
        return None
    n = int(min(max_n, math.floor(window_m / min(t.tile.pixel_m for t in tiers)) + 1))
    n = max(n, 3)
    spacing = window_m / (n - 1)
    off = (np.arange(n) - (n - 1) / 2.0) * spacing
    east, north = np.meshgrid(off, -off)  # row 0 is the north edge
    x, y = local_xy(lat_deg, lon_east_deg, east, north)
    heights = np.full((n, n), np.nan)
    which = np.full((n, n), -1, dtype=int)
    dist = np.hypot(east, north)
    for k, t in enumerate(tiers):
        z = sample_array(t.tile, x, y)
        take = np.isnan(heights) & np.isfinite(z) & (dist <= t.max_distance_m)
        heights[take] = z[take]
        which[take] = k
    finite = float(np.mean(np.isfinite(heights)))
    if finite == 0.0:
        return None
    counts = np.array([np.sum(which == k) for k in range(len(tiers))], dtype=float)
    share = {t.name: float(counts[k]) / which.size for k, t in enumerate(tiers)}
    main = int(np.argmax(counts))
    return LocalGrid(n, n, spacing, heights, tiers[main].tile.pixel_m, share, finite)
