"""/health and /status response-shape tests."""

from __future__ import annotations

from fastapi.testclient import TestClient


def test_health_ok(client: TestClient) -> None:
    resp = client.get("/health")
    assert resp.status_code == 200
    assert resp.json() == {"status": "ok"}


def test_status_unauthenticated_when_no_tokens(client: TestClient) -> None:
    resp = client.get("/status")
    assert resp.status_code == 200
    body = resp.json()
    assert body["authenticated"] is False
    # No secrets / identity leaked before auth.
    assert body.get("display_name") is None


def test_status_authenticated_after_login(client: TestClient) -> None:
    login = client.post(
        "/login", json={"email": "user@example.com", "password": "pw"}
    )
    assert login.status_code == 200

    resp = client.get("/status")
    assert resp.status_code == 200
    body = resp.json()
    assert body["authenticated"] is True
    assert body["display_name"] == "Test Athlete"
    assert body["expires_at"] == 4102444800.0
