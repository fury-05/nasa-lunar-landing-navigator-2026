"""POST /sites/custom, GET /jobs/{id}, GET /jobs/{id}/events (SSE) (P3-04, docs/05)."""

from __future__ import annotations

import asyncio
import json
import threading
from collections.abc import AsyncIterator
from datetime import UTC, datetime
from typing import Annotated, Any

from fastapi import APIRouter, Depends, Request
from fastapi.responses import JSONResponse, StreamingResponse
from lunar_engine.ephemeris import HorizonsClient
from pydantic import BaseModel, ConfigDict, Field

from lunar_api.errors import ApiError, safe_echo
from lunar_api.jobs import (
    TERMINAL,
    JobError,
    JobState,
    JobStore,
    MemoryJobStore,
    RedisJobStore,
    custom_site_id,
    run_custom_site,
    validate_point,
)
from lunar_api.schemas import JobAccepted, JobOut, Problem
from lunar_api.settings import Settings

router = APIRouter(prefix="/api/v1")
ERRORS: dict[int | str, dict[str, Any]] = {
    404: {"model": Problem, "description": "Not found"},
    422: {"model": Problem, "description": "Invalid input"},
}

_STORE: JobStore = MemoryJobStore()
_RUNNING: dict[str, threading.Thread] = {}
CUSTOM_START = datetime(2026, 12, 1, tzinfo=UTC)
CUSTOM_DAYS = 60
SSE_POLL_S = 0.5
SSE_MAX_S = 150.0
SSE_KEEPALIVE_S = 15.0


_REDIS_STORE: JobStore | None = None


def job_store() -> JobStore:
    """Redis when REDIS_URL is set (jobs survive a restart and run in the worker), else memory."""
    global _REDIS_STORE
    url = Settings.from_env().redis_url
    if not url:
        return _STORE
    if _REDIS_STORE is None:
        import redis

        _REDIS_STORE = RedisJobStore(redis.Redis.from_url(url))
    return _REDIS_STORE


def start_job(
    store: JobStore,
    job_id: str,
    lat: float,
    lon: float,
    alt_m: float,
    settings: Settings,
    client: HorizonsClient,
) -> str:
    """Start the work. Returns "queue" when handed to the arq worker, "thread" otherwise."""
    if isinstance(store, RedisJobStore):
        import asyncio

        from arq import create_pool
        from arq.connections import RedisSettings

        async def push() -> None:
            pool = await create_pool(RedisSettings.from_dsn(settings.redis_url))
            try:
                await pool.enqueue_job(
                    "custom_site",
                    job_id,
                    lat,
                    lon,
                    alt_m,
                    CUSTOM_START.isoformat(),
                    CUSTOM_DAYS,
                    _job_id=job_id,  # arq ignores a second enqueue of the same id
                )
            finally:
                await pool.aclose()

        asyncio.run(push())
        return "queue"
    thread = threading.Thread(
        target=run_custom_site,
        args=(
            store,
            job_id,
            lat,
            lon,
            alt_m,
            client,
            settings.dem_dir,
            settings.data_dir,
            CUSTOM_START,
            CUSTOM_DAYS,
        ),
        daemon=True,
        name=job_id,
    )
    _RUNNING[job_id] = thread
    thread.start()
    return "thread"


def get_client() -> HorizonsClient:
    return HorizonsClient(cache_dir=Settings.from_env().cache_dir / "horizons")


def get_settings() -> Settings:
    return Settings.from_env()


class CustomSiteIn(BaseModel):
    model_config = ConfigDict(strict=True)

    lat: float = Field(description="degrees, -90 to 90")
    lon: float = Field(description="degrees east, -180 to 180")
    alt_m: float = Field(default=0.0, description="metres above the 1737400 m reference sphere")


