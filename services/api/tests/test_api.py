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
