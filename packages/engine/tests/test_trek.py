"""Trek tile maths. The 'live' tests encode tiles that returned HTTP 200 on 2026-11-14."""

import pytest
from lunar_engine.links import south_polar_xy
from lunar_engine.trek import (
    LAYERS,
    attribution_line,
    metres_per_pixel,
    tile_bounds_m,
    tile_for_xy,
    tile_size_m,
    tile_url,
)


def test_resolution_matches_capabilities_scale_denominators() -> None:
    assert metres_per_pixel(0) == pytest.approx(8561.95, abs=0.01)
    assert metres_per_pixel(3) == pytest.approx(1070.24, abs=0.01)
    assert metres_per_pixel(5) == pytest.approx(267.56, abs=0.01)
    assert metres_per_pixel(9) == pytest.approx(16.72, abs=0.01)
    assert metres_per_pixel(11) == pytest.approx(4.18, abs=0.01)
    assert tile_size_m(1) == pytest.approx(1_095_930.0, abs=1.0)  # matches the capabilities grid


def test_pole_sits_on_the_corner_of_four_tiles_at_zoom_3() -> None:
    # Observed: z=3 tiles 3/3, 4/3 and 4/4 exist (HTTP 200) around the pole.
    assert tile_for_xy(0.0, 0.0, 3) == (4, 4)
    assert tile_for_xy(-1.0, 1.0, 3) == (3, 3)
    assert tile_for_xy(-1.0, -1.0, 3) == (4, 3)


def test_tile_bounds_contain_the_point_and_tile_neighbours() -> None:
    x, y = south_polar_xy(-89.7668, -171.8699)  # Shackleton rim tile centre
    for z in (4, 7, 9):
        row, col = tile_for_xy(x, y, z)
        x0, y0, x1, y1 = tile_bounds_m(row, col, z)
        assert x0 <= x < x1 and y0 <= y < y1
        assert x1 - x0 == pytest.approx(tile_size_m(z))
        assert tile_bounds_m(row, col + 1, z)[0] == pytest.approx(x1, abs=1e-6)


def test_url_pattern_and_zoom_limits() -> None:
    url = tile_url("LRO_WAC_Mosaic_SPole60_100m_v02", 3, 3, 3)
    assert url == (
        "https://trek.nasa.gov/tiles/Moon/SP/LRO_WAC_Mosaic_SPole60_100m_v02/"
        "1.0.0/default/default028mm/3/3/3.png"
    )
    with pytest.raises(ValueError):
        tile_url("LRO_WAC_Mosaic_SPole60_100m_v02", 6, 0, 0)  # level 6 returned 404 live
    assert tile_url("LRO_NAC_Mosaic_SPole85.5_1mp", 11, 0, 0).endswith("/11/0/0.png")


def test_every_layer_has_a_real_credit_and_no_invented_licence() -> None:
    assert set(LAYERS) == {
        "LRO_WAC_Mosaic_SPole60_100m_v02",
        "LRO_NAC_Mosaic_SPole85.5_1mp",
        "LRO_LOLA_Gray_SPole875_5mp_v04",
        "LRO_LOLA_Gray_SPole75_30mp_v04",
    }
    for lid, layer in LAYERS.items():
        assert layer.credit and layer.metadata_url.endswith(lid)
        assert "Use_Constraints: None" in layer.metadata_constraints
        line = attribution_line(lid)
        assert layer.credit in line and "Moon Trek" in line
    assert LAYERS["LRO_LOLA_Gray_SPole875_5mp_v04"].role.startswith("terrain shading only")