@router.post(
    "/sites/custom",
    status_code=202,
    responses={200: {"model": JobAccepted}, 202: {"model": JobAccepted}, 422: {"model": Problem}},
)
def create_custom(
    body: CustomSiteIn,
    request: Request,
    store: Annotated[JobStore, Depends(job_store)],
    settings: Annotated[Settings, Depends(get_settings)],
    client: Annotated[HorizonsClient, Depends(get_client)],
) -> JSONResponse:
    try:
        validate_point(body.lat, body.lon, body.alt_m)
    except JobError as exc:
        raise ApiError(
            422,
            "Invalid coordinates",
            str(exc),
            "validation",
            [{"field": "lat/lon/alt_m", "message": str(exc)}],
        ) from exc
    site_id = custom_site_id(body.lat, body.lon, body.alt_m)
    done_meta = settings.data_dir / site_id / "meta.json"
    if done_meta.exists():  # same point asked before: no new work, point at the stored result
        return JSONResponse(
            {
                "site_id": site_id,
                "job_id": None,
                "status": "done",
                "cached": True,
                "site_url": f"/api/v1/sites/{site_id}",
            },
            status_code=200,
        )
    job_id = "job-" + site_id.removeprefix("custom-")
    existing = store.get(job_id)
    if existing is not None and existing.status not in TERMINAL:
        return JSONResponse(
            _accepted(existing), status_code=202, headers={"Location": f"/api/v1/jobs/{job_id}"}
        )
    state = JobState(job_id, site_id)
    store.create(state)
    start_job(store, job_id, body.lat, body.lon, body.alt_m, settings, client)
    return JSONResponse(
        _accepted(state), status_code=202, headers={"Location": f"/api/v1/jobs/{job_id}"}
    )


def _accepted(s: JobState) -> dict[str, Any]:
    return {
        "site_id": s.site_id,
        "job_id": s.job_id,
        "status": s.status,
        "cached": False,
        "status_url": f"/api/v1/jobs/{s.job_id}",
        "events_url": f"/api/v1/jobs/{s.job_id}/events",
    }


@router.get("/jobs/{job_id}", response_model=JobOut, responses=ERRORS)
def get_job(job_id: str, store: Annotated[JobStore, Depends(job_store)]) -> dict[str, Any]:
    s = store.get(job_id)
    if s is None:
        raise ApiError(
            404,
            "Job not found",
            f"No job '{safe_echo(job_id)}'. Jobs expire after one day.",
            "job-not-found",
        )
    out = s.public()
    if s.status == "done":
        out["site_url"] = f"/api/v1/sites/{s.site_id}"
    if s.status == "failed":
        out["retry"] = "POST the same coordinates to /api/v1/sites/custom to try again."
    return out


async def _events(job_id: str, store: JobStore) -> AsyncIterator[str]:
    last = ""
    waited = 0.0
    quiet = 0.0
    while True:
        s = store.get(job_id)
        if s is None:
            yield "event: error\ndata: " + json.dumps({"reason": "job not found"}) + "\n\n"
            return
        payload = json.dumps(
            {"status": s.status, "progress": s.progress, "message": s.message, "reason": s.reason}
        )
        if payload != last:
            yield f"event: progress\ndata: {payload}\n\n"
            last = payload
            quiet = 0.0
        if s.status in TERMINAL:
            yield "event: end\ndata: " + json.dumps({"status": s.status}) + "\n\n"
            return
        if waited >= SSE_MAX_S:
            yield "event: timeout\ndata: " + json.dumps({"reason": "stream limit reached"}) + "\n\n"
            return
        await asyncio.sleep(SSE_POLL_S)
        waited += SSE_POLL_S
        quiet += SSE_POLL_S
        if quiet >= SSE_KEEPALIVE_S:  # a comment line keeps proxies from closing an idle stream
            quiet = 0.0
            yield ": keepalive\n\n"


@router.get(
    "/jobs/{job_id}/events",
    response_class=StreamingResponse,
    responses={
        200: {
            "description": (
                "Server sent events. `event: progress` carries JSON {status, progress, message, "
                "reason} and is sent only when it changes. `event: end` carries {status} and "
                "closes the stream. `event: timeout` closes it after 150 s. Lines starting with "
                "a colon are keepalive comments."
            ),
            "content": {"text/event-stream": {"schema": {"type": "string"}}},
        },
        404: {"model": Problem},
    },
)
async def job_events(
    job_id: str, store: Annotated[JobStore, Depends(job_store)]
) -> StreamingResponse:
    if store.get(job_id) is None:
        raise ApiError(404, "Job not found", f"No job '{safe_echo(job_id)}'.", "job-not-found")
    return StreamingResponse(
        _events(job_id, store),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
