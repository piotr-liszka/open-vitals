"""Workout WRITES — create / schedule / delete (spec 050).

These are the first Garmin-mutating routes besides /login, and the endpoints they
call are an ASSUMPTION we cannot verify offline. So the contract pinned down here
is two-sided, exactly like the calendar read in spec 024:

* when Garmin accepts the write, our step tree must arrive as the workout DTO
  Garmin's model expects (sport, step types, end conditions, targets in *Garmin's
  units*, repeat groups with continuous step ordering);
* when Garmin serves no such endpoint, the route reports ``supported: false``
  rather than raising or pretending the workout landed on the watch.
"""

from __future__ import annotations

from typing import Any

from fastapi.testclient import TestClient

from app import workouts
from conftest import USER_A, USER_B, FakeAPIClient, headers


def _login(client: TestClient, user_id: str = USER_A) -> None:
    resp = client.post(
        "/login",
        json={"email": "user@example.com", "password": "pw"},
        headers=headers(user_id),
    )
    assert resp.status_code == 200


def _run_intervals() -> dict[str, Any]:
    """A run session with a warmup, a 5× repeat block at pace, and a cooldown."""
    return {
        "sport": "running",
        "title": "5x1km",
        "steps": [
            {"kind": "warmup", "durationType": "time", "durationValue": 600},
            {
                "kind": "repeat",
                "repeats": 5,
                "steps": [
                    {
                        "kind": "work",
                        "durationType": "distance",
                        "durationValue": 1000,
                        # 4:00–4:10 per km, sent the way an athlete thinks about it.
                        "target": {
                            "type": "pace",
                            "low": 240,
                            "high": 250,
                            "unit": "s_per_km",
                        },
                    },
                    {"kind": "recovery", "durationType": "time", "durationValue": 120},
                ],
            },
            {"kind": "cooldown", "durationType": "time", "durationValue": 600},
        ],
    }


def _last_payload() -> dict[str, Any]:
    assert FakeAPIClient.writes, "no write reached the Garmin boundary"
    return FakeAPIClient.writes[-1]["payload"]


# --- create -------------------------------------------------------------------

def test_create_workout_maps_the_step_tree_onto_garmins_model(
    client: TestClient,
) -> None:
    _login(client)

    resp = client.post("/workouts", json=_run_intervals())

    assert resp.status_code == 200
    assert resp.json() == {"supported": True, "workoutId": "424242"}

    write = FakeAPIClient.writes[-1]
    assert write["method"] == "POST"
    assert write["path"] == "/workout-service/workout"
    payload = write["payload"]
    assert payload["workoutName"] == "5x1km"
    assert payload["sportType"] == {"sportTypeId": 1, "sportTypeKey": "running"}

    steps = payload["workoutSegments"][0]["workoutSteps"]
    assert [s["type"] for s in steps] == [
        "ExecutableStepDTO",
        "RepeatGroupDTO",
        "ExecutableStepDTO",
    ]
    assert steps[0]["stepType"] == {"stepTypeId": 1, "stepTypeKey": "warmup"}
    assert steps[0]["endCondition"] == {"conditionTypeId": 2, "conditionTypeKey": "time"}
    assert steps[0]["endConditionValue"] == 600
    assert steps[0]["targetType"]["workoutTargetTypeKey"] == "no.target"

    group = steps[1]
    assert group["numberOfIterations"] == 5
    assert group["endCondition"] == {"conditionTypeId": 7, "conditionTypeKey": "iterations"}
    assert [s["stepType"]["stepTypeKey"] for s in group["workoutSteps"]] == [
        "interval",
        "recovery",
    ]
    # stepOrder is CONTINUOUS across nesting — the repeat children are numbered
    # in the same sequence as the top-level steps, which is how Garmin reads them.
    assert [s["stepOrder"] for s in steps] == [1, 2, 5]
    assert [s["stepOrder"] for s in group["workoutSteps"]] == [3, 4]


def test_pace_target_is_converted_to_metres_per_second_and_ordered(
    client: TestClient,
) -> None:
    _login(client)

    client.post("/workouts", json=_run_intervals())

    work = _last_payload()["workoutSegments"][0]["workoutSteps"][1]["workoutSteps"][0]
    assert work["targetType"] == {"workoutTargetTypeId": 6, "workoutTargetTypeKey": "pace.zone"}
    # 250 s/km = 4.00 m/s (slower) … 240 s/km = 4.17 m/s (faster). The pair must
    # come out ascending, or Garmin sees an inverted (empty) range.
    assert work["targetValueOne"] < work["targetValueTwo"]
    assert round(work["targetValueOne"], 3) == 4.0
    assert round(work["targetValueTwo"], 3) == round(1000 / 240, 3)


