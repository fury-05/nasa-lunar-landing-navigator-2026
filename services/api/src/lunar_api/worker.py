"""arq worker for custom-site jobs (P3-04).

The API process starts a job in a thread when no Redis is configured (tests, local runs). With
`REDIS_URL` set, `job_routes.start_job` hands the work to this worker instead, so it survives an API
restart. Both paths call the same `run_custom_site`, and job state lives in Redis in that case.
"""

from __future__ import annotations

import os
from datetime import UTC, datetime
from typing import Any

from arq.connections import RedisSettings
from lunar_engine.ephemeris import HorizonsClient

from lunar_api.degraded import RedisHealth
from lunar_api.jobs import JOB_TIMEOUT_S, RedisJobStore, run_custom_site
from lunar_api.settings import Settings


async def ping(ctx: dict[str, Any]) -> str:
    return "pong"


async def custom_site(
    ctx: dict[str, Any],
    job_id: str,
    lat: float,
    lon: float,
    alt_m: float,
    start_iso: str,
    days: int,
) -> str:
    """Run one custom site job. State is written to Redis by RedisJobStore."""
    settings = Settings.from_env()
    store = RedisJobStore(ctx["sync_redis"])
    client = HorizonsClient(cache_dir=settings.cache_dir / "horizons")
    run_custom_site(
        store,
        job_id,
        lat,
        lon,
        alt_m,
        client,
        settings.dem_dir,
        settings.data_dir,
        datetime.fromisoformat(start_iso).astimezone(UTC),
        days,
        health=RedisHealth(ctx["sync_redis"]),
    )
    state = store.get(job_id)
    return state.status if state else "missing"


async def on_startup(ctx: dict[str, Any]) -> None:
    import redis

    ctx["sync_redis"] = redis.Redis.from_url(
        os.environ.get("REDIS_URL", "redis://127.0.0.1:6379/0")
    )


async def on_shutdown(ctx: dict[str, Any]) -> None:
    client = ctx.get("sync_redis")
    if client is not None:
        client.close()


class WorkerSettings:
    functions = [ping, custom_site]
    on_startup = on_startup
    on_shutdown = on_shutdown
    redis_settings = RedisSettings.from_dsn(os.environ.get("REDIS_URL", "redis://127.0.0.1:6379/0"))
    job_timeout = int(JOB_TIMEOUT_S) + 30  # the job's own timeout fires first and records why
    max_jobs = 2  # at most 2 Horizons requests at once (docs/02 etiquette)
    keep_result = 3600
