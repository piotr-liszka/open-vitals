"""The diagnostic channel: classified upstream errors + the log ring buffer.

Spec 019. Two things are asserted here:

1. A failing Garmin call no longer collapses into "something went wrong": the
   response carries a machine-readable ``error`` object (code / reason /
   endpoint / retryable) and the right HTTP status (429 rate limit, 409 rejected
   token, 502 everything else).
2. ``GET /diagnostics`` returns a bounded, per-user, sanitised tail of the
   sidecar's own log records — and NEVER another user's records, a password, an
   e-mail address or a token.

garmy stays mocked at the client boundary (conftest), so this is offline.
"""

from __future__ import annotations

from typing import Any

import pytest
from fastapi.testclient import TestClient

from app import garmy_client
from app.diagnostics import DiagnosticBuffer, sanitize
from app.errors import GarminUpstreamError, classify_upstream
from conftest import USER_A, USER_B, headers

EMAIL = "athlete@example.com"
PASSWORD = "sup3r-secret-pw"


def _login(client: TestClient, user: str = USER_A) -> None:
    resp = client.post(
        "/login",
        json={"email": EMAIL, "password": PASSWORD},
        headers=headers(user),
    )
    assert resp.status_code == 200


def _fail_metric_with(monkeypatch: pytest.MonkeyPatch, exc: Exception) -> None:
    def boom(api: Any, garmy_name: str, date: Any) -> Any:
        raise exc

    monkeypatch.setattr(garmy_client, "fetch_metric", boom)


# --- classification (unit) ----------------------------------------------------

@pytest.mark.parametrize(
    ("exc", "code", "retryable"),
    [
        (RuntimeError("429 Client Error: Too Many Requests"), "rate_limited", True),
        (RuntimeError("401 Client Error: Unauthorized"), "token_rejected", False),
        (RuntimeError("403 Forbidden: cloudflare challenge"), "blocked", True),
        (TimeoutError("request timed out"), "timeout", True),
        (RuntimeError("kaboom"), "upstream_error", True),
    ],
)
def test_classify_upstream_maps_failures_to_codes(
    exc: Exception, code: str, retryable: bool
) -> None:
    err = classify_upstream(exc, "metrics/sleep")
    assert err.code == code
    assert err.retryable is retryable
    assert err.endpoint == "metrics/sleep"


def test_classification_never_echoes_the_upstream_message() -> None:
    err = classify_upstream(RuntimeError(f"login failed for {EMAIL} / {PASSWORD}"), "login")
    payload = str(err.payload())
    assert EMAIL not in payload
    assert PASSWORD not in payload


# --- classified error responses ----------------------------------------------

def test_rate_limited_metric_returns_429_with_structured_error(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    _login(client)
    _fail_metric_with(monkeypatch, RuntimeError("429 Too Many Requests"))

    resp = client.get("/metrics/sleep")

    assert resp.status_code == 429
    error = resp.json()["error"]
    assert error["code"] == "rate_limited"
    assert error["retryable"] is True
    assert error["endpoint"] == "metrics/sleep"


def test_rejected_token_returns_409_and_is_not_retryable(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    _login(client)
    _fail_metric_with(monkeypatch, RuntimeError("401 Client Error: Unauthorized"))

    resp = client.get("/metrics/sleep")

    assert resp.status_code == 409
    error = resp.json()["error"]
    assert error["code"] == "token_rejected"
    assert error["retryable"] is False


def test_unknown_failure_still_502s_with_a_code(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    _login(client)
    _fail_metric_with(monkeypatch, RuntimeError("kaboom"))

    resp = client.get("/metrics/sleep")

    assert resp.status_code == 502
    assert resp.json()["error"]["code"] == "upstream_error"
    # The legacy human string stays, so older callers keep working.
    assert resp.json()["detail"] == "garmin request failed"


def test_missing_tokens_report_not_connected(client: TestClient) -> None:
    resp = client.get("/metrics/sleep")  # never logged in

    assert resp.status_code == 409
    assert resp.json()["error"] == {
        "code": "not_connected",
        "reason": "no valid Garmin tokens for this user",
        "retryable": False,
    }


def test_range_aborts_on_a_rate_limit_instead_of_grinding_every_day(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    _login(client)
    calls: list[Any] = []

    def throttled(api: Any, garmy_name: str, date: Any) -> Any:
        calls.append(date)
        raise RuntimeError("429 Too Many Requests")

    monkeypatch.setattr(garmy_client, "fetch_metric", throttled)

    resp = client.get(
        "/metrics/steps/range", params={"start": "2026-08-01", "end": "2026-08-20"}
    )

    assert resp.status_code == 429
    assert len(calls) == 1  # gave up after the first throttled day


# --- the diagnostics buffer ---------------------------------------------------

def test_diagnostics_returns_this_users_records(client: TestClient) -> None:
    _login(client)
    client.get("/metrics/sleep")

    resp = client.get("/diagnostics")

    assert resp.status_code == 200
    body = resp.json()
    assert body["capacity"] > 0
    messages = [e["msg"] for e in body["entries"]]
    assert any("metric" in m for m in messages)
    assert all({"t", "level", "logger", "msg"} <= set(e) for e in body["entries"])


def test_diagnostics_records_the_failure_code(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    _login(client)
    _fail_metric_with(monkeypatch, RuntimeError("429 Too Many Requests"))
    client.get("/metrics/sleep")

    entries = client.get("/diagnostics").json()["entries"]

    assert any(e.get("code") == "rate_limited" for e in entries)
    assert any(e["level"] == "warning" for e in entries)


def test_diagnostics_never_leak_credentials(client: TestClient) -> None:
    _login(client)
    dump = client.get("/diagnostics").text
    assert EMAIL not in dump
    assert PASSWORD not in dump
    assert "oa2-access" not in dump  # the fake's token material


def test_diagnostics_are_per_user(client: TestClient) -> None:
    _login(client, USER_A)
    _login(client, USER_B)
    client.get("/metrics/sleep", headers=headers(USER_B))

    a_entries = client.get("/diagnostics", headers=headers(USER_A)).json()["entries"]
    b_entries = client.get("/diagnostics", headers=headers(USER_B)).json()["entries"]

    assert any("metric" in e["msg"] for e in b_entries)
    assert not any("metric" in e["msg"] for e in a_entries)
    # No record ever carries the user scope out of the process.
    assert all("user" not in e for e in a_entries + b_entries)


def test_diagnostics_requires_a_user_header(unscoped_client: TestClient) -> None:
    assert unscoped_client.get("/diagnostics").status_code == 400


def test_buffer_is_bounded_and_sanitises() -> None:
    buffer = DiagnosticBuffer(capacity=3)
    for i in range(10):
        buffer.add("INFO", f"line {i}", user_id="u1")

    entries = buffer.snapshot("u1", limit=100)
    assert [e["msg"] for e in entries] == ["line 7", "line 8", "line 9"]
    assert sanitize(f"login for {EMAIL} token=abcdefghijklmnopqrstuvwxyz") == (
        "login for *** token=***"
    )


def test_upstream_payload_shape() -> None:
    err = GarminUpstreamError(
        "rate_limited", reason="rate_limited (HTTPError, HTTP 429)",
        endpoint="metrics/hrv", status=429, retryable=True
    )
    assert err.payload() == {
        "code": "rate_limited",
        "reason": "rate_limited (HTTPError, HTTP 429)",
        "retryable": True,
        "endpoint": "metrics/hrv",
        "upstreamStatus": 429,
    }
