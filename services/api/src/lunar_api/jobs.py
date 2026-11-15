"""Custom-site jobs (P3-04, docs/03 and docs/05).

A custom coordinate needs a Horizons series and a skyline, which takes seconds, so it runs as a
job: validate, find terrain, fetch Horizons, cast the skyline, store a bundle, report progress.
The job logic here knows nothing about Redis. `JobStore` keeps status, `run_custom_site` does the
work, and the arq worker or an in-process thread calls it.

If no downloaded DEM tile contains the point, the result is a flat-horizon bundle flagged
`terrain_unavailable`, as docs/03 requires, never a made-up skyline.
"""

from __future__ import annotations

import hashlib
import json
import math
import threading
import time
from collections.abc import Callable
from dataclasses import asdict, dataclass, field
from datetime import UTC, datetime, timedelta
from pathlib import Path
from typing import Any, Protocol

from lunar_engine.ephemeris import HorizonsClient
from lunar_engine.ephemeris.client import _Retryable
from lunar_engine.links import south_polar_xy
from lunar_engine.precompute import BuildSettings, build_site
from lunar_engine.terrain import DemTile, read_tile

from lunar_api.degraded import Health

JOB_TIMEOUT_S = 120.0
TERMINAL = {"done", "failed"}
MIN_SOUTH_LAT = -89.999  # the polar projection is singular at the pole itself
UNREACHABLE_MESSAGE = "The Horizons service could not be reached; try again in a minute."


class JobError(Exception):
    """A failure with a reason the user can read."""


@dataclass
class JobState:
    job_id: str
    site_id: str
    status: str = "queued"  # queued, running, done, failed
    progress: float = 0.0
    message: str = "waiting for a worker"
    reason: str | None = None
    created_at_utc: str = ""
    updated_at_utc: str = ""
    result: dict[str, Any] = field(default_factory=dict)
    # True when the failure was transient (network error or Horizons 500/503): POSTing again helps.
    retryable: bool = False
    # Restarts after a failure. Part of the arq queue id, which arq will not reuse (issue #152).
    attempt: int = 0

    def public(self) -> dict[str, Any]:
        return asdict(self)


def now_utc() -> str:
    return datetime.now(UTC).strftime("%Y-%m-%dT%H:%M:%SZ")


def custom_site_id(lat_deg: float, lon_east_deg: float, alt_m: float = 0.0) -> str:
    """Deterministic id from the rounded coordinates: the same point always gives the same id."""
    key = f"{lat_deg:.5f},{lon_east_deg:.5f},{alt_m:.1f}"
    return "custom-" + hashlib.sha256(key.encode()).hexdigest()[:12]


def validate_point(lat_deg: float, lon_east_deg: float, alt_m: float) -> None:
    if not (math.isfinite(lat_deg) and math.isfinite(lon_east_deg) and math.isfinite(alt_m)):
        raise JobError("coordinates must be finite numbers")
    if not -90.0 <= lat_deg <= 90.0:
        raise JobError("latitude must be within [-90, 90]")
    if not -180.0 <= lon_east_deg <= 180.0:
        raise JobError("longitude must be within [-180, 180], east positive")
    if not -10_000.0 <= alt_m <= 10_000.0:
        raise JobError("altitude must be within +-10000 m of the reference sphere")


class JobStore(Protocol):
    def create(self, state: JobState) -> None: ...
    def get(self, job_id: str) -> JobState | None: ...
    def update(self, job_id: str, **changes: Any) -> JobState: ...


class MemoryJobStore:
    def __init__(self) -> None:
        self._jobs: dict[str, JobState] = {}
        self._lock = threading.Lock()

    def create(self, state: JobState) -> None:
        state.created_at_utc = state.updated_at_utc = now_utc()
        with self._lock:
            self._jobs[state.job_id] = state

    def get(self, job_id: str) -> JobState | None:
        with self._lock:
            s = self._jobs.get(job_id)
            return None if s is None else JobState(**asdict(s))

    def update(self, job_id: str, **changes: Any) -> JobState:
        with self._lock:
            s = self._jobs[job_id]
            for k, v in changes.items():
                setattr(s, k, v)
            s.updated_at_utc = now_utc()
            return JobState(**asdict(s))


