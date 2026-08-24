"""Shared pytest fixtures and a garmy fake mocked at the client boundary.

garmy is never imported or called for real here: tests monkeypatch
``app.garmy_client.AuthClient`` / ``APIClient`` with the fakes below, so the
suite is deterministic and offline (AGENTS.md §7).
"""

from __future__ import annotations

import datetime as _dt
import os
from types import SimpleNamespace
from typing import Any

import pytest
from cryptography.fernet import Fernet

# A required Fernet key + a DATABASE_URL must exist before importing app.main:
# its module-level create_app() reads the environment and (for the module-level
# ASGI app only) constructs a Postgres store object. The dummy DSN is NEVER
# connected to — every test builds its own app wired to an in-memory store, and
# the module-level app's lifespan (which would connect) is never started here.
_TEST_KEY = Fernet.generate_key().decode()
os.environ.setdefault("TOKEN_ENCRYPTION_KEY", _TEST_KEY)
os.environ.setdefault("DATABASE_URL", "postgresql://unused-in-tests/none")

from fastapi.testclient import TestClient  # noqa: E402

from app import garmy_client  # noqa: E402
from app.config import Settings  # noqa: E402
from app.main import create_app  # noqa: E402
from app.tokens import InMemoryTokenStore  # noqa: E402

# Stable opaque user ids used across the suite. Every Garmin-touching request is
# scoped by an ``X-User-Id`` header (spec 012).
USER_A = "user-a-0001"
USER_B = "user-b-0002"


# --- fake garmy behaviour controller -----------------------------------------

class GarmyBehavior:
    """Mutable knobs a test flips to steer the fake garmy client."""

    def __init__(self) -> None:
        self.mode = "ok"  # "ok" | "mfa" | "bad_creds"
        self.valid_mfa = "123456"
        self.display_name = "Test Athlete"
        self.expires_at = 4102444800.0  # 2100-01-01, safely in the future


class _FakeAccessor:
    def __init__(self, name: str) -> None:
        self._name = name

    def raw(self, date: Any = None) -> dict[str, Any]:
        return {
            "metric": self._name,
            "date": str(date) if date is not None else None,
            "value": 42,
        }


# The newest activity in the fixture; everything else steps back one day from it.
ACTIVITIES_LATEST_DATE = _dt.date(2026, 8, 8)
ACTIVITIES_FIXTURE_DAYS = 45


def _build_activities() -> list[dict[str, Any]]:
    """A newest-first activity list, one per day, plus a same-day double.

    Spans enough days (45) to sit well past the 20-per-page window, so tests can
    exercise real pagination rather than always landing on page one.
    """
    activities: list[dict[str, Any]] = []
    for offset in range(ACTIVITIES_FIXTURE_DAYS):
        day = ACTIVITIES_LATEST_DATE - _dt.timedelta(days=offset)
        activities.append(
            {
                "activityId": 1000 + offset,
                "activityName": f"Run {day.isoformat()}",
                "startTimeLocal": f"{day.isoformat()} 08:36:18",
                "duration": 4200.0,
            }
        )
    # A second activity on the newest day: one date may hold several activities.
    activities.insert(
        1,
        {
            "activityId": 999,
            "activityName": "Evening walk",
            "startTimeLocal": f"{ACTIVITIES_LATEST_DATE.isoformat()} 19:02:00",
            "duration": 1800.0,
        },
    )
    return activities


class _FakeActivitiesAccessor:
    """Mirrors garmy's ActivitiesAccessor: paginated, newest-first, NO date arg.

    Its signature is ``raw(limit: int = 20, start: int = 0)``. The explicit type
    guard is the point: the bug this fixture guards against passed a ``date``
    positionally into ``limit``, which real garmy swallowed into an empty list.
    """

    PAGE_DEFAULT = 20

    def __init__(self, activities: list[dict[str, Any]]) -> None:
        self._activities = activities

    def raw(self, limit: int = PAGE_DEFAULT, start: int = 0) -> list[dict[str, Any]]:
        if not isinstance(limit, int) or not isinstance(start, int):
            raise TypeError(
                "activities raw() takes integer limit/start, not "
                f"{type(limit).__name__}/{type(start).__name__}"
            )
        return [dict(a) for a in self._activities[start : start + limit]]


