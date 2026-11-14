"""Rate limits, cache headers and ETags."""

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from lunar_api.caching import EtagMiddleware, RateLimitMiddleware, TokenBucket, client_ip
from lunar_api.errors import install_error_handlers
from lunar_api.middleware import RequestIdMiddleware
from starlette.requests import Request


class Clock:
    def __init__(self) -> None:
        self.t = 1000.0

    def __call__(self) -> float:
        return self.t


def test_token_bucket_allows_a_burst_then_refills_at_the_rate() -> None:
    clock = Clock()
    b = TokenBucket(rate_per_s=2.0, burst=3, clock=clock)
    assert [b.take("a")[0] for _ in range(4)] == [True, True, True, False]
    ok, wait = b.take("a")
    assert not ok and wait == pytest.approx(0.5)
    clock.t += 0.5
    assert b.take("a")[0] and not b.take("a")[0]
    clock.t += 100.0  # capped at the burst, not unlimited
    assert [b.take("a")[0] for _ in range(4)] == [True, True, True, False]
    assert b.take("other")[0]  # another client has its own bucket


def _app(**kw) -> tuple[FastAPI, Clock]:  # type: ignore[no-untyped-def]
    clock = Clock()
    app = FastAPI()
    app.add_middleware(EtagMiddleware)
    app.add_middleware(RateLimitMiddleware, clock=clock, **kw)
    app.add_middleware(RequestIdMiddleware)
    install_error_handlers(app)
    payload = {"v": 1}

    @app.get("/api/v1/sites/x")
    def x() -> dict[str, int]:
        return payload

    @app.get("/api/v1/jobs/j")
    def j() -> dict[str, int]:
        return payload

    @app.post("/api/v1/sites/custom")
    def custom() -> dict[str, int]:
        return payload

    @app.get("/api/v1/health")
    def health() -> dict[str, str]:
        return {"status": "ok"}

    return app, clock


def test_429_is_a_problem_document_with_retry_after_and_request_id() -> None:
    app, clock = _app(rate_per_s=1.0, burst=2)
    c = TestClient(app)
    assert c.get("/api/v1/jobs/j").status_code == 200
    assert c.get("/api/v1/jobs/j").status_code == 200
    r = c.get("/api/v1/jobs/j")
    assert r.status_code == 429 and r.headers["retry-after"] == "1"
    assert r.headers["content-type"].startswith("application/problem+json")
    assert r.json()["title"] == "Too many requests" and r.json()["request_id"]
    clock.t += 1.0
    assert c.get("/api/v1/jobs/j").status_code == 200


def test_posts_use_a_stricter_bucket_and_health_is_never_limited() -> None:
    app, _ = _app(rate_per_s=100.0, burst=100, heavy_rate_per_s=0.1, heavy_burst=2)
    c = TestClient(app)
    assert [c.post("/api/v1/sites/custom").status_code for _ in range(3)] == [200, 200, 429]
    assert c.get("/api/v1/sites/x").status_code == 200  # reads still fine
    app2, _ = _app(rate_per_s=0.001, burst=1)
    c2 = TestClient(app2)
    assert c2.get("/api/v1/jobs/j").status_code == 200
    assert c2.get("/api/v1/jobs/j").status_code == 429
    assert all(c2.get("/api/v1/health").status_code == 200 for _ in range(20))


def test_forwarded_for_is_trusted_only_from_loopback() -> None:
    def req(peer: str, xff: str | None) -> Request:
        headers = [(b"x-forwarded-for", xff.encode())] if xff else []
        return Request(
            {
                "type": "http",
                "headers": headers,
                "client": (peer, 1234),
                "method": "GET",
                "path": "/",
                "query_string": b"",
            }
        )

    assert client_ip(req("127.0.0.1", "203.0.113.9, 10.0.0.1")) == "203.0.113.9"
    assert client_ip(req("198.51.100.7", "203.0.113.9")) == "198.51.100.7"  # spoof ignored
    assert client_ip(req("127.0.0.1", "not-an-ip")) == "127.0.0.1"
    assert client_ip(req("127.0.0.1", None)) == "127.0.0.1"


