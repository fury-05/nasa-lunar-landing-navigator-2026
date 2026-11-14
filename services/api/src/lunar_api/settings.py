"""Environment-driven settings. Secrets come from the environment only, never the repo."""

from __future__ import annotations

import os
from dataclasses import dataclass


@dataclass(frozen=True)
class Settings:
    database_url: str
    redis_url: str

    @classmethod
    def from_env(cls) -> Settings:
        return cls(
            database_url=os.environ.get("DATABASE_URL", ""),
            redis_url=os.environ.get("REDIS_URL", ""),
        )