def training_readiness_payload(date: Any = None) -> dict[str, Any]:
    """One Garmin Training Readiness document, camelCase as the API serves it."""
    day = str(date) if date is not None else "2026-08-01"
    return {
        "calendarDate": day,
        # The instant Garmin computed the reading — zoneless UTC with a one-digit
        # fraction, exactly as the live API serves it. The web tier counts the
        # recovery timer down from here (spec 075).
        "timestamp": f"{day}T15:54:57.0",
        "timestampLocal": f"{day}T17:54:57.0",
        "score": 27,
        "level": "LOW",
        "feedbackShort": "RECOVERY_TIME_LIMITED",
        "sleepScore": 74,
        "sleepScoreFactorPercent": 74,
        "sleepHistoryFactorPercent": 60,
        "hrvFactorPercent": 45,
        "hrvWeeklyAverage": 92,
        "recoveryTime": 34,
        "recoveryTimeFactorPercent": 10,
        "recoveryTimeChangePhrase": "RECOVERY_TIME_DECREASED",
        "acwrFactorPercent": 80,
        "acuteLoad": 312,
        "stressHistoryFactorPercent": 55,
    }


class FakeTrainingReadinessAccessor:
    """Mirrors garmy's training_readiness accessor: raw() answers with a LIST.

    Garmin wraps the single day's document in a one-element array; the empty
    list is how an account or device without the feature answers, and the
    sidecar must read that as "no data today", not as a failure (spec 059).
    """

    #: Flipped by a test to model an account with no Training Readiness.
    empty: bool = False

    def raw(self, date: Any = None) -> list[dict[str, Any]]:
        return [] if FakeTrainingReadinessAccessor.empty else [training_readiness_payload(date)]


class _FakeMetrics:
    def __init__(self, activities: list[dict[str, Any]]) -> None:
        self._activities = activities

    def get(self, name: str) -> Any:
        if name == "activities":
            return _FakeActivitiesAccessor(self._activities)
        if name == "training_readiness":
            return FakeTrainingReadinessAccessor()
        return _FakeAccessor(name)


# --- per-activity detail + weigh-in fixtures (served via connectapi) ----------
# garmy 1.0.0 has no metric accessor for these; the sidecar calls
# ``APIClient.connectapi(path)`` directly, so the fake models that method and the
# real Garmin payload shapes (metricDescriptors + activityDetailMetrics columns;
# weight/dateRange daily summaries).

# Epoch MILLISECONDS, as Garmin's ``directTimestamp`` column really reports them.
# The sidecar rebases + rescales this to seconds-from-start.
DETAILS_T0_MS = 1_754_640_978_000