def test_bike_workout_uses_cycling_sport_and_absolute_power(client: TestClient) -> None:
    _login(client)

    resp = client.post(
        "/workouts",
        json={
            "sport": "gravel_cycling",
            "title": "4x8 FTP",
            "steps": [
                {"kind": "warmup", "durationType": "time", "durationValue": 900},
                {
                    "kind": "repeat",
                    "repeats": 4,
                    "steps": [
                        {
                            "kind": "work",
                            "durationType": "time",
                            "durationValue": 480,
                            "target": {"type": "power", "low": 250, "high": 265},
                        },
                        {"kind": "recovery", "durationType": "time", "durationValue": 240},
                    ],
                },
            ],
        },
    )

    assert resp.status_code == 200
    payload = _last_payload()
    # A variant key (`gravel_cycling`) still maps to the cycling sport type.
    assert payload["sportType"] == {"sportTypeId": 2, "sportTypeKey": "cycling"}
    work = payload["workoutSegments"][0]["workoutSteps"][1]["workoutSteps"][0]
    assert work["targetType"]["workoutTargetTypeKey"] == "power.zone"
    assert (work["targetValueOne"], work["targetValueTwo"]) == (250.0, 265.0)


def test_lap_button_step_carries_no_duration_value(client: TestClient) -> None:
    _login(client)

    resp = client.post(
        "/workouts",
        json={
            "sport": "strength_training",
            "title": "Siła",
            "steps": [{"kind": "work", "durationType": "lap"}],
        },
    )

    assert resp.status_code == 200
    step = _last_payload()["workoutSegments"][0]["workoutSteps"][0]
    assert step["endCondition"] == {"conditionTypeId": 1, "conditionTypeKey": "lap.button"}
    assert step["endConditionValue"] is None


def test_a_single_sided_target_becomes_a_range(client: TestClient) -> None:
    _login(client)

    resp = client.post(
        "/workouts",
        json={
            "sport": "running",
            "title": "Easy",
            "steps": [
                {
                    "kind": "work",
                    "durationType": "time",
                    "durationValue": 1800,
                    "target": {"type": "hr", "high": 145},
                }
            ],
        },
    )

    assert resp.status_code == 200
    step = _last_payload()["workoutSegments"][0]["workoutSteps"][0]
    assert (step["targetValueOne"], step["targetValueTwo"]) == (145.0, 145.0)


# --- validation (422, before anything reaches Garmin) -------------------------

def test_power_target_on_a_walk_is_rejected(client: TestClient) -> None:
    _login(client)

    resp = client.post(
        "/workouts",
        json={
            "sport": "walking",
            "title": "Marsz",
            "steps": [
                {
                    "kind": "work",
                    "durationType": "time",
                    "durationValue": 1800,
                    "target": {"type": "power", "low": 200},
                }
            ],
        },
    )

    assert resp.status_code == 422
    assert "walk" in resp.json()["detail"]
    assert FakeAPIClient.writes == []


def test_unknown_step_kind_and_duration_are_rejected(client: TestClient) -> None:
    _login(client)

    bad_kind = client.post(
        "/workouts",
        json={"sport": "running", "title": "x", "steps": [{"kind": "sprintish"}]},
    )
    bad_duration = client.post(
        "/workouts",
        json={
            "sport": "running",
            "title": "x",
            "steps": [{"kind": "work", "durationType": "furlongs", "durationValue": 3}],
        },
    )
    missing_value = client.post(
        "/workouts",
        json={
            "sport": "running",
            "title": "x",
            "steps": [{"kind": "work", "durationType": "time"}],
        },
    )

    assert bad_kind.status_code == 422
    assert bad_duration.status_code == 422
    assert missing_value.status_code == 422
    assert FakeAPIClient.writes == []


def test_repeat_blocks_must_be_valid_and_flat(client: TestClient) -> None:
    _login(client)

    empty = client.post(
        "/workouts",
        json={
            "sport": "running",
            "title": "x",
            "steps": [{"kind": "repeat", "repeats": 3, "steps": []}],
        },
    )
    nested = client.post(
        "/workouts",
        json={
            "sport": "running",
            "title": "x",
            "steps": [
                {
                    "kind": "repeat",
                    "repeats": 3,
                    "steps": [
                        {
                            "kind": "repeat",
                            "repeats": 2,
                            "steps": [{"kind": "work", "durationType": "lap"}],
                        }
                    ],
                }
            ],
        },
    )

    assert empty.status_code == 422
    assert nested.status_code == 422
    assert FakeAPIClient.writes == []


def test_pace_unit_must_be_known(client: TestClient) -> None:
    _login(client)

    resp = client.post(
        "/workouts",
        json={
            "sport": "running",
            "title": "x",
            "steps": [
                {
                    "kind": "work",
                    "durationType": "distance",
                    "durationValue": 1000,
                    "target": {"type": "pace", "low": 4.2, "unit": "min_per_km"},
                }
            ],
        },
    )

    assert resp.status_code == 422
    assert FakeAPIClient.writes == []


# --- honest failure -----------------------------------------------------------

def test_absent_endpoint_reports_unsupported_not_success(client: TestClient) -> None:
    _login(client)
    FakeAPIClient.write_behavior = "not_found"

    resp = client.post("/workouts", json=_run_intervals())

    assert resp.status_code == 200
    assert resp.json() == {"supported": False, "reason": "unsupported_endpoint"}


