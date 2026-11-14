"""CSA content must stay short, paraphrased, credited and linked (terms of the CSA site)."""

import json
from pathlib import Path

DOC = json.loads((Path(__file__).parents[3] / "data" / "content" / "csa.json").read_text("utf8"))


def test_credit_and_no_endorsement_text_present() -> None:
    assert "Canadian Space Agency" in DOC["credit"]
    assert "not associated with or endorsed by" in DOC["no_endorsement"]
    assert DOC["terms"]["url"] == "https://www.asc-csa.gc.ca/eng/terms.asp"


def test_items_are_short_linked_and_unique() -> None:
    ids = [i["id"] for i in DOC["items"]]
    assert len(ids) == len(set(ids)) == 6
    for i in DOC["items"]:
        assert i["url"].startswith("https://www.asc-csa.gc.ca/eng/astronomy/moon-exploration/")
        assert 40 < len(i["blurb"]) <= 420, i["id"]
        assert i["title"] and i["why_here"]


def test_no_logo_or_image_references() -> None:
    text = json.dumps(DOC).lower()
    for banned in (".png", ".jpg", ".svg", "logo.", "<img"):
        assert banned not in text
