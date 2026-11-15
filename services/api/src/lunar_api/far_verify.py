"""Checksum verification of the ADR-0007 far-terrain files for custom-site jobs.

`scripts/precompute_sites.py --far-dir` refuses to build from a far file whose sha256 differs from
`data/MANIFEST.far.json`, or has none. Custom-site jobs apply the same rule. Hashing the multi
gigabyte rasters takes a while, so each file is hashed once per process and the result is also
kept in a small sidecar file next to the data, keyed by file size and modification time. A changed
file (different size or time) is hashed again. Run `python -m lunar_api.far_verify` once after a
download to fill the sidecar, so the first customer job does not pay for it.
"""

from __future__ import annotations

import hashlib
import json
import sys
import threading
from pathlib import Path

SIDECAR = ".lunar-sha256-cache.json"
MANIFEST_PATHS = (
    Path(__file__).resolve().parents[4] / "data" / "MANIFEST.far.json",  # repository checkout
    Path("/opt/lunar/current/data/MANIFEST.far.json"),  # deployed release
)
_MEM: dict[tuple[str, int, int], str] = {}
_LOCK = threading.Lock()


class FarDataError(Exception):
    """A far file is unverified or does not match its manifest checksum. Not retryable."""


def reset_cache() -> None:
    """Forget the in-process hashes (the sidecar file stays). For tests."""
    with _LOCK:
        _MEM.clear()


def load_far_manifest() -> dict[str, str | None]:
    """filename -> sha256 (None when the manifest has no verified checksum for it)."""
    for p in MANIFEST_PATHS:
        if p.exists():
            doc = json.loads(p.read_text(encoding="utf8"))
            return {f["filename"]: f.get("sha256") for f in doc["files"]}
    return {}


def sha256_file(p: Path) -> str:
    h = hashlib.sha256()
    with p.open("rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def _sidecar(far_dir: Path) -> dict[str, dict[str, object]]:
    try:
        data = json.loads((far_dir / SIDECAR).read_text(encoding="utf8"))
        return data if isinstance(data, dict) else {}
    except (OSError, ValueError):
        return {}


def _digest(far_dir: Path, name: str) -> str:
    st = (far_dir / name).stat()
    key = (str(far_dir / name), st.st_size, st.st_mtime_ns)
    with _LOCK:
        if key in _MEM:
            return _MEM[key]
    side = _sidecar(far_dir)
    rec = side.get(name)
    if rec and rec.get("size") == st.st_size and rec.get("mtime_ns") == st.st_mtime_ns:
        digest = str(rec["sha256"])
    else:
        digest = sha256_file(far_dir / name)
        side[name] = {"size": st.st_size, "mtime_ns": st.st_mtime_ns, "sha256": digest}
        try:
            (far_dir / SIDECAR).write_text(json.dumps(side, indent=1), encoding="utf8")
        except OSError:
            pass  # a read-only data folder only costs the next process a re-hash
    with _LOCK:
        _MEM[key] = digest
    return digest


def verify_far_files(far_dir: Path, files: list[str], manifest: dict[str, str | None]) -> None:
    """Raise FarDataError unless every file has a manifest checksum and matches it."""
    no_hash = [f for f in files if not manifest.get(f)]
    if no_hash:
        raise FarDataError(
            "no verified sha256 in data/MANIFEST.far.json for: " + ", ".join(no_hash)
        )
    for f in files:
        if _digest(far_dir, f) != manifest[f]:
            raise FarDataError(f"far file checksum differs from the manifest: {f}")


def main() -> int:
    far_dir = Path(sys.argv[1]) if len(sys.argv) > 1 else None
    if far_dir is None or not far_dir.is_dir():
        print("usage: python -m lunar_api.far_verify FAR_DIR")
        return 2
    manifest = load_far_manifest()
    present = [f for f in manifest if (far_dir / f).exists()]
    try:
        verify_far_files(far_dir, present, manifest)
    except FarDataError as exc:
        print("REFUSED:", exc)
        return 1
    print("verified", len(present), "far files:", ", ".join(present))
    return 0


if __name__ == "__main__":
    sys.exit(main())
