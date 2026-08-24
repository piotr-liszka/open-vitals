"""/metrics/{name} tests: data when authenticated, 409 when not, 404 unknown."""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app.metrics import SUPPORTED_METRICS

from conftest import FakeTrainingReadinessAccessor


def _login(client: TestClient) -> None:
    resp = client.post(
        "/login", json={"email": "user@example.com", "password": "pw"}
    )
    assert resp.status_code == 200


@pytest.mark.parametrize("name", SUPPORTED_METRICS)
def test_metric_returns_data_when_authenticated(
    client: TestClient, name: str
) -> None:
    _login(client)
    resp = client.get(f"/metrics/{name}", params={"date": "2026-08-01"})
    assert resp.status_code == 200
    body = resp.json()
    assert body["metric"] == name
    assert body["date"] == "2026-08-01"
    assert body["data"] is not None


@pytest.mark.parametrize("name", ["spo2", "body_composition"])
def test_extended_metric_returns_data(client: TestClient, name: str) -> None:
    """spec 008: new metrics dispatch through the same generic route."""
    _login(client)
    resp = client.get(f"/metrics/{name}", params={"date": "2026-08-01"})
    assert resp.status_code == 200
    body = resp.json()
    assert body["metric"] == name
    assert body["date"] == "2026-08-01"
    assert body["data"] is not None


def test_extended_metrics_registered() -> None:
    for name in ("spo2", "respiration", "calories", "body_composition"):
        assert name in SUPPORTED_METRICS


def test_training_readiness_unwraps_single_item_list(client: TestClient) -> None:
    """spec 059: Garmin wraps the day in a list; the sidecar serves one object."""
    _login(client)
    resp = client.get("/metrics/training_readiness", params={"date": "2026-08-01"})
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert isinstance(data, dict)
    assert data["score"] == 27
    assert data["recoveryTime"] == 34


def test_training_readiness_empty_list_is_an_empty_day(client: TestClient) -> None:
    """A device without the feature answers []; that is a gap, never a 5xx."""
    _login(client)
    FakeTrainingReadinessAccessor.empty = True
    resp = client.get("/metrics/training_readiness", params={"date": "2026-08-01"})
    assert resp.status_code == 200
    assert resp.json()["data"] is None


def test_training_readiness_range_shapes_days(client: TestClient) -> None:
    _login(client)
    resp = client.get(
        "/metrics/training_readiness/range",
        params={"start": "2026-08-01", "end": "2026-08-03"},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert [d["date"] for d in body["days"]] == ["2026-08-01", "2026-08-02", "2026-08-03"]
    assert all(d["data"]["score"] == 27 for d in body["days"])


def test_metric_without_date_defaults(client: TestClient) -> None:
    _login(client)
    resp = client.get("/metrics/sleep")
    assert resp.status_code == 200
    assert resp.json()["date"] is None


def test_metric_409_when_not_authenticated(client: TestClient) -> None:
    resp = client.get("/metrics/sleep")
    assert resp.status_code == 409
    assert resp.json()["detail"] == "not authenticated"


def test_unknown_metric_404(client: TestClient) -> None:
    _login(client)
    resp = client.get("/metrics/not_a_metric")
    assert resp.status_code == 404


def test_bad_date_422(client: TestClient) -> None:
    _login(client)
    resp = client.get("/metrics/sleep", params={"date": "08-01-2026"})
    assert resp.status_code == 422
