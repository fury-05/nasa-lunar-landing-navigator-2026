"""Readiness probes. Each returns (ok, detail). Never raises."""

from __future__ import annotations

import redis
from sqlalchemy import create_engine, text


def check_db(url: str) -> tuple[bool, str]:
    if not url:
        return False, "DATABASE_URL not set"
    try:
        engine = create_engine(url, pool_pre_ping=True)
        with engine.connect() as conn:
            conn.execute(text("select 1"))
        engine.dispose()
    except Exception as exc:  # noqa: BLE001 - probe must not raise
        return False, type(exc).__name__
    return True, "ok"


def check_redis(url: str) -> tuple[bool, str]:
    if not url:
        return False, "REDIS_URL not set"
    try:
        redis.Redis.from_url(url, socket_connect_timeout=2).ping()
    except Exception as exc:  # noqa: BLE001 - probe must not raise
        return False, type(exc).__name__
    return True, "ok"
