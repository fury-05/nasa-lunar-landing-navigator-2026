"""Cap and expiry of stored custom sites (audit finding F11, issue #92)."""

import json
import os
import shutil
from datetime import UTC, datetime, timedelta
from pathlib import Path

import httpx
import pytest
from fakehorizons import fake_horizons
from lunar_api.jobs import (
    JobState,
    MemoryJobStore,
    custom_site_id,
    prune_custom_sites,
    run_custom_site,
)
from lunar_api.settings import Settings
from lunar_api.store import SiteStore
from lunar_engine.ephemeris import HorizonsClient

NOW = datetime(2026, 12, 20, 12, 0, tzinfo=UTC)


def _bundle(root: Path, site_id: str, age_days: float, *, meta: bool = True) -> None:
    folder = root / site_id
    folder.mkdir(parents=True)
    (folder / "skyline.npz").write_bytes(b"x")
    if meta:
        built = (NOW - timedelta(days=age_days)).strftime("%Y-%m-%dT%H:%M:%SZ")
        (folder / "meta.json").write_text(json.dumps({"built_at_utc": built}), encoding="utf8")


def _ids(n: int) -> list[str]:
    return [custom_site_id(-89.0 - i / 100, 10.0) for i in range(n)]


def left(root: Path) -> set[str]:
    return {p.name for p in root.iterdir()}


def test_oldest_custom_sites_are_evicted_first_down_to_the_cap(tmp_path: Path) -> None:
    ids = _ids(5)
    for i, sid in enumerate(ids):
        _bundle(tmp_path, sid, age_days=5 - i)  # ids[0] is the oldest
    gone = prune_custom_sites(tmp_path, max_sites=3, max_age_days=30, now=NOW)
    assert set(gone) == set(ids[:2]) and left(tmp_path) == set(ids[2:])


def test_sites_older_than_the_age_limit_expire_even_under_the_cap(tmp_path: Path) -> None:
    a, b = _ids(2)
    _bundle(tmp_path, a, age_days=8)
    _bundle(tmp_path, b, age_days=6.9)
    assert prune_custom_sites(tmp_path, max_sites=50, max_age_days=7, now=NOW) == [a]
    assert left(tmp_path) == {b}


def test_catalogue_and_unrelated_folders_are_never_touched(tmp_path: Path) -> None:
    _bundle(tmp_path, "apollo-11", age_days=900)
    _bundle(tmp_path, "custom-notahash", age_days=900)  # not a generated custom id
    (tmp_path / "stray.txt").write_text("x")
    for sid in _ids(3):
        _bundle(tmp_path, sid, age_days=100)
    prune_custom_sites(tmp_path, max_sites=0, max_age_days=1, now=NOW)
    assert left(tmp_path) == {"apollo-11", "custom-notahash", "stray.txt"}


def test_a_site_without_meta_falls_back_to_the_folder_time(tmp_path: Path) -> None:
    a, b = _ids(2)
    _bundle(tmp_path, a, age_days=0, meta=False)
    _bundle(tmp_path, b, age_days=0)
    old = (NOW - timedelta(days=20)).timestamp()
    os.utime(tmp_path / a, (old, old))
    assert prune_custom_sites(tmp_path, max_sites=50, max_age_days=7, now=NOW) == [a]


def test_missing_root_and_bad_limits(tmp_path: Path) -> None:
    assert prune_custom_sites(tmp_path / "nope", 5, 7, now=NOW) == []
    with pytest.raises(ValueError):
        prune_custom_sites(tmp_path, max_sites=-1, max_age_days=7, now=NOW)
    with pytest.raises(ValueError):
        prune_custom_sites(tmp_path, max_sites=1, max_age_days=0, now=NOW)


def test_limits_are_settings_driven(monkeypatch: pytest.MonkeyPatch) -> None:
    s = Settings.from_env()
    assert s.max_custom_sites == 50 and s.custom_max_age_days == 7.0
    monkeypatch.setenv("LUNAR_MAX_CUSTOM_SITES", "3")
    monkeypatch.setenv("LUNAR_CUSTOM_MAX_AGE_DAYS", "2.5")
    s = Settings.from_env()
    assert s.max_custom_sites == 3 and s.custom_max_age_days == 2.5


def test_a_finished_job_prunes_with_the_configured_cap(tmp_path: Path) -> None:
    out = tmp_path / "out"
    for sid in _ids(2):
        _bundle(out, sid, age_days=2)
    _bundle(out, "apollo-11", age_days=900)
    store = MemoryJobStore()
    store.create(JobState("j1", "x"))
    client = HorizonsClient(
        transport=httpx.MockTransport(fake_horizons(6.0)), sleep=lambda _s: None, min_interval_s=0
    )
    t0 = datetime(2026, 12, 1, tzinfo=UTC)
    run_custom_site(
        store, "j1", -89.5, 40.0, 0.0, client, tmp_path / "d", out, t0, 3,
        max_custom_sites=2, custom_max_age_days=7.0,
    )  # fmt: skip
    s = store.get("j1")
    assert s is not None and s.status == "done"
    kept = left(out)
    assert "apollo-11" in kept and s.result["site_id"] in kept  # the new site is never evicted
    assert len(kept - {"apollo-11"}) == 2


def test_the_store_stops_serving_a_site_that_was_deleted(bundle: Path) -> None:
    root = bundle.parent / "copy"
    shutil.copytree(bundle, root, dirs_exist_ok=True)
    store = SiteStore(root)
    store.get("alpha")
    shutil.rmtree(root / "alpha")
    with pytest.raises(KeyError):
        store.get("alpha")
