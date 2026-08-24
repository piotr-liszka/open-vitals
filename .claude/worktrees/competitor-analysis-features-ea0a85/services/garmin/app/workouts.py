"""Structured-workout WRITES: create, schedule and delete (spec 050).

This is the first code in the whole system that mutates the user's Garmin
account. garmy 1.0.0 ships no workout accessor — its metric modules stop at
activities/body_battery/… — so, exactly like the calendar READ in spec 024, this
goes through ``APIClient.connectapi``, which does accept a method and a JSON
body (``garmy.core.client.APIClient.connectapi(path, method="GET", **kwargs)``).

Two rules shape everything here, because a bad write shows up on the athlete's
watch rather than in a log file:

1. **Honest failure.** A missing/unknown endpoint (upstream 404) yields
   ``supported: False`` — never a pretended success, never an exception. The web
   tier then parks the row as ``unsupported`` and stops retrying it.
2. **Local is the source of truth.** Nothing here reads Garmin back or invents
   ids; the caller stores whatever id Garmin returns and can always delete it
   again.

Every path and every magic id below is an ``ASSUMPTION`` — none of it can be
verified offline. The sidecar sends BOTH the numeric id and the string key in
each DTO, so a wrong id is the most likely cause of a 4xx, and that status is
propagated verbatim instead of being smoothed over.
"""

from __future__ import annotations

import datetime as _dt
import logging
from typing import Any

from . import garmy_client
from .errors import InvalidWorkout, classify_upstream

logger = logging.getLogger("garmin-sidecar")

# ASSUMPTION (spec 050, UNVERIFIED): the workout-service endpoints third-party
# clients converge on. Create returns a body carrying the new ``workoutId``;
# scheduling posts a date and answers with a schedule id.
_CREATE_PATH = "/workout-service/workout"
_SCHEDULE_PATH = "/workout-service/schedule/{workout_id}"
_DELETE_PATH = "/workout-service/workout/{workout_id}"

# --- Garmin's enum tables (id + key are both sent; see the module docstring) ---

# Our Garmin `typeKey` → the workout-service sport DTO. Keyed by SPORT FAMILY
# (lib/sport-labels.ts `SportGroup` in the web tier) so every cycling/running
# variant maps without listing all 40 keys. A family that is absent is NOT
# pushable — the row stays local-only rather than being pushed as the wrong sport.
_SPORT_BY_FAMILY: dict[str, tuple[int, str]] = {
    "run": (1, "running"),
    "ride": (2, "cycling"),
    "swim": (4, "swimming"),
    "strength": (5, "strength_training"),
    # ASSUMPTION: the workout service has no walking sport type; "other" is the
    # honest carrier and the LOCAL row keeps the real sport for our own views.
    "walk": (3, "other"),
    "other": (3, "other"),
}

# Substring → family. Mirrors how `lib/sport-labels.ts` groups Garmin type keys;
# kept as substrings so `gravel_cycling`, `virtual_ride`, `trail_running`, … all
# land in the right family without a second copy of that table.
_FAMILY_BY_SPORT_HINT: tuple[tuple[str, str], ...] = (
    ("run", "run"),
    ("cycl", "ride"),
    ("bik", "ride"),
    ("ride", "ride"),
    ("bmx", "ride"),
    ("swim", "swim"),
    ("strength", "strength"),
    ("weight", "strength"),
    ("walk", "walk"),
    ("hik", "walk"),
)

_STEP_TYPES: dict[str, tuple[int, str]] = {
    "warmup": (1, "warmup"),
    "cooldown": (2, "cooldown"),
    "work": (3, "interval"),
    "recovery": (4, "recovery"),
    "rest": (5, "rest"),
    "repeat": (6, "repeat"),
}

_END_CONDITIONS: dict[str, tuple[int, str]] = {
    "lap": (1, "lap.button"),
    "time": (2, "time"),
    "distance": (3, "distance"),
    "calories": (4, "calories"),
}
_ITERATIONS_CONDITION: tuple[int, str] = (7, "iterations")

_TARGET_TYPES: dict[str, tuple[int, str]] = {
    "none": (1, "no.target"),
    "power": (2, "power.zone"),
    "cadence": (3, "cadence"),
    "hr": (4, "heart.rate.zone"),
    "speed": (5, "speed.zone"),
    "pace": (6, "pace.zone"),
}