def _build_activity_details() -> dict[str, Any]:
    """A realistic Garmin activity-details payload with column-encoded streams.

    Carries the running-dynamics / physiology columns as well as the classic
    GPS+HR+power ones, so the decoder's optional-stream handling is exercised.
    """
    return {
        "activityId": 1000,
        "metricDescriptors": [
            {"key": "directLatitude", "metricsIndex": 0},
            {"key": "directLongitude", "metricsIndex": 1},
            {"key": "directElevation", "metricsIndex": 2},
            {"key": "directHeartRate", "metricsIndex": 3},
            {"key": "directSpeed", "metricsIndex": 4},
            {"key": "directBikeCadence", "metricsIndex": 5},
            {"key": "directPower", "metricsIndex": 6},
            {"key": "directTimestamp", "metricsIndex": 7},
            {"key": "directRespirationRate", "metricsIndex": 8},
            {"key": "directVerticalRatio", "metricsIndex": 9},
            {"key": "directVerticalOscillation", "metricsIndex": 10},
            {"key": "directGroundContactTime", "metricsIndex": 11},
            {"key": "directGroundContactBalanceLeft", "metricsIndex": 12},
            {"key": "directStrideLength", "metricsIndex": 13},
            {"key": "directAirTemperature", "metricsIndex": 14},
            {"key": "directGrade", "metricsIndex": 15},
            {"key": "directAvailableStamina", "metricsIndex": 16},
            {"key": "directPotentialStamina", "metricsIndex": 17},
            {"key": "directPerformanceCondition", "metricsIndex": 18},
            {"key": "directFractionalCadence", "metricsIndex": 19},
            {"key": "sumMovingDuration", "metricsIndex": 20},
        ],
        "activityDetailMetrics": [
            {
                "metrics": [
                    52.10, 21.00, 100.0, 140, 3.5, 85, 210, DETAILS_T0_MS,
                    16.0, 7.5, 9.1, 250.0, 49.5, 118.0, 21.0, 1.5,
                    82.0, 95.0, 3.0, 0.5, 0.0,
                ]
            },
            {
                "metrics": [
                    52.20, 21.10, 102.0, 145, 3.6, 86, 215, DETAILS_T0_MS + 1000,
                    17.0, 7.6, 9.2, 252.0, 49.8, 119.0, 21.5, 2.0,
                    80.0, 95.0, 2.0, 0.5, 1.0,
                ]
            },
            {
                "metrics": [
                    52.30, 21.20, 104.0, 150, 3.7, 87, 220, DETAILS_T0_MS + 2000,
                    18.0, 7.7, 9.3, 254.0, 50.1, 120.0, 22.0, 2.5,
                    78.0, 95.0, 1.0, 0.5, 1.0,
                ]
            },
        ],
        # An alternative GPS source the parser falls back to only when the
        # metrics carry no lat/lng columns (not exercised by the payload above).
        "geoPolylineDTO": {
            "polyline": [
                {"lat": 52.10, "lon": 21.00, "altitude": 100.0},
                {"lat": 52.20, "lon": 21.10, "altitude": 102.0},
            ]
        },
    }


def _build_activity_splits() -> dict[str, Any]:
    """Garmin's ``/splits`` payload: per-lap DTOs under ``lapDTOs``."""
    return {
        "activityId": 1000,
        "lapDTOs": [
            {
                "messageIndex": 0,
                "startTimeGMT": "2026-08-08T06:36:18.0",
                "distance": 1000.0,
                "duration": 300.0,
                "movingDuration": 295.0,
                "elapsedDuration": 305.0,
                "averageSpeed": 3.33,
                "maxSpeed": 3.9,
                "averageHR": 148.0,
                "maxHR": 160.0,
                "elevationGain": 12.0,
                "elevationLoss": 8.0,
                "calories": 70.0,
                "averageRunCadence": 172.0,
                "strideLength": 118.0,
                "groundContactTime": 250.0,
                "verticalOscillation": 9.1,
                "verticalRatio": 7.5,
                "intensityType": "ACTIVE",
            },
            {
                "messageIndex": 1,
                "startTimeGMT": "2026-08-08T06:41:18.0",
                "distance": 1000.0,
                "duration": 290.0,
                "averageHR": 152.0,
                "intensityType": "ACTIVE",
            },
        ],
    }


def _build_typed_splits() -> dict[str, Any]:
    """Garmin's ``/typedsplits`` payload: the run/walk/stand classification."""
    return {
        "splits": [
            {"type": "RWD_RUN", "duration": 480.0, "distance": 1600.0, "noOfSplits": 4},
            {"type": "RWD_WALK", "duration": 90.0, "distance": 120.0, "noOfSplits": 3},
            {"type": "RWD_STAND", "duration": 30.0, "noOfSplits": 1},
        ]
    }


def _build_activity_summary() -> dict[str, Any]:
    """The base activity endpoint payload: summary lives under summaryDTO."""
    return {
        "activityId": 1000,
        "activityName": "Run",
        "summaryDTO": {"distance": 5000.0, "duration": 1500.0, "averageHR": 150},
    }