class RedisJobStore:
    """Job state in Redis hashes with a one day expiry. Same interface as MemoryJobStore."""

    def __init__(self, client: Any, ttl_s: int = 86_400) -> None:
        self.r, self.ttl = client, ttl_s

    def _key(self, job_id: str) -> str:
        return f"lunar:job:{job_id}"

    def create(self, state: JobState) -> None:
        state.created_at_utc = state.updated_at_utc = now_utc()
        self.r.set(self._key(state.job_id), json.dumps(asdict(state)), ex=self.ttl)

    def get(self, job_id: str) -> JobState | None:
        raw = self.r.get(self._key(job_id))
        return None if raw is None else JobState(**json.loads(raw))

    def update(self, job_id: str, **changes: Any) -> JobState:
        s = self.get(job_id)
        if s is None:
            raise KeyError(job_id)
        for k, v in changes.items():
            setattr(s, k, v)
        s.updated_at_utc = now_utc()
        self.r.set(self._key(job_id), json.dumps(asdict(s)), ex=self.ttl)
        return s


def find_tile(
    dem_dir: Path, lat_deg: float, lon_east_deg: float, margin_m: float = 50.0
) -> Path | None:
    """First downloaded DEM tile whose extent contains the point (with a small margin)."""
    if lat_deg > -75.0 or not dem_dir.exists():
        return None
    x, y = south_polar_xy(lat_deg, lon_east_deg)
    import rasterio

    for p in sorted(dem_dir.glob("*_surf*.tif")):
        with rasterio.open(p) as ds:
            b = ds.bounds
            if (
                b.left + margin_m <= x <= b.right - margin_m
                and b.bottom + margin_m <= y <= b.top - margin_m
            ):
                return p
    return None


def run_custom_site(
    store: JobStore,
    job_id: str,
    lat_deg: float,
    lon_east_deg: float,
    alt_m: float,
    client: HorizonsClient,
    dem_dir: Path,
    out_dir: Path,
    start: datetime,
    days: int,
    timeout_s: float = JOB_TIMEOUT_S,
    clock: Callable[[], float] = time.monotonic,
    load_tile: Callable[[Path], DemTile] = read_tile,
    health: Health | None = None,
) -> None:
    """Do the work and keep the job state current. Never raises; failures become state."""
    t0 = clock()

    def step(progress: float, message: str) -> None:
        if clock() - t0 > timeout_s:
            raise JobError(f"timed out after {timeout_s:.0f} s")
        store.update(job_id, status="running", progress=progress, message=message)

    site_id = custom_site_id(lat_deg, lon_east_deg, alt_m)
    try:
        step(0.05, "validating the coordinates")
        validate_point(lat_deg, lon_east_deg, alt_m)
        if lat_deg > MIN_SOUTH_LAT and lat_deg >= -90.0 and lat_deg > -75.0:
            note = "latitude north of -75: no polar DEM, flat horizon only"
        else:
            note = ""
        step(0.15, "looking for terrain data")
        tile_path = find_tile(dem_dir, lat_deg, lon_east_deg)
        tile = load_tile(tile_path) if tile_path else None
        step(0.3, "terrain found" if tile else "no terrain data here: flat horizon will be used")
        settings = BuildSettings(start, start + timedelta(days=days), max_range_m=8_000.0)
        step(0.4, "fetching Sun and Earth positions from Horizons")
        build_site(
            client,
            site_id,
            lat_deg,
            lon_east_deg,
            tile,
            {
                "file": tile_path.name if tile_path else None,
                "custom": True,
                "terrain": "available" if tile else "unavailable",
                "note": note,
            },
            out_dir,
            settings,
        )
        if health is not None:
            health.record_success()
        step(0.95, "storing the result")
        meta = json.loads((out_dir / site_id / "meta.json").read_text(encoding="utf8"))
        store.update(
            job_id,
            status="done",
            progress=1.0,
            message="finished",
            result={
                "site_id": site_id,
                "terrain_unavailable": tile is None,
                "built_at_utc": meta["built_at_utc"],
                "warnings": (
                    [
                        "No terrain data covers this point. Results assume a flat horizon "
                        "and are NOT terrain aware."
                    ]
                    if tile is None
                    else []
                ),
            },
        )
    except JobError as exc:
        store.update(job_id, status="failed", reason=str(exc), message="failed", retryable=False)
    except _Retryable:
        # The raw text ("_Retryable: network error: ConnectError") means nothing to a visitor.
        if health is not None:
            health.record_failure(UNREACHABLE_MESSAGE.rstrip("."))
        store.update(
            job_id, status="failed", reason=UNREACHABLE_MESSAGE, message="failed", retryable=True
        )
    except Exception as exc:  # noqa: BLE001 - a job must always end in a recorded state
        store.update(
            job_id,
            status="failed",
            reason=f"{type(exc).__name__}: {exc}"[:300],
            message="failed",
            retryable=False,
        )