def test_a_sport_without_a_garmin_workout_type_is_not_pushed(
    client: TestClient,
) -> None:
    _login(client)

    resp = client.post(
        "/workouts",
        json={
            "sport": "inline_skating",
            "title": "Rolki",
            "steps": [{"kind": "work", "durationType": "time", "durationValue": 1800}],
        },
    )

    assert resp.status_code == 200
    # `other` IS a Garmin sport type, so skating is pushable as "other" — what
    # matters is that the local sport is never silently sent as running/cycling.
    assert resp.json()["supported"] is True
    assert _last_payload()["sportType"] == {"sportTypeId": 3, "sportTypeKey": "other"}


def test_upstream_failure_is_classified_not_swallowed(client: TestClient) -> None:
    _login(client)
    FakeAPIClient.write_behavior = "error"

    resp = client.post("/workouts", json=_run_intervals())

    assert resp.status_code == 502
    assert resp.json()["error"]["code"] == "upstream_error"


def test_create_without_a_returned_id_is_a_failure(client: TestClient) -> None:
    """A workout we cannot address later could never be deleted — so it is an error."""
    _login(client)
    FakeAPIClient.write_behavior = "no_id"

    resp = client.post("/workouts", json=_run_intervals())

    assert resp.status_code == 502


def test_write_requires_tokens(client: TestClient) -> None:
    resp = client.post("/workouts", json=_run_intervals())

    assert resp.status_code == 409
    assert resp.json()["error"]["code"] == "not_connected"


def test_write_requires_the_user_header(unscoped_client: TestClient) -> None:
    resp = unscoped_client.post("/workouts", json=_run_intervals())

    assert resp.status_code == 400


def test_one_users_login_does_not_authorise_anothers_write(client: TestClient) -> None:
    _login(client, USER_A)

    resp = client.post("/workouts", json=_run_intervals(), headers=headers(USER_B))

    assert resp.status_code == 409


# --- schedule + delete --------------------------------------------------------

def test_schedule_posts_the_day(client: TestClient) -> None:
    _login(client)

    resp = client.post("/workouts/424242/schedule", json={"day": "2026-08-20"})

    assert resp.status_code == 200
    assert resp.json() == {"supported": True, "scheduleId": "777"}
    write = FakeAPIClient.writes[-1]
    assert write["path"] == "/workout-service/schedule/424242"
    assert write["payload"] == {"date": "2026-08-20"}


def test_schedule_rejects_a_bad_day_and_a_bad_id(client: TestClient) -> None:
    _login(client)

    bad_day = client.post("/workouts/424242/schedule", json={"day": "20-08-2026"})
    # A crafted id must never be interpolated into the upstream path.
    bad_id = client.post("/workouts/424242.json/schedule", json={"day": "2026-08-20"})

    assert bad_day.status_code == 422
    assert bad_id.status_code == 422
    assert FakeAPIClient.writes == []


def test_delete_removes_upstream(client: TestClient) -> None:
    _login(client)

    resp = client.delete("/workouts/424242")

    assert resp.status_code == 200
    assert resp.json() == {"supported": True, "removed": True}
    assert FakeAPIClient.writes[-1] == {
        "path": "/workout-service/workout/424242",
        "method": "DELETE",
        "payload": None,
    }


def test_deleting_an_already_gone_workout_is_not_an_error(client: TestClient) -> None:
    _login(client)
    FakeAPIClient.write_behavior = "not_found"

    resp = client.delete("/workouts/424242")

    assert resp.status_code == 200
    assert resp.json() == {"supported": True, "removed": False, "reason": "already_gone"}


# --- mapper units (no HTTP) ---------------------------------------------------

def test_sport_families_cover_the_keys_the_web_tier_sends() -> None:
    assert workouts.sport_family("trail_running") == "run"
    assert workouts.sport_family("virtual_ride") == "ride"
    assert workouts.sport_family("mountain_biking") == "ride"
    assert workouts.sport_family("lap_swimming") == "swim"
    assert workouts.sport_family("hiking") == "walk"
    assert workouts.sport_family("strength_training") == "strength"
    assert workouts.sport_family("bouldering") == "other"


def test_speed_units_convert_to_metres_per_second() -> None:
    payload = workouts.build_workout_payload(
        "cycling",
        "Tempo",
        [
            {
                "kind": "work",
                "durationType": "time",
                "durationValue": 600,
                "target": {"type": "speed", "low": 30, "high": 36, "unit": "kph"},
            }
        ],
    )
    step = payload["workoutSegments"][0]["workoutSteps"][0]
    assert round(step["targetValueOne"], 4) == round(30 / 3.6, 4)
    assert round(step["targetValueTwo"], 4) == 10.0


def test_the_log_never_carries_workout_content(
    client: TestClient, caplog: Any
) -> None:
    _login(client)

    with caplog.at_level("INFO"):
        client.post("/workouts", json=_run_intervals())

    text = "\n".join(record.getMessage() for record in caplog.records)
    assert "5x1km" not in text
    assert "steps=" in text
