"""Skyline ray caster (P2-03, docs/04 section 2).

For each azimuth the kernel walks outward from the site over a DEM, computes the curvature-aware
elevation of every terrain sample (lunar_engine.geometry), and keeps the maximum. The result is
floored by the bare-sphere dip. It also records how far the DEM reached so a caller can see where
coverage ended before the geometric limit (the skyline then reflects missing data, not terrain).

Coordinates: south polar stereographic metres (QuickMap proj 27). Sample points along a ray are
placed by great-circle destination, then projected, so curvature is honoured at 16 km as at 400 km.
"""

from __future__ import annotations

import math
from dataclasses import dataclass

import numpy as np
import numpy.typing as npt
from numba import njit, prange

from lunar_engine.geometry import R_MOON_M, sphere_dip_deg
from lunar_engine.links import south_polar_xy
from lunar_engine.terrain import DemTier, DemTile

F64 = npt.NDArray[np.float64]


@njit(cache=True)
def _bilinear(
    h: npt.NDArray[np.float32], x0: float, y0: float, px: float, x: float, y: float
) -> float:
    """Bilinear sample at pixel-centre registration. NaN outside the tile or beside NaN data."""
    fx = (x - x0) / px - 0.5
    fy = (y0 - y) / px - 0.5
    w = h.shape[1]
    hh = h.shape[0]
    if fx < 0.0 or fy < 0.0 or fx > w - 1 or fy > hh - 1:
        return np.nan
    i0 = int(math.floor(fx))
    j0 = int(math.floor(fy))
    i1 = min(i0 + 1, w - 1)
    j1 = min(j0 + 1, hh - 1)
    tx = fx - i0
    ty = fy - j0
    top = h[j0, i0] * (1.0 - tx) + h[j0, i1] * tx
    bot = h[j1, i0] * (1.0 - tx) + h[j1, i1] * tx
    return float(top * (1.0 - ty) + bot * ty)


@njit(cache=True)
def _project(lat: float, lon: float, radius: float) -> tuple[float, float]:
    rho = 2.0 * radius * math.tan((lat + math.pi / 2.0) / 2.0)
    return rho * math.sin(lon), rho * math.cos(lon)


@njit(cache=True, parallel=True)
def _cast(
    h: npt.NDArray[np.float32], x0: float, y0: float, px: float,
    site_lat: float, site_lon: float, eye_h: float, z_site: float,
    azimuths: F64, step_m: float, max_range_m: float, radius: float,
) -> tuple[F64, F64]:
    n = azimuths.shape[0]
    sky = np.empty(n)
    reach = np.empty(n)
    sin_lat = math.sin(site_lat)
    cos_lat = math.cos(site_lat)
    h0 = z_site + eye_h
    # Bare-sphere horizon for an eye `eye_h` above the local ground. Measured from the site's own
    # ground level, so a crater floor below the reference sphere cannot make acos() invalid.
    dip = -math.acos((radius + z_site) / (radius + h0))
    for k in prange(n):
        az = azimuths[k]
        sin_az = math.sin(az)
        cos_az = math.cos(az)
        best = dip
        last_ok = 0.0
        d = step_m
        while d <= max_range_m:
            ang = d / radius
            sin_d = math.sin(ang)
            cos_d = math.cos(ang)
            lat = math.asin(sin_lat * cos_d + cos_lat * sin_d * cos_az)
            lon = site_lon + math.atan2(sin_az * sin_d * cos_lat, cos_d - sin_lat * math.sin(lat))
            x, y = _project(lat, lon, radius)
            z = _bilinear(h, x0, y0, px, x, y)
            if math.isnan(z):
                break
            up = (radius + z) * cos_d - (radius + h0)
            out = (radius + z) * sin_d
            e = math.atan2(up, out)
            if e > best:
                best = e
            last_ok = d
            d += step_m
        sky[k] = math.degrees(best)
        reach[k] = last_ok
    return sky, reach


