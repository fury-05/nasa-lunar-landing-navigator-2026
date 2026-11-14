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
    log_level: str = "INFO"
    max_window_days: int = 400  # docs/05 limits
    max_compare_sites: int = 8

    @classmethod
    def from_env(cls) -> Settings:
        explicit = os.environ.get("LUNAR_PRECOMPUTE_DIR")
        base = Path(os.environ.get("LUNAR_DATA_DIR", "."))
        data_dir = Path(explicit) if explicit else base / "precompute"
        return cls(
            database_url=os.environ.get("DATABASE_URL", ""),
            redis_url=os.environ.get("REDIS_URL", ""),
            data_dir=data_dir,
            log_level=os.environ.get("LOG_LEVEL", "INFO").upper(),
        )
