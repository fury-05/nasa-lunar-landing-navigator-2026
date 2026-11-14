"""Hostile input against the real app (P3-09). Each test names the attack it covers."""

import json
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

W = {"start": "2026-12-03T00:00:00Z", "end": "2026-12-08T00:00:00Z"}
SITE = "/api/v1/sites"


@pytest.mark.parametrize(
    "site_id",
    [
        "..",
        "../..",
        "%2e%2e",
        "%2e%2e%2f%2e%2e%2fetc%2fpasswd",
        "..%5c..%5cWindows",
        "alpha%2f..%2fbeta",
        ".hidden",
        "alpha%00",
        "ALPHA",
        "alpha ",
        "al/pha",
        "a" * 5000,
        "%",
        "%zz",
        "alpha;ls",
        "alpha'--",
        'alpha"; DROP TABLE sites;--',
    ],
)
def test_path_traversal_and_injection_in_site_ids_never_reach_the_filesystem(
    client: TestClient, site_id: str
) -> None:
    for url in (f"{SITE}/{site_id}", f"{SITE}/{site_id}/skyline", f"{SITE}/{site_id}/assess"):
        r = client.get(url, params=W if url.endswith("assess") else None)
        assert r.status_code in (404, 422, 400), (url, r.status_code)
        assert r.status_code != 500
        assert "root:" not in r.text
        assert "<" not in r.text and "\x00" not in r.text
        if r.status_code in (404, 422):
            assert r.headers["content-type"].startswith("application/problem+json")


def test_site_id_with_a_valid_prefix_cannot_escape_the_data_directory(
    client: TestClient, bundle: Path
) -> None:
    secret = bundle.parent / "secret_meta"
    (secret).mkdir(exist_ok=True)
    (secret / "meta.json").write_text('{"leak": true}', encoding="utf8")
    for sid in ("../secret_meta", "..%2fsecret_meta", "alpha/../../secret_meta"):
        r = client.get(f"{SITE}/{sid}")
        assert r.status_code == 404 and "leak" not in r.text


@pytest.mark.parametrize("field", ["start", "end"])
@pytest.mark.parametrize(
    "bad",
    [
        "",
        "now",
        "2026-13-45T00:00:00Z",
        "0",
        "9999999999999",
        "2026-12-03T00:00:00Z' OR 1=1",
        "<script>alert(1)</script>",
        "2026-12-03 00:00:00\x00",
        "nan",
        "inf",
        "-1",
    ],
)
def test_malformed_times_are_rejected_cleanly(client: TestClient, field: str, bad: str) -> None:
    params = dict(W)
    params[field] = bad
    r = client.get(f"{SITE}/alpha/assess", params=params)
    assert r.status_code == 422, (bad, r.status_code)
    body = r.json()
    assert body["errors"] and "<script>" not in r.text.replace("&lt;", "")  # no reflected markup
    assert "Traceback" not in r.text and 'File "' not in r.text


@pytest.mark.parametrize(
    "payload",
    [
        {"lat": "NaN", "lon": 0},
        {"lat": 1e999, "lon": 0},
        {"lat": -89.5, "lon": 40, "alt_m": "1e999"},
        {"lat": -89.5, "lon": 40, "alt_m": 10**12},
        {"lat": -89.5, "lon": 200},
        {"lat": [1], "lon": 0},
        {"lat": None, "lon": 0},
        {"lat": True, "lon": 0},
    ],
)
def test_custom_site_rejects_hostile_numbers(client: TestClient, payload: dict) -> None:  # type: ignore[type-arg]
    r = client.post(
        f"{SITE}/custom",
        content=json.dumps(payload, allow_nan=True),
        headers={"content-type": "application/json"},
    )
    assert r.status_code in (422, 400), (payload, r.status_code, r.text[:200])
    assert r.status_code != 500


