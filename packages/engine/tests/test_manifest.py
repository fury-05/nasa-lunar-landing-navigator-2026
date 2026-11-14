"""data/MANIFEST.json must describe every large file with a checksum, source and citation."""

import json
import re
from pathlib import Path

M = json.loads((Path(__file__).parents[3] / "data" / "MANIFEST.json").read_text(encoding="utf8"))
ATTR = (Path(__file__).parents[3] / "docs" / "ATTRIBUTION.md").read_text(encoding="utf8")


def test_manifest_lists_the_ten_documented_tiles() -> None:
    names = {f["filename"] for f in M["files"]}
    assert len(M["files"]) == 10 == len(names)
    assert "Site23_final_adj_5mpp_surf.tif" in names and "Haworth_final_adj_5mpp_surf.tif" in names


def test_every_entry_is_complete_and_honest() -> None:
    for f in M["files"]:
        assert re.fullmatch(r"[0-9a-f]{64}", f["sha256"]), f["id"]
        assert f["size_bytes"] > 1_000_000 and f["url"].startswith("https://pgda.gsfc.nasa.gov/")
        assert re.fullmatch(r"\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z", f["retrieved_at_utc"])
        assert f["licence"].startswith("pending-source")
        assert "Barker" in f["citation"]


def test_every_manifest_source_has_an_attribution_row() -> None:
    for f in M["files"]:
        assert f"| {f['source_id']} |" in ATTR
