"""FastAPI app. Walking skeleton: health, ready, version."""

from __future__ import annotations

import html
import threading
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from typing import Any

from fastapi import FastAPI, Response
from fastapi.responses import HTMLResponse
from lunar_engine import ENGINE_VERSION

from lunar_api import API_VERSION
from lunar_api.caching import EtagMiddleware, RateLimitMiddleware
from lunar_api.checks import check_db, check_redis
from lunar_api.degraded import snapshot
from lunar_api.errors import install_error_handlers
from lunar_api.job_routes import router as job_router
from lunar_api.lander_routes import router as lander_router
from lunar_api.middleware import RequestIdMiddleware, SecurityHeadersMiddleware, configure_logging
from lunar_api.routes import get_store, router
from lunar_api.schemas import HealthOut, ReadyOut, VersionOut
from lunar_api.settings import Settings
from lunar_api.terrain_routes import router as terrain_router

DISCLAIMER = "Planning tool, not for flight operations."

WARM: dict[str, Any] = {"state": "idle", "sites": {}}


def _warm_in_background() -> None:
    WARM["state"] = "running"
    try:
        store = get_store(Settings.from_env())
        WARM["sites"] = store.warm()
        WARM["state"] = "done"
    except Exception as exc:  # noqa: BLE001 - startup must never fail because of warming
        WARM["state"] = f"failed: {type(exc).__name__}"


@asynccontextmanager
async def lifespan(_app: FastAPI) -> AsyncIterator[None]:
    """Warm the caches in the background so the first visitor never waits for them."""
    if Settings.from_env().data_dir.exists():
        threading.Thread(target=_warm_in_background, name="warm", daemon=True).start()
    yield


app = FastAPI(
    title="Lunar Landing Site Navigator API",
    version=API_VERSION,
    description=DISCLAIMER,
    docs_url=None,  # the stock page loads Swagger UI from a third party CDN; see /api/v1/docs below
    openapi_url="/api/v1/openapi.json",
    lifespan=lifespan,
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
app.include_router(terrain_router)
app.include_router(lander_router)


def _degraded(cfg: Settings) -> dict[str, Any] | None:
    stored = cfg.data_dir.exists() and any(cfg.data_dir.glob("*/meta.json"))
    return snapshot(cfg.redis_url, bool(stored))


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
        "horizons_degraded": _degraded(cfg),
    }


@app.get("/api/v1/version", response_model=VersionOut)
def version() -> dict[str, Any]:
    return {
        "api": API_VERSION,
        "engine": ENGINE_VERSION,
        "disclaimer": DISCLAIMER,
        "horizons_degraded": _degraded(Settings.from_env()),
    }


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