# Which target types make sense for which sport family. The web tier validates
# this too (so the athlete gets the error while authoring), but the sidecar is
# the last gate before Garmin: a power target on a walk is a payload Garmin
# would either reject or silently mangle.
_TARGETS_BY_FAMILY: dict[str, frozenset[str]] = {
    "run": frozenset({"none", "pace", "speed", "hr", "cadence"}),
    "ride": frozenset({"none", "power", "speed", "hr", "cadence"}),
    "swim": frozenset({"none", "pace", "hr"}),
    "walk": frozenset({"none", "pace", "speed", "hr"}),
    "strength": frozenset({"none", "hr"}),
    "other": frozenset({"none", "hr"}),
}

# Accepted units per target type → factor/converter into Garmin's own unit.
# Garmin stores BOTH pace and speed targets as metres per second, so a pace
# range in seconds-per-km inverts (a lower number is a HIGHER m/s) — the pair is
# re-sorted after conversion, which is what keeps "4:30–4:45/km" from arriving
# as an empty range.
_METRES_PER_MILE = 1609.344


def sport_family(sport: str) -> str:
    """Coarse sport family for a Garmin ``typeKey`` (``other`` when unknown)."""
    key = (sport or "").strip().lower()
    for hint, family in _FAMILY_BY_SPORT_HINT:
        if hint in key:
            return family
    return "other"


def is_pushable(sport: str) -> bool:
    """Whether this sport has a Garmin workout sport type we are willing to send."""
    return sport_family(sport) in _SPORT_BY_FAMILY


def build_workout_payload(
    sport: str, title: str, steps: list[dict[str, Any]]
) -> dict[str, Any]:
    """Our step tree → Garmin's workout DTO.

    Raises :class:`InvalidWorkout` (→ HTTP 422) for a tree Garmin could not
    represent: an unknown step kind, a bad duration/target type, a target that
    makes no sense for the sport, an empty or over-nested repeat.
    """
    family = sport_family(sport)
    sport_dto = _SPORT_BY_FAMILY.get(family)
    if sport_dto is None:  # pragma: no cover - callers check is_pushable first
        raise InvalidWorkout(f"sport '{sport}' has no Garmin workout equivalent")
    if not steps:
        raise InvalidWorkout("a workout needs at least one step")

    sport_type = {"sportTypeId": sport_dto[0], "sportTypeKey": sport_dto[1]}
    order = _Counter()
    workout_steps = [_step_dto(step, family, order, depth=0) for step in steps]
    return {
        "sportType": sport_type,
        "workoutName": title,
        "workoutSegments": [
            {
                "segmentOrder": 1,
                "sportType": sport_type,
                "workoutSteps": workout_steps,
            }
        ],
    }


class _Counter:
    """Shared, monotonic ``stepOrder`` source (Garmin numbers nested steps too)."""

    def __init__(self) -> None:
        self._n = 0

    def next(self) -> int:
        self._n += 1
        return self._n


def _step_dto(
    step: Any, family: str, order: _Counter, depth: int
) -> dict[str, Any]:
    """One step (executable or repeat group) as Garmin's DTO."""
    if not isinstance(step, dict):
        raise InvalidWorkout("each step must be an object")
    kind = str(step.get("kind") or "").strip().lower()
    step_type = _STEP_TYPES.get(kind)
    if step_type is None:
        raise InvalidWorkout(f"unknown step kind '{kind}'")

    if kind == "repeat":
        return _repeat_dto(step, family, order, depth)

    condition_key = str(step.get("durationType") or "lap").strip().lower()
    condition = _END_CONDITIONS.get(condition_key)
    if condition is None:
        raise InvalidWorkout(f"unknown duration type '{condition_key}'")
    value = step.get("durationValue")
    if condition_key == "lap":
        value = None
    elif not isinstance(value, (int, float)) or value <= 0:
        raise InvalidWorkout(f"{condition_key} step needs a positive durationValue")

    target_type, low, high = _target_values(step.get("target"), family)
    dto: dict[str, Any] = {
        "type": "ExecutableStepDTO",
        "stepId": None,
        "stepOrder": order.next(),
        "stepType": {"stepTypeId": step_type[0], "stepTypeKey": step_type[1]},
        "endCondition": {
            "conditionTypeId": condition[0],
            "conditionTypeKey": condition[1],
        },
        "endConditionValue": value,
        "targetType": {
            "workoutTargetTypeId": target_type[0],
            "workoutTargetTypeKey": target_type[1],
        },
        "targetValueOne": low,
        "targetValueTwo": high,
    }
    note = step.get("note")
    if isinstance(note, str) and note.strip():
        dto["description"] = note.strip()
    return dto


