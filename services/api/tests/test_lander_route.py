"""POST /api/v1/lander/assess against the synthetic bundle (issues #84 and #85)."""

import math
from pathlib import Path
from typing import Any

import numpy as np
import pytest
import rasterio
from fastapi.testclient import TestClient
from lunar_engine.links import south_polar_xy
from rasterio.transform import from_origin

URL = "/api/v1/lander/assess"
W = {"start": "2026-12-03T00:00:00Z", "end": "2026-12-08T00:00:00Z"}
LANDER: dict[str, Any] = {
    "battery_capacity_wh": 1000,
    "reserve_fraction": 0.2,
    "survival_load_w": 10,
    "autonomy_without_earth_h": 48,
    "source": "unit test",
}
SX, SY = south_polar_xy(-89.5, 40.0)


def body(**over: Any) -> dict[str, Any]:
    return {"site_id": "alpha", **W, "lander": dict(LANDER), **over}


def check(b: dict[str, Any], cid: str) -> dict[str, Any]:
    return next(c for c in b["checks"] if c["id"] == cid)


def test_contract_shape_provenance_and_label(client: TestClient) -> None:
    r = client.post(URL, json=body())
    assert r.status_code == 200, r.text
    b = r.json()
    assert "NaN" not in r.text and "Infinity" not in r.text
    assert [c["id"] for c in b["checks"]] == [
        "power",
        "communication",
        "terrain_slope",
        "thermal",
        "mission_needs",
    ]
    assert b["label"] == "Planning tool, not for flight operations."
    assert b["lander"]["source"] == "unit test"
    assert b["lander"]["usable_energy_wh"] == pytest.approx(800.0)
    assert b["lander"]["dark_survival_hours"] == pytest.approx(80.0)
    assert b["provenance"]["engine_version"] and b["provenance"]["reproduce"]["inputs"]["lander"]
    assert b["start_utc"] == W["start"] and b["end_utc"] == W["end"]
    d = b["longest_dark_hours"]
    assert d["low"] <= d["nominal"] <= d["high"]
    assert check(b, "thermal")["status"] == "not_assessed"
    assert check(b, "mission_needs")["status"] == "not_assessed"
    assert any("thermal" in w for w in b["warnings"])


def test_terrain_incompleteness_is_taken_from_assess(client: TestClient) -> None:
    ref = client.get("/api/v1/sites/alpha/assess", params=W).json()
    b = client.post(URL, json=body()).json()
    assert b["terrain"] == ref["terrain"] and b["band_basis"] == ref["band_basis"]
    assert b["longest_dark_hours"] == ref["longest_dark_hours"]
    assert b["longest_outage_hours"] == ref["longest_outage_hours"]
    # the test bundle reaches 2.5 km only, so a pass cannot be claimed
    assert not b["terrain"]["complete"]
    assert b["verdict"] in {"upper_bound_terrain_incomplete", "fail"}
    assert any("upper bound" in w or "can only be" in w for w in b["warnings"])


def test_a_tiny_battery_fails_conclusively_and_a_huge_one_stays_an_upper_bound(
    client: TestClient,
) -> None:
    tiny = client.post(URL, json=body(lander={**LANDER, "battery_capacity_wh": 1})).json()
    assert check(tiny, "power")["status"] == "fail" and tiny["verdict"] == "fail"
    assert tiny["conclusive"] is True
    assert "short" in check(tiny, "power")["reasoning"]
    huge = client.post(
        URL,
        json=body(lander={**LANDER, "battery_capacity_wh": 1e7, "autonomy_without_earth_h": 1e5}),
    ).json()
    assert huge["verdict"] == "upper_bound_terrain_incomplete" and huge["conclusive"] is False
    assert check(huge, "power")["status"] in {"pass", "marginal"}


def test_more_battery_never_worsens_the_result_over_the_api(client: TestClient) -> None:
    rank = {"fail": 0, "marginal": 1, "pass": 2}
    last = -1
    last_margin = -math.inf
    for cap in (1, 100, 500, 1000, 5000, 1e6):
        b = client.post(URL, json=body(lander={**LANDER, "battery_capacity_wh": cap})).json()
        p = check(b, "power")
        assert rank[p["status"]] >= last
        assert p["margin_pessimistic"] >= last_margin
        last, last_margin = rank[p["status"]], p["margin_pessimistic"]


def test_mission_needs_use_the_same_names_as_assess(client: TestClient) -> None:
    b = client.post(
        URL, json=body(mission_needs={"min_sun_fraction": 0.99, "max_dark_hours": 1})
    ).json()
    assert b["mission_needs"]["source"] == "user-chosen"
    assert b["mission_needs"]["min_sun_fraction"] == 0.99
    assert check(b, "mission_needs")["status"] in {"pass", "marginal", "fail"}
    d = client.post(URL, json=body()).json()
    assert d["mission_needs"]["source"] == "default-placeholder"


