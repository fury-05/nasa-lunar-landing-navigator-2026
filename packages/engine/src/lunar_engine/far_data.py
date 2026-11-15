"""Load the ADR-0007 far-terrain data into skyline tiers for one site.

Files live in one folder (`$LUNAR_DATA_DIR/far`), named as PGDA names them. Only a window around
the site is read, so the 2.7 GB and 3.5 GB rasters are never held in memory whole. Missing files
are reported in `FarTiers.missing` and the skyline then simply has fewer tiers: nothing is
substituted silently.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path

from lunar_engine.links import south_polar_xy
from lunar_engine.terrain import DemTier, DemTile, read_window

LDEM_20M = "LDEM_80S_20MPP_ADJ.TIF"
ERR_20M = "LDEM_80S_20MPP_ADJ_ERR.TIF"
EFFRES_20M = "LDEM_80S_20MPP_ADJ_EFFRES.TIF"
MOSAIC_5M = "ldem_87s_5mpp.tif"
LDEM_80M = "LDEM_80S_80MPP_ADJ.TIF"
ERR_80M = "LDEM_80S_80MPP_ADJ_ERR.TIF"
EFFRES_80M = "LDEM_80S_80MPP_ADJ_EFFRES.TIF"

NEAR_LIMIT_M = 20_000.0  # docs/04: the near tier reaches 20 km
ERR_REDUCE = 4  # ERR and EFFRES are kept at 4 x the pixel size, max per block (conservative)


@dataclass
class FarTiers:
    tiers: list[DemTier]
    err: DemTile | None
    effres: DemTile | None
    files: list[str] = field(default_factory=list)
    missing: list[str] = field(default_factory=list)


def _try(path: Path, cx: float, cy: float, half: float, reduce: int = 1) -> DemTile | None:
    if not path.exists():
        return None
    try:
        return read_window(path, cx, cy, half, reduce)
    except ValueError:  # the file does not overlap this site
        return None


def load_far_tiers(
    far_dir: Path,
    site_tile: DemTile | None,
    lat_deg: float,
    lon_east_deg: float,
    max_range_m: float,
    allow_80m_fallback: bool = True,
) -> FarTiers:
    """Tiers for one site, finest first: site tile, 5 m mosaic window, 20 m (or 80 m) LDEM."""
    cx, cy = south_polar_xy(lat_deg, lon_east_deg)
    half = max_range_m + 1_000.0
    tiers: list[DemTier] = []
    files: list[str] = []
    missing: list[str] = []
    if site_tile is not None:
        tiers.append(DemTier("site-tile-5m", site_tile, NEAR_LIMIT_M))
    mosaic = _try(far_dir / MOSAIC_5M, cx, cy, NEAR_LIMIT_M + 1_000.0)
    if mosaic is not None:
        tiers.append(DemTier("mosaic-87s-5m", mosaic, NEAR_LIMIT_M))
        files.append(MOSAIC_5M)
    elif not (far_dir / MOSAIC_5M).exists():
        missing.append(MOSAIC_5M)
    err = effres = None
    wide = _try(far_dir / LDEM_20M, cx, cy, half)
    if wide is not None:
        tiers.append(DemTier("ldem-20m", wide))
        files.append(LDEM_20M)
        err = _try(far_dir / ERR_20M, cx, cy, half, ERR_REDUCE)
        effres = _try(far_dir / EFFRES_20M, cx, cy, half, ERR_REDUCE)
        files += [f for f, t in ((ERR_20M, err), (EFFRES_20M, effres)) if t is not None]
        missing += [f for f, t in ((ERR_20M, err), (EFFRES_20M, effres)) if t is None]
    else:
        missing.append(LDEM_20M)
        if allow_80m_fallback:
            wide = _try(far_dir / LDEM_80M, cx, cy, half)
            if wide is not None:
                tiers.append(DemTier("ldem-80m", wide))
                files.append(LDEM_80M)
                err = _try(far_dir / ERR_80M, cx, cy, half, 1)
                effres = _try(far_dir / EFFRES_80M, cx, cy, half, 1)
                files += [f for f, t in ((ERR_80M, err), (EFFRES_80M, effres)) if t is not None]
    return FarTiers(tiers, err, effres, files, missing)
