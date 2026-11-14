"""Polite, cached, retrying client for the JPL Horizons API (sync, thread safe).

Rules from docs/02 and docs/04: identify ourselves, at most 2 concurrent requests, about one
request per second, backoff on 500/503, treat error text in an HTTP 200 payload as failure,
cache every response by sha256 of the normalised request, and check the API version.
"""

from __future__ import annotations

import hashlib
import json
import threading
import time
from collections.abc import Callable
from pathlib import Path
from typing import Any

import httpx
from tenacity import retry, retry_if_exception_type, stop_after_attempt, wait_exponential

from lunar_engine.ephemeris.parse import HorizonsParseError, ObserverTable, parse_observer_result

API_URL = "https://ssd.jpl.nasa.gov/api/horizons.api"
MAX_URL_CHARS = 1900
SUN, EARTH = "10", "399"
# Quantity codes checked against a live response on 2026-11-14 (ADR-0004):
# 4 = apparent Az/El (airless), 13 = target angular diameter, 20 = range and range-rate.
DEFAULT_QUANTITIES = "4,13,20"
EXPECTED_API_VERSION = "1.2"  # observed in real responses on 2026-11-14 (ADR-0004)
USER_AGENT = "LunarLandingSiteNavigator/0.0.1 (NASA Space Apps 2026; planning tool)"


class HorizonsError(RuntimeError):
    """Horizons returned an error, an unexpected version, or an unparseable payload."""


class _Retryable(HorizonsError):
    """HTTP 500/503 or a network failure: worth retrying with backoff."""


def observer_params(
    body: str,
    lon_east_deg: float,
    lat_deg: float,
    alt_km: float,
    start_utc: str,
    stop_utc: str,
    step: str = "10m",
    quantities: str = DEFAULT_QUANTITIES,
) -> dict[str, str]:
    """Build the parameter set for a topocentric observer table on the Moon (center 301)."""
    if not -90.0 <= lat_deg <= 90.0:
        raise ValueError("latitude must be within [-90, 90]")
    return {
        "format": "json",
        "COMMAND": f"'{body}'",
        "CENTER": "'coord@301'",
        "COORD_TYPE": "'GEODETIC'",
        "SITE_COORD": f"'{lon_east_deg:.6f},{lat_deg:.6f},{alt_km:.6f}'",
        "EPHEM_TYPE": "'OBSERVER'",
        "START_TIME": f"'{start_utc}'",
        "STOP_TIME": f"'{stop_utc}'",
        "STEP_SIZE": f"'{step}'",
        "QUANTITIES": f"'{quantities}'",
        "CSV_FORMAT": "'YES'",
        "TIME_DIGITS": "'SECONDS'",
        "APPARENT": "'AIRLESS'",
    }


def cache_key(params: dict[str, str]) -> str:
    """sha256 of the normalised request (sorted keys, no whitespace)."""
    norm = json.dumps(sorted(params.items()), separators=(",", ":"))
    return hashlib.sha256(norm.encode()).hexdigest()


def check_payload(payload: dict[str, Any], expected_version: str | None) -> str:
    """Return the result text, or raise HorizonsError. HTTP 200 can still carry an error."""
    if "message" in payload and "result" not in payload:
        raise HorizonsError(f"Horizons error: {payload['message']}")
    version = payload.get("signature", {}).get("version")
    if expected_version is not None and version != expected_version:
        raise HorizonsError(f"Horizons API version {version!r}, expected {expected_version!r}")
    result = payload.get("result")
    if not isinstance(result, str):
        raise HorizonsError("payload has no result text")
    if "$$SOE" not in result:
        head = [h.strip() for h in result.strip().splitlines()[:3]]
        raise HorizonsError("Horizons returned no data: " + " | ".join(head))
    return result


class HorizonsClient:
    def __init__(
        self,
        cache_dir: Path | str | None = None,
        contact_email: str = "",
        expected_version: str | None = EXPECTED_API_VERSION,
        max_concurrency: int = 2,
        min_interval_s: float = 1.0,
        timeout_s: float = 60.0,
        transport: httpx.BaseTransport | None = None,
        sleep: Callable[[float], None] = time.sleep,
    ) -> None:
        self.cache_dir = Path(cache_dir) if cache_dir else None
        if self.cache_dir:
            self.cache_dir.mkdir(parents=True, exist_ok=True)
        self.expected_version = expected_version
        self._sem = threading.Semaphore(max_concurrency)
        self._rate_lock = threading.Lock()
        self._last = 0.0
        self._min_interval = min_interval_s
        self._sleep = sleep
        self._email = contact_email
        self._http = httpx.Client(
            timeout=timeout_s, transport=transport, headers={"User-Agent": USER_AGENT}
        )
        self.network_calls = 0

    def close(self) -> None:
        self._http.close()

    def _throttle(self) -> None:
        with self._rate_lock:
            wait = self._min_interval - (time.monotonic() - self._last)
            if wait > 0:
                self._sleep(wait)
            self._last = time.monotonic()

    @retry(
        retry=retry_if_exception_type(_Retryable),
        stop=stop_after_attempt(4),
        wait=wait_exponential(multiplier=1, min=1, max=20),
        reraise=True,
    )
    def _fetch(self, params: dict[str, str]) -> dict[str, Any]:
        with self._sem:
            self._throttle()
            self.network_calls += 1
            try:
                resp = self._http.get(API_URL, params=params)
            except httpx.TransportError as exc:
                raise _Retryable(f"network error: {type(exc).__name__}") from exc
        if resp.status_code in (500, 503):
            raise _Retryable(f"Horizons HTTP {resp.status_code}")
        try:
            payload = resp.json()
        except ValueError as exc:
            raise HorizonsError(f"non-JSON response (HTTP {resp.status_code})") from exc
        if not isinstance(payload, dict):
            raise HorizonsError("unexpected JSON shape")
        if resp.status_code != 200 and "result" not in payload:
            raise HorizonsError(f"Horizons HTTP {resp.status_code}: {payload.get('message', '')}")
        return payload

    def raw(self, params: dict[str, str]) -> dict[str, Any]:
        """Return the full JSON payload (cached). Raises HorizonsError on any failure."""
        key = cache_key(params)  # the contact email is not part of the identity of the data
        path = self.cache_dir / f"{key}.json" if self.cache_dir else None
        if path and path.exists():
            cached: dict[str, Any] = json.loads(path.read_text(encoding="utf8"))
            check_payload(cached, self.expected_version)
            return cached
        sent = dict(params)
        if self._email:
            sent["EMAIL_ADDR"] = f"'{self._email}'"
        url_len = len(str(httpx.URL(API_URL, params=sent)))
        if url_len > MAX_URL_CHARS:
            raise HorizonsError(f"request URL is {url_len} chars; chunk the time range")
        payload = self._fetch(sent)
        check_payload(payload, self.expected_version)  # never cache a bad payload
        if path:
            tmp = path.with_suffix(".tmp")
            tmp.write_text(json.dumps(payload), encoding="utf8")
            tmp.replace(path)
        return payload

    def observer(self, params: dict[str, str]) -> tuple[ObserverTable, dict[str, Any]]:
        """Fetch and parse an observer table. Returns (table, provenance)."""
        payload = self.raw(params)
        try:
            table = parse_observer_result(payload["result"])
        except HorizonsParseError as exc:
            raise HorizonsError(str(exc)) from exc
        prov = {
            "source": "horizons",
            "api_version": payload.get("signature", {}).get("version"),
            "request_sha256": cache_key(params),
            "frame_header": table.frame_header,
        }
        return table, prov