def test_slope_not_assessed_without_data_or_limit_and_thermal_is_echoed_only(
    client: TestClient, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setenv("LUNAR_DEM_DIR", str(tmp_path / "none"))
    monkeypatch.setenv("LUNAR_FAR_DIR", str(tmp_path / "none"))
    lander = {
        **LANDER,
        "slope_limit_deg": 8,
        "min_survival_temp_c": -150,
        "max_survival_temp_c": 80,
    }
    b = client.post(URL, json=body(lander=lander)).json()
    s = check(b, "terrain_slope")
    assert s["status"] == "not_assessed" and "No elevation data" in s["reasoning"]
    assert b["slope"] is None
    assert b["lander"]["min_survival_temp_c"] == -150
    assert "no thermal model" in check(b, "thermal")["reasoning"]


def _tilted(path: Path, half: float, px: float, deg: float, centre: tuple[float, float]) -> None:
    cx, cy = centre
    n = int(2 * half / px)
    x0, y0 = cx - half, cy + half
    xx = x0 + (np.arange(n) + 0.5) * px
    path.parent.mkdir(parents=True, exist_ok=True)
    z = np.tile((xx - cx) * math.tan(math.radians(deg)), (n, 1)).astype(np.float32)
    with rasterio.open(
        path,
        "w",
        driver="GTiff",
        width=n,
        height=n,
        count=1,
        dtype="float32",
        transform=from_origin(x0, y0, px, px),
        nodata=float("nan"),
    ) as ds:
        ds.write(z, 1)


@pytest.fixture()
def sloped(client: TestClient, tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> TestClient:
    dem = tmp_path / "dem"
    _tilted(dem / "Test_final_adj_5mpp_surf.tif", 3000.0, 5.0, 10.0, (SX, SY))
    monkeypatch.setenv("LUNAR_DEM_DIR", str(dem))
    monkeypatch.setenv("LUNAR_FAR_DIR", str(tmp_path / "nofar"))
    return client


def test_slope_is_derived_from_the_height_grid_with_its_resolution_caveat(
    sloped: TestClient,
) -> None:
    ok = sloped.post(URL, json=body(lander={**LANDER, "slope_limit_deg": 15})).json()
    s = check(ok, "terrain_slope")
    assert ok["slope"]["max_slope_deg"] == pytest.approx(10.0, abs=0.2)
    assert (
        ok["slope"]["baseline_m"] == pytest.approx(10.0) and ok["slope"]["slope_error_deg"] is None
    )
    assert s["status"] == "pass" and "not resolved" in s["reasoning"]
    bad = sloped.post(URL, json=body(lander={**LANDER, "slope_limit_deg": 5})).json()
    assert check(bad, "terrain_slope")["status"] == "fail" and bad["verdict"] == "fail"
    nolimit = sloped.post(URL, json=body()).json()
    assert check(nolimit, "terrain_slope")["status"] == "not_assessed"
    assert "no slope limit" in check(nolimit, "terrain_slope")["reasoning"]


def test_validation_errors_are_problem_documents(client: TestClient) -> None:
    def bad(**over: Any) -> Any:
        return client.post(URL, json=over)

    cases = [
        body(lander={**LANDER, "reserve_fraction": 1.5}),
        body(lander={**LANDER, "battery_capacity_wh": -1}),
        body(lander={**LANDER, "source": ""}),
        body(lander={**LANDER, "source": "   "}),
        body(lander={**LANDER, "min_survival_temp_c": 50, "max_survival_temp_c": 10}),
        body(lander={k: v for k, v in LANDER.items() if k != "source"}),
        body(start="nonsense"),
        body(start=W["end"], end=W["start"]),
        body(mission_needs={"min_sun_fraction": 2}),
        {"site_id": "alpha", **W},
    ]
    for c in cases:
        r = bad(**c)
        assert r.status_code == 422, (c, r.text)
        assert r.headers["content-type"].startswith("application/problem+json")
    r = client.post(
        URL,
        content=b'{"lander": {"battery_capacity_wh": NaN}}',
        headers={"content-type": "application/json"},
    )
    assert r.status_code == 422
    unknown = client.post(URL, json=body(site_id="ghost"))
    assert unknown.status_code == 404
    assert unknown.headers["content-type"].startswith("application/problem+json")
    outside = client.post(URL, json=body(start="2031-01-01T00:00:00Z", end="2031-01-05T00:00:00Z"))
    assert outside.status_code == 422


def test_post_is_rate_limited_like_other_heavy_routes(client: TestClient) -> None:
    from lunar_api.caching import RateLimitMiddleware, TokenBucket
    from lunar_api.main import app

    node: Any = app.middleware_stack
    while node is not None and not isinstance(node, RateLimitMiddleware):
        node = getattr(node, "app", None)
    assert node is not None
    node.heavy = TokenBucket(0.001, 2)
    codes = [client.post(URL, json=body()).status_code for _ in range(4)]
    assert codes.count(429) >= 1 and codes[0] == 200


def test_openapi_documents_the_route(client: TestClient) -> None:
    spec = client.get("/api/v1/openapi.json").json()
    op = spec["paths"]["/api/v1/lander/assess"]["post"]
    assert "LanderAssessOut" in str(op["responses"]["200"])
    assert "422" in op["responses"] and "404" in op["responses"]
