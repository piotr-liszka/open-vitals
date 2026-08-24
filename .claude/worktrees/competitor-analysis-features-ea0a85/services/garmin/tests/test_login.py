"""/login success, MFA-required, MFA-completion, and bad-credential tests."""

from __future__ import annotations

from fastapi.testclient import TestClient

from tests.conftest import GarmyBehavior


def test_login_success(client: TestClient) -> None:
    resp = client.post(
        "/login", json={"email": "user@example.com", "password": "pw"}
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["authenticated"] is True
    assert body["display_name"] == "Test Athlete"


def test_login_mfa_required(client: TestClient, behavior: GarmyBehavior) -> None:
    behavior.mode = "mfa"
    resp = client.post(
        "/login", json={"email": "user@example.com", "password": "pw"}
    )
    assert resp.status_code == 202
    assert resp.json() == {"mfa_required": True}


def test_login_mfa_completion(client: TestClient, behavior: GarmyBehavior) -> None:
    behavior.mode = "mfa"
    first = client.post(
        "/login", json={"email": "user@example.com", "password": "pw"}
    )
    assert first.status_code == 202

    second = client.post(
        "/login",
        json={"email": "user@example.com", "password": "pw", "mfa_code": "123456"},
    )
    assert second.status_code == 200
    assert second.json()["authenticated"] is True

    # Tokens now present.
    assert client.get("/status").json()["authenticated"] is True


def test_login_bad_credentials(client: TestClient, behavior: GarmyBehavior) -> None:
    behavior.mode = "bad_creds"
    resp = client.post(
        "/login", json={"email": "user@example.com", "password": "wrong"}
    )
    assert resp.status_code == 401
    # Store stays empty after a failed login.
    assert client.get("/status").json()["authenticated"] is False


def test_login_rejects_invalid_body(client: TestClient) -> None:
    resp = client.post("/login", json={"email": "u@x.io"})  # missing password
    assert resp.status_code == 422


def test_delete_session_clears_tokens(client: TestClient) -> None:
    client.post("/login", json={"email": "user@example.com", "password": "pw"})
    assert client.get("/status").json()["authenticated"] is True

    deleted = client.delete("/session")
    assert deleted.status_code == 200
    assert deleted.json()["cleared"] is True
    assert client.get("/status").json()["authenticated"] is False
