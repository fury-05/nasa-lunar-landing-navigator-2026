"""Horizons degraded flag in /ready and /version (issue #151)."""

from datetime import UTC, datetime
from pathlib import Path
from typing import Any

import fakeredis
import httpx
import pytest
from fakehorizons import fake_horizons
from fastapi.testclient import TestClient
from lunar_api import degraded
from lunar_api.degraded import MemoryHealth, RedisHealth
from lunar_api.jobs import JobState, MemoryJobStore, run_custom_site
from lunar_engine.ephemeris import HorizonsClient

T0 = datetime(2026, 12, 1, tzinfo=UTC)


def _client(handler: Any = None) -> HorizonsClient:
    return HorizonsClient(
        transport=httpx.MockTransport(handler or fake_horizons(6.0)),
        sleep=lambda _s: None,
        min_interval_s=0,
    )


def _down(_r: httpx.Request) -> httpx.Response:
    raise httpx.ConnectError("refused")


def _run(health: Any, handler: Any, tmp_path: Path) -> None:
    store = MemoryJobStore()
    store.create(JobState("j1", "x"))
    run_custom_site(
        store,
        "j1",
        -89.5,
        40.0,
        0.0,
        _client(handler),
        tmp_path / "d",
        tmp_path / "o",
        T0,
        3,
        health=health,
    )


@pytest.mark.parametrize("make", [MemoryHealth, lambda: RedisHealth(fakeredis.FakeRedis())])
def test_failure_sets_the_flag_and_success_clears_it(make: Any, tmp_path: Path) -> None:
    h = make()
    assert h.get() is None
    _run(h, _down, tmp_path)
    got = h.get()
    assert got is not None and "could not be reached" in got["reason"]
    assert got["since_utc"].endswith("Z")
    first = got["since_utc"]
    _run(h, _down, tmp_path)
    again = h.get()
    assert again is not None and again["since_utc"] == first  # the start of the outage is kept
    _run(h, None, tmp_path)
    assert h.get() is None


def test_other_failures_do_not_set_the_flag(tmp_path: Path) -> None:
    h = MemoryHealth()
    store = MemoryJobStore()
    store.create(JobState("j1", "x"))
    run_custom_site(store, "j1", 95.0, 0.0, 0.0, _client(), tmp_path, tmp_path, T0, 3, health=h)
    assert h.get() is None  # bad coordinates are the caller's fault, not Horizons


def test_the_redis_flag_expires_by_itself() -> None:
    r = fakeredis.FakeRedis()
    h = RedisHealth(r)
    h.record_failure("x")
    ttl = r.ttl("lunar:horizons:degraded")
    assert isinstance(ttl, int) and 0 < ttl <= 600
    assert degraded.TTL_S == 600


def test_memory_flag_expires_by_itself() -> None:
    now = [1000.0]
    h = MemoryHealth(clock=lambda: now[0])
    h.record_failure("x")
    assert h.get() is not None
    now[0] += degraded.TTL_S + 1
    assert h.get() is None


def test_ready_and_version_report_the_flag(monkeypatch: pytest.MonkeyPatch, bundle: Path) -> None:
    from lunar_api.main import app

    monkeypatch.setenv("LUNAR_PRECOMPUTE_DIR", str(bundle))
    monkeypatch.delenv("REDIS_URL", raising=False)
    h = MemoryHealth()
    monkeypatch.setattr(degraded, "_MEMORY", h)
    c = TestClient(app, raise_server_exceptions=False)
    assert c.get("/api/v1/ready").json()["horizons_degraded"] is None
    assert c.get("/api/v1/version").json()["horizons_degraded"] is None
    h.record_failure("network error")
    for path in ("/api/v1/ready", "/api/v1/version"):
        d = c.get(path).json()["horizons_degraded"]
        assert set(d) == {"since_utc", "reason", "using_cache"}
        assert d["reason"] == "network error" and d["using_cache"] is True
    empty = bundle / "nothing"
    monkeypatch.setenv("LUNAR_PRECOMPUTE_DIR", str(empty))
    assert c.get("/api/v1/ready").json()["horizons_degraded"]["using_cache"] is False


def test_a_broken_flag_store_never_breaks_ready(monkeypatch: pytest.MonkeyPatch) -> None:
    from lunar_api.main import app

    class Broken:
        def get(self) -> None:
            raise RuntimeError("redis down")

    monkeypatch.setattr(degraded, "health_for", lambda _url: Broken())
    r = TestClient(app, raise_server_exceptions=False).get("/api/v1/version")
    assert r.status_code == 200 and r.json()["horizons_degraded"] is None
