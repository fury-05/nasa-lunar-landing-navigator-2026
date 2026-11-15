"""Environment-driven settings. Secrets come from the environment only, never the repo."""

from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path


@dataclass(frozen=True)
class Settings:
    database_url: str
    redis_url: str
    data_dir: Path  # root of precomputed bundles: <data_dir>/<site_id>/meta.json
    dem_dir: Path = Path("dem")  # downloaded DEM tiles (*_surf*.tif)
    far_dir: Path = Path("far")  # ADR-0007 far-terrain rasters (20 m LDEM, ERR, EFFRES, mosaic)
    cache_dir: Path = Path("cache")  # Horizons response cache lives in <cache_dir>/horizons
    log_level: str = "INFO"
    max_window_days: int = 400  # docs/05 limits
    max_compare_sites: int = 8
    rate_per_s: float = 5.0  # reads per second per client, after the burst
    rate_burst: int = 60
    heavy_rate_per_s: float = 0.5  # POSTs (compare, slip matrix, custom jobs)
    heavy_burst: int = 6
    max_custom_sites: int = 50  # stored custom bundles on disk; oldest evicted first (F11)
    custom_max_age_days: float = 7.0  # a custom bundle older than this is deleted
    custom_max_range_m: float = 300_000.0  # skyline range for custom sites with far terrain

    @classmethod
    def from_env(cls) -> Settings:
        explicit = os.environ.get("LUNAR_PRECOMPUTE_DIR")
        base = Path(os.environ.get("LUNAR_DATA_DIR", "."))
        explicit = os.environ.get("LUNAR_PRECOMPUTE_DIR")
        data_dir = Path(explicit) if explicit else base / "precompute"
        dem_dir = Path(os.environ.get("LUNAR_DEM_DIR") or base / "dem")
        far_dir = Path(os.environ.get("LUNAR_FAR_DIR") or base / "far")
        cache_dir = Path(os.environ.get("LUNAR_CACHE_DIR") or base / "cache")
        return cls(
            database_url=os.environ.get("DATABASE_URL", ""),
            redis_url=os.environ.get("REDIS_URL", ""),
            data_dir=data_dir,
            dem_dir=dem_dir,
            far_dir=far_dir,
            cache_dir=cache_dir,
            log_level=os.environ.get("LOG_LEVEL", "INFO").upper(),
            rate_per_s=float(os.environ.get("RATE_PER_S", "5")),
            rate_burst=int(os.environ.get("RATE_BURST", "60")),
            heavy_rate_per_s=float(os.environ.get("HEAVY_RATE_PER_S", "0.5")),
            heavy_burst=int(os.environ.get("HEAVY_BURST", "6")),
            max_custom_sites=int(os.environ.get("LUNAR_MAX_CUSTOM_SITES", "50")),
            custom_max_age_days=float(os.environ.get("LUNAR_CUSTOM_MAX_AGE_DAYS", "7")),
            custom_max_range_m=float(os.environ.get("LUNAR_CUSTOM_MAX_RANGE_M", "300000")),
        )
