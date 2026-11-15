"""Custom-site jobs use the multi-tier far terrain, like scripts/precompute_sites.py (H1)."""

import asyncio
import hashlib
import json
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

import fakeredis
import httpx
import numpy as np
import pytest
import rasterio
from fakehorizons import fake_horizons
from lunar_api import far_verify, worker
from lunar_api.far_verify import FarDataError, load_far_manifest, verify_far_files
from lunar_api.jobs import JobState, MemoryJobStore, RedisJobStore, run_custom_site
from lunar_engine.ephemeris import HorizonsClient
from lunar_engine.far_data import EFFRES_20M, ERR_20M, LDEM_20M
from lunar_engine.links import south_polar_xy
from rasterio.transform import from_origin

T0 = datetime(2026, 12, 1, tzinfo=UTC)
LAT, LON = -89.5, 40.0
SX, SY = south_polar_xy(LAT, LON)
RANGE_M = 20_000.0


def _client() -> HorizonsClient:
    return HorizonsClient(
        transport=httpx.MockTransport(fake_horizons(6.0)), sleep=lambda _s: None, min_interval_s=0
    )


def _raster(path: Path, half: float, px: float, value: float, centre: tuple[float, float]) -> None:
    n = int(2 * half / px)
    x = (np.arange(n) + 0.5) * px - half  # east-west ramp of 0.02, so some terrain sets the horizon
    ramp = np.tile(x * 0.02, (n, 1)) if value == 90.0 else 0.0
    path.parent.mkdir(parents=True, exist_ok=True)
    with rasterio.open(
        path, "w", driver="GTiff", width=n, height=n, count=1, dtype="float32",
        transform=from_origin(centre[0] - half, centre[1] + half, px, px), nodata=float("nan"),
    ) as ds:  # fmt: skip
        ds.write((np.full((n, n), value) + ramp).astype(np.float32), 1)


def _sha(p: Path) -> str:
    return hashlib.sha256(p.read_bytes()).hexdigest()


@pytest.fixture()
def far(tmp_path: Path) -> tuple[Path, dict[str, str | None]]:
    d = tmp_path / "far"
    _raster(d / LDEM_20M, 30_000.0, 20.0, 90.0, (SX, SY))
    _raster(d / ERR_20M, 30_000.0, 20.0, 2.5, (SX, SY))
    _raster(d / EFFRES_20M, 30_000.0, 20.0, 60.0, (SX, SY))
    return d, {n: _sha(d / n) for n in (LDEM_20M, ERR_20M, EFFRES_20M)}


def _job(
    tmp_path: Path, far_dir: Path | None, manifest: dict[str, str | None] | None, **kw: Any
) -> tuple[MemoryJobStore, Any]:
    far_verify.reset_cache()
    store = MemoryJobStore()
    store.create(JobState("j1", "x"))
    run_custom_site(
        store, "j1", LAT, LON, 0.0, _client(), kw.pop("dem_dir", tmp_path / "nodem"),
        tmp_path / "out", T0, 3, far_dir=far_dir, far_sha256=manifest, max_range_m=RANGE_M,
        **kw,
    )  # fmt: skip
    return store, store.get("j1")


def test_a_point_without_a_site_tile_gets_the_ldem_tiers_and_a_long_reach(
    tmp_path: Path, far: tuple[Path, dict[str, str | None]]
) -> None:
    d, manifest = far
    _, s = _job(tmp_path, d, manifest)
    assert s.status == "done", s.reason
    assert s.result["terrain_unavailable"] is False and s.result["tiers"] == ["ldem-20m"]
    meta = json.loads((tmp_path / "out" / s.result["site_id"] / "meta.json").read_text("utf8"))
    assert meta["terrain_unavailable"] is False
    assert meta["skyline"]["tiers"] == ["ldem-20m"]
    assert meta["skyline"]["max_reach_m"] > 8_000.0  # the old near-tile build stopped at 8 km
    assert meta["skyline"]["dem_error_deg_p95"] is not None  # ERR product applied
    assert set(meta["dem"]["far_files"]) == {LDEM_20M, ERR_20M, EFFRES_20M}
    assert all(meta["dem"]["far_files"][n] == manifest[n] for n in meta["dem"]["far_files"])
    assert "lola-dem-wide" in meta["sources"]


def test_the_site_tile_stays_the_nearest_tier_and_progress_names_the_tiers(
    tmp_path: Path, far: tuple[Path, dict[str, str | None]]
) -> None:
    d, manifest = far
    _raster(tmp_path / "dem" / "T_final_adj_5mpp_surf.tif", 3000.0, 10.0, 80.0, (SX, SY))
    messages: list[str] = []

    class Spy(MemoryJobStore):
        def update(self, job_id: str, **changes):  # type: ignore[no-untyped-def]
            if "message" in changes:
                messages.append(changes["message"])
            return super().update(job_id, **changes)

    far_verify.reset_cache()
    store = Spy()
    store.create(JobState("j1", "x"))
    run_custom_site(
        store, "j1", LAT, LON, 0.0, _client(), tmp_path / "dem", tmp_path / "out", T0, 3,
        far_dir=d, far_sha256=manifest, max_range_m=RANGE_M,
    )  # fmt: skip
    s = store.get("j1")
    assert s is not None and s.status == "done", s.reason if s else None
    assert s.result["tiers"] == ["site-tile-5m", "ldem-20m"]
    assert any("site-tile-5m" in m and "ldem-20m" in m for m in messages)


