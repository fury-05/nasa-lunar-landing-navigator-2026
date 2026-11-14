"""QuickMap link builder, checked against the recorded live verification."""

import json
import math
from pathlib import Path
from urllib.parse import parse_qs, urlparse

import pytest
from lunar_engine.links import (
    DEFS_SHADOWS,
    quickmap_link,
    south_polar_latlon,
    south_polar_xy,
)

ROOT = Path(__file__).parents[3]
VERIFY = json.loads((ROOT / "data" / "quickmap-verification.json").read_text(encoding="utf8"))
SITES = {s["id"]: s for s in json.loads((ROOT / "data" / "sites.json").read_text("utf8"))["sites"]}


def test_live_verification_agrees_within_a_fraction_of_a_pixel() -> None:
    rows = VERIFY["rows"]
    assert len(rows) >= 9
    for r in rows:
        assert len(r["hover_checks"]) == 4, r["id"]
        assert r["worst_offset_px"] < 0.5, r["id"]
        assert all(h["offset_m"] < 1.0 for h in r["hover_checks"]), r["id"]
    kinds = {r["projection"].split(" (")[0] for r in rows}
    assert kinds == {"south polar stereographic", "equidistant cylindrical"}


def test_polar_projection_round_trips() -> None:
    for lat, lon in [(-89.7668, -171.8699), (-85.9948, -0.2358), (-80.0, 120.0), (-89.99, 45.0)]:
        got = south_polar_latlon(*south_polar_xy(lat, lon))
        assert got[0] == pytest.approx(lat, abs=1e-9)
        assert got[1] == pytest.approx(lon, abs=1e-7)


def test_polar_projection_known_points() -> None:
    assert south_polar_xy(-90.0, 0.0) == pytest.approx((0.0, 0.0), abs=1e-6)
    x, y = south_polar_xy(-89.0, 0.0)  # 1 degree from the pole toward 0 E, about 30.3 km
    assert x == pytest.approx(0.0, abs=1e-6) and 30_000 < y < 30_700
    x, y = south_polar_xy(-89.0, 90.0)  # toward 90 E: positive x
    assert x > 30_000 and abs(y) < 1e-6


def test_link_for_south_pole_site_uses_proj_27_and_matches_recorded_link() -> None:
    s = SITES["pgda-site04"]
    link = quickmap_link(s["lat_deg"], s["lon_east_deg"])
    q = parse_qs(urlparse(link).query)
    assert q["proj"] == ["27"]
    recorded = next(r for r in VERIFY["rows"] if r["id"] == "pgda-site04")["link"]
    assert link == recorded  # byte for byte the link that was verified live


def test_link_for_nearside_site_uses_proj_16() -> None:
    q = parse_qs(urlparse(quickmap_link(0.674, 23.473)).query)
    assert q["proj"] == ["16"]
    x0, y0, x1, y1 = (float(v) for v in q["prjExtent"][0].split(","))
    assert x1 - x0 == pytest.approx(2000.0)
    assert y1 - y0 == pytest.approx(2000.0)
    assert (x0 + x1) / 2 == pytest.approx(math.radians(23.473) * 1_737_400.0, abs=0.01)


def test_time_and_shadow_options() -> None:
    link = quickmap_link(-89.7668, -171.8699, time_utc="2026-12-01T00:00:00Z", show_shadows=True)
    q = parse_qs(urlparse(link).query)
    assert q["time"] == ["2026-12-01T00:00:00Z"]
    assert q["stack"] == ["3314,4072"] and q["defs"] == [DEFS_SHADOWS]
    plain = parse_qs(urlparse(quickmap_link(-89.7668, -171.8699)).query)
    assert "time" not in plain and "defs" not in plain


@pytest.mark.parametrize("lat", [-90.5, 91.0])
def test_invalid_latitude_is_rejected(lat: float) -> None:
    with pytest.raises(ValueError):
        quickmap_link(lat, 0.0)