@dataclass(frozen=True)
class Skyline:
    azimuth_deg: F64
    elevation_deg: F64  # terrain skyline, floored by the sphere dip
    reach_m: F64  # how far along each azimuth the DEM was readable
    max_range_m: float
    eye_height_m: float
    site_height_m: float
    sphere_dip_deg: float
    # Vertical DEM error along the rays as an angle (degrees), measured from the ERR product.
    # None means not measured; callers then use the assumed figure and say so (issue #126).
    dem_error_deg: float | None = None
    # Highest relief (metres above the reference sphere) that may lie beyond where the DEM ended.
    # None means unknown: reported as pending-source, never guessed (issue #126).
    unseen_relief_m: float | None = None
    # Multi-tier output (ADR-0007), None for single-tile skylines.
    tier_names: tuple[str, ...] | None = None
    # per azimuth: tier of the sample that sets the horizon, -1 when none did
    tier_idx: npt.NDArray[np.int8] | None = None
    dem_error_az_deg: F64 | None = None  # per azimuth: ERR at the controlling sample as an angle
    effres_m: F64 | None = None  # per azimuth: effective resolution at the controlling sample
    ctrl_dist_m: F64 | None = None  # per azimuth: distance of the controlling sample

    def effective_dem_error_deg(self) -> float | None:
        """Single DEM error figure for the sensitivity band, or None when not measured.

        A scalar `dem_error_deg` wins. Otherwise the 95th percentile of the per-azimuth ERR angles
        (azimuths with a terrain sample only), so a few noisy rays cannot set the band but a
        consistently uncertain horizon does.
        """
        if self.dem_error_deg is not None:
            return self.dem_error_deg
        if self.dem_error_az_deg is None:
            return None
        v = self.dem_error_az_deg[np.isfinite(self.dem_error_az_deg)]
        return float(np.percentile(v, 95)) if v.size else None

    def covered_fraction(self) -> float:
        """Share of azimuths whose ray reached the requested range (full coverage).

        A skyline built without any terrain (max_range_m of 0) has no coverage at all.
        """
        if self.max_range_m <= 0.0:
            return 0.0
        return float(np.mean(self.reach_m >= self.max_range_m - 1e-6))

    def min_reach_m(self) -> float:
        return float(np.min(self.reach_m))

    def at_array(self, azimuth_deg: npt.ArrayLike) -> F64:
        """Vectorised skyline elevation at many azimuths (wraps at 360)."""
        az = np.append(self.azimuth_deg, 360.0)
        el = np.append(self.elevation_deg, self.elevation_deg[0])
        out: F64 = np.interp(np.asarray(azimuth_deg, dtype=float) % 360.0, az, el)
        return out

    def at(self, azimuth_deg: float) -> float:
        """Skyline elevation at any azimuth by linear interpolation (wraps at 360)."""
        az = np.append(self.azimuth_deg, 360.0)
        el = np.append(self.elevation_deg, self.elevation_deg[0])
        return float(np.interp(azimuth_deg % 360.0, az, el))


def cast_skyline(
    tile: DemTile,
    lat_deg: float,
    lon_east_deg: float,
    eye_height_m: float = 1.0,
    max_range_m: float = 16_000.0,
    azimuth_step_deg: float = 0.25,
    step_m: float | None = None,
    radius_m: float = R_MOON_M,
) -> Skyline:
    """Cast rays over one DEM tile. Sample spacing defaults to the tile's pixel size."""
    if eye_height_m < 0 or max_range_m <= 0 or azimuth_step_deg <= 0:
        raise ValueError("eye height must be >= 0, range and azimuth step must be > 0")
    step = tile.pixel_m if step_m is None else step_m
    sx, sy = south_polar_xy(lat_deg, lon_east_deg)
    z_site = tile.sample(sx, sy)
    if math.isnan(z_site):
        raise ValueError("site is outside the DEM tile or on missing data")
    azimuths = np.arange(0.0, 360.0, azimuth_step_deg, dtype=np.float64)
    sky, reach = _cast(
        tile.heights, tile.x0, tile.y0, tile.pixel_m,
        math.radians(lat_deg), math.radians(lon_east_deg), eye_height_m, z_site,
        np.radians(azimuths), step, max_range_m, radius_m,
    )
    dip = sphere_dip_deg(eye_height_m, radius_m + z_site)
    return Skyline(
        azimuths, np.maximum(sky, dip), reach, max_range_m, eye_height_m, float(z_site), dip
    )


_NO_TILE = np.full((1, 1), np.nan, dtype=np.float32)


@njit(cache=True)
def _pick(
    h0: npt.NDArray[np.float32], h1: npt.NDArray[np.float32], h2: npt.NDArray[np.float32],
    prm: F64, x: float, y: float, d: float,
) -> tuple[float, int]:
    """Height and tier index from the finest tier that is in range and valid, else (NaN, -1)."""
    for k in range(3):
        if d > prm[k, 3]:
            continue
        if k == 0:
            z = _bilinear(h0, prm[0, 0], prm[0, 1], prm[0, 2], x, y)
        elif k == 1:
            z = _bilinear(h1, prm[1, 0], prm[1, 1], prm[1, 2], x, y)
        else:
            z = _bilinear(h2, prm[2, 0], prm[2, 1], prm[2, 2], x, y)
        if not math.isnan(z):
            return z, k
    return np.nan, -1


