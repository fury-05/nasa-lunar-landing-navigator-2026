"""RFC 7807 problem responses for every error the API can return (P3-01, docs/05)."""

from __future__ import annotations

import logging
from typing import Any

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

log = logging.getLogger("lunar_api")
PROBLEM_JSON = "application/problem+json"
MAX_ECHO = 64
TYPE_BASE = "https://lunar-navigator.invalid/problems/"  # not dereferenceable; stable identifiers


def safe_echo(value: str, limit: int = MAX_ECHO) -> str:
    """Caller text made safe to put in an error message: printable ASCII only, short.

    Anything else (control characters, markup, long strings, unicode tricks) becomes '?' so an
    attacker cannot shape the response text, and logs cannot be flooded through error details.
    """
    cleaned = "".join(ch if 32 <= ord(ch) < 127 and ch not in "<>\"'`\\" else "?" for ch in value)
    return cleaned[:limit] + ("..." if len(cleaned) > limit else "")


class ApiError(Exception):
    """Raise anywhere in a route to return a problem document."""

    def __init__(
        self,
        status: int,
        title: str,
        detail: str,
        code: str = "error",
        errors: list[dict[str, Any]] | None = None,
    ) -> None:
        super().__init__(detail)
        self.status, self.title, self.detail, self.code = status, title, detail, code
        self.errors = errors or []


def problem(
    request: Request,
    status: int,
    title: str,
    detail: str,
    code: str,
    errors: list[dict[str, Any]] | None = None,
) -> JSONResponse:
    body: dict[str, Any] = {
        "type": TYPE_BASE + code,
        "title": title,
        "status": status,
        "detail": detail,
        "instance": safe_echo(str(request.url.path), 200),
        "request_id": getattr(request.state, "request_id", None),
        "errors": errors or [],
    }
    headers = {}
    rid = getattr(request.state, "request_id", None)
    if rid:
        # Unhandled errors are answered by Starlette's outer layer, which skips our middleware,
        # so the id must be set here as well as in the middleware.
        headers["X-Request-ID"] = rid
    return JSONResponse(body, status_code=status, media_type=PROBLEM_JSON, headers=headers)


def install_error_handlers(app: FastAPI) -> None:
    @app.exception_handler(ApiError)
    async def _api_error(request: Request, exc: ApiError) -> JSONResponse:
        return problem(request, exc.status, exc.title, exc.detail, exc.code, exc.errors)

    @app.exception_handler(RequestValidationError)
    async def _validation(request: Request, exc: RequestValidationError) -> JSONResponse:
        errors = [
            {
                "field": ".".join(str(p) for p in e.get("loc", ()) if p != "body"),
                "message": str(e.get("msg", "")),
                "code": str(e.get("type", "")),
            }
            for e in exc.errors()
        ]
        return problem(
            request, 422, "Invalid input", "One or more fields are invalid.", "validation", errors
        )

    @app.exception_handler(StarletteHTTPException)
    async def _http(request: Request, exc: StarletteHTTPException) -> JSONResponse:
        titles = {404: "Not found", 405: "Method not allowed", 429: "Too many requests"}
        title = titles.get(exc.status_code, "Request failed")
        return problem(
            request,
            exc.status_code,
            title,
            safe_echo(str(exc.detail), 200),
            f"http-{exc.status_code}",
        )

    @app.exception_handler(Exception)
    async def _unhandled(request: Request, exc: Exception) -> JSONResponse:
        # Never leak internals. The request id lets an operator find the traceback in the logs.
        rid = getattr(request.state, "request_id", None)
        log.exception("unhandled error request_id=%s", rid)
        return problem(
            request, 500, "Internal error", "The server could not complete the request.", "internal"
        )
