"""Request ids and structured access logging (P3-01)."""

from __future__ import annotations

import json
import logging
import re
import time
import uuid
from collections.abc import Awaitable, Callable

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

log = logging.getLogger("lunar_api.access")
SAFE_ID = re.compile(r"^[A-Za-z0-9._-]{8,64}$")


class RequestIdMiddleware(BaseHTTPMiddleware):
    """Accept a well-formed X-Request-ID from the caller, else make one; echo it on the response."""

    async def dispatch(
        self, request: Request, call_next: Callable[[Request], Awaitable[Response]]
    ) -> Response:
        supplied = request.headers.get("x-request-id", "")
        rid = supplied if SAFE_ID.match(supplied) else uuid.uuid4().hex
        request.state.request_id = rid
        start = time.perf_counter()
        status = 500
        try:
            response = await call_next(request)
            status = response.status_code
        finally:
            log.info(
                json.dumps(
                    {
                        "request_id": rid,
                        "method": request.method,
                        "path": request.url.path,
                        "status": status,
                        "ms": round(1000 * (time.perf_counter() - start), 1),
                    }
                )
            )
        response.headers["X-Request-ID"] = rid
        return response


def configure_logging(level: str = "INFO") -> None:
    logging.basicConfig(level=level, format="%(asctime)s %(levelname)s %(name)s %(message)s")


SECURITY_HEADERS = {
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer",
    "Cross-Origin-Resource-Policy": "same-site",
    "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'",
    "Permissions-Policy": "geolocation=(), camera=(), microphone=()",
}


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """Defence in depth: headers like the ones Caddy sets, for a direct hit on the API port."""

    async def dispatch(
        self, request: Request, call_next: Callable[[Request], Awaitable[Response]]
    ) -> Response:
        response = await call_next(request)
        for k, v in SECURITY_HEADERS.items():
            response.headers.setdefault(k, v)
        return response