def test_malformed_json_bodies_are_422_not_500(client: TestClient) -> None:
    for raw in (b"", b"{", b"[1,2", b"null", b"\xff\xfe\x00", b'{"lat":' + b"9" * 100_000):
        r = client.post(f"{SITE}/custom", content=raw, headers={"content-type": "application/json"})
        assert r.status_code in (400, 413, 422), (raw[:20], r.status_code)
    r = client.post(
        f"{SITE}/custom",
        content=b"lat=1&lon=2",
        headers={"content-type": "application/x-www-form-urlencoded"},
    )
    assert r.status_code == 422


def test_compare_and_slip_matrix_resist_size_and_type_abuse(client: TestClient) -> None:
    huge_sites = {"sites": [f"s{i}" for i in range(10_000)], "windows": [W]}
    assert client.post("/api/v1/compare", json=huge_sites).status_code in (422, 413)
    many_windows = {"sites": ["alpha"], "windows": [W] * 500}
    assert client.post("/api/v1/compare", json=many_windows).status_code == 422
    slip = {
        "sites": ["alpha"],
        "start": "2026-12-02T00:00:00Z",
        "offsets_days": [0] * 5000,
        "duration_days": 4,
    }
    assert client.post("/api/v1/slip-matrix", json=slip).status_code == 422
    for bad in (
        {"sites": "alpha", "windows": [W]},
        {"sites": [1, 2], "windows": [W]},
        {"sites": ["alpha"], "windows": "x"},
        {"sites": ["alpha"], "windows": [{"start": 1}]},
    ):
        assert client.post("/api/v1/compare", json=bad).status_code in (404, 422)


def test_timeline_cannot_be_used_to_request_an_enormous_payload(client: TestClient) -> None:
    r = client.get(
        f"{SITE}/alpha/timeline",
        params={"start": "2026-12-01T00:00:00Z", "end": "2026-12-30T00:00:00Z", "step_min": 10},
    )
    assert r.status_code == 200 and r.json()["count"] <= 400 * 144 + 1  # bounded by the window cap
    big = client.get(
        f"{SITE}/alpha/timeline",
        params={"start": "2026-12-01T00:00:00Z", "end": "2028-12-30T00:00:00Z"},
    )
    assert big.status_code == 422


def test_unhandled_errors_do_not_leak_internals(client: TestClient, monkeypatch) -> None:  # type: ignore[no-untyped-def]
    import lunar_api.routes as routes

    def boom(*_a: object, **_k: object) -> None:
        raise RuntimeError("secret path C:/Users/hp/.ssh/id_rsa password=hunter2")

    monkeypatch.setattr(routes, "assess_window", boom)
    r = client.get(f"{SITE}/alpha/assess", params=W)
    assert r.status_code == 500
    assert "hunter2" not in r.text and ".ssh" not in r.text and "RuntimeError" not in r.text
    assert r.json()["title"] == "Internal error" and r.headers["x-request-id"]


def test_security_relevant_headers_and_methods(client: TestClient) -> None:
    r = client.get("/api/v1/version")
    assert "server" not in {k.lower() for k in r.headers} or "uvicorn" not in r.headers.get(
        "server", ""
    )
    for method in ("PUT", "DELETE", "PATCH"):
        assert client.request(method, f"{SITE}/alpha").status_code == 405
    assert client.options(f"{SITE}/alpha").status_code in (200, 405)
    assert client.get("/api/v1/docs").status_code == 200  # documented on purpose, read-only API


def test_cors_is_not_opened_to_every_origin_by_accident(client: TestClient) -> None:
    r = client.get(f"{SITE}", headers={"Origin": "https://evil.example"})
    assert r.headers.get("access-control-allow-origin") in (None, "")
    pre = client.options(
        f"{SITE}",
        headers={"Origin": "https://evil.example", "Access-Control-Request-Method": "GET"},
    )
    assert pre.headers.get("access-control-allow-origin") in (None, "")


def test_request_id_header_cannot_inject_log_lines(client: TestClient) -> None:
    r = client.get("/api/v1/version", headers={"X-Request-ID": "abc\r\nSet-Cookie: x=1"})
    assert "set-cookie" not in {k.lower() for k in r.headers}
    assert "\n" not in r.headers["x-request-id"] and "\r" not in r.headers["x-request-id"]


