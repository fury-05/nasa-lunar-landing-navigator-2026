"""Rate limiting, cache headers and ETags (P3-07, docs/05).

* Rate limit: a token bucket per client address, in memory (one API process group per VM; the
  limit is a courtesy shield for Horizons-backed jobs and heavy compute, not a security boundary).
  Behind Caddy the client address comes from X-Forwarded-For, which is trusted ONLY when the
  immediate peer is loopback, so a remote caller cannot spoof it.
* ETag: a hash of the response bytes. Responses to GET requests under /api/v1/sites, /attribution
  and /links are immutable per data build, so they get `Cache-Control: public, max-age=300` and
  `If-None-Match` is honoured with 304. Probes, jobs and POSTs are never cached.
"""

from __future__ import annotations

import hashlib
import ipaddress
import time
from collections.abc import Awaitable, Callable
from typing import Any

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse, Response

from lunar_api.errors import safe_echo

CACHEABLE_PREFIXES = ("/api/v1/sites", "/api/v1/attribution", "/api/v1/links")
NEVER_CACHED = ("/api/v1/sites/custom",)
MAX_CACHE_BODY = 2_000_000  # do not buffer and hash bigger responses


def client_ip(request: Request) -> str:
    peer = request.client.host if request.client else "unknown"
    try:
        trusted = ipaddress.ip_address(peer).is_loopback
    except ValueError:
        trusted = False
    if trusted:
        fwd = request.headers.get("x-forwarded-for", "").split(",")[0].strip()
        try:
            return str(ipaddress.ip_address(fwd))
        except ValueError:
            return peer
    return peer


class TokenBucket:
    def __init__(self, rate_per_s: float, burst: int, clock: Callable[[], float] = time.monotonic):
        self.rate, self.burst, self.clock = rate_per_s, float(burst), clock
        self.state: dict[str, tuple[float, float]] = {}

    def take(self, key: str) -> tuple[bool, float]:
        """Returns (allowed, seconds until a token is available)."""
        now = self.clock()
        tokens, last = self.state.get(key, (self.burst, now))
        tokens = min(self.burst, tokens + (now - last) * self.rate)
        if tokens >= 1.0:
            self.state[key] = (tokens - 1.0, now)
            return True, 0.0
        self.state[key] = (tokens, now)
        if len(self.state) > 50_000:  # bound memory under a spray of addresses
            self.state = {k: v for k, v in self.state.items() if v[0] < self.burst}
        return False, (1.0 - tokens) / self.rate


class RateLimitMiddleware(BaseHTTPMiddleware):
    def __init__(
        self,
        app: Any,
        rate_per_s: float = 5.0,
        burst: int = 60,
        heavy_rate_per_s: float = 0.5,
        heavy_burst: int = 6,
        clock: Callable[[], float] = time.monotonic,
    ) -> None:
        super().__init__(app)
        self.light = TokenBucket(rate_per_s, burst, clock)
        self.heavy = TokenBucket(heavy_rate_per_s, heavy_burst, clock)

    async def dispatch(
        self, request: Request, call_next: Callable[[Request], Awaitable[Response]]
    ) -> Response:
        if request.url.path in ("/api/v1/health", "/api/v1/ready"):
            return await call_next(request)  # probes must keep working under load
        ip = client_ip(request)
        heavy = request.method == "POST"
        allowed, wait = (self.heavy if heavy else self.light).take(ip)
        if not allowed:
            retry = max(1, int(wait + 0.999))
            problem: dict[str, Any] = {
                "type": "https://lunar-navigator.invalid/problems/http-429",
                "title": "Too many requests",
                "status": 429,
                "detail": f"Rate limit reached. Try again in {retry} s.",
                "instance": safe_echo(request.url.path, 200),
                "request_id": getattr(request.state, "request_id", None),
                "errors": [],
            }
            return JSONResponse(
                problem,
                status_code=429,
                media_type="application/problem+json",
                headers={"Retry-After": str(retry)},
            )
        return await call_next(request)


class EtagMiddleware(BaseHTTPMiddleware):
    async def dispatch(
        self, request: Request, call_next: Callable[[Request], Awaitable[Response]]
    ) -> Response:
        response = await call_next(request)
        path = request.url.path
        if (
            request.method != "GET"
            or response.status_code != 200
            or not path.startswith(CACHEABLE_PREFIXES)
            or path in NEVER_CACHED
            or response.headers.get("content-type", "").startswith("text/event-stream")
        ):
            return response
        body: bytes = b""
        async for chunk in response.body_iterator:  # type: ignore[attr-defined]
            body += chunk if isinstance(chunk, bytes) else chunk.encode()
            if len(body) > MAX_CACHE_BODY:
                return Response(
                    body,
                    status_code=200,
                    headers=dict(response.headers),
                    media_type=response.media_type,
                )
        etag = '"' + hashlib.sha256(body).hexdigest()[:32] + '"'
        headers = {k: v for k, v in response.headers.items() if k.lower() != "content-length"}
        headers.update(
            {"ETag": etag, "Cache-Control": "public, max-age=300", "Vary": "Accept-Encoding"}
        )
        sent = {
            t.strip().removeprefix("W/")
            for t in request.headers.get("if-none-match", "").split(",")
        }
        if etag in sent:
            keep = {
                k: v
                for k, v in headers.items()
                if k.lower() in ("etag", "cache-control", "vary", "x-request-id")
            }
            return Response(status_code=304, headers=keep)
        return Response(body, status_code=200, headers=headers, media_type=response.media_type)
