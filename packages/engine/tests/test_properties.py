"""Property tests that close gaps in docs/04 section 8 item 6 (hypothesis, no network, no data).

Already covered elsewhere (see docs/validation/REPORT.md audit): visible fraction in [0, 1]
(test_visibility), raising terrain never lowers elevation (test_geometry, test_tiers). Added here:
skyline never below the sphere dip, raising the eye never lowers visibility, azimuth plus 360
returns the same value.
"""

import numpy as np
from hypothesis import HealthCheck, given, settings
from hypothesis import strategies as st
from lunar_engine.geometry import great_circle_destination, sphere_dip_deg
from lunar_engine.links import south_polar_xy
from lunar_engine.skyline import Skyline, cast_skyline
from lunar_engine.terrain import DemTile
from lunar_engine.visibility import disc_visibility, disc_visibility_array

LAT, LON = -89.5, 40.0
SX, SY = south_polar_xy(LAT, LON)
HALF, PX = 3000.0, 15.0
_N = int(2 * HALF / PX)
_COLS = SX - HALF + (np.arange(_N) + 0.5) * PX
_ROWS = SY + HALF - (np.arange(_N) + 0.5) * PX
_XX, _YY = np.meshgrid(_COLS, _ROWS)
RHO = 0.27

terrain = st.tuples(
    st.floats(0.0, 360.0),  # azimuth of the feature
    st.floats(200.0, 2500.0),  # distance
    st.floats(-300.0, 400.0),  # height (a pit or a hill)
    st.floats(50.0, 400.0),  # radius
)


def _tile(feature: tuple[float, float, float, float]) -> DemTile:
    az, d, h, r = feature
    la, lo = great_circle_destination(LAT, LON, az, d)
    cx, cy = south_polar_xy(la, lo)
    z = np.where(np.hypot(_XX - cx, _YY - cy) <= r, h, 0.0).astype(np.float32)
    return DemTile(z, SX - HALF, SY + HALF, PX, "prop")


SETTINGS = settings(max_examples=25, deadline=None, suppress_health_check=list(HealthCheck))


@SETTINGS
@given(feature=terrain, eye=st.floats(0.0, 30.0))
def test_property_the_skyline_is_never_below_the_sphere_dip(
    feature: tuple[float, float, float, float], eye: float
) -> None:
    sky = cast_skyline(_tile(feature), LAT, LON, eye_height_m=eye, max_range_m=2500.0,
                       azimuth_step_deg=5.0)
    assert np.all(sky.elevation_deg >= sphere_dip_deg(eye) - 1e-12)


@SETTINGS
@given(feature=terrain, el=st.floats(-1.0, 6.0), az=st.floats(0.0, 360.0))
def test_property_raising_the_eye_never_lowers_the_visible_fraction(
    feature: tuple[float, float, float, float], el: float, az: float
) -> None:
    tile = _tile(feature)
    low = cast_skyline(tile, LAT, LON, eye_height_m=1.0, max_range_m=2500.0, azimuth_step_deg=2.0)
    high = cast_skyline(tile, LAT, LON, eye_height_m=15.0, max_range_m=2500.0, azimuth_step_deg=2.0)
    assert np.all(high.elevation_deg <= low.elevation_deg + 1e-9)
    assert disc_visibility(high, az, el, RHO) >= disc_visibility(low, az, el, RHO) - 1e-12


def _wavy(phase: float) -> Skyline:
    az = np.arange(0.0, 360.0, 0.25)
    el = 1.0 + 0.8 * np.sin(np.radians(5.0 * az + phase))
    return Skyline(az, el, np.full(az.size, 1000.0), 1000.0, 1.0, 0.0, -0.001)


@SETTINGS
@given(phase=st.floats(0.0, 360.0), az=st.floats(-720.0, 720.0), el=st.floats(-2.0, 4.0))
def test_property_azimuth_plus_360_returns_the_same_value(
    phase: float, az: float, el: float
) -> None:
    sky = _wavy(phase)
    assert abs(sky.at(az) - sky.at(az + 360.0)) < 1e-9
    assert abs(disc_visibility(sky, az, el, RHO) - disc_visibility(sky, az + 360.0, el, RHO)) < 1e-9
    a = disc_visibility_array(sky, [az], [el], RHO)[0]
    b = disc_visibility_array(sky, [az + 360.0], [el], RHO)[0]
    assert abs(a - b) < 1e-9
