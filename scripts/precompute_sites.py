"""Build the precomputed bundle for catalogue sites that have a DEM tile (P2-09, P1-11).

Usage:
  uv run python scripts/precompute_sites.py --dem-dir DIR --out DIR --cache DIR \
      --start 2026-12-01 --days 365 [--sites pgda-site04 ...] [--far-dir DIR]

With --far-dir (ADR-0007, the folder made by scripts/fetch_far_terrain.sh) the skyline is cast
over several tiers: the site tile and the 87S 5 m mosaic near, the 20 m LDEM out to --max-range-m
(default 300000 m when --far-dir is given, else 16000 m), and the ERR product for the DEM error.
Every far file used must match its sha256 in data/MANIFEST.far.json, and a missing sha256 refuses
the build (the download has not been verified). Without --far-dir the old single tile build runs.

Reads data/sites.json and data/MANIFEST.json; only sites whose tile centre falls inside a downloaded
PGDA tile are built, and the DEM file checksum must match the manifest. Horizons calls are polite
(1 per second, cached). Safe to re-run: finished sites are skipped unless --force.
"""

import argparse
import hashlib
import json
import sys
from datetime import UTC, datetime, timedelta
from pathlib import Path

from lunar_engine.ephemeris import HorizonsClient
from lunar_engine.far_data import load_far_tiers
from lunar_engine.precompute import BuildSettings, build_site
from lunar_engine.terrain import read_tile

ROOT = Path(__file__).resolve().parents[1]


def sha256(p: Path) -> str:
    h = hashlib.sha256()
    with p.open("rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


_SHA: dict[Path, str] = {}


def sha256_once(p: Path) -> str:
    """Checksum a large far file once per run, not once per site."""
    if p not in _SHA:
        _SHA[p] = sha256(p)
    return _SHA[p]


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--dem-dir", required=True, type=Path)
    ap.add_argument("--out", required=True, type=Path)
    ap.add_argument("--cache", required=True, type=Path)
    ap.add_argument("--start", required=True)
    ap.add_argument("--days", required=True, type=int)
    ap.add_argument("--sites", nargs="*")
    ap.add_argument("--far-dir", type=Path, default=None)
    ap.add_argument("--max-range-m", type=float, default=None)
    ap.add_argument("--force", action="store_true")
    a = ap.parse_args()

    start = datetime.fromisoformat(a.start).replace(tzinfo=UTC)
    max_range = a.max_range_m or (300_000.0 if a.far_dir else 16_000.0)
    settings = BuildSettings(start, start + timedelta(days=a.days), max_range_m=max_range)
    far_manifest = {}
    if a.far_dir:
        far_doc = json.loads((ROOT / "data" / "MANIFEST.far.json").read_text("utf8"))
        far_manifest = {f["filename"]: f for f in far_doc["files"]}
    sites = json.loads((ROOT / "data" / "sites.json").read_text("utf8"))["sites"]
    manifest = {f["filename"]: f for f in json.loads((ROOT / "data" / "MANIFEST.json").read_text("utf8"))["files"]}
    client = HorizonsClient(cache_dir=a.cache)
    built = 0
    for s in sites:
        if s["kind"] != "pgda-tile" or (a.sites and s["id"] not in a.sites):
            continue
        stem = s["source_url"].rsplit("/", 1)[-1]
        dem = a.dem_dir / stem
        if stem not in manifest or not dem.exists():
            print("skip (no downloaded tile):", s["id"])
            continue
        if sha256(dem) != manifest[stem]["sha256"]:
            print("REFUSED (checksum differs from manifest):", s["id"])
            return 1
        if (a.out / s["id"] / "meta.json").exists() and not a.force:
            print("already built:", s["id"])
            continue
        tile = read_tile(dem)
        info = {"file": stem, "sha256": manifest[stem]["sha256"], "manifest_id": manifest[stem]["id"]}
        tiers = err = effres = None
        if a.far_dir:
            far = load_far_tiers(a.far_dir, tile, s["lat_deg"], s["lon_east_deg"], max_range)
            bad = [f for f in far.files if not far_manifest.get(f, {}).get("sha256")]
            if bad:
                print("REFUSED (no verified sha256 in data/MANIFEST.far.json for):", ", ".join(bad))
                return 1
            for f in far.files:
                if sha256_once(a.far_dir / f) != far_manifest[f]["sha256"]:
                    print("REFUSED (far file checksum differs from manifest):", f)
                    return 1
            if far.missing:
                print("note, far files not used:", ", ".join(far.missing))
            tiers, err, effres = far.tiers, far.err, far.effres
            info["far_files"] = {f: far_manifest[f]["sha256"] for f in far.files}
            info["far_missing"] = far.missing
        build_site(client, s["id"], s["lat_deg"], s["lon_east_deg"], tile, info, a.out, settings,
                   tiers=tiers, err=err, effres=effres)
        built += 1
        print("built", s["id"], flush=True)
    print("done, built", built)
    return 0


if __name__ == "__main__":
    sys.exit(main())
