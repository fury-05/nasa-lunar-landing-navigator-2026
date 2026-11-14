"""Build the precomputed bundle for catalogue sites that have a DEM tile (P2-09, P1-11).

Usage:
  uv run python scripts/precompute_sites.py --dem-dir DIR --out DIR --cache DIR \
      --start 2026-12-01 --days 365 [--sites pgda-site04 ...]

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
from lunar_engine.precompute import BuildSettings, build_site
from lunar_engine.terrain import read_tile

ROOT = Path(__file__).resolve().parents[1]


def sha256(p: Path) -> str:
    h = hashlib.sha256()
    with p.open("rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--dem-dir", required=True, type=Path)
    ap.add_argument("--out", required=True, type=Path)
    ap.add_argument("--cache", required=True, type=Path)
    ap.add_argument("--start", required=True)
    ap.add_argument("--days", required=True, type=int)
    ap.add_argument("--sites", nargs="*")
    ap.add_argument("--max-range-m", type=float, default=16_000.0)
    ap.add_argument("--force", action="store_true")
    a = ap.parse_args()

    start = datetime.fromisoformat(a.start).replace(tzinfo=UTC)
    settings = BuildSettings(start, start + timedelta(days=a.days), max_range_m=a.max_range_m)
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
        build_site(client, s["id"], s["lat_deg"], s["lon_east_deg"], tile, info, a.out, settings)
        built += 1
        print("built", s["id"], flush=True)
    print("done, built", built)
    return 0


if __name__ == "__main__":
    sys.exit(main())