def test_job_ids_cannot_probe_other_data(client: TestClient) -> None:
    for jid in ("..", "../etc/passwd", "job-%00", "job-" + "a" * 10_000, "' OR '1'='1"):
        r = client.get(f"/api/v1/jobs/{jid}")
        assert r.status_code in (404, 422)
        assert client.get(f"/api/v1/jobs/{jid}/events").status_code in (404, 422)


NUL, CR, LF = chr(0), chr(13), chr(10)
RLO = chr(0x202E)  # right-to-left override, used to disguise text
ARABIC_DIGITS = "".join(chr(c) for c in (0x662, 0x660, 0x662, 0x666))


def test_site_ids_have_one_spelling_so_case_cannot_alias_a_folder(client: TestClient) -> None:
    from lunar_api.store import valid_site_id

    assert client.get(f"{SITE}/alpha").status_code == 200
    for alias in ("ALPHA", "Alpha", "alpha.", "alpha%20", "_alpha", "-alpha"):
        r = client.get(f"{SITE}/{alias}")
        assert r.status_code == 404, (alias, r.status_code)
        assert r.headers["content-type"].startswith("application/problem+json")
    assert valid_site_id("alpha") and valid_site_id("custom-8c9e0de96ae0")
    assert valid_site_id("pgda-site04")
    for bad in ("", "ALPHA", "a b", "a/b", "..", ".a", "a.b", "a" * 65, chr(0xE9), "a" + NUL):
        assert not valid_site_id(bad), repr(bad)


def test_error_messages_never_echo_markup_control_characters_or_long_input(
    client: TestClient,
) -> None:
    from lunar_api.errors import safe_echo

    assert safe_echo("abc-123") == "abc-123"
    assert safe_echo("<script>alert(1)</script>") == "?script?alert(1)?/script?"
    assert safe_echo("a" + NUL + "b" + CR + LF + "c") == "a?b??c"
    assert safe_echo(RLO + NUL + "x") == "??x"
    assert safe_echo("x" * 500) == "x" * 64 + "..."
    r = client.get(f"{SITE}/<img src=x onerror=alert(1)>")
    assert r.status_code == 404 and "<img" not in r.text and "<" not in r.text


def test_booleans_and_strings_are_not_accepted_as_coordinates(client: TestClient) -> None:
    bodies = ({"lat": True, "lon": 0}, {"lat": "-89.5", "lon": 40}, {"lat": -89.5, "lon": False})
    for body in bodies:
        assert client.post(f"{SITE}/custom", json=body).status_code == 422, body
    ok = client.post(f"{SITE}/custom", json={"lat": -89, "lon": 40})  # whole numbers are fine
    assert ok.status_code in (200, 202)


def test_times_with_nul_bytes_or_unicode_digits_are_rejected(client: TestClient) -> None:
    for bad in (
        "2026-12-03T00:00:00Z" + NUL,
        ARABIC_DIGITS + "-12-03T00:00:00Z",
        "2026-12-03T00:00:00Z" + LF,
        "2026-12-03T00:00:00Z; DROP",
    ):
        r = client.get(f"{SITE}/alpha/assess", params={**W, "start": bad})
        assert r.status_code == 422, repr(bad)


def test_every_response_carries_defence_in_depth_headers(client: TestClient) -> None:
    for url in ("/api/v1/version", f"{SITE}/alpha", f"{SITE}/nope", "/api/v1/docs"):
        h = client.get(url).headers
        assert h["x-content-type-options"] == "nosniff"
        assert h["referrer-policy"] == "no-referrer"
        assert "frame-ancestors 'none'" in h["content-security-policy"]


def test_docs_page_is_self_contained_and_lists_the_routes(client: TestClient) -> None:
    r = client.get("/api/v1/docs")
    assert r.status_code == 200 and "text/html" in r.headers["content-type"]
    assert "https://" not in r.text  # no scripts or styles pulled from a third party
    assert "<script" not in r.text.lower()
    assert "/api/v1/sites/{site_id}/assess" in r.text
    assert "not for flight operations" in r.text
