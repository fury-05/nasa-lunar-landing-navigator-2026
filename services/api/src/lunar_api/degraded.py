"""Horizons degraded flag (issue #151).

When a Horizons call made by the API or the worker fails with a network error or a server error
(HTTP 500/503), the flag is set; the next success clears it. It also expires by itself after ten
minutes, so a worker that died cannot leave a stale banner. Shared through Redis when `REDIS_URL`
is set (API and worker are separate processes), otherwise kept in memory.

The flag only says that the LAST call failed. It does not probe Horizons, and stored bundles keep
being served either way (`using_cache`).
"""

from __future__ import annotations

import json
import threading
import time
from collections.abc import Callable
from datetime import UTC, datetime
from typing import Any, Protocol

TTL_S = 600
KEY = "lunar:horizons:degraded"


def _now() -> str:
    return datetime.now(UTC).strftime("%Y-%m-%dT%H:%M:%SZ")


class Health(Protocol):
    def record_failure(self, reason: str) -> None: ...
    def record_success(self) -> None: ...
    def get(self) -> dict[str, str] | None: ...


class MemoryHealth:
    def __init__(self, clock: Callable[[], float] = time.monotonic) -> None:
        self._clock = clock
        self._state: tuple[float, dict[str, str]] | None = None
        self._lock = threading.Lock()

    def record_failure(self, reason: str) -> None:
        with self._lock:
            since = self._state[1]["since_utc"] if self._state and self._live() else _now()
            self._state = (self._clock(), {"since_utc": since, "reason": reason})

    def record_success(self) -> None:
        with self._lock:
            self._state = None

    def _live(self) -> bool:
        return self._state is not None and self._clock() - self._state[0] <= TTL_S

    def get(self) -> dict[str, str] | None:
        with self._lock:
            return dict(self._state[1]) if self._live() and self._state else None


class RedisHealth:
    def __init__(self, client: Any) -> None:
        self.r = client

    def record_failure(self, reason: str) -> None:
        current = self.get()
        since = current["since_utc"] if current else _now()
        self.r.set(KEY, json.dumps({"since_utc": since, "reason": reason}), ex=TTL_S)

    def record_success(self) -> None:
        self.r.delete(KEY)

    def get(self) -> dict[str, str] | None:
        raw = self.r.get(KEY)
        if raw is None:
            return None
        data: dict[str, str] = json.loads(raw)
        return data


_MEMORY = MemoryHealth()
_REDIS: dict[str, RedisHealth] = {}


def health_for(redis_url: str) -> Health:
    if not redis_url:
        return _MEMORY
    if redis_url not in _REDIS:
        import redis

        _REDIS[redis_url] = RedisHealth(
            redis.Redis.from_url(redis_url, socket_connect_timeout=2, socket_timeout=2)
        )
    return _REDIS[redis_url]


def snapshot(redis_url: str, has_stored_sites: bool) -> dict[str, Any] | None:
    """The `horizons_degraded` field: None, or {since_utc, reason, using_cache}. Never raises."""
    try:
        got = health_for(redis_url).get()
    except Exception:  # noqa: BLE001 - a broken flag store must not break /ready
        return None
    if got is None:
        return None
    return {**got, "using_cache": has_stored_sites}