def test_a_far_file_whose_checksum_differs_refuses_the_build(
    tmp_path: Path, far: tuple[Path, dict[str, str | None]]
) -> None:
    d, manifest = far
    bad = dict(manifest, **{LDEM_20M: "0" * 64})
    _, s = _job(tmp_path, d, bad)
    assert s.status == "failed" and "checksum" in (s.reason or "") and LDEM_20M in (s.reason or "")
    assert s.retryable is False
    assert not (tmp_path / "out").exists() or not any((tmp_path / "out").iterdir())


def test_a_far_file_without_a_verified_checksum_is_refused(
    tmp_path: Path, far: tuple[Path, dict[str, str | None]]
) -> None:
    d, manifest = far
    _, s = _job(tmp_path, d, dict(manifest, **{ERR_20M: None}))
    assert s.status == "failed" and "no verified sha256" in (s.reason or "")
    _, s2 = _job(tmp_path, d, {k: v for k, v in manifest.items() if k != ERR_20M})
    assert s2.status == "failed" and ERR_20M in (s2.reason or "")


def test_no_tier_covering_the_point_is_terrain_unavailable_not_a_guess(tmp_path: Path) -> None:
    d = tmp_path / "far"
    _raster(d / LDEM_20M, 5_000.0, 20.0, 90.0, (SX + 100_000.0, SY))  # elsewhere
    _, s = _job(tmp_path, d, {LDEM_20M: _sha(d / LDEM_20M)})
    assert s.status == "done" and s.result["terrain_unavailable"] is True
    assert s.result["tiers"] == [] and "NOT terrain aware" in s.result["warnings"][0]


def test_an_empty_or_missing_far_folder_falls_back_to_the_site_tile_only(tmp_path: Path) -> None:
    (tmp_path / "far").mkdir()
    for d in (tmp_path / "far", tmp_path / "does-not-exist"):
        _, s = _job(tmp_path, d, {})
        assert s.status == "done" and s.result["terrain_unavailable"] is True
    _raster(tmp_path / "dem" / "T_final_adj_5mpp_surf.tif", 3000.0, 10.0, 80.0, (SX, SY))
    _, s = _job(tmp_path, tmp_path / "far", {}, dem_dir=tmp_path / "dem")
    assert s.status == "done" and s.result["terrain_unavailable"] is False
    assert s.result["tiers"] == ["site-tile-5m"]


def test_without_a_far_dir_the_old_near_tile_build_runs(tmp_path: Path) -> None:
    _raster(tmp_path / "dem" / "T_final_adj_5mpp_surf.tif", 3000.0, 10.0, 80.0, (SX, SY))
    _, s = _job(tmp_path, None, None, dem_dir=tmp_path / "dem")
    assert s.status == "done" and s.result["tiers"] == ["site-tile-5m"]
    meta = json.loads((tmp_path / "out" / s.result["site_id"] / "meta.json").read_text("utf8"))
    assert meta["skyline"]["tiers"] is None


def test_checksums_are_computed_once_per_file(
    tmp_path: Path, far: tuple[Path, dict[str, str | None]], monkeypatch: pytest.MonkeyPatch
) -> None:
    d, manifest = far
    calls: list[str] = []
    real = far_verify.sha256_file

    def counting(p: Path) -> str:
        calls.append(p.name)
        return real(p)

    monkeypatch.setattr(far_verify, "sha256_file", counting)
    far_verify.reset_cache()
    verify_far_files(d, [LDEM_20M, ERR_20M], manifest)
    verify_far_files(d, [LDEM_20M, ERR_20M], manifest)
    assert sorted(calls) == sorted([LDEM_20M, ERR_20M])
    # a fresh process trusts the sidecar while size and modification time are unchanged
    far_verify.reset_cache()
    verify_far_files(d, [LDEM_20M], manifest)
    assert calls.count(LDEM_20M) == 1
    # a changed file is hashed again and caught
    (d / LDEM_20M).write_bytes((d / LDEM_20M).read_bytes() + b"x")
    far_verify.reset_cache()
    with pytest.raises(FarDataError, match="checksum"):
        verify_far_files(d, [LDEM_20M], manifest)


def test_the_repository_far_manifest_loads_with_verified_hashes() -> None:
    m = load_far_manifest()
    assert LDEM_20M in m and m[LDEM_20M] and len(m[LDEM_20M] or "") == 64


def test_the_worker_reads_the_far_dir_and_range_from_settings(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    seen: dict[str, Any] = {}

    def fake_run(*args: Any, **kwargs: Any) -> None:
        seen.update(kwargs)

    monkeypatch.setattr(worker, "run_custom_site", fake_run)
    monkeypatch.setenv("LUNAR_FAR_DIR", str(tmp_path / "farfiles"))
    monkeypatch.setenv("LUNAR_CUSTOM_MAX_RANGE_M", "123000")
    monkeypatch.setenv("LUNAR_PRECOMPUTE_DIR", str(tmp_path / "pre"))
    r = fakeredis.FakeRedis()
    RedisJobStore(r).create(JobState("job-w", "custom-w"))
    asyncio.run(worker.custom_site({"sync_redis": r}, "job-w", LAT, LON, 0.0, T0.isoformat(), 3))
    assert seen["far_dir"] == tmp_path / "farfiles" and seen["max_range_m"] == 123_000.0
    assert isinstance(seen["far_sha256"], dict) and LDEM_20M in seen["far_sha256"]
