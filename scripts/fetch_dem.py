"""Download the PGDA 5 m LOLA surface tiles named in ADR-0003 and update data/MANIFEST.json.

Standard library only. Files go to $LUNAR_DATA_DIR/dem (outside git). For every file the
manifest records URL, size, sha256, retrieval time, licence status and citation (CLAUDE.md
rule 4: nothing unsourced). Re-running skips files whose sha256 already matches the manifest.

Usage: python scripts/fetch_dem.py [--dry-run] [site ...]

Far-terrain set (ADR-0007, issue #130): python scripts/fetch_dem.py --far [--dry-run] [id ...]
Downloads the 20 m LDEM with its ERR and EFFRES companions and the 87S 5 m mosaic into
$LUNAR_DATA_DIR/far. Downloads resume (HTTP Range) after a broken connection. The expected size
is checked against the server before and after the transfer. sha256 and the retrieval time are
written to data/MANIFEST.far.json only after a verified download. Entries whose sha256 is still
null are listed, not invented. Use scripts/fetch_far_terrain.sh on the VM.
"""

import hashlib
import json
import os
import sys
import urllib.request
from collections.abc import Callable
from datetime import UTC, datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MANIFEST = Path(os.environ.get("LUNAR_MANIFEST", ROOT / "data" / "MANIFEST.json"))
BASE = "https://pgda.gsfc.nasa.gov/data/LOLA_5mpp"
UA = {"User-Agent": "LunarLandingSiteNavigator/0.0.1 (NASA Space Apps 2026)"}
# Sites documented in the PGDA README (ADR-0003). folder -> file stem
SITES = {
    "Site01": "Site01", "Site04": "Site04", "Site06": "Site06", "Site07": "Site07",
    "Site11": "Site11", "Site20": "Site20", "Site23": "Site23", "Haworth": "Haworth",
    "Shoemaker": "Shoemaker", "DM2": "DM2",
}
CITATION = (
    "Barker et al., 2021, Planetary and Space Science 203, 105119, "
    "https://doi.org/10.1016/j.pss.2020.105119; NASA GSFC PGDA, "
    "https://pgda.gsfc.nasa.gov/products/78"
)


def url_for(folder: str) -> str:
    return f"{BASE}/{folder}/{SITES[folder]}_final_adj_5mpp_surf.tif"


def head_size(url: str) -> int:
    req = urllib.request.Request(url, method="HEAD", headers=UA)
    with urllib.request.urlopen(req, timeout=60) as r:
        if "tiff" not in r.headers.get("Content-Type", ""):
            raise RuntimeError(f"{url} is not a TIFF (got {r.headers.get('Content-Type')})")
        return int(r.headers["Content-Length"])


def sha256_of(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def download(url: str, dest: Path, expected: int) -> None:
    tmp = dest.with_suffix(".part")
    with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=120) as r, tmp.open("wb") as f:
        while chunk := r.read(1 << 20):
            f.write(chunk)
    if tmp.stat().st_size != expected:
        raise RuntimeError(f"size mismatch for {dest.name}: {tmp.stat().st_size} != {expected}")
    tmp.replace(dest)


FAR_MANIFEST = Path(os.environ.get("LUNAR_FAR_MANIFEST", ROOT / "data" / "MANIFEST.far.json"))


def download_resumable(url: str, dest: Path, expected: int, attempts: int = 30,
                       sleep: Callable[[float], None] | None = None) -> None:
    """Fetch `url` to `dest`, resuming a `.part` file with Range requests until complete."""
    import time

    pause = sleep or time.sleep
    tmp = dest.with_name(dest.name + ".part")
    for attempt in range(1, attempts + 1):
        have = tmp.stat().st_size if tmp.exists() else 0
        if have == expected:
            break
        if have > expected:
            tmp.unlink()
            have = 0
        headers = dict(UA)
        if have:
            headers["Range"] = f"bytes={have}-"
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=headers), timeout=120) as r:
                if have and r.status != 206:
                    tmp.unlink()  # server ignored Range: start again rather than corrupt the file
                    continue
                with tmp.open("ab") as f:
                    while chunk := r.read(1 << 20):
                        f.write(chunk)
        except OSError as exc:
            print(f"  attempt {attempt} interrupted ({exc}); resuming from {tmp.stat().st_size if tmp.exists() else 0}")
            pause(min(60, 2 * attempt))
    if not tmp.exists() or tmp.stat().st_size != expected:
        got = tmp.stat().st_size if tmp.exists() else 0
        raise RuntimeError(f"size mismatch for {dest.name}: {got} != {expected}")
    tmp.replace(dest)