def test_different_clients_do_not_share_a_bucket() -> None:
    # Behind Caddy the peer is loopback, so X-Forwarded-For identifies the real caller.
    app, _ = _app(rate_per_s=0.001, burst=1)
    c = TestClient(app, client=("127.0.0.1", 50000))
    h1, h2 = {"x-forwarded-for": "203.0.113.1"}, {"x-forwarded-for": "203.0.113.2"}
    assert c.get("/api/v1/jobs/j", headers=h1).status_code == 200
    assert c.get("/api/v1/jobs/j", headers=h2).status_code == 200
    assert c.get("/api/v1/jobs/j", headers=h1).status_code == 429


def test_a_remote_caller_cannot_dodge_the_limit_by_spoofing_forwarded_for() -> None:
    app, _ = _app(rate_per_s=0.001, burst=1)
    c = TestClient(app, client=("198.51.100.7", 50000))  # not loopback: header must be ignored
    assert c.get("/api/v1/jobs/j", headers={"x-forwarded-for": "203.0.113.1"}).status_code == 200
    for i in range(2, 6):
        r = c.get("/api/v1/jobs/j", headers={"x-forwarded-for": f"203.0.113.{i}"})
        assert r.status_code == 429


def test_cacheable_gets_have_etag_and_304_on_match() -> None:
    app, _ = _app()
    c = TestClient(app)
    r = c.get("/api/v1/sites/x")
    assert r.status_code == 200 and r.headers["cache-control"] == "public, max-age=300"
    etag = r.headers["etag"]
    assert etag.startswith('"') and len(etag) == 34
    hit = c.get("/api/v1/sites/x", headers={"If-None-Match": etag})
    assert hit.status_code == 304 and hit.content == b"" and hit.headers["etag"] == etag
    weak = c.get("/api/v1/sites/x", headers={"If-None-Match": "W/" + etag})
    assert weak.status_code == 304
    miss = c.get("/api/v1/sites/x", headers={"If-None-Match": '"nope"'})
    assert miss.status_code == 200 and miss.json() == {"v": 1}
    assert c.get("/api/v1/sites/x").headers["etag"] == etag  # same content, same tag


def test_etag_changes_when_the_content_changes() -> None:
    app, _ = _app()
    c = TestClient(app)
    first = c.get("/api/v1/sites/x").headers["etag"]
    app2 = FastAPI()
    app2.add_middleware(EtagMiddleware)

    @app2.get("/api/v1/sites/x")
    def x() -> dict[str, int]:
        return {"v": 2}

    assert TestClient(app2).get("/api/v1/sites/x").headers["etag"] != first


def test_jobs_posts_probes_and_errors_are_never_cached() -> None:
    app, _ = _app()
    c = TestClient(app)
    for r in (
        c.get("/api/v1/jobs/j"),
        c.post("/api/v1/sites/custom"),
        c.get("/api/v1/health"),
        c.get("/api/v1/sites/missing-route-404"),
    ):
        assert "etag" not in r.headers and "cache-control" not in r.headers


def test_real_app_serves_etags_for_sites_but_not_for_jobs(client: TestClient) -> None:
    r = client.get("/api/v1/sites")
    assert r.status_code == 200 and r.headers["etag"]
    assert (
        client.get("/api/v1/sites", headers={"If-None-Match": r.headers["etag"]}).status_code == 304
    )
    assert "etag" not in client.get("/api/v1/jobs/job-nothing").headers
    assert client.get("/api/v1/sites/alpha/state", params={"t": "2026-12-03T06:00:00Z"}).headers[
        "x-request-id"
    ]


def test_settings_reads_limits_from_the_environment(monkeypatch: pytest.MonkeyPatch) -> None:
    from lunar_api.settings import Settings

    d = Settings.from_env()
    assert (d.rate_per_s, d.rate_burst, d.heavy_rate_per_s, d.heavy_burst) == (5.0, 60, 0.5, 6)
    monkeypatch.setenv("RATE_PER_S", "2")
    monkeypatch.setenv("RATE_BURST", "10")
    monkeypatch.setenv("HEAVY_BURST", "3")
    s = Settings.from_env()
    assert (s.rate_per_s, s.rate_burst, s.heavy_burst) == (2.0, 10, 3)
