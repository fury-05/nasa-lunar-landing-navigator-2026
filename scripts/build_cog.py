"""Convert downloaded PGDA tiles to Cloud Optimized GeoTIFFs and prove no pixel changed (P1-08).

Usage: uv run python scripts/build_cog.py <input_dir> <output_dir>
Writes <output_dir>/<name>.cog.tif and data/MANIFEST.cog.json with sha256 of every output.
"""

import hashlib
import json
import sys
from datetime import UTC, datetime
from pathlib import Path

import numpy as np
import rasterio
from lunar_engine.terrain import to_cog


def sha256(p: Path) -> str:
    h = hashlib.sha256()
    with p.open("rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def main(src_dir: Path, out_dir: Path) -> int:
    out_dir.mkdir(parents=True, exist_ok=True)
    manifest = json.loads((Path(__file__).parents[1] / "data" / "MANIFEST.json").read_text("utf8"))
    by_name = {f["filename"]: f for f in manifest["files"]}
    entries = []
    for src in sorted(src_dir.glob("*_surf.tif")):
        if src.name not in by_name or sha256(src) != by_name[src.name]["sha256"]:
            print("SKIP (not in manifest or checksum differs):", src.name)
            continue
        dst = out_dir / (src.stem + ".cog.tif")
        to_cog(src, dst)
        with rasterio.open(src) as a, rasterio.open(dst) as b:
            same = bool(np.array_equal(a.read(1), b.read(1))) and a.transform == b.transform
            overviews = b.overviews(1)
        if not same:
            print("MISMATCH after conversion:", src.name)
            return 1
        entries.append({
            "source_file": src.name, "source_sha256": by_name[src.name]["sha256"],
            "cog_file": dst.name, "cog_sha256": sha256(dst), "cog_bytes": dst.stat().st_size,
            "overviews": overviews, "pixels_identical": True,
        })
        print(dst.name, dst.stat().st_size, overviews)
    doc = {
        "schema": 1, "built_at_utc": datetime.now(UTC).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "tool": "rasterio COG driver, DEFLATE, predictor 3, blocksize 512", "files": entries,
    }
    out = Path(__file__).parents[1] / "data" / "MANIFEST.cog.json"
    out.write_text(json.dumps(doc, indent=2) + "\n", encoding="utf8")
    return 0


if __name__ == "__main__":
    sys.exit(main(Path(sys.argv[1]), Path(sys.argv[2])))
