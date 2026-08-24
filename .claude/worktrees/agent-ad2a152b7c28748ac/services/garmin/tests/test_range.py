"""/metrics/{name}/range tests (spec 009).

Covers the happy multi-day path, range validation (start>end, span>31),
unknown metric (404), not-authenticated (409), and the transient single-day
failure that nulls one day while the range still succeeds. garmy stays mocked at
the client boundary via the shared ``client`` fixture (see conftest.py).
"""

from __future__ import annotations

from typing import Any

import pytest
from fastapi.testclient import TestClient

from app import garmy_client


def _login(client: TestClient) -> None:
    resp = client.post(
        "/login", json={"email": "user@example.com", "password": "pw"}
    )
    assert resp.status_code == 200


def test_range_happy_path_multi_day(client: TestClient) -> None:
    _login(client)
    resp = client.get(
        "/metrics/steps/range",
        params={"start": "2026-08-01", "end": "2026-08-03"},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["metric"] == "steps"
    assert body["start"] == "2026-08-01"
    assert body["end"] == "2026-08-03"
    dates = [day["date"] for day in body["days"]]
    assert dates == ["2026-08-01", "2026-08-02", "2026-08-03"]
    assert all(day["data"] is not None for day in body["days"])


def test_range_single_day_inclusive(client: TestClient) -> None:
    _login(client)
    resp = client.get(
        "/metrics/sleep/range",
        params={"start": "2026-08-01", "end": "2026-08-01"},
    )
    assert resp.status_code == 200
    assert len(resp.json()["days"]) == 1


def test_range_start_after_end_rejected(client: TestClient) -> None:
    _login(client)
    resp = client.get(
        "/metrics/steps/range",
        params={"start": "2026-08-05", "end": "2026-08-01"},
    )
    assert resp.status_code == 400


def test_range_span_over_31_rejected(client: TestClient) -> None:
    _login(client)
    resp = client.get(
        "/metrics/steps/range",
        params={"start": "2026-08-01", "end": "2026-09-15"},
    )
    assert resp.status_code == 400


def test_range_exactly_31_days_ok(client: TestClient) -> None:
    _login(client)
    # 2026-08-01 .. 2026-08-31 inclusive == 31 days.
    resp = client.get(
        "/metrics/steps/range",
        params={"start": "2026-08-01", "end": "2026-08-31"},
    )
    assert resp.status_code == 200
    assert len(resp.json()["days"]) == 31


def test_range_unknown_metric_404(client: TestClient) -> None:
    _login(client)
    resp = client.get(
        "/metrics/not_a_metric/range",
        params={"start": "2026-08-01", "end": "2026-08-02"},
    )
    assert resp.status_code == 404


def test_range_409_when_not_authenticated(client: TestClient) -> None:
    resp = client.get(
        "/metrics/steps/range",
        params={"start": "2026-08-01", "end": "2026-08-02"},
    )
    assert resp.status_code == 409
    assert resp.json()["detail"] == "not authenticated"


def test_range_bad_date_422(client: TestClient) -> None:
    _login(client)
    resp = client.get(
        "/metrics/steps/range",
        params={"start": "08-01-2026", "end": "2026-08-02"},
    )
    assert resp.status_code == 422


def test_range_transient_day_failure_nulls_that_day(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    """A single day's upstream hiccup yields data=null; the range still 200s."""
    _login(client)
    real_fetch = garmy_client.fetch_metric
    fail_on = "2026-08-02"

    def flaky(api: Any, garmy_name: str, date: Any) -> Any:
        if date is not None and str(date) == fail_on:
            raise RuntimeError("transient upstream error")
        return real_fetch(api, garmy_name, date)

    monkeypatch.setattr(garmy_client, "fetch_metric", flaky)

    resp = client.get(
        "/metrics/steps/range",
        params={"start": "2026-08-01", "end": "2026-08-03"},
    )
    assert resp.status_code == 200
    days = {day["date"]: day["data"] for day in resp.json()["days"]}
    assert days["2026-08-01"] is not None
    assert days["2026-08-02"] is None
    assert days["2026-08-03"] is not None