def _build_weight_range() -> dict[str, Any]:
    """Garmin weight/dateRange payload; weights are in GRAMS (converted upstream)."""
    return {
        "dailyWeightSummaries": [
            {"summaryDate": "2026-08-01", "allWeightMetrics": [{"weight": 81200.0}]},
            {"summaryDate": "2026-08-05", "allWeightMetrics": [{"weight": 80900.0}]},
        ],
        "totalAverage": {"weight": 81050.0},
    }


# Garmin's calendar month payload (spec 024). ``month`` in the path is
# ZERO-BASED, so August 2026 is ``/calendar-service/year/2026/month/7``; the
# fixture only answers for that month and returns an empty calendar otherwise,
# which is exactly how a month with nothing scheduled behaves.
CALENDAR_YEAR = 2026
CALENDAR_MONTH_ZERO_BASED = 7  # August


def _build_calendar_month() -> dict[str, Any]:
    return {
        "calendarItems": [
            {
                "id": 5001,
                "itemType": "workout",
                "date": "2026-08-10",
                "title": "Interwały 6×800",
                "sportTypeKey": "running",
                "estimatedDurationInSecs": 3600,
                "distanceInMeters": 12000,
                "startTimeLocal": "2026-08-10 18:00:00",
            },
            {
                "id": 5002,
                "itemType": "race",
                "date": "2026-08-30",
                "title": "Półmaraton",
                "sportTypeKey": "running",
            },
            # Already completed — history, never a plan.
            {
                "id": 5003,
                "itemType": "activity",
                "date": "2026-08-08",
                "title": "Run 2026-08-08",
                "activityId": 1000,
            },
        ]
    }


class FakeAPIClient:
    """Fake garmy APIClient.

    ``writes`` records every non-GET connectapi call (spec 050) so a test can
    assert the exact Garmin payload the mapper produced; ``write_behavior`` lets
    a test make the workout endpoints answer 404 (absent for this account) or
    fail, which is the honest-failure path the sidecar must not smooth over.
    """

    #: Class-level so a test can reach them without holding the instance the
    #: sidecar built internally. Reset by the ``fake_garmy`` fixture per test.
    writes: list[dict[str, Any]] = []
    write_behavior: str = "ok"  # "ok" | "not_found" | "error" | "no_id"

    def __init__(self, auth_client: Any) -> None:
        self.auth_client = auth_client
        self.metrics = _FakeMetrics(_build_activities())

    def connectapi(self, path: str, method: str = "GET", **kwargs: Any) -> Any:
        """Route the raw Garmin paths the sidecar hits directly (no accessor)."""
        if method != "GET":
            return self._write(path, method, kwargs.get("json"))
        if path.startswith("/calendar-service/year/"):
            wanted = f"/calendar-service/year/{CALENDAR_YEAR}/month/{CALENDAR_MONTH_ZERO_BASED}"
            return _build_calendar_month() if path == wanted else {"calendarItems": []}
        if "/details" in path:
            return _build_activity_details()
        if path.endswith("/typedsplits"):
            return _build_typed_splits()
        if path.endswith("/splits"):
            return _build_activity_splits()
        if path.startswith("/activity-service/activity/"):
            return _build_activity_summary()
        if path.startswith("/weight-service/weight/dateRange"):
            return _build_weight_range()
        return None

    def _write(self, path: str, method: str, payload: Any) -> Any:
        """Serve a workout write per ``write_behavior`` and record what was sent."""
        FakeAPIClient.writes.append(
            {"path": path, "method": method, "payload": payload}
        )
        behavior = FakeAPIClient.write_behavior
        if behavior == "not_found":
            # Shaped like garmy's APIError text, which is all classify_upstream reads.
            raise RuntimeError("404 Client Error: Not Found for url: /workout-service")
        if behavior == "error":
            raise RuntimeError("500 Server Error: Internal Server Error")
        if behavior == "no_id":
            return {}
        if path.startswith("/workout-service/schedule/"):
            return {"workoutScheduleId": 777}
        if method == "DELETE":
            return None
        return {"workoutId": 424242}


