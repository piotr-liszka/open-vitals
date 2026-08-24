"""Activities tests: the paginated, newest-first metric that has no date param.

Regression cover for the bug where ``_get_activities`` handed a ``date`` to
garmy's ``ActivitiesAccessor.raw(limit, start)``. The date bound to ``limit``,
garmy swallowed the upstream error into ``[]``, and every dated request returned
an empty list with nothing logged. garmy stays mocked at the client boundary
(see conftest.py), whose fake now models the real paginated signature.
"""

from __future__ import annotations

import datetime as _dt
from typing import Any

import pytest
from fastapi.testclient import TestClient

from app import garmy_client
from conftest import ACTIVITIES_LATEST_DATE


def _login(client: TestClient) -> None:
    resp = client.post("/login", json={"email": "user@example.com", "password": "pw"})
    assert resp.status_code == 200


def _day(offset: int) -> str:
    """The fixture's activity date ``offset`` days before the newest one."""
    return (ACTIVITIES_LATEST_DATE - _dt.timedelta(days=offset)).isoformat()


# --- single date --------------------------------------------------------------

def test_activities_for_a_date_returns_that_days_activity(
    client: TestClient,
) -> None:
    _login(client)
    date = _day(7)
    resp = client.get("/metrics/activities", params={"date": date})

    assert resp.status_code == 200
    body = resp.json()
    assert body["metric"] == "activities"
    assert body["date"] == date
    assert isinstance(body["data"], list)
    assert len(body["data"]) == 1
    assert body["data"][0]["startTimeLocal"].startswith(date)


def test_activities_returns_every_activity_on_a_busy_day(
    client: TestClient,
) -> None:
    """A date holding two activities returns both, not just the first."""
    _login(client)
    date = _day(0)
    resp = client.get("/metrics/activities", params={"date": date})

    assert resp.status_code == 200
    data = resp.json()["data"]
    assert len(data) == 2
    assert all(a["startTimeLocal"].startswith(date) for a in data)


def test_activities_paginates_past_the_first_page(client: TestClient) -> None:
    """A date beyond the 20-per-page window is still found (the core fix)."""
    _login(client)
    date = _day(30)  # sits on page 2 of the fixture
    resp = client.get("/metrics/activities", params={"date": date})

    assert resp.status_code == 200
    data = resp.json()["data"]
    assert len(data) == 1
    assert data[0]["startTimeLocal"].startswith(date)


def test_activities_empty_for_a_date_with_none(client: TestClient) -> None:
    """A rest day returns an empty list, not an error."""
    _login(client)
    future = (ACTIVITIES_LATEST_DATE + _dt.timedelta(days=3)).isoformat()
    resp = client.get("/metrics/activities", params={"date": future})

    assert resp.status_code == 200
    assert resp.json()["data"] == []


def test_activities_without_date_returns_recent_page(client: TestClient) -> None:
    _login(client)
    resp = client.get("/metrics/activities")

    assert resp.status_code == 200
    body = resp.json()
    assert body["date"] is None
    assert len(body["data"]) == garmy_client._ACTIVITY_PAGE_SIZE


# --- range --------------------------------------------------------------------

def test_activities_range_buckets_by_day(client: TestClient) -> None:
    _login(client)
    start, end = _day(2), _day(0)
    resp = client.get(
        "/metrics/activities/range", params={"start": start, "end": end}
    )

    assert resp.status_code == 200
    days = {day["date"]: day["data"] for day in resp.json()["days"]}
    assert [*days] == [_day(2), _day(1), _day(0)]
    assert len(days[_day(0)]) == 2  # the busy day
    assert len(days[_day(1)]) == 1
    assert len(days[_day(2)]) == 1


def test_activities_range_empty_days_are_empty_lists(client: TestClient) -> None:
    """Days with no activity still appear, carrying [] rather than null."""
    _login(client)
    start = (ACTIVITIES_LATEST_DATE + _dt.timedelta(days=1)).isoformat()
    end = (ACTIVITIES_LATEST_DATE + _dt.timedelta(days=3)).isoformat()
    resp = client.get(
        "/metrics/activities/range", params={"start": start, "end": end}
    )

    assert resp.status_code == 200
    assert all(day["data"] == [] for day in resp.json()["days"])


def test_activities_range_sweeps_the_list_once(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    """The range path pages once for the whole span, not once per day."""
    _login(client)
    calls: list[tuple[int, int]] = []
    real_page = garmy_client._activities_page

    def counting(accessor: Any, limit: int, start: int) -> list[Any]:
        calls.append((limit, start))
        return real_page(accessor, limit, start)

    monkeypatch.setattr(garmy_client, "_activities_page", counting)

    resp = client.get(
        "/metrics/activities/range",
        params={"start": _day(5), "end": _day(0)},
    )
    assert resp.status_code == 200
    # One page covers a 6-day window at the head of the list; the per-day loop
    # would have issued at least six sweeps.
    assert len(calls) == 1


# --- boundary contract --------------------------------------------------------

def test_raw_is_never_called_with_a_date(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    """The regression guard: limit/start must stay integers.

    conftest's fake raises TypeError on a non-int, mirroring how real garmy
    misinterprets a date as ``limit``.
    """
    _login(client)
    seen: list[tuple[Any, Any]] = []
    real_page = garmy_client._activities_page

    def recording(accessor: Any, limit: Any, start: Any) -> list[Any]:
        seen.append((limit, start))
        return real_page(accessor, limit, start)

    monkeypatch.setattr(garmy_client, "_activities_page", recording)
    resp = client.get("/metrics/activities", params={"date": _day(3)})

    assert resp.status_code == 200
    assert seen, "expected at least one page fetch"
    assert all(
        isinstance(limit, int) and isinstance(start, int) for limit, start in seen
    )


def test_activity_local_date_parses_and_rejects() -> None:
    parse = garmy_client.activity_local_date
    assert parse({"startTimeLocal": "2026-08-08 08:36:18"}) == "2026-08-08"
    assert parse({"start_time_local": "2026-08-08 08:36:18"}) == "2026-08-08"
    assert parse({"startTimeLocal": "08/08/2026 08:36"}) is None
    assert parse({"startTimeLocal": "short"}) is None
    assert parse({"startTimeLocal": None}) is None
    assert parse({}) is None
    assert parse("not a dict") is None


def test_activities_paging_is_bounded() -> None:
    """A far-past date cannot sweep the history forever."""
    pages: list[int] = []

    class _Endless:
        def raw(self, limit: int = 20, start: int = 0) -> list[dict[str, Any]]:
            pages.append(start)
            # Always a full page, always newer than the requested date, so the
            # only thing that can stop the walk is the page cap.
            return [
                {"startTimeLocal": "2026-08-08 08:00:00", "activityId": i}
                for i in range(limit)
            ]

    api = type("_Api", (), {"metrics": type("_M", (), {"get": lambda self, n: _Endless()})()})()

    result = garmy_client.fetch_activities(api, _dt.date(2020, 1, 1))

    assert result == []
    assert len(pages) == garmy_client._ACTIVITY_MAX_PAGES
