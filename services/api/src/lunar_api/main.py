"""FastAPI app. Walking skeleton: health, ready, version."""

from __future__ import annotations

import html
from typing import Any

from fastapi import FastAPI, Response
from fastapi.responses import HTMLResponse
from lunar_engine import ENGINE_VERSION

from lunar_api import API_VERSION
from lunar_api.caching import EtagMiddleware, RateLimitMiddleware
from lunar_api.checks import check_db, check_redis
from lunar_api.errors import install_error_handlers
from lunar_api.job_routes import router as job_router
from lunar_api.middleware import RequestIdMiddleware, SecurityHeadersMiddleware, configure_logging
from lunar_api.routes import router
from lunar_api.schemas import HealthOut, ReadyOut, VersionOut
from lunar_api.settings import Settings

DISCLAIMER = "Planning tool, not for flight operations."

app = FastAPI(
    title="Lunar Landing Site Navigator API",
    version=API_VERSION,
    description=DISCLAIMER,
    docs_url=None,  # the stock page loads Swagger UI from a third party CDN; see /api/v1/docs below
    openapi_url="/api/v1/openapi.json",
)
configure_logging(Settings.from_env().log_level)
app.add_middleware(EtagMiddleware)
_cfg = Settings.from_env()
app.add_middleware(
    RateLimitMiddleware,
    rate_per_s=_cfg.rate_per_s,
    burst=_cfg.rate_burst,
    heavy_rate_per_s=_cfg.heavy_rate_per_s,
    heavy_burst=_cfg.heavy_burst,
)
app.add_middleware(RequestIdMiddleware)
app.add_middleware(SecurityHeadersMiddleware)
install_error_handlers(app)
app.include_router(router)
app.include_router(job_router)


@app.get("/api/v1/health", response_model=HealthOut)
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/api/v1/ready", response_model=ReadyOut, responses={503: {"model": ReadyOut}})
def ready(response: Response) -> dict[str, Any]:
    cfg = Settings.from_env()
    db_ok, db_detail = check_db(cfg.database_url)
    redis_ok, redis_detail = check_redis(cfg.redis_url)
    ok = db_ok and redis_ok
    if not ok:
        response.status_code = 503
    return {
        "status": "ready" if ok else "not-ready",
        "checks": {
            "database": {"ok": db_ok, "detail": db_detail},
            "redis": {"ok": redis_ok, "detail": redis_detail},
        },
    }


@app.get("/api/v1/version", response_model=VersionOut)
def version() -> dict[str, str]:
    return {"api": API_VERSION, "engine": ENGINE_VERSION, "disclaimer": DISCLAIMER}


def _docs_html() -> str:
    """A dependency free reference page built from the live OpenAPI document."""
    rows = []
    for path, ops in sorted(app.openapi()["paths"].items()):
        for method, op in sorted(ops.items()):
            rows.append(
                f"<tr><td><code>{method.upper()}</code></td><td><code>{html.escape(path)}</code></td>"
                f"<td>{html.escape(op.get('summary', ''))}</td></tr>"
            )
    return (
        "<!doctype html><html lang=en><meta charset=utf-8>"
        "<title>Lunar Landing Site Navigator API</title>"
        "<style>body{font:16px/1.5 system-ui;margin:2rem auto;max-width:60rem;padding:0 1rem}"
        "td,th{padding:.3rem .8rem;text-align:left;border-bottom:1px solid #8884}</style>"
        f"<h1>Lunar Landing Site Navigator API</h1><p>{html.escape(DISCLAIMER)}</p>"
        "<p>Machine readable contract: <a href=/api/v1/openapi.json>openapi.json</a>. "
        "Errors are RFC 7807 problem documents. Times are UTC.</p>"
        "<table><tr><th>Method<th>Path<th>Summary</tr>" + "".join(rows) + "</table></html>"
    )


@app.get("/api/v1/docs", include_in_schema=False)
def docs() -> HTMLResponse:
    return HTMLResponse(_docs_html())
