"""GET /sites/{id}/terrain on synthetic rasters (issue #77, P5-01)."""

from pathlib import Path

import numpy as np
import pytest
import rasterio
from fastapi.testclient import TestClient
from lunar_engine.geometry import great_circle_destination
from lunar_engine.links import south_polar_xy
from rasterio.transform import from_origin

LAT, LON = -89.5, 40.0  # the fixture sites alpha and beta
SX, SY = south_polar_xy(LAT, LON)
URL = "/api/v1/sites/alpha/terrain"


def _raster(path: Path, half: float, px: float, fn, centre=(0.0, 0.0)) -> None:  # type: ignore[no-untyped-def]
    cx, cy = centre
    n = int(2 * half / px)
    x0, y0 = cx - half, cy + half
    xx, yy = np.meshgrid(x0 + (np.arange(n) + 0.5) * px, y0 - (np.arange(n) + 0.5) * px)
    path.parent.mkdir(parents=True, exist_ok=True)
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
        ds.write(fn(xx, yy).astype(np.float32), 1)


def _hill(az: float, dist: float, h: float, r: float):  # type: ignore[no-untyped-def]
    lat, lon = great_circle_destination(LAT, LON, az, dist)
    cx, cy = south_polar_xy(lat, lon)
    return lambda xx, yy: np.where(np.hypot(xx - cx, yy - cy) <= r, h, 100.0)


@pytest.fixture()
def far_client(client: TestClient, tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> TestClient:
    dem, far = tmp_path / "dem", tmp_path / "far"
    _raster(
        dem / "Test_final_adj_5mpp_surf.tif",
        3000.0,
        5.0,
        _hill(0.0, 1200.0, 160.0, 120.0),
        centre=(SX, SY),
    )
    _raster(far / "LDEM_80S_20MPP_ADJ.TIF", 60_000.0, 20.0, lambda x, y: x * 0.0 + 90.0)
    _raster(far / "LDEM_80S_20MPP_ADJ_ERR.TIF", 60_000.0, 20.0, lambda x, y: x * 0.0 + 2.5)
    _raster(far / "LDEM_80S_20MPP_ADJ_EFFRES.TIF", 60_000.0, 20.0, lambda x, y: x * 0.0 + 60.0)
    monkeypatch.setenv("LUNAR_DEM_DIR", str(dem))
    monkeypatch.setenv("LUNAR_FAR_DIR", str(far))
    return client


def test_terrain_shape_orientation_and_provenance(far_client: TestClient) -> None:
    r = far_client.get(URL)
    assert r.status_code == 200, r.text
    b = r.json()
    assert b["rows"] == b["cols"] == 128 and len(b["heights_m"]) == 128 * 128
    assert b["spacing_m"] == pytest.approx(4000.0 / 127) and b["window_m"] == 4000.0
    assert b["finite_fraction"] == 1.0 and None not in b["heights_m"]
    assert b["centre"] == {"lat_deg": LAT, "lon_east_deg": LON}
    grid = np.array(b["heights_m"]).reshape(128, 128)
    hill_rows, hill_cols = np.where(grid > 150.0)
    assert hill_rows.size > 20
    assert hill_rows.mean() < 128 * 0.4 and abs(hill_cols.mean() - 64) < 8  # due north: top rows
    assert "PGDA" in b["source"] and b["provenance"]["engine_version"]
    assert b["tier_share"]["site-tile-5m"] > 0.9


def test_error_and_interpolated_fraction_come_from_real_products_or_are_null(
    far_client: TestClient, monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    # the site tile (5 m) supplies the grid, so the 20 m EFFRES does not describe it: null
    b = far_client.get(URL).json()
    assert b["height_error_m"] == pytest.approx(2.5) and "ERR" in b["height_error_basis"]
    assert b["interpolated_fraction"] is None and "not available" in b["interpolated_basis"]
    # without the site tile the 20 m LDEM supplies the grid and EFFRES (60 m > 20 m) applies
    monkeypatch.setenv("LUNAR_DEM_DIR", str(tmp_path / "nodem"))
    b2 = far_client.get(URL, params={"window_m": 4001}).json()
    assert b2["native_resolution_m"] == 20.0
    assert b2["interpolated_fraction"] == 1.0 and "EFFRES" in b2["interpolated_basis"]


def test_missing_error_product_gives_null_error_not_a_guess(
    far_client: TestClient, tmp_path: Path
) -> None:
    (tmp_path / "far" / "LDEM_80S_20MPP_ADJ_ERR.TIF").unlink()
    b = far_client.get(URL, params={"window_m": 3999}).json()
    assert b["height_error_m"] is None and "not available" in b["height_error_basis"]


def test_downsampling_and_validation(far_client: TestClient) -> None:
    b = far_client.get(URL, params={"max_n": 32, "window_m": 2000}).json()
    assert b["rows"] == 32 and b["spacing_m"] == pytest.approx(2000.0 / 31)
    for params in ({"max_n": 8}, {"max_n": 500}, {"window_m": 100}, {"window_m": 99999}):
        r = far_client.get(URL, params=params)
        assert r.status_code == 422 and r.headers["content-type"].startswith(
            "application/problem+json"
        )


def test_no_terrain_is_a_404_problem_document(
    client: TestClient, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setenv("LUNAR_DEM_DIR", str(tmp_path / "none"))
    monkeypatch.setenv("LUNAR_FAR_DIR", str(tmp_path / "none"))
    r = client.get(URL)
    assert r.status_code == 404 and r.json()["type"].endswith("terrain-unavailable")
    assert r.headers["content-type"].startswith("application/problem+json")
    assert client.get("/api/v1/sites/nope/terrain").status_code == 404
    assert client.get("/api/v1/sites/../terrain").status_code in (404, 422)


def test_outside_a_dem_the_cells_are_null_not_zero(
    client: TestClient, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    far = tmp_path / "far2"
    # a 20 m raster that covers only part of the 4 km window around the site
    _raster(far / "LDEM_80S_20MPP_ADJ.TIF", 400.0, 20.0, lambda x, y: x * 0.0 + 5.0, (SX, SY))
    monkeypatch.setenv("LUNAR_DEM_DIR", str(tmp_path / "none"))
    monkeypatch.setenv("LUNAR_FAR_DIR", str(far))
    b = client.get(URL).json()
    assert 0.0 < b["finite_fraction"] < 0.1 and None in b["heights_m"]
    assert b["tier_share"]["ldem-20m"] == pytest.approx(b["finite_fraction"])