def far_main(argv: list[str]) -> int:
    dry = "--dry-run" in argv
    wanted = [a for a in argv if not a.startswith("--")]
    doc = json.loads(FAR_MANIFEST.read_text(encoding="utf8"))
    entries = {f["id"]: f for f in doc["files"]}
    ids = wanted or [i for i, f in entries.items() if f["tier"] != "fallback" and f["role"] != "crosscheck"]
    unknown = [i for i in ids if i not in entries]
    if unknown:
        print("unknown ids:", ", ".join(unknown))
        return 2
    data_dir = os.environ.get("LUNAR_DATA_DIR", "")
    if not data_dir and not dry:
        print("Set LUNAR_DATA_DIR to a folder outside the repository.")
        return 2
    total = 0
    for fid in ids:
        e = entries[fid]
        size = head_size(e["url"])
        if size != e["size_bytes"]:
            print(f"{fid}: server reports {size} bytes but the manifest expects {e['size_bytes']}; "
                  "the product changed, stop and review")
            return 3
        total += size
        print(f"{fid}: {size} bytes")
        if dry:
            continue
        out = Path(data_dir) / "far"
        out.mkdir(parents=True, exist_ok=True)
        dest = out / e["filename"]
        if dest.exists() and e["sha256"] and sha256_of(dest) == e["sha256"]:
            print("  already present, checksum ok")
            continue
        download_resumable(e["url"], dest, size)
        e["sha256"] = sha256_of(dest)
        e["retrieved_at_utc"] = datetime.now(UTC).strftime("%Y-%m-%dT%H:%M:%SZ")
        FAR_MANIFEST.write_text(json.dumps(doc, indent=2) + "\n", encoding="utf8")
        print(f"  saved, sha256 {e['sha256'][:16]}...")
    print(f"total {total / 1e9:.2f} GB")
    return 0


def main(argv: list[str]) -> int:
    if "--far" in argv:
        return far_main([a for a in argv if a != "--far"])
    dry = "--dry-run" in argv
    wanted = [a for a in argv if not a.startswith("--")] or list(SITES)
    data_dir = os.environ.get("LUNAR_DATA_DIR", "")
    if not data_dir and not dry:
        print("Set LUNAR_DATA_DIR to a folder outside the repository.")
        return 2
    out = Path(data_dir) / "dem" if data_dir else None
    manifest = json.loads(MANIFEST.read_text(encoding="utf8")) if MANIFEST.exists() else {"schema": 1, "files": []}
    by_id = {f["id"]: f for f in manifest["files"]}
    for folder in wanted:
        fid = f"lola5m-{folder.lower()}-surf"
        url = url_for(folder)
        size = head_size(url)
        print(f"{folder}: {size} bytes")
        if dry:
            continue
        assert out is not None
        out.mkdir(parents=True, exist_ok=True)
        dest = out / Path(url).name
        known = by_id.get(fid)
        if dest.exists() and known and sha256_of(dest) == known["sha256"]:
            print("  already present, checksum ok")
            continue
        download(url, dest, size)
        entry = {
            "id": fid, "source_id": "lola-dem", "url": url, "filename": dest.name, "size_bytes": size,
            "sha256": sha256_of(dest), "retrieved_at_utc": datetime.now(UTC).strftime("%Y-%m-%dT%H:%M:%SZ"),
            "licence": "pending-source (NASA public product, terms not yet read by a human)",
            "citation": CITATION, "stored_in": "$LUNAR_DATA_DIR/dem",
        }
        by_id[fid] = entry
        manifest["files"] = sorted(by_id.values(), key=lambda e: e["id"])
        MANIFEST.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf8")
        print(f"  saved, sha256 {entry['sha256'][:16]}...")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
