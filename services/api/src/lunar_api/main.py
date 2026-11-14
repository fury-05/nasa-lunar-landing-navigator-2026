"""FastAPI app. Walking skeleton: health, ready, version."""

from __future__ import annotations

from typing import Any

from fastapi import FastAPI, Response
from lunar_engine import ENGINE_VERSION

from lunar_api import API_VERSION
from lunar_api.checks import check_db, check_redis
from lunar_api.errors import install_error_handlers
from lunar_api.job_routes import router as job_router
from lunar_api.middleware import RequestIdMiddleware, configure_logging
from lunar_api.routes import router
from lunar_api.settings import Settings

DISCLAIMER = "Planning tool, not for flight operations."

app = FastAPI(
    title="Lunar Landing Site Navigator API",
    version=API_VERSION,
    description=DISCLAIMER,
    docs_url="/api/v1/docs",
    openapi_url="/api/v1/openapi.json",
)
configure_logging(Settings.from_env().log_level)
app.add_middleware(RequestIdMiddleware)
install_error_handlers(app)
app.include_router(router)
app.include_router(job_router)


@app.get("/api/v1/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/api/v1/ready")
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


@app.get("/api/v1/version")
def version() -> dict[str, str]:
    return {"api": API_VERSION, "engine": ENGINE_VERSION, "disclaimer": DISCLAIMER}
