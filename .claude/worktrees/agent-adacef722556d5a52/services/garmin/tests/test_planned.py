"""`GET /calendar/planned` — scheduled workouts / races (spec 024).

garmy ships no calendar accessor, so the sidecar calls Garmin's
``/calendar-service/year/{y}/month/{m}`` through ``APIClient.connectapi``. That
path is an ASSUMPTION we cannot verify offline, so the contract these tests pin
down is deliberately two-sided:

* when Garmin answers with a calendar, planned items are normalised and
  completed activities are filtered out;
* when it answers nothing/garbage/an error, the endpoint reports
  ``available: false`` with an empty list — never an invented plan.
"""

from __future__ import annotations

from typing import Any

import pytest
from fastapi.testclient import TestClient

from app import garmy_client
from conftest import USER_A, headers


def _login(client: TestClient) -> None:
    resp = client.post("/login", json={"email": "user@example.com", "password": "pw"})
    assert resp.status_code == 200


def test_planned_events_are_normalised(client: TestClient) -> None:
    _login(client)

    resp = client.get(
        "/calendar/planned", params={"start": "2026-08-09", "end": "2026-08-31"}
    )

    assert resp.status_code == 200
    body = resp.json()
    assert body["available"] is True
    assert body["source"] == "calendar-service"
    assert [e["day"] for e in body["events"]] == ["2026-08-10", "2026-08-30"]
    workout = body["events"][0]
    assert workout == {
        "id": "5001",
        "day": "2026-08-10",
        "time": "18:00",
        "kind": "workout",
        "title": "Interwały 6×800",
        "sport": "running",
        "description": None,
        "estimatedDurationS": 3600.0,
        "estimatedDistanceM": 12000.0,
        "targetLoad": None,
    }
    assert body["events"][1]["kind"] == "race"


def test_completed_activities_are_not_planned_events(client: TestClient) -> None:
    _login(client)

    resp = client.get(
        "/calendar/planned", params={"start": "2026-08-01", "end": "2026-08-31"}
    )

    # 2026-08-08 holds a finished activity in the fixture calendar.
    assert all(e["day"] != "2026-08-08" for e in resp.json()["events"])


def test_window_outside_the_calendar_is_empty_but_available(client: TestClient) -> None:
    _login(client)

    resp = client.get(
        "/calendar/planned", params={"start": "2026-09-01", "end": "2026-09-07"}
    )

    body = resp.json()
    assert body["available"] is True  # Garmin answered, the month is just empty
    assert body["events"] == []


def test_unavailable_calendar_is_reported_honestly(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    """An account/endpoint Garmin serves nothing for must not look like "no plan"."""
    _login(client)
    monkeypatch.setattr(garmy_client, "_try_connectapi", lambda api, path: None)

    body = client.get(
        "/calendar/planned", params={"start": "2026-08-09", "end": "2026-08-16"}
    ).json()

    assert body["available"] is False
    assert body["events"] == []


def test_upstream_failure_does_not_crash_the_endpoint(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    _login(client)

    def boom(api: Any, path: str) -> Any:
        raise RuntimeError("500 Server Error")

    monkeypatch.setattr(garmy_client, "_connectapi", boom)

    body = client.get(
        "/calendar/planned", params={"start": "2026-08-09", "end": "2026-08-16"}
    ).json()

    # _try_connectapi swallows the failure: honest "unavailable", not a 502.
    assert body["available"] is False


def test_planned_requires_auth_and_a_user_header(
    client: TestClient, unscoped_client: TestClient
) -> None:
    params = {"start": "2026-08-09", "end": "2026-08-16"}
    assert client.get("/calendar/planned", params=params).status_code == 409
    assert (
        unscoped_client.get("/calendar/planned", params=params).status_code == 400
    )


def test_planned_validates_the_range(client: TestClient) -> None:
    _login(client)
    assert (
        client.get(
            "/calendar/planned", params={"start": "2026-08-09", "end": "2026-08-01"}
        ).status_code
        == 400
    )
    assert (
        client.get(
            "/calendar/planned", params={"start": "2020-01-01", "end": "2026-08-01"}
        ).status_code
        == 400
    )
    assert (
        client.get(
            "/calendar/planned", params={"start": "nope", "end": "2026-08-01"}
        ).status_code
        == 422
    )


def test_planned_is_scoped_per_user(client: TestClient) -> None:
    _login(client)  # USER_A only
    params = {"start": "2026-08-09", "end": "2026-08-16"}

    assert client.get("/calendar/planned", params=params).status_code == 200
    other = client.get(
        "/calendar/planned", params=params, headers=headers("user-c-0003")
    )
    assert other.status_code == 409  # no tokens for that user
    assert USER_A not in other.text


def test_month_paths_are_zero_based(monkeypatch: pytest.MonkeyPatch) -> None:
    """Garmin numbers calendar months from 0; a 1-based path would 404 silently."""
    seen: list[str] = []

    class FakeApi:
        def connectapi(self, path: str) -> Any:
            seen.append(path)
            return {"calendarItems": []}

    import datetime as dt

    garmy_client.fetch_planned_events(FakeApi(), dt.date(2026, 1, 5), dt.date(2026, 2, 3))

    assert seen == [
        "/calendar-service/year/2026/month/0",
        "/calendar-service/year/2026/month/1",
    ]
