"""Measure two error-budget lines for REPORT.md on the real Site04 tile (docs/04 section 7).

1. DEM resolution: skyline from the real 5 m tile versus the same tile block-averaged to 20 m and
   80 m pixels (same site, same eye height, same range). Reports the difference per azimuth.
2. DEM vertical error (ERR product): the per-azimuth error angle and its 95th percentile when the
   skyline is cast over the site tile plus the 80 m LDEM with the 80 m ERR product (the only far
   files fully downloaded when this was run).

Usage: uv run python scripts/validate_error_budget.py --dem FILE --far-dir DIR [--out FILE.json]
Both inputs are verified against sha256 in data/MANIFEST.json and data/MANIFEST.far.json. Prints
numbers only; nothing is tuned.
"""

from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path
from typing import Any

import numpy as np
from lunar_engine.far_data import ERR_80M, LDEM_80M
from lunar_engine.skyline import cast_skyline, cast_skyline_tiers
from lunar_engine.terrain import DemTier, DemTile, read_tile, read_window

ROOT = Path(__file__).resolve().parents[1]
LAT, LON = -89.7668, -171.8699  # pgda-site04, the tile centre (data/sites.json)
RANGE_M = 8000.0  # inside the 5 m tile everywhere (first-real-run: rays reached 7995 m minimum)


def sha256(p: Path) -> str:
    h = hashlib.sha256()
    with p.open("rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def block_mean(tile: DemTile, k: int) -> DemTile:
    h, w = tile.heights.shape
    h2, w2 = h // k * k, w // k * k
    blocks = tile.heights[:h2, :w2].reshape(h2 // k, k, w2 // k, k)
    with np.errstate(all="ignore"):
        coarse = np.nanmean(blocks, axis=(1, 3)).astype(np.float32)
    return DemTile(coarse, tile.x0, tile.y0, tile.pixel_m * k, f"{tile.source}-x{k}")


def stats(d: np.ndarray) -> dict[str, float]:
    a = np.abs(d)
    return {
        "mean_abs_deg": round(float(a.mean()), 4),
        "p95_abs_deg": round(float(np.percentile(a, 95)), 4),
        "max_abs_deg": round(float(a.max()), 4),
        "mean_signed_deg": round(float(d.mean()), 4),
    }


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--dem", required=True, type=Path)
    ap.add_argument("--far-dir", required=True, type=Path)
    ap.add_argument("--out", type=Path)
    args = ap.parse_args()
    man_doc = json.loads((ROOT / "data/MANIFEST.json").read_text("utf8"))
    far_doc = json.loads((ROOT / "data/MANIFEST.far.json").read_text("utf8"))
    man = {f["filename"]: f["sha256"] for f in man_doc["files"]}
    far = {f["filename"]: f.get("sha256") for f in far_doc["files"]}
    out: dict[str, Any] = {"site": {"id": "pgda-site04", "lat_deg": LAT, "lon_east_deg": LON}}
    dem_sha = sha256(args.dem)
    if dem_sha != man[args.dem.name]:
        raise SystemExit("DEM does not match data/MANIFEST.json")
    tile = read_tile(args.dem)
    base = cast_skyline(tile, LAT, LON, 1.0, RANGE_M, 0.25)
    out["resolution"] = {"dem": args.dem.name, "dem_sha256": dem_sha, "range_m": RANGE_M,
                         "base_pixel_m": tile.pixel_m, "skyline_5m_mean_deg":
                         round(float(base.elevation_deg.mean()), 4)}
    for k in (4, 16):
        coarse = block_mean(tile, k)
        sky = cast_skyline(coarse, LAT, LON, 1.0, RANGE_M, 0.25)
        d = sky.elevation_deg - base.elevation_deg
        out["resolution"][f"{int(tile.pixel_m * k)}m_minus_5m"] = stats(d)
    # ERR-derived DEM error with the 80 m far files
    ldem, err_f = args.far_dir / LDEM_80M, args.far_dir / ERR_80M
    for f in (ldem, err_f):
        want = far.get(f.name)  # the manifest has null sha256 for the far files for now
        if want is not None:
            if sha256(f) != want:
                raise SystemExit(f"{f.name} does not match data/MANIFEST.far.json")
    cx = tile.x0 + tile.width * tile.pixel_m / 2
    cy = tile.y0 - tile.height * tile.pixel_m / 2
    wide = read_window(ldem, cx, cy, 20_000.0, 1)
    err = read_window(err_f, cx, cy, 20_000.0, 1)
    tiers = [DemTier("site-tile-5m", tile, 20_000.0), DemTier("ldem-80m", wide)]
    sky = cast_skyline_tiers(tiers, LAT, LON, 1.0, 15_000.0, 0.25, err=err)
    v = sky.dem_error_az_deg
    if v is None:
        raise SystemExit("no ERR tier was read")
    fin = v[np.isfinite(v)]
    share = {n: float(np.mean(sky.tier_idx == i)) for i, n in enumerate(sky.tier_names or [])}
    out["err_80m"] = {
        "ldem_sha256": sha256(ldem), "err_sha256": sha256(err_f), "range_m": 15_000.0,
        "azimuths_with_error": int(fin.size), "azimuths": int(v.size),
        "median_deg": round(float(np.median(fin)), 4),
        "p95_deg": round(float(np.percentile(fin, 95)), 4),
        "max_deg": round(float(fin.max()), 4),
        "effective_dem_error_deg": round(float(sky.effective_dem_error_deg() or float("nan")), 4),
        "tier_share": {k: round(s, 3) for k, s in share.items()},
        "note": "ERR is in metres and is divided by the distance of the controlling sample",
    }
    print(json.dumps(out, indent=2))
    if args.out:
        args.out.write_text(json.dumps(out, indent=2) + "\n", encoding="utf8")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
