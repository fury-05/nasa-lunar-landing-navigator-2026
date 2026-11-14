"""arq worker. No jobs yet; custom-site jobs arrive in phase 3."""

from __future__ import annotations

import os
from typing import Any

from arq.connections import RedisSettings


async def ping(ctx: dict[str, Any]) -> str:
    return "pong"


class WorkerSettings:
    functions = [ping]
    redis_settings = RedisSettings.from_dsn(os.environ.get("REDIS_URL", "redis://127.0.0.1:6379/0"))
