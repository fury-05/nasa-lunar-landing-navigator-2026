"""Precompute pipeline and storage layout for catalogue sites (P2-09, P1-11).

Layout under `<out_dir>/<site_id>/`:
    meta.json     provenance: Horizons version and request hashes, frame header, DEM file and
                  sha256, skyline settings and coverage, engine version, real build time
    skyline.npz   azimuth_deg, elevation_deg, reach_m
    sun.npz       t (int64 seconds since 1970-01-01 UTC), az, el, dist_km
    earth.npz     same columns

Horizons is asked for 30 day chunks at the series step (docs/04 section 1). Consecutive chunks share
a boundary row, which is dropped once, and the stitched series must be a perfectly regular grid or
the build fails. Nothing is invented: a missing chunk raises, it never leaves a gap.
"""

from __future__ import annotations

import json
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from pathlib import Path
from typing import Any

import numpy as np

from lunar_engine import ENGINE_VERSION
from lunar_engine.compare import SiteSky
from lunar_engine.ephemeris import HorizonsClient
from lunar_engine.ephemeris.client import EARTH, SUN, observer_params
from lunar_engine.geometry import sphere_dip_deg
from lunar_engine.metrics import AU_KM, BodySeries
from lunar_engine.skyline import Skyline, cast_skyline
from lunar_engine.terrain import DemTile

CHUNK_DAYS = 30
FMT = "%Y-%m-%d %H:%M"


def chunk_ranges(
    start: datetime, end: datetime, days: int = CHUNK_DAYS
) -> list[tuple[datetime, datetime]]:
    """Back to back ranges covering [start, end]; each stop equals the next start."""
    if end <= start:
        raise ValueError("end must be after start")
    out: list[tuple[datetime, datetime]] = []
    a = start
    while a < end:
        b = min(a + timedelta(days=days), end)
        out.append((a, b))
        a = b
    return out


def fetch_body_series(
    client: HorizonsClient, body: str, lon_east_deg: float, lat_deg: float,
    start: datetime, end: datetime, step_min: int = 10,
) -> tuple[BodySeries, dict[str, Any]]:
    """One stitched series for a body. Returns the series and a provenance summary."""
    step = timedelta(minutes=step_min)
    times: list[datetime] = []
    az: list[float] = []
    el: list[float] = []
    dist: list[float] = []
    hashes: list[str] = []
    versions: set[str] = set()
    frame: dict[str, str] = {}
    for a, b in chunk_ranges(start, end):
        params = observer_params(
            body, lon_east_deg, lat_deg, 0.0, a.strftime(FMT), b.strftime(FMT), f"{step_min}m"
        )
        table, prov = client.observer(params)
        hashes.append(prov["request_sha256"])
        versions.add(str(prov["api_version"]))
        frame = frame or prov["frame_header"]
        for row in table.rows:
            if times and row.time_utc <= times[-1]:
                continue  # shared boundary row
            if row.azimuth_deg is None or row.elevation_deg is None or row.delta_au is None:
                raise ValueError(f"Horizons returned an incomplete row at {row.time_utc}")
            times.append(row.time_utc)
            az.append(row.azimuth_deg)
            el.append(row.elevation_deg)
            dist.append(row.delta_au * AU_KM)
    gaps = [i for i in range(1, len(times)) if times[i] - times[i - 1] != step]
    if gaps or times[0] != start or times[-1] != end:
        raise ValueError(f"series is not a regular {step_min} minute grid over the window")
    series = BodySeries(times, np.array(az), np.array(el), np.array(dist))
    prov = {"request_sha256": hashes, "api_versions": sorted(versions), "frame_header": frame}
    return series, prov


def _epoch(times: list[datetime]) -> Any:
    return np.array([int(t.timestamp()) for t in times], dtype=np.int64)


def save_series(path: Path, s: BodySeries) -> None:
    np.savez_compressed(
        path, t=_epoch(s.times), az=s.azimuth_deg, el=s.elevation_deg, dist_km=s.distance_km
    )


def load_series(path: Path) -> BodySeries:
    with np.load(path) as z:
        times = [datetime.fromtimestamp(int(t), UTC) for t in z["t"]]
        return BodySeries(times, z["az"].astype(float), z["el"].astype(float),
                          z["dist_km"].astype(float))


def save_skyline(path: Path, sky: Skyline) -> None:
    np.savez_compressed(
        path, azimuth_deg=sky.azimuth_deg, elevation_deg=sky.elevation_deg, reach_m=sky.reach_m,
        meta=np.array([sky.max_range_m, sky.eye_height_m, sky.site_height_m, sky.sphere_dip_deg]),
    )


