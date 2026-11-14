"""Checks on data/sites.json: every record is sourced, dated and honest about its coordinates."""

import json
import re
from pathlib import Path

import pytest

DATA = json.loads((Path(__file__).parents[3] / "data" / "sites.json").read_text(encoding="utf8"))
SITES = DATA["sites"]
ISO = re.compile(r"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$")


def test_count_matches_and_ids_are_unique() -> None:
    assert DATA["count"] == len(SITES) > 20
    ids = [s["id"] for s in SITES]
    assert len(ids) == len(set(ids))


@pytest.mark.parametrize("site", SITES, ids=lambda s: s["id"])
def test_every_record_has_source_and_retrieval_time(site: dict) -> None:  # type: ignore[type-arg]
    assert site["source_id"] and site["source_url"].startswith("https://")
    assert ISO.match(site["retrieved_at_utc"])
    assert site["coordinate_status"] in {"sourced", "derived-tile-centre", "pending-source"}


@pytest.mark.parametrize("site", SITES, ids=lambda s: s["id"])
def test_coordinates_are_valid_or_explicitly_pending(site: dict) -> None:  # type: ignore[type-arg]
    if site["coordinate_status"] == "pending-source":
        assert site["lat_deg"] is None and site["lon_east_deg"] is None
    else:
        assert -90 <= site["lat_deg"] <= 90
        assert -180 <= site["lon_east_deg"] <= 180


def test_apollo_records_match_the_nssdc_table() -> None:
    apollo = {s["id"]: (s["lat_deg"], s["lon_east_deg"]) for s in SITES if s["kind"] == "apollo"}
    assert apollo == {
        "apollo-11": (0.674, 23.473),
        "apollo-12": (-3.013, -23.422),
        "apollo-14": (-3.646, -17.472),
        "apollo-15": (26.132, 3.633),
        "apollo-16": (-8.973, 15.501),
        "apollo-17": (20.191, 30.772),
    }


def test_pgda_tiles_are_south_polar_and_labelled_derived() -> None:
    tiles = [s for s in SITES if s["kind"] == "pgda-tile"]
    assert len(tiles) >= 10
    for t in tiles:
        assert t["lat_deg"] < -80, t["id"]
        assert t["coordinate_status"] == "derived-tile-centre"
        assert "not the exact landing point" in t["note"]
    shack = next(t for t in tiles if t["id"] == "pgda-site04")
    assert shack["lat_deg"] < -89.5  # Shackleton rim tile sits within half a degree of the pole
    mal = next(t for t in tiles if t["id"] == "pgda-site23")
    assert -86.5 < mal["lat_deg"] < -85.5  # Malapert massif region


def test_clps_records_never_invent_coordinates() -> None:
    clps = [s for s in SITES if s["kind"] == "clps"]
    assert clps
    assert all(s["coordinate_status"] == "pending-source" for s in clps)
