from fastapi.testclient import TestClient
from lunar_api.main import app

client = TestClient(app)


def test_health() -> None:
    r = client.get("/api/v1/health")
    assert r.status_code == 200 and r.json() == {"status": "ok"}


def test_version_has_disclaimer() -> None:
    body = client.get("/api/v1/version").json()
    assert body["api"] and body["engine"]
    assert "not for flight operations" in body["disclaimer"]


def test_ready_is_503_without_backing_services(monkeypatch) -> None:  # type: ignore[no-untyped-def]
    monkeypatch.delenv("DATABASE_URL", raising=False)
    monkeypatch.delenv("REDIS_URL", raising=False)
    r = client.get("/api/v1/ready")
    assert r.status_code == 503
    assert r.json()["status"] == "not-ready"


def test_unknown_route_is_a_problem_document() -> None:
    r = client.get("/api/v1/nope")
    assert r.status_code == 404
    assert r.headers["content-type"].startswith("application/problem+json")
    body = r.json()
    assert body["status"] == 404 and body["title"] == "Not found"
    assert body["type"].endswith("/http-404") and body["instance"] == "/api/v1/nope"
    assert body["errors"] == [] and body["request_id"]


def test_request_id_is_generated_echoed_and_validated() -> None:
    r = client.get("/api/v1/health")
    rid = r.headers["x-request-id"]
    assert len(rid) == 32
    ok = client.get("/api/v1/health", headers={"X-Request-ID": "abc-12345-XYZ"})
    assert ok.headers["x-request-id"] == "abc-12345-XYZ"
    bad = client.get("/api/v1/health", headers={"X-Request-ID": "bad id with spaces\t"})
    assert bad.headers["x-request-id"] != "bad id with spaces\t" and len(bad.headers["x-request-id"]) == 32
    assert client.get("/api/v1/nope").json()["request_id"]


def test_wrong_method_is_405_problem() -> None:
    r = client.post("/api/v1/health")
    assert r.status_code == 405 and r.json()["title"] == "Method not allowed"


def test_validation_and_unhandled_errors_use_the_same_shape() -> None:
    from fastapi import FastAPI
    from lunar_api.errors import ApiError, install_error_handlers
    from lunar_api.middleware import RequestIdMiddleware
    from pydantic import BaseModel

    app2 = FastAPI()
    app2.add_middleware(RequestIdMiddleware)
    install_error_handlers(app2)

    class Body(BaseModel):
        lat: float
        lon: float

    @app2.post("/v")
    def v(b: Body) -> dict[str, float]:
        return {"lat": b.lat}

    @app2.get("/boom")
    def boom() -> None:
        raise RuntimeError("secret internals: password=hunter2")

    @app2.get("/teapot")
    def teapot() -> None:
        raise ApiError(418, "Teapot", "short", "teapot", [{"field": "x", "message": "y"}])

    c = TestClient(app2, raise_server_exceptions=False)
    r = c.post("/v", json={"lat": "north"})
    assert r.status_code == 422
    assert r.headers["content-type"].startswith("application/problem+json")
    fields = {e["field"] for e in r.json()["errors"]}
    assert fields == {"lat", "lon"}
    b = c.get("/boom")
    assert b.status_code == 500 and "hunter2" not in b.text
    assert b.json()["title"] == "Internal error"
    assert b.json()["request_id"] == b.headers["x-request-id"]
    t = c.get("/teapot")
    assert t.status_code == 418 and t.json()["errors"] == [{"field": "x", "message": "y"}]