def load_skyline(path: Path) -> Skyline:
    with np.load(path) as z:
        m = z["meta"]
        return Skyline(z["azimuth_deg"], z["elevation_deg"], z["reach_m"], float(m[0]),
                       float(m[1]), float(m[2]), float(m[3]))


def flat_skyline(eye_height_m: float, azimuth_step_deg: float) -> Skyline:
    """Bare-sphere horizon for a point with no terrain data. Reach is 0 so it reads as uncovered."""
    az = np.arange(0.0, 360.0, azimuth_step_deg, dtype=np.float64)
    dip = sphere_dip_deg(eye_height_m)
    return Skyline(az, np.full_like(az, dip), np.zeros_like(az), 0.0, eye_height_m, 0.0, dip)


@dataclass(frozen=True)
class BuildSettings:
    start: datetime
    end: datetime
    step_min: int = 10
    eye_height_m: float = 1.0
    max_range_m: float = 16_000.0
    azimuth_step_deg: float = 0.25


def build_site(
    client: HorizonsClient, site_id: str, lat_deg: float, lon_east_deg: float,
    tile: DemTile | None,
    dem_info: dict[str, Any], out_dir: Path, settings: BuildSettings,
) -> Path:
    """Build and store everything for one site. Returns the site folder."""
    folder = out_dir / site_id
    folder.mkdir(parents=True, exist_ok=True)
    if tile is None:
        sky = flat_skyline(settings.eye_height_m, settings.azimuth_step_deg)
    else:
        sky = cast_skyline(tile, lat_deg, lon_east_deg, settings.eye_height_m,
                           settings.max_range_m, settings.azimuth_step_deg)
    sun, sun_prov = fetch_body_series(client, SUN, lon_east_deg, lat_deg, settings.start,
                                      settings.end, settings.step_min)
    earth, earth_prov = fetch_body_series(client, EARTH, lon_east_deg, lat_deg, settings.start,
                                          settings.end, settings.step_min)
    save_skyline(folder / "skyline.npz", sky)
    save_series(folder / "sun.npz", sun)
    save_series(folder / "earth.npz", earth)
    meta = {
        "schema": 1,
        "site_id": site_id,
        "lat_deg": lat_deg,
        "lon_east_deg": lon_east_deg,
        "built_at_utc": datetime.now(UTC).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "engine_version": ENGINE_VERSION,
        "window": {"start_utc": settings.start.isoformat(), "end_utc": settings.end.isoformat(),
                   "step_min": settings.step_min, "samples": len(sun.times)},
        "skyline": {
            "eye_height_m": settings.eye_height_m, "max_range_m": settings.max_range_m,
            "azimuth_step_deg": settings.azimuth_step_deg, "site_height_m": sky.site_height_m,
            "sphere_dip_deg": sky.sphere_dip_deg, "covered_fraction": sky.covered_fraction(),
            "min_reach_m": sky.min_reach_m(), "max_reach_m": float(sky.reach_m.max()),
        },
        "dem": dem_info,
        "sources": ["horizons"] if tile is None else ["horizons", "lola-dem"],
        "terrain_unavailable": tile is None,
        "horizons": {"sun": sun_prov, "earth": earth_prov},
        "assumptions": (
            [
                "NO TERRAIN DATA covers this point: the horizon is the bare sphere, so results "
                "are NOT terrain aware and can only overstate sunlight and Earth visibility",
                "Horizons frame MEAN_ME (ADR-0004)",
            ]
            if tile is None
            else [
                "site is the centre of the DEM tile (derived, not a landing point)",
                "Horizons frame MEAN_ME versus DEM frame MOON_ME treated as equal "
                "(ADR-0004, ADR-0003)",
                f"skyline covers {sky.min_reach_m():.0f} to {float(sky.reach_m.max()):.0f} m of "
                "terrain; beyond that no data (approval item A2)",
            ]
        ),
    }
    (folder / "meta.json").write_text(json.dumps(meta, indent=2) + "\n", encoding="utf8")
    return folder


def load_site(out_dir: Path, site_id: str) -> tuple[SiteSky, dict[str, Any]]:
    folder = out_dir / site_id
    meta = json.loads((folder / "meta.json").read_text(encoding="utf8"))
    sky = load_skyline(folder / "skyline.npz")
    return SiteSky(site_id, sky, load_series(folder / "sun.npz"),
                   load_series(folder / "earth.npz")), meta
