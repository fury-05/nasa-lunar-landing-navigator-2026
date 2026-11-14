"""The worker uses the same job function and sane queue limits."""

import asyncio
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

import fakeredis
import pytest
from lunar_api import worker
from lunar_api.jobs import JobState, RedisJobStore
from lunar_engine.ephemeris import HorizonsClient


def test_worker_settings_register_the_job_and_respect_the_horizons_limit() -> None:
    names = {f.__name__ for f in worker.WorkerSettings.functions}
    assert names == {"ping", "custom_site"}
    assert worker.WorkerSettings.max_jobs <= 2  # docs/02: at most 2 concurrent Horizons requests
    assert worker.WorkerSettings.job_timeout > 120


def test_redis_job_store_round_trip_and_expiry() -> None:
    r = fakeredis.FakeRedis()
    store = RedisJobStore(r, ttl_s=100)
    store.create(JobState("job-a", "custom-a"))
    store.update("job-a", status="running", progress=0.4, message="m")
    got = store.get("job-a")
    assert got is not None and got.status == "running" and got.progress == 0.4
    ttl = int(r.ttl("lunar:job:job-a"))  # type: ignore[arg-type]
    assert 0 < ttl <= 100
    assert store.get("nope") is None
    with pytest.raises(KeyError):
        store.update("nope", status="x")


def test_custom_site_worker_function_runs_the_job_and_writes_state(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    import httpx
    from fakehorizons import fake_horizons

    r = fakeredis.FakeRedis()
    store = RedisJobStore(r)
    store.create(JobState("job-w", "custom-w"))
    monkeypatch.setenv("LUNAR_PRECOMPUTE_DIR", str(tmp_path / "data" / "precompute"))
    monkeypatch.setattr(
        worker,
        "HorizonsClient",
        lambda **_k: HorizonsClient(
            transport=httpx.MockTransport(fake_horizons(6.0)),
            sleep=lambda _s: None,
            min_interval_s=0,
        ),
    )
    out = asyncio.run(
        worker.custom_site(
            {"sync_redis": r},
            "job-w",
            -89.5,
            40.0,
            0.0,
            datetime(2026, 12, 1, tzinfo=UTC).isoformat(),
            3,
        )
    )
    assert out == "done"
    s = store.get("job-w")
    assert s is not None and s.status == "done" and s.result["terrain_unavailable"] is True


def test_start_job_hands_redis_backed_jobs_to_arq_and_memory_jobs_to_a_thread(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    import threading

    from lunar_api import job_routes
    from lunar_api.jobs import MemoryJobStore
    from lunar_api.settings import Settings

    calls: list[tuple[Any, ...]] = []

    class Pool:
        async def enqueue_job(self, *a: object, **k: object) -> None:
            calls.append((a, k))

        async def aclose(self) -> None:
            calls.append(("closed",))

    async def fake_pool(_settings: object) -> Pool:
        return Pool()

    import arq

    monkeypatch.setattr(arq, "create_pool", fake_pool)
    cfg = Settings("", "redis://localhost:6379/0", tmp_path / "data" / "precompute")
    how = job_routes.start_job(
        RedisJobStore(fakeredis.FakeRedis()),
        "job-q",
        -89.5,
        40.0,
        0.0,
        cfg,
        HorizonsClient(),
    )
    assert how == "queue"
    (args, kwargs), closed = calls
    assert args[0] == "custom_site" and args[1] == "job-q" and kwargs == {"_job_id": "job-q"}
    assert closed == ("closed",)

    started: list[str] = []
    monkeypatch.setattr(threading.Thread, "start", lambda self: started.append(self.name))
    assert (
        job_routes.start_job(MemoryJobStore(), "job-t", -89.5, 40.0, 0.0, cfg, HorizonsClient())
        == "thread"
    )
    assert started == ["job-t"]


def test_job_store_choice_follows_redis_url(monkeypatch: pytest.MonkeyPatch) -> None:
    from lunar_api import job_routes
    from lunar_api.jobs import MemoryJobStore

    monkeypatch.delenv("REDIS_URL", raising=False)
    assert isinstance(job_routes.job_store(), MemoryJobStore)
    monkeypatch.setenv("REDIS_URL", "redis://127.0.0.1:1/0")
    monkeypatch.setattr(job_routes, "_REDIS_STORE", None)
    assert isinstance(job_routes.job_store(), RedisJobStore)