@njit(cache=True, parallel=True)
def _cast_tiers(
    h0: npt.NDArray[np.float32], h1: npt.NDArray[np.float32], h2: npt.NDArray[np.float32],
    prm: F64, err: npt.NDArray[np.float32], eprm: F64, eff: npt.NDArray[np.float32], fprm: F64,
    site_lat: float, site_lon: float, eye_h: float, z_site: float,
    azimuths: F64, max_range_m: float, radius: float,
) -> tuple[F64, F64, npt.NDArray[np.int8], F64, F64, F64]:
    n = azimuths.shape[0]
    sky = np.empty(n)
    reach = np.empty(n)
    tier = np.empty(n, dtype=np.int8)
    ctrl = np.empty(n)
    err_deg = np.empty(n)
    eff_m = np.empty(n)
    sin_lat = math.sin(site_lat)
    cos_lat = math.cos(site_lat)
    eye = z_site + eye_h
    dip = -math.acos((radius + z_site) / (radius + eye))
    for k in prange(n):
        az = azimuths[k]
        sin_az = math.sin(az)
        cos_az = math.cos(az)
        best = dip
        best_d = 0.0
        best_x = 0.0
        best_y = 0.0
        best_tier = -1
        last_ok = 0.0
        d = prm[0, 2]
        while True:
            if d > max_range_m:
                d = max_range_m
            ang = d / radius
            sin_d = math.sin(ang)
            cos_d = math.cos(ang)
            lat = math.asin(sin_lat * cos_d + cos_lat * sin_d * cos_az)
            lon = site_lon + math.atan2(sin_az * sin_d * cos_lat, cos_d - sin_lat * math.sin(lat))
            x, y = _project(lat, lon, radius)
            z, t = _pick(h0, h1, h2, prm, x, y, d)
            if t < 0:
                break
            e = math.atan2((radius + z) * cos_d - (radius + eye), (radius + z) * sin_d)
            if e > best:
                best = e
                best_d = d
                best_x = x
                best_y = y
                best_tier = t
            last_ok = d
            if d >= max_range_m:
                break
            d = d + prm[t, 2]  # spacing never exceeds the pixel size of the tier in use
        sky[k] = math.degrees(best)
        reach[k] = last_ok
        err_deg[k] = np.nan
        eff_m[k] = np.nan
        if best - dip < 1e-9:
            tier[k] = -1
            ctrl[k] = np.nan
        else:
            tier[k] = best_tier
            ctrl[k] = best_d
            ev = _bilinear(err, eprm[0], eprm[1], eprm[2], best_x, best_y)
            if not math.isnan(ev):
                err_deg[k] = math.degrees(ev / best_d)
            fv = _bilinear(eff, fprm[0], fprm[1], fprm[2], best_x, best_y)
            if not math.isnan(fv):
                eff_m[k] = fv
    return sky, reach, tier, ctrl, err_deg, eff_m


def cast_skyline_tiers(
    tiers: list[DemTier],
    lat_deg: float,
    lon_east_deg: float,
    eye_height_m: float = 1.0,
    max_range_m: float = 300_000.0,
    azimuth_step_deg: float = 0.25,
    radius_m: float = R_MOON_M,
    err: DemTile | None = None,
    effres: DemTile | None = None,
) -> Skyline:
    """Cast rays over up to three resolution tiers, finest first (ADR-0007).

    At every sample the finest tier that is within its `max_distance_m` and has valid data
    supplies the height, so a ray only ends when no tier has data (never at a fine tile's edge
    while a wider tier exists). Sample spacing equals the pixel size of the tier in use. `err` and
    `effres` (the ERR and EFFRES products) are read at the sample that fixes each azimuth's
    skyline; the error becomes an angle (error metres divided by that sample's distance).
    """
    if not 1 <= len(tiers) <= 3:
        raise ValueError("between one and three tiers are supported")
    if eye_height_m < 0 or max_range_m <= 0 or azimuth_step_deg <= 0:
        raise ValueError("eye height must be >= 0, range and azimuth step must be > 0")
    sx, sy = south_polar_xy(lat_deg, lon_east_deg)
    z_site = float("nan")
    for t in tiers:
        z_site = t.tile.sample(sx, sy)
        if not math.isnan(z_site):
            break
    if math.isnan(z_site):
        raise ValueError("site is outside every DEM tier or on missing data")
    heights = [np.ascontiguousarray(t.tile.heights, dtype=np.float32) for t in tiers]
    prm = np.zeros((3, 4))
    prm[:, 3] = -1.0  # unused slots are never in range
    for i, t in enumerate(tiers):
        prm[i] = (t.tile.x0, t.tile.y0, t.tile.pixel_m, t.max_distance_m)
    while len(heights) < 3:
        heights.append(_NO_TILE)

    def grid(tile: DemTile | None) -> tuple[npt.NDArray[np.float32], F64]:
        if tile is None:
            return _NO_TILE, np.array([0.0, 0.0, 1.0])
        return (
            np.ascontiguousarray(tile.heights, dtype=np.float32),
            np.array([tile.x0, tile.y0, tile.pixel_m]),
        )

    e_h, e_p = grid(err)
    f_h, f_p = grid(effres)
    azimuths = np.arange(0.0, 360.0, azimuth_step_deg, dtype=np.float64)
    sky, reach, tier, ctrl, err_deg, eff_m = _cast_tiers(
        heights[0], heights[1], heights[2], prm, e_h, e_p, f_h, f_p,
        math.radians(lat_deg), math.radians(lon_east_deg), eye_height_m, z_site,
        np.radians(azimuths), max_range_m, radius_m,
    )
    dip = sphere_dip_deg(eye_height_m, radius_m + z_site)
    return Skyline(
        azimuths, np.maximum(sky, dip), reach, max_range_m, eye_height_m, float(z_site), dip,
        tier_names=tuple(t.name for t in tiers),
        tier_idx=tier,
        dem_error_az_deg=err_deg if err is not None else None,
        effres_m=eff_m if effres is not None else None,
        ctrl_dist_m=ctrl,
    )