def _repeat_dto(
    step: dict[str, Any], family: str, order: _Counter, depth: int
) -> dict[str, Any]:
    """A repeat block: ``5 × (1 km hard + 2 min easy)`` as one Garmin group."""
    if depth >= 1:
        # Garmin's own editor allows a single level; refusing deeper nesting here
        # beats sending a tree the watch cannot execute.
        raise InvalidWorkout("repeat blocks cannot be nested")
    repeats = step.get("repeats")
    if not isinstance(repeats, int) or isinstance(repeats, bool) or repeats < 1:
        raise InvalidWorkout("a repeat step needs a positive integer 'repeats'")
    children = step.get("steps")
    if not isinstance(children, list) or not children:
        raise InvalidWorkout("a repeat step needs at least one child step")
    step_type = _STEP_TYPES["repeat"]
    dto: dict[str, Any] = {
        "type": "RepeatGroupDTO",
        "stepId": None,
        "stepOrder": order.next(),
        "stepType": {"stepTypeId": step_type[0], "stepTypeKey": step_type[1]},
        "numberOfIterations": repeats,
        "smartRepeat": False,
        "endCondition": {
            "conditionTypeId": _ITERATIONS_CONDITION[0],
            "conditionTypeKey": _ITERATIONS_CONDITION[1],
        },
        "endConditionValue": repeats,
        "workoutSteps": [
            _step_dto(child, family, order, depth + 1) for child in children
        ],
    }
    return dto


def _target_values(
    target: Any, family: str
) -> tuple[tuple[int, str], float | None, float | None]:
    """Target DTO + the (low, high) pair in Garmin's unit for this target type."""
    if target is None:
        return _TARGET_TYPES["none"], None, None
    if not isinstance(target, dict):
        raise InvalidWorkout("target must be an object")
    kind = str(target.get("type") or "none").strip().lower()
    target_type = _TARGET_TYPES.get(kind)
    if target_type is None:
        raise InvalidWorkout(f"unknown target type '{kind}'")
    if kind not in _TARGETS_BY_FAMILY.get(family, frozenset({"none"})):
        raise InvalidWorkout(f"target '{kind}' does not apply to a {family} workout")
    if kind == "none":
        return target_type, None, None

    low = _finite(target.get("low"))
    high = _finite(target.get("high"))
    if low is None and high is None:
        raise InvalidWorkout(f"target '{kind}' needs a low and/or high value")
    unit = str(target.get("unit") or "").strip().lower()
    converted = sorted(
        _convert_target(kind, value, unit) for value in (low, high) if value is not None
    )
    if len(converted) == 1:
        # A single-sided target still has to arrive as a range; Garmin's own UI
        # writes the same value twice.
        converted = [converted[0], converted[0]]
    return target_type, converted[0], converted[1]


def _convert_target(kind: str, value: float, unit: str) -> float:
    """One target value in Garmin's unit (m/s for pace+speed, else as given)."""
    if kind == "pace":
        # seconds per km / per mile → metres per second
        if unit in ("", "s_per_km", "sec_per_km", "s/km"):
            return 1000.0 / value
        if unit in ("s_per_mile", "sec_per_mile", "s/mi"):
            return _METRES_PER_MILE / value
        raise InvalidWorkout(f"unknown pace unit '{unit}' (use s_per_km)")
    if kind == "speed":
        if unit in ("", "m_s", "mps", "m/s"):
            return value
        if unit in ("kph", "km_h", "kmh", "km/h"):
            return value / 3.6
        if unit in ("mph",):
            return value * _METRES_PER_MILE / 3600.0
        raise InvalidWorkout(f"unknown speed unit '{unit}' (use m_s or kph)")
    if kind == "power":
        if unit in ("", "w", "watt", "watts"):
            return value
        raise InvalidWorkout(f"unknown power unit '{unit}' (use absolute watts)")
    if kind == "hr":
        if unit in ("", "bpm"):
            return value
        raise InvalidWorkout(f"unknown heart-rate unit '{unit}' (use bpm)")
    if kind == "cadence":
        if unit in ("", "rpm", "spm"):
            return value
        raise InvalidWorkout(f"unknown cadence unit '{unit}' (use rpm)")
    raise InvalidWorkout(f"unknown target type '{kind}'")  # pragma: no cover


