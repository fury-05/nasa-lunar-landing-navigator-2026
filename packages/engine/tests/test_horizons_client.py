import json
from pathlib import Path

import httpx
import pytest
from lunar_engine.ephemeris import HorizonsClient, HorizonsError, parse_observer_result
from lunar_engine.ephemeris.client import cache_key, check_payload, observer_params
from lunar_engine.ephemeris.parse import HorizonsParseError

FIX = Path(__file__).parent / "fixtures" / "horizons_sun_30E_m89.5_probe.json"
REAL = json.loads(FIX.read_text(encoding="utf8"))


def _params() -> dict[str, str]:
    return observer_params("10", 30.0, -89.5, 0.0, "2026-12-01 00:00", "2026-12-01 01:00", "30m")


def _client(handler, tmp_path: Path | None = None, **kw) -> HorizonsClient:  # type: ignore[no-untyped-def]
    return HorizonsClient(
        cache_dir=tmp_path,
        transport=httpx.MockTransport(handler),
        sleep=lambda _s: None,
        min_interval_s=0,
        **kw,
    )


# ---- parser against a real, unmodified Horizons response -------------------------------------


def test_parse_real_response_rows_and_values() -> None:
    table = parse_observer_result(REAL["result"])
    assert len(table.rows) == 3
    r0 = table.rows[0]
    assert r0.time_utc.isoformat() == "2026-12-01T00:00:00+00:00"
    assert r0.azimuth_deg == pytest.approx(250.052432)
    assert r0.elevation_deg == pytest.approx(1.2996)
    assert r0.ang_diam_arcsec == pytest.approx(1945.048)
    assert r0.solar_flag == "*"


def test_parse_keeps_frame_header_for_provenance() -> None:
    h = parse_observer_result(REAL["result"]).frame_header
    assert "East-longitude positive" in h["Center pole/equ"]
    assert h["Center pole/equ"].startswith("MEAN_ME")
    assert h["Center radii"].startswith("1737.4")
    assert "AIRLESS" in h["Atmos refraction"]
    assert h["Center geodetic"].startswith("30.0, -89.5")


def test_sun_angular_diameter_matches_physics() -> None:
    # Sun radius 695700 km at ~0.98633 au gives about 1945 arcsec across.
    import math

    row = parse_observer_result(REAL["result"]).rows[0]
    assert row.delta_au is not None and row.ang_diam_arcsec is not None
    expected = 2 * math.degrees(math.asin(695700.0 / (row.delta_au * 149597870.7))) * 3600
    assert row.ang_diam_arcsec == pytest.approx(expected, rel=2e-3)


def test_parse_rejects_text_without_data_block() -> None:
    with pytest.raises(HorizonsParseError):
        parse_observer_result("No ephemeris for target")


# ---- error handling --------------------------------------------------------------------------


def test_http_200_with_error_text_is_failure() -> None:
    bad = {"signature": {"version": "1.2"}, "result": "No ephemeris for target 'x' prior to ..."}
    with pytest.raises(HorizonsError, match="no data"):
        check_payload(bad, None)


def test_error_message_payload_is_failure() -> None:
    with pytest.raises(HorizonsError, match="Horizons error"):
        check_payload({"message": "Invalid SITE_COORD"}, None)


def test_version_mismatch_is_failure() -> None:
    with pytest.raises(HorizonsError, match="version"):
        check_payload(REAL, "9.9")
    assert check_payload(REAL, "1.2")


def test_retries_503_then_succeeds(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr("tenacity.nap.time.sleep", lambda _s: None)
    calls = {"n": 0}

    def handler(request: httpx.Request) -> httpx.Response:
        calls["n"] += 1
        if calls["n"] < 3:
            return httpx.Response(503, text="busy")
        return httpx.Response(200, json=REAL)

    c = _client(handler)
    table, prov = c.observer(_params())
    assert calls["n"] == 3 and len(table.rows) == 3
    assert prov["api_version"] == "1.2"


def test_gives_up_after_repeated_503(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr("tenacity.nap.time.sleep", lambda _s: None)
    c = _client(lambda r: httpx.Response(503))
    with pytest.raises(HorizonsError, match="503"):
        c.raw(_params())
    assert c.network_calls == 4


def test_bad_payload_is_not_cached(tmp_path: Path) -> None:
    bad = {"signature": {"version": "1.2"}, "result": "garbage"}
    c = _client(lambda r: httpx.Response(200, json=bad), tmp_path)
    with pytest.raises(HorizonsError):
        c.raw(_params())
    assert list(tmp_path.glob("*.json")) == []


# ---- cache, identification, limits -----------------------------------------------------------


def test_second_call_is_served_from_cache(tmp_path: Path) -> None:
    c = _client(lambda r: httpx.Response(200, json=REAL), tmp_path)
    c.observer(_params())
    c.observer(_params())
    assert c.network_calls == 1


def test_cache_key_ignores_param_order_and_changes_with_site() -> None:
    p = _params()
    assert cache_key(p) == cache_key(dict(reversed(list(p.items()))))
    q = observer_params("10", 31.0, -89.5, 0.0, "2026-12-01 00:00", "2026-12-01 01:00", "30m")
    assert cache_key(p) != cache_key(q)


def test_user_agent_and_email_are_sent_but_not_in_cache_key() -> None:
    seen: dict[str, str] = {}

    def handler(request: httpx.Request) -> httpx.Response:
        seen["ua"] = request.headers["user-agent"]
        seen["email"] = request.url.params.get("EMAIL_ADDR", "")
        return httpx.Response(200, json=REAL)

    _client(handler, contact_email="team@example.org").raw(_params())
    assert "LunarLandingSiteNavigator" in seen["ua"]
    assert seen["email"] == "'team@example.org'"


def test_overlong_request_is_refused() -> None:
    p = _params()
    p["TLIST"] = "'" + " ".join(["2461000.5"] * 400) + "'"
    c = _client(lambda r: httpx.Response(200, json=REAL))
    with pytest.raises(HorizonsError, match="chunk"):
        c.raw(p)
    assert c.network_calls == 0


def test_site_coord_uses_east_longitude_and_validates_latitude() -> None:
    assert _params()["SITE_COORD"] == "'30.000000,-89.500000,0.000000'"
    assert _params()["CENTER"] == "'coord@301'"
    with pytest.raises(ValueError):
        observer_params("10", 0.0, 91.0, 0.0, "a", "b")


def test_default_client_rejects_an_unexpected_api_version() -> None:
    newer = {**REAL, "signature": {"source": "NASA/JPL Horizons API", "version": "1.3"}}
    c = _client(lambda r: httpx.Response(200, json=newer))
    with pytest.raises(HorizonsError, match="version"):
        c.raw(_params())