def _make_fake_auth_client(behavior: GarmyBehavior):
    class FakeAuthClient:
        def __init__(self) -> None:
            self.token_manager = SimpleNamespace(
                oauth1_token=None, oauth2_token=None
            )

        # Sets plausible token objects on a successful login.
        def _grant(self) -> None:
            self.token_manager.oauth1_token = SimpleNamespace(
                oauth_token="oa1-token", oauth_token_secret="oa1-secret"
            )
            self.token_manager.oauth2_token = SimpleNamespace(
                access_token="oa2-access",
                refresh_token="oa2-refresh",
                expires_at=behavior.expires_at,
            )

        def login(
            self,
            email: str,
            password: str,
            return_on_mfa: bool = False,
            prompt_mfa: Any = None,
        ):
            if behavior.mode == "bad_creds":
                raise RuntimeError("401 Client Error: Unauthorized")
            if behavior.mode == "mfa":
                if prompt_mfa is not None:  # single-shot path
                    if prompt_mfa() == behavior.valid_mfa:
                        self._grant()
                        return True
                    raise RuntimeError("invalid mfa code")
                if return_on_mfa:
                    return ("needs_mfa", {"pending": True})
            self._grant()
            return True

        def resume_login(self, state: Any, mfa_code: str) -> bool:
            if mfa_code == behavior.valid_mfa:
                self._grant()
                return True
            raise RuntimeError("invalid mfa code")

        def refresh_oauth2_token(self) -> None:
            self.token_manager.oauth2_token = SimpleNamespace(
                access_token="oa2-access-refreshed",
                refresh_token="oa2-refresh",
                expires_at=behavior.expires_at,
            )

        def get_user_profile(self) -> dict[str, str]:
            return {"displayName": behavior.display_name}

    return FakeAuthClient


@pytest.fixture
def behavior() -> GarmyBehavior:
    return GarmyBehavior()


@pytest.fixture
def fake_garmy(monkeypatch: pytest.MonkeyPatch, behavior: GarmyBehavior) -> GarmyBehavior:
    """Monkeypatch the garmy boundary classes with the fakes."""
    monkeypatch.setattr(garmy_client, "AuthClient", _make_fake_auth_client(behavior))
    monkeypatch.setattr(garmy_client, "APIClient", FakeAPIClient)
    # Write recording is class-level state; start every test from empty/ok.
    FakeAPIClient.writes = []
    FakeAPIClient.write_behavior = "ok"
    FakeTrainingReadinessAccessor.empty = False
    return behavior


@pytest.fixture
def settings() -> Settings:
    """Isolated Settings with a fresh Fernet key (no real Postgres needed)."""
    return Settings(token_encryption_key=Fernet.generate_key().decode())


@pytest.fixture
def token_store(settings: Settings) -> InMemoryTokenStore:
    """An offline, encrypting, per-user token store shared across a test's app."""
    return InMemoryTokenStore(settings.token_encryption_key)


@pytest.fixture
def app_(settings: Settings, token_store: InMemoryTokenStore, fake_garmy: GarmyBehavior):
    """The wired FastAPI app: isolated settings + in-memory store + fake garmy."""
    return create_app(settings, token_store)


@pytest.fixture
def client(app_) -> TestClient:
    """TestClient defaulting to USER_A's scope (``X-User-Id`` on every request).

    Isolation tests reuse this same app/store and override the header per request
    (e.g. ``client.get(..., headers=headers(USER_B))``) so two users share one
    store instance, exactly as in production.
    """
    return TestClient(app_, headers={"X-User-Id": USER_A})


@pytest.fixture
def unscoped_client(app_) -> TestClient:
    """TestClient with NO default ``X-User-Id`` — for missing-header (400) tests."""
    return TestClient(app_)


def headers(user_id: str) -> dict[str, str]:
    """Build the required per-user request header."""
    return {"X-User-Id": user_id}