def _finite(value: Any) -> float | None:
    """A usable positive number, or None. Rejects bools (``True`` is not 1 bpm)."""
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        return None
    number = float(value)
    if number != number or number in (float("inf"), float("-inf")) or number <= 0:
        return None
    return number


# --- the three writes ---------------------------------------------------------

def create_workout(
    api: Any, sport: str, title: str, steps: list[dict[str, Any]]
) -> dict[str, Any]:
    """Create a structured workout in the user's Garmin library.

    Returns ``{"supported": True, "workoutId": <id>}``, or
    ``{"supported": False, "reason": …}`` when this sport has no Garmin workout
    type or the endpoint does not exist for this account.
    """
    if not is_pushable(sport):
        return {"supported": False, "reason": "unsupported_sport"}
    payload = build_workout_payload(sport, title, steps)
    result = _write(api, _CREATE_PATH, "POST", payload)
    if result is _UNSUPPORTED:
        return {"supported": False, "reason": "unsupported_endpoint"}
    workout_id = _first_id(result, ("workoutId", "id"))
    if workout_id is None:
        # Garmin answered, but with nothing we can delete later — treat as a
        # failure rather than storing a workout we could never clean up.
        raise classify_upstream(
            RuntimeError("workout create returned no id"), _CREATE_PATH
        )
    logger.info("Created workout (steps=%d).", _count_steps(steps))  # no titles
    return {"supported": True, "workoutId": workout_id}


def schedule_workout(api: Any, workout_id: str, day: _dt.date) -> dict[str, Any]:
    """Pin an existing workout to a calendar day."""
    path = _SCHEDULE_PATH.format(workout_id=workout_id)
    result = _write(api, path, "POST", {"date": day.isoformat()})
    if result is _UNSUPPORTED:
        return {"supported": False, "reason": "unsupported_endpoint"}
    schedule_id = _first_id(
        result, ("workoutScheduleId", "scheduleId", "id", "calendarItemId")
    )
    logger.info("Scheduled workout for %s.", day.isoformat())
    return {"supported": True, "scheduleId": schedule_id}


def delete_workout(api: Any, workout_id: str) -> dict[str, Any]:
    """Remove a workout (and with it its schedule) from Garmin.

    A 404 means it is already gone, which is a SUCCESS for the caller's purpose:
    ``{"supported": True, "removed": False}``. Anything else raises.
    """
    path = _DELETE_PATH.format(workout_id=workout_id)
    result = _write(api, path, "DELETE", None)
    if result is _UNSUPPORTED:
        return {"supported": True, "removed": False, "reason": "already_gone"}
    logger.info("Deleted workout upstream.")
    return {"supported": True, "removed": True}


class _Unsupported:
    """Sentinel: the endpoint answered 404 (absent, or already gone)."""


_UNSUPPORTED = _Unsupported()


def _write(
    api: Any, path: str, method: str, payload: dict[str, Any] | None
) -> Any:
    """One connectapi write; upstream 404 → :data:`_UNSUPPORTED`, else classified.

    Only the classification, the method and the PATH are logged — never the
    payload, which is the athlete's own content.
    """
    try:
        return garmy_client.connectapi_write(api, path, method, payload)
    except Exception as exc:
        err = classify_upstream(exc, path)
        if err.code == "not_found":
            logger.warning("Workout endpoint unavailable (%s %s).", method, path)
            return _UNSUPPORTED
        logger.warning(
            "Workout write failed (%s) for %s %s.",
            err.code,
            method,
            path,
            extra={"code": err.code, "endpoint": path},
        )
        raise err from None


def _first_id(payload: Any, keys: tuple[str, ...]) -> str | None:
    """First present id-ish key in a response body, as a string."""
    if isinstance(payload, (int, str)) and str(payload).strip():
        return str(payload).strip()
    if not isinstance(payload, dict):
        return None
    for key in keys:
        value = payload.get(key)
        if isinstance(value, bool):
            continue
        if isinstance(value, (int, str)) and str(value).strip():
            return str(value).strip()
    return None


def _count_steps(steps: list[dict[str, Any]]) -> int:
    """Total step count including repeat children (for a payload-free log line)."""
    total = 0
    for step in steps:
        total += 1
        children = step.get("steps") if isinstance(step, dict) else None
        if isinstance(children, list):
            total += len(children)
    return total
