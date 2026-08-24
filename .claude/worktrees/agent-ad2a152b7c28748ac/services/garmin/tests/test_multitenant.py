"""Multi-tenant contract tests (spec 012).

Proves the shared HTTP contract the web tier depends on:
- every Garmin-touching endpoint requires an ``X-User-Id`` header (missing/empty
  → 400); ``/health`` stays unauthenticated;
- token state is isolated per user id (A's tokens are invisible to B);
- two users can be logged in independently;
- disconnecting A leaves B untouched.

garmy stays mocked at the client boundary and the token store is the offline
in-memory adapter (see conftest.py) — no real Garmin, no real Postgres.
"""

from __future__ import annotations

import logging

import pytest
from fastapi.testclient import TestClient

from tests.conftest import USER_A, USER_B, headers

_LOGIN_BODY = {"email": "user@example.com", "password": "pw"}


# --- X-User-Id is required on every Garmin-touching endpoint ------------------

def test_health_needs_no_user_id(unscoped_client: TestClient) -> None:
    resp = unscoped_client.get("/health")
    assert resp.status_code == 200
    assert resp.json() == {"status": "ok"}


def test_status_missing_header_400(unscoped_client: TestClient) -> None:
    resp = unscoped_client.get("/status")
    assert resp.status_code == 400


def test_login_missing_header_400(unscoped_client: TestClient) -> None:
    resp = unscoped_client.post("/login", json=_LOGIN_BODY)
    assert resp.status_code == 400


def test_metric_missing_header_400(unscoped_client: TestClient) -> None:
    resp = unscoped_client.get("/metrics/sleep")
    assert resp.status_code == 400


def test_range_missing_header_400(unscoped_client: TestClient) -> None:
    resp = unscoped_client.get(
        "/metrics/steps/range", params={"start": "2026-08-01", "end": "2026-08-02"}
    )
    assert resp.status_code == 400


def test_delete_session_missing_header_400(unscoped_client: TestClient) -> None:
    resp = unscoped_client.delete("/session")
    assert resp.status_code == 400


def test_empty_header_400(unscoped_client: TestClient) -> None:
    resp = unscoped_client.get("/status", headers={"X-User-Id": "   "})
    assert resp.status_code == 400


# --- per-user isolation -------------------------------------------------------

def test_login_scoped_to_user_a_only(client: TestClient) -> None:
    # A logs in (default header = USER_A).
    assert client.post("/login", json=_LOGIN_BODY).status_code == 200

    # A is authenticated; B (same app + store) is not.
    assert client.get("/status", headers=headers(USER_A)).json()["authenticated"] is True
    assert client.get("/status", headers=headers(USER_B)).json()["authenticated"] is False


def test_two_users_logged_in_independently(client: TestClient) -> None:
    assert client.post("/login", json=_LOGIN_BODY, headers=headers(USER_A)).status_code == 200
    assert client.post("/login", json=_LOGIN_BODY, headers=headers(USER_B)).status_code == 200

    assert client.get("/status", headers=headers(USER_A)).json()["authenticated"] is True
    assert client.get("/status", headers=headers(USER_B)).json()["authenticated"] is True


def test_a_metrics_not_available_to_b(client: TestClient) -> None:
    # Only A logs in.
    client.post("/login", json=_LOGIN_BODY, headers=headers(USER_A))

    a = client.get("/metrics/sleep", headers=headers(USER_A))
    assert a.status_code == 200
    assert a.json()["metric"] == "sleep"

    # B has no tokens -> 409, cannot read A's data.
    b = client.get("/metrics/sleep", headers=headers(USER_B))
    assert b.status_code == 409
    assert b.json()["detail"] == "not authenticated"


def test_disconnect_a_does_not_affect_b(client: TestClient) -> None:
    client.post("/login", json=_LOGIN_BODY, headers=headers(USER_A))
    client.post("/login", json=_LOGIN_BODY, headers=headers(USER_B))

    # A disconnects.
    deleted = client.delete("/session", headers=headers(USER_A))
    assert deleted.status_code == 200
    assert deleted.json()["cleared"] is True

    # A is gone; B remains authenticated and can still read metrics.
    assert client.get("/status", headers=headers(USER_A)).json()["authenticated"] is False
    assert client.get("/status", headers=headers(USER_B)).json()["authenticated"] is True
    assert client.get("/metrics/steps", headers=headers(USER_B)).status_code == 200


def test_delete_session_only_reports_caller(client: TestClient) -> None:
    client.post("/login", json=_LOGIN_BODY, headers=headers(USER_A))
    # B never logged in: clearing B removes nothing.
    assert client.delete("/session", headers=headers(USER_B)).json()["cleared"] is False
    # A still authenticated.
    assert client.get("/status", headers=headers(USER_A)).json()["authenticated"] is True


def test_mfa_pending_is_per_user(client: TestClient, fake_garmy) -> None:
    """An MFA challenge started by A cannot be completed under B's scope."""
    fake_garmy.mode = "mfa"

    # A starts login -> 202 mfa_required, pending state stored for A.
    assert client.post("/login", json=_LOGIN_BODY, headers=headers(USER_A)).status_code == 202

    # B supplies the code but has no pending context: the fake does a one-shot
    # login for B and authenticates B only; A is still not authenticated.
    body = {**_LOGIN_BODY, "mfa_code": "123456"}
    assert client.post("/login", json=body, headers=headers(USER_B)).status_code == 200
    assert client.get("/status", headers=headers(USER_B)).json()["authenticated"] is True
    assert client.get("/status", headers=headers(USER_A)).json()["authenticated"] is False

    # A completes its own pending MFA independently.
    assert client.post("/login", json=body, headers=headers(USER_A)).status_code == 200
    assert client.get("/status", headers=headers(USER_A)).json()["authenticated"] is True


# --- log hygiene: no user id / credentials / tokens in logs -------------------

def test_no_user_id_or_secrets_logged(
    client: TestClient, caplog: pytest.LogCaptureFixture
) -> None:
    with caplog.at_level(logging.DEBUG, logger="garmin-sidecar"):
        client.post(
            "/login",
            json={"email": "leaky@example.com", "password": "sup3r-secret"},
            headers=headers(USER_A),
        )
        client.get("/metrics/sleep", headers=headers(USER_A))

    blob = "\n".join(r.getMessage() for r in caplog.records)
    # The user id, the Garmin credentials, and token material never appear.
    for needle in (USER_A, "leaky@example.com", "sup3r-secret", "oa2-access", "oa1-token"):
        assert needle not in blob
