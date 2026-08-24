"""The single boundary between this service and the ``garmy`` library.

Every call into garmy lives here so that (a) it is trivially mockable in tests
(monkeypatch ``AuthClient`` / ``APIClient`` or the small functions below) and
(b) when garmy's real API differs from what we assumed, there is exactly one
file to adjust.

garmy is NOT installed in the local dev environment (only in the Python 3.12
container), so the exact shapes below are inferred. Every uncertain call is
tagged ``# ASSUMPTION:`` — verify each against the installed garmy version.

Design contract this module assumes of garmy:

  AuthClient()                      -> constructs an auth client (no args)
  auth.login(email, password, return_on_mfa=True)
                                    -> ("needs_mfa", state) when MFA is required,
                                       otherwise a truthy success result
  auth.resume_login(state, code)    -> completes a pending MFA login
  auth.login(email, password, prompt_mfa=lambda: code)
                                    -> single-shot login when the code is known
  auth.token_manager.oauth1_token   -> OAuth1 token object/dict
  auth.token_manager.oauth2_token   -> OAuth2 token object/dict (has expires_at)
  auth.get_user_profile()           -> {"displayName": ...} (optional)
  auth.refresh_oauth2_token()       -> refreshes an expired OAuth2 token
  APIClient(auth_client=auth)       -> constructs a metrics client
  api.metrics.get(name)             -> a metric accessor
  accessor.get(date)                -> the metric for `date` (dataclass/obj)
  accessor.raw(date)                -> the metric as a plain dict (preferred)

Activities are the one exception to the per-date model: garmy's
``ActivitiesAccessor.raw(limit, start)`` is a newest-first *paginated* endpoint
with no date parameter, so it gets its own boundary function
(:func:`fetch_activities` / :func:`fetch_activity_page`) rather than going
through :func:`fetch_metric`.

Per-activity detail streams (:func:`fetch_activity_details`) and weigh-in ranges
(:func:`fetch_weight_range`) have NO garmy metric accessor in 1.0.0, so they call
``APIClient.connectapi(path)`` directly against Garmin's activity-service /
weight-service. Those raw paths + payload shapes are the least-certain calls in
this module — every one is ``# ASSUMPTION:`` tagged for verification.
"""

from __future__ import annotations

import dataclasses
import datetime as _dt
import logging
from types import SimpleNamespace
from typing import Any, Callable

logger = logging.getLogger("garmin-sidecar.garmy")

# --- garmy import (optional at import time so the module loads for tests) -----
# Tests monkeypatch AuthClient/APIClient; production imports the real classes.
try:  # pragma: no cover - exercised only where garmy is installed
    from garmy import AuthClient, APIClient  # type: ignore
except Exception:  # pragma: no cover - garmy absent in local dev
    AuthClient = None  # type: ignore[assignment]
    APIClient = None  # type: ignore[assignment]

# garmy's real token dataclasses. We must restore into THESE (not a duck-typed
# SimpleNamespace) because garmy's auth layer reads properties like
# ``oauth2_token.expired`` that only exist on the concrete classes — otherwise
# ``is_authenticated`` raises and every metric call silently returns empty.
try:  # pragma: no cover - exercised only where garmy is installed
    from garmy.auth.tokens import OAuth1Token, OAuth2Token  # type: ignore
except Exception:  # pragma: no cover - garmy absent in local dev
    OAuth1Token = None  # type: ignore[assignment]
    OAuth2Token = None  # type: ignore[assignment]


# A sentinel string garmy is assumed to return as the first tuple element when a
# login needs a second factor. Kept here so tests and code agree on one value.
MFA_SENTINEL = "needs_mfa"


# --- client construction ------------------------------------------------------

def make_auth_client() -> Any:
    """Construct a fresh garmy AuthClient."""
    if AuthClient is None:  # pragma: no cover - guarded for local dev only
        raise RuntimeError("garmy is not installed in this environment")
    # ASSUMPTION: AuthClient() takes no required constructor arguments.
    return AuthClient()


def make_api_client(auth: Any) -> Any:
    """Construct a garmy APIClient bound to an authenticated AuthClient."""
    if APIClient is None:  # pragma: no cover - guarded for local dev only
        raise RuntimeError("garmy is not installed in this environment")
    # ASSUMPTION: APIClient accepts the auth client as ``auth_client=``.
    return APIClient(auth_client=auth)


# --- login flow ---------------------------------------------------------------

def login_start(auth: Any, email: str, password: str) -> tuple[bool, Any]:
    """Begin a login. Return ``(needs_mfa, state)``.

    ``state`` is an opaque value garmy hands back to resume MFA; it is only ever
    held in memory, never persisted or logged.
    """
    # ASSUMPTION: passing return_on_mfa=True makes garmy return instead of
    # blocking on an interactive MFA prompt, yielding (MFA_SENTINEL, state).
    result = auth.login(email, password, return_on_mfa=True)
    if isinstance(result, tuple) and len(result) == 2 and result[0] == MFA_SENTINEL:
        return True, result[1]
    return False, None


def login_resume(auth: Any, state: Any, mfa_code: str) -> None:
    """Complete a login that was paused waiting for an MFA code."""
    # ASSUMPTION: resume_login(state, code) finishes the flow on the same client.
    auth.resume_login(state, mfa_code)


def login_with_code(auth: Any, email: str, password: str, mfa_code: str) -> None:
    """Single-shot login when the MFA code is already known (no pending state)."""
    prompt: Callable[[], str] = lambda: mfa_code  # noqa: E731 - tiny callback
    # ASSUMPTION: login accepts a prompt_mfa callback used when MFA is demanded.
    auth.login(email, password, prompt_mfa=prompt)


# --- token bundle (extract / restore / status) --------------------------------

def _to_dict(obj: Any) -> dict[str, Any] | None:
    """Best-effort convert a garmy token object into a JSON-able dict."""
    if obj is None:
        return None
    if isinstance(obj, dict):
        return dict(obj)
    if dataclasses.is_dataclass(obj) and not isinstance(obj, type):
        return dataclasses.asdict(obj)
    if hasattr(obj, "_asdict"):  # namedtuple
        return dict(obj._asdict())
    if hasattr(obj, "__dict__"):
        return {k: v for k, v in vars(obj).items() if not k.startswith("_")}
    return None


def _token_manager(auth: Any) -> Any:
    """Return garmy's token manager, tolerating a couple of shapes."""
    # ASSUMPTION: tokens hang off auth.token_manager; fall back to auth itself.
    return getattr(auth, "token_manager", auth)


def extract_token_bundle(auth: Any) -> dict[str, Any]:
    """Pull the OAuth1/OAuth2 material off the auth client into a plain dict.

    Also stashes a display name and OAuth2 expiry alongside so that ``status``
    can answer without a network round-trip.
    """
    tm = _token_manager(auth)
    # ASSUMPTION: attributes named oauth1_token / oauth2_token.
    oauth1 = _to_dict(getattr(tm, "oauth1_token", None))
    oauth2 = _to_dict(getattr(tm, "oauth2_token", None))

    bundle: dict[str, Any] = {"oauth1": oauth1, "oauth2": oauth2}

    # OAuth2 expiry surfaced for /status (epoch seconds if present).
    if oauth2 and "expires_at" in oauth2:
        bundle["expires_at"] = oauth2["expires_at"]

    display_name = _try_display_name(auth)
    if display_name:
        bundle["display_name"] = display_name

    return bundle


def _try_display_name(auth: Any) -> str | None:
    """Fetch the Garmin display name if garmy exposes it; never fatal."""
    getter = getattr(auth, "get_user_profile", None)
    if not callable(getter):
        return None
    try:
        # ASSUMPTION: get_user_profile() returns a dict with "displayName".
        profile = getter()
    except Exception:
        return None
    if isinstance(profile, dict):
        name = profile.get("displayName") or profile.get("display_name")
        return name if isinstance(name, str) else None
    return None


def _reify_token(token_cls: Any, fields: dict[str, Any]) -> Any:
    """Rebuild a garmy token dataclass from a stored dict.

    Filters to the dataclass's own fields (tolerating extra/renamed keys from an
    older bundle) and constructs the concrete class so garmy's property accessors
    (``.expired`` etc.) work. Falls back to a duck-typed SimpleNamespace when the
    real class is unavailable (tests) or construction fails.
    """
    if token_cls is not None and dataclasses.is_dataclass(token_cls):
        names = {f.name for f in dataclasses.fields(token_cls)}
        try:
            return token_cls(**{k: v for k, v in fields.items() if k in names})
        except Exception:  # pragma: no cover - defensive; shape drift
            logger.warning("Could not build %s from stored bundle; using fallback.", token_cls.__name__)
    return SimpleNamespace(**fields)


def restore_token_bundle(auth: Any, bundle: dict[str, Any]) -> None:
    """Load a previously-saved bundle back onto a fresh auth client.

    Restores into garmy's concrete OAuth1Token/OAuth2Token so the auth layer's
    property accessors work; a SimpleNamespace lacks e.g. ``.expired`` and makes
    ``is_authenticated`` raise, which silently blanks every metric fetch.
    """
    tm = _token_manager(auth)
    oauth1 = bundle.get("oauth1")
    oauth2 = bundle.get("oauth2")
    if oauth1 is not None:
        setattr(tm, "oauth1_token", _reify_token(OAuth1Token, oauth1))
    if oauth2 is not None:
        setattr(tm, "oauth2_token", _reify_token(OAuth2Token, oauth2))


def ensure_valid(auth: Any) -> None:
    """Refresh the OAuth2 token if it has expired. Best-effort, non-fatal."""
    tm = _token_manager(auth)
    oauth2 = getattr(tm, "oauth2_token", None)
    expires_at = getattr(oauth2, "expires_at", None) if oauth2 is not None else None
    if not _is_expired(expires_at):
        return
    refresher = getattr(auth, "refresh_oauth2_token", None)
    if callable(refresher):
        try:
            # ASSUMPTION: refresh_oauth2_token() refreshes in place.
            refresher()
        except Exception:
            logger.warning("OAuth2 token refresh failed.")


def _is_expired(expires_at: Any) -> bool:
    """True if an epoch-seconds expiry is in the past. Unknown -> not expired."""
    if expires_at is None:
        return False
    try:
        return float(expires_at) <= _dt.datetime.now(tz=_dt.timezone.utc).timestamp()
    except (TypeError, ValueError):
        return False


# --- metrics ------------------------------------------------------------------

def fetch_metric(api: Any, garmy_name: str, date: _dt.date | None) -> Any:
    """Fetch one metric for a date via garmy, returned as JSON-able data.

    Prefers the accessor's ``raw`` form (already a dict) and falls back to
    ``get`` + generic serialisation.
    """
    # ASSUMPTION: api.metrics.get(name) returns an accessor exposing get()/raw().
    accessor = api.metrics.get(garmy_name)

    raw = getattr(accessor, "raw", None)
    if callable(raw):
        # ASSUMPTION: accessor.raw(date) returns plain JSON-able data.
        return _jsonify(raw(date) if date is not None else raw())

    # ASSUMPTION: accessor.get(date) returns a dataclass/obj we can serialise.
    result = accessor.get(date) if date is not None else accessor.get()
    return _jsonify(result)


# --- activities ---------------------------------------------------------------
# garmy's activities accessor does NOT take a date: its signature is
# ``raw(limit: int = 20, start: int = 0)`` over a newest-first list. Passing a
# date positionally silently bound it to ``limit``, and garmy swallows the
# resulting upstream error and returns ``[]`` — so every dated request came back
# empty with nothing in the logs. We page explicitly and filter by local date.

# One page of the Garmin activity list. 20 is garmy's own default.
_ACTIVITY_PAGE_SIZE = 20
# Hard stop on paging so a far-past date can never sweep the whole history.
_ACTIVITY_MAX_PAGES = 25


def activity_local_date(activity: Any) -> str | None:
    """Return an activity's local start date as ``YYYY-MM-DD``, or None.

    Garmin returns ``startTimeLocal`` as ``"YYYY-MM-DD HH:MM:SS"``; the date is
    the leading 10 characters. Local (not GMT) is the right basis because a run
    belongs to the day the athlete ran it.
    """
    if not isinstance(activity, dict):
        return None
    value = activity.get("startTimeLocal") or activity.get("start_time_local")
    if not isinstance(value, str) or len(value) < 10:
        return None
    stamp = value[:10]
    return stamp if stamp[4] == "-" and stamp[7] == "-" else None


def _activities_page(accessor: Any, limit: int, start: int) -> list[Any]:
    """Fetch one page of activities, normalised to a list."""
    # ASSUMPTION: raw(limit=, start=) — verified against garmy 1.0.0's
    # ActivitiesAccessor.raw(limit: int = 20, start: int = 0).
    page = _jsonify(accessor.raw(limit=limit, start=start))
    return page if isinstance(page, list) else []


def fetch_activities(
    api: Any, start: _dt.date | None, end: _dt.date | None = None
) -> list[Any]:
    """Activities whose local start date falls in ``[start, end]`` (inclusive).

    With ``start=None`` the most recent page is returned unfiltered, which is the
    "no date given" case. Otherwise pages newest-first and stops as soon as a
    page runs older than ``start`` (the list is ordered, so nothing newer can
    appear later) or ``_ACTIVITY_MAX_PAGES`` is reached.
    """
    accessor = api.metrics.get("activities")

    if start is None:
        return _activities_page(accessor, _ACTIVITY_PAGE_SIZE, 0)

    lo = start.isoformat()
    hi = (end or start).isoformat()

    matches: list[Any] = []
    for page_index in range(_ACTIVITY_MAX_PAGES):
        page = _activities_page(
            accessor, _ACTIVITY_PAGE_SIZE, page_index * _ACTIVITY_PAGE_SIZE
        )
        if not page:
            break
        exhausted = False
        for activity in page:
            stamp = activity_local_date(activity)
            if stamp is None:
                continue  # undated entry: keep scanning, never a stop signal
            if lo <= stamp <= hi:
                matches.append(activity)
            elif stamp < lo:
                exhausted = True  # past the window; nothing older can match
        if exhausted or len(page) < _ACTIVITY_PAGE_SIZE:
            break
    return matches


def fetch_activity_page(api: Any, limit: int, start: int) -> list[Any]:
    """One raw, newest-first page of the activity list (no date filter).

    Returns the raw garmy activity-summary dicts for ``[start, start+limit)`` and
    ``[]`` once ``start`` is past the end of the list. The web tier paginates the
    user's ENTIRE history by walking ``start`` forward until it gets ``[]`` back;
    there is no server-side sweep here, so the only guard is the page size the
    caller passes (bounded in the route + MetricsService).
    """
    accessor = api.metrics.get("activities")
    return _activities_page(accessor, limit, start)


# --- activity detail / streams ------------------------------------------------
# garmy 1.0.0 ships NO metric accessor for per-activity detail or for weigh-ins,
# so both reach Garmin directly via ``APIClient.connectapi(path)`` (verified
# against garmy.core.client.APIClient.connectapi -> parsed JSON | str | None).

# ASSUMPTION: Garmin's activity-service detail path. ``maxChartSize`` /
# ``maxPolylineSize`` widen the returned sample resolution (default truncates a
# long ride). Verify the path and the exact cap query-param names against a live
# response from the installed garmy/Garmin.
_ACTIVITY_DETAILS_PATH = (
    "/activity-service/activity/{activity_id}/details"
    "?maxChartSize=2000&maxPolylineSize=4000"
)
# ASSUMPTION: the base activity endpoint carries the summary under "summaryDTO".
# Verify the key against a live response.
_ACTIVITY_SUMMARY_PATH = "/activity-service/activity/{activity_id}"

# ASSUMPTION: Garmin's lap/split endpoints. ``/splits`` carries the per-lap DTOs
# (one entry per lap button press / auto-lap); ``/typedsplits`` carries Garmin's
# own classified splits (run/walk/stand for a run, interval work/rest, …).
# Verify both paths and their payload keys against a live response.
_ACTIVITY_SPLITS_PATH = "/activity-service/activity/{activity_id}/splits"
_ACTIVITY_TYPED_SPLITS_PATH = "/activity-service/activity/{activity_id}/typedsplits"

# Garmin metricDescriptor "key" -> our output stream name. A descriptor maps one
# column index in every ``activityDetailMetrics`` row to a metric.
#
# CONTRACT: stream names are camelCase, matching `GarminActivityDetails` in the
# web tier (apps/web/src/lib/server/interfaces.ts). This used to emit snake_case
# `heart_rate` while the web read `heartRate`, so HR streams were silently
# dropped for every synced activity — the names on both sides must stay in step.
#
# ASSUMPTION: these ``directXxx``/``sumXxx`` descriptor keys are Garmin's standard
# names for the activity-details time series. Descriptors vary by DEVICE and
# SPORT, so every stream is optional: an absent descriptor simply yields no
# stream (never an error), and an unknown descriptor key is ignored.
_DESCRIPTOR_TO_STREAM: dict[str, str] = {
    "directLatitude": "lat",
    "directLongitude": "lng",
    "directElevation": "elevation",
    "directHeartRate": "heartRate",
    "directPower": "power",
    "directSpeed": "speed",
    "directBikeCadence": "cadence",
    "directRunCadence": "cadence",
    "directDoubleCadence": "cadence",
    "directFractionalCadence": "fractionalCadence",
    "directRespirationRate": "respirationRate",
    "directVerticalRatio": "verticalRatio",
    "directVerticalOscillation": "verticalOscillation",
    "directGroundContactTime": "groundContactTime",
    "directGroundContactBalanceLeft": "groundContactBalance",
    "directStrideLength": "strideLength",
    "directAirTemperature": "temperature",
    "directTemperature": "temperature",
    "directGrade": "grade",
    "directAvailableStamina": "stamina",
    "directPotentialStamina": "staminaPotential",
    "directPerformanceCondition": "performanceCondition",
    # Cumulative moving seconds; its per-sample delta is the run/walk (moving vs.
    # standing) classification exposed as the derived ``moving`` stream.
    "sumMovingDuration": "movingDuration",
}

# Time columns in PRIORITY order — deliberately NOT descriptor order. The `time`
# contract is SECONDS FROM START (the web tier infers the sample interval from
# consecutive diffs), so a cumulative duration column beats the absolute epoch
# timestamp column, which is rebased and converted below.
_TIME_DESCRIPTORS: tuple[str, ...] = (
    "sumElapsedDuration",
    "sumDuration",
    "directTimestamp",
)

# An absolute timestamp at/above this is epoch MILLISECONDS (1e11 ms ≈ 1973,
# 1e11 s ≈ year 5138), so the scale can be detected rather than assumed.
_EPOCH_MS_FLOOR = 1e11

# Scalar streams emitted (in this order) when the descriptors carried them. `lat`
# and `lng` are excluded: they are folded into `gps` instead.
_SCALAR_STREAMS: tuple[str, ...] = (
    "heartRate",
    "power",
    "cadence",
    "fractionalCadence",
    "speed",
    "elevation",
    "grade",
    "temperature",
    "respirationRate",
    "verticalRatio",
    "verticalOscillation",
    "groundContactTime",
    "groundContactBalance",
    "strideLength",
    "stamina",
    "staminaPotential",
    "performanceCondition",
    "movingDuration",
)


def _connectapi(api: Any, path: str) -> Any:
    """Call garmy's ``APIClient.connectapi`` and JSON-normalise the result."""
    # ASSUMPTION: connectapi(path) returns parsed JSON (dict/list) or None.
    return _jsonify(api.connectapi(path))


def connectapi_write(
    api: Any, path: str, method: str, payload: dict[str, Any] | None = None
) -> Any:
    """A NON-GET connectapi call — the only write path to Garmin (spec 050).

    ``APIClient.connectapi(path, method="GET", **kwargs)`` forwards ``method``
    and any extra kwargs to the underlying session, so a JSON body goes out as
    ``json=``. Kept here beside :func:`_connectapi` so all knowledge of garmy's
    escape hatch stays in one module; the workout mapper and the failure
    classification live in ``workouts.py``.
    """
    kwargs: dict[str, Any] = {} if payload is None else {"json": payload}
    return _jsonify(api.connectapi(path, method=method, **kwargs))


def fetch_activity_details(api: Any, activity_id: int) -> dict[str, Any]:
    """Per-activity time-series streams + summary + laps, all JSON-able.

    Returns ``{"activityId", "summary", "laps"?, "typedSplits"?, ...streams}``.
    Stream keys are camelCase (see :data:`_DESCRIPTOR_TO_STREAM`) and cover
    ``gps`` (list of ``[lat, lng]`` or ``[lat, lng, elevation]``), ``time``
    (seconds from start) and every scalar in :data:`_SCALAR_STREAMS` plus the
    derived ``moving`` flag. A stream Garmin did not record for this activity is
    OMITTED rather than returned empty — partial data is fine (it still unlocks
    route maps, HR/power zones, power curves, PMC). Never raises on missing
    pieces: every sub-fetch is best-effort.
    """
    details = _connectapi(api, _ACTIVITY_DETAILS_PATH.format(activity_id=activity_id))
    result: dict[str, Any] = {
        "activityId": activity_id,
        "summary": _activity_summary(api, activity_id),
    }
    result.update(fetch_activity_splits(api, activity_id))
    if isinstance(details, dict):
        result.update(_extract_streams(details))
    return result


def _activity_summary(api: Any, activity_id: int) -> dict[str, Any]:
    """Fetch the activity's summary dict; never fatal (returns {} on any miss)."""
    try:
        base = _connectapi(api, _ACTIVITY_SUMMARY_PATH.format(activity_id=activity_id))
    except Exception:  # pragma: no cover - defensive; summary is best-effort
        return {}
    if isinstance(base, dict):
        summary = base.get("summaryDTO")
        return summary if isinstance(summary, dict) else {}
    return {}


def _extract_streams(details: dict[str, Any]) -> dict[str, Any]:
    """Turn a Garmin activity-details payload into per-stream JSON arrays."""
    streams = _streams_from_descriptors(
        details.get("metricDescriptors"), details.get("activityDetailMetrics")
    )
    if "gps" not in streams:
        # Fallback GPS source when the details metrics carry no lat/lng columns.
        # ASSUMPTION: geoPolylineDTO.polyline is a list of {lat, lon, altitude}.
        gps = _gps_from_polyline(details.get("geoPolylineDTO"))
        if gps:
            streams["gps"] = gps
    return streams


def _streams_from_descriptors(descriptors: Any, records: Any) -> dict[str, Any]:
    """Column-decode ``activityDetailMetrics`` rows using ``metricDescriptors``.

    Descriptors differ per device/sport, so this is entirely opportunistic: only
    the columns we recognise are decoded, anything unknown or malformed is
    skipped, and a stream with no usable value is omitted from the result.
    """
    if not isinstance(descriptors, list) or not isinstance(records, list):
        return {}
    # stream name -> column index (first descriptor wins per stream). Time
    # candidates are collected separately so priority beats descriptor order.
    col: dict[str, int] = {}
    time_col: dict[str, int] = {}
    for descriptor in descriptors:
        if not isinstance(descriptor, dict):
            continue
        key = descriptor.get("key")
        idx = descriptor.get("metricsIndex")
        if not isinstance(key, str) or not isinstance(idx, int) or idx < 0:
            continue
        if key in _TIME_DESCRIPTORS and key not in time_col:
            time_col[key] = idx
        name = _DESCRIPTOR_TO_STREAM.get(key)
        if name is not None and name not in col:
            col[name] = idx
    if not col and not time_col:
        return {}

    wanted = dict(col)
    wanted.update({f"time:{key}": idx for key, idx in time_col.items()})
    cols: dict[str, list[Any]] = {name: [] for name in wanted}
    for record in records:
        values = record.get("metrics") if isinstance(record, dict) else None
        if not isinstance(values, list):
            continue
        for name, idx in wanted.items():
            cols[name].append(values[idx] if idx < len(values) else None)

    streams: dict[str, Any] = {}
    gps = _gps_from_columns(cols)
    if gps:
        streams["gps"] = gps
    time = _time_stream(cols, time_col)
    if time is not None:
        streams["time"] = time
    for name in _SCALAR_STREAMS:
        vals = cols.get(name)
        if vals and any(v is not None for v in vals):
            streams[name] = vals
    moving = _moving_flags(streams.get("movingDuration"))
    if moving is not None:
        streams["moving"] = moving
    return streams


def _gps_from_columns(cols: dict[str, list[Any]]) -> list[list[Any]]:
    """Fold the lat/lng(/elevation) columns into ``[lat, lng(, elevation)]``."""
    lat, lng = cols.get("lat"), cols.get("lng")
    if not lat or not lng:
        return []
    elev = cols.get("elevation")
    gps: list[list[Any]] = []
    for i in range(min(len(lat), len(lng))):
        la, lo = lat[i], lng[i]
        if la is None or lo is None:
            continue
        if elev is not None and i < len(elev) and elev[i] is not None:
            gps.append([la, lo, elev[i]])
        else:
            gps.append([la, lo])
    return gps


def _time_stream(
    cols: dict[str, list[Any]], time_col: dict[str, int]
) -> list[Any] | None:
    """Pick the best time column and normalise it to SECONDS FROM START.

    Garmin's ``directTimestamp`` is an absolute epoch (milliseconds on every
    payload seen), which the web tier would otherwise read as a ~1000 s sample
    interval and mis-scale every duration-based curve. Cumulative duration
    columns win when present; whatever is used gets rebased on its first sample.
    """
    for key in _TIME_DESCRIPTORS:
        if key not in time_col:
            continue
        values = cols.get(f"time:{key}")
        if not values:
            continue
        seconds = _seconds_from_start(values, absolute=key == "directTimestamp")
        if seconds is not None:
            return seconds
    return None


def _number(value: Any) -> float | None:
    """A finite int/float, or None (bools are NOT numbers here)."""
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        return None
    return float(value) if value == value and abs(value) != float("inf") else None


def _seconds_from_start(values: list[Any], absolute: bool) -> list[Any] | None:
    """Rebase a time column on its first sample, converting epoch ms to seconds."""
    numbers = [_number(v) for v in values]
    first = next((v for v in numbers if v is not None), None)
    if first is None:
        return None
    scale = 0.001 if absolute and abs(first) >= _EPOCH_MS_FLOOR else 1.0
    return [None if v is None else round((v - first) * scale, 3) for v in numbers]


def _moving_flags(moving_duration: Any) -> list[int] | None:
    """Derive a per-sample moving (1) / not-moving (0) flag from cumulative seconds.

    Garmin's ``sumMovingDuration`` only advances while the athlete is moving, so
    a zero delta marks a standing/paused sample — the run-walk-stand split the
    activity page shows. The first sample has no delta and is counted as moving.
    Returns None when the column is unusable or nothing ever moved.
    """
    if not isinstance(moving_duration, list) or len(moving_duration) < 2:
        return None
    flags: list[int] = []
    previous: float | None = None
    for value in moving_duration:
        current = _number(value)
        if current is None or previous is None:
            flags.append(0 if current is None else 1)
        else:
            flags.append(1 if current > previous else 0)
        if current is not None:
            previous = current
    return flags if any(flags) else None


# --- laps / splits ------------------------------------------------------------
# Garmin lap DTO key candidates -> our camelCase, unit-suffixed output name. Every
# field is optional: a lap only carries what the device recorded for that sport.

_LAP_NUMBER_FIELDS: dict[str, tuple[str, ...]] = {
    "durationS": ("duration",),
    "movingDurationS": ("movingDuration",),
    "elapsedDurationS": ("elapsedDuration",),
    "distanceM": ("distance",),
    "avgSpeedMps": ("averageSpeed", "avgSpeed"),
    "maxSpeedMps": ("maxSpeed",),
    "avgHr": ("averageHR", "averageHr", "avgHr"),
    "maxHr": ("maxHR", "maxHr"),
    "avgPower": ("averagePower", "avgPower"),
    "maxPower": ("maxPower",),
    "normPower": ("normalizedPower", "normPower"),
    "calories": ("calories",),
    "elevationGainM": ("elevationGain",),
    "elevationLossM": ("elevationLoss",),
    "maxElevationM": ("maxElevation",),
    "minElevationM": ("minElevation",),
    "avgRunCadenceSpm": (
        "averageRunCadence",
        "averageRunningCadenceInStepsPerMinute",
        "avgRunCadence",
    ),
    "maxRunCadenceSpm": ("maxRunCadence", "maxRunningCadenceInStepsPerMinute"),
    "avgStrideLengthCm": ("strideLength", "avgStrideLength"),
    "avgGroundContactTimeMs": ("groundContactTime", "avgGroundContactTime"),
    "avgGroundContactBalancePct": (
        "groundContactBalanceLeft",
        "avgGroundContactBalance",
    ),
    "avgVerticalOscillationCm": ("verticalOscillation", "avgVerticalOscillation"),
    "avgVerticalRatio": ("verticalRatio", "avgVerticalRatio"),
    "avgTemperatureC": ("averageTemperature", "avgTemperature"),
    "avgRespirationRate": ("averageRespirationRate", "avgRespirationRate"),
    "count": ("noOfSplits", "numberOfSplits"),
}

_LAP_TEXT_FIELDS: dict[str, tuple[str, ...]] = {
    "startTimeGmt": ("startTimeGMT", "startTimeGmt"),
    "intensityType": ("intensityType",),
}


def fetch_activity_splits(api: Any, activity_id: int) -> dict[str, Any]:
    """Laps + Garmin's own classified splits for one activity (best-effort).

    Returns ``{"laps"?: [...], "typedSplits"?: [...]}`` — each key is present
    only when that endpoint returned usable rows. Both are normalised to the
    same optional-field lap shape. Never raises: a device/sport without laps (or
    an endpoint Garmin retires) simply yields ``{}``.
    """
    out: dict[str, Any] = {}
    laps = _normalize_laps(
        _try_connectapi(api, _ACTIVITY_SPLITS_PATH.format(activity_id=activity_id)),
        ("lapDTOs", "laps"),
    )
    if laps:
        out["laps"] = laps
    typed = _normalize_laps(
        _try_connectapi(
            api, _ACTIVITY_TYPED_SPLITS_PATH.format(activity_id=activity_id)
        ),
        ("splits", "typedSplits", "lapDTOs"),
    )
    if typed:
        out["typedSplits"] = typed
    return out


def _try_connectapi(api: Any, path: str) -> Any:
    """``_connectapi`` that swallows upstream errors (optional data, never fatal).

    The failed PATH is logged (it is a Garmin route, never credential material)
    so the diagnostics buffer can say which optional endpoint went missing.
    """
    try:
        return _connectapi(api, path)
    except Exception as exc:  # pragma: no cover - defensive; sub-resources are best-effort
        logger.warning(
            "Optional sub-resource fetch failed (%s): %s.",
            path.split("?", 1)[0],
            type(exc).__name__,
            extra={"endpoint": path.split("?", 1)[0]},
        )
        return None


def _normalize_laps(payload: Any, list_keys: tuple[str, ...]) -> list[dict[str, Any]]:
    """Pull the lap array out of a splits payload and normalise every entry."""
    rows: Any = None
    if isinstance(payload, list):
        rows = payload
    elif isinstance(payload, dict):
        for key in list_keys:
            if isinstance(payload.get(key), list):
                rows = payload[key]
                break
    if not isinstance(rows, list):
        return []
    laps: list[dict[str, Any]] = []
    for position, row in enumerate(rows):
        lap = _normalize_lap(row, position)
        if lap is not None:
            laps.append(lap)
    return laps


def _normalize_lap(row: Any, position: int) -> dict[str, Any] | None:
    """One raw lap/split dict -> our optional-field shape; None when unusable."""
    if not isinstance(row, dict):
        return None
    lap: dict[str, Any] = {"index": _lap_index(row, position)}
    lap_type = _lap_type(row)
    if lap_type is not None:
        lap["type"] = lap_type
    for name, candidates in _LAP_NUMBER_FIELDS.items():
        for key in candidates:
            value = _number(row.get(key))
            if value is not None:
                lap[name] = value
                break
    for name, candidates in _LAP_TEXT_FIELDS.items():
        for key in candidates:
            value = row.get(key)
            if isinstance(value, str) and value:
                lap[name] = value
                break
    return lap if len(lap) > 1 else None


def _lap_index(row: dict[str, Any], position: int) -> int:
    """1-based lap number: Garmin's messageIndex when sane, else the position."""
    raw = row.get("messageIndex", row.get("lapIndex"))
    if isinstance(raw, int) and not isinstance(raw, bool) and raw >= 0:
        return raw + 1
    return position + 1


def _lap_type(row: dict[str, Any]) -> str | None:
    """Split classification (e.g. ``RWD_RUN``/``RWD_WALK``/``INTERVAL_ACTIVE``)."""
    for key in ("type", "typeKey", "splitTypeKey"):
        value = row.get(key)
        if isinstance(value, str) and value:
            return value
    nested = row.get("splitType") or row.get("activityType")
    if isinstance(nested, dict):
        value = nested.get("typeKey") or nested.get("type")
        if isinstance(value, str) and value:
            return value
    return None


def _gps_from_polyline(geo: Any) -> list[list[Any]]:
    """Extract ``[lat, lng(, altitude)]`` points from a geoPolylineDTO."""
    if not isinstance(geo, dict):
        return []
    poly = geo.get("polyline")
    if not isinstance(poly, list):
        return []
    gps: list[list[Any]] = []
    for point in poly:
        if not isinstance(point, dict):
            continue
        lat = point.get("lat")
        lng = point.get("lon", point.get("lng"))
        if lat is None or lng is None:
            continue
        alt = point.get("altitude")
        gps.append([lat, lng, alt] if alt is not None else [lat, lng])
    return gps


# --- weight / body-composition history ----------------------------------------
# ASSUMPTION: Garmin's weigh-in date-range endpoint. Returns EVERY weigh-in in
# the window in ONE call (far cheaper than the per-day body_composition metric),
# which is what the Withings-parity weight chart wants. Garmin reports weight in
# GRAMS in this payload — the web tier converts to kg. Verify the path and the
# unit against a live response.
_WEIGHT_RANGE_PATH = (
    "/weight-service/weight/dateRange?startDate={start}&endDate={end}"
)


def fetch_weight_range(api: Any, start: _dt.date, end: _dt.date) -> Any:
    """Fetch all weigh-ins in ``[start, end]`` in a single upstream call."""
    return _connectapi(
        api,
        _WEIGHT_RANGE_PATH.format(start=start.isoformat(), end=end.isoformat()),
    )


# --- planned workouts / training calendar -------------------------------------
# garmy 1.0.0 has NO calendar or workout accessor, so this goes through
# ``APIClient.connectapi`` like the activity/weight reads do.
#
# ASSUMPTION (spec 024, UNVERIFIED against a live account): Garmin's calendar
# service serves one month per call at
# ``/calendar-service/year/{year}/month/{month}`` where ``month`` is
# ZERO-BASED (January = 0) — the quirk most third-party clients document — and
# answers ``{"calendarItems": [ ... ]}``. Each item carries an ``itemType``
# ("workout" for a scheduled session, "activity" for one already completed,
# plus race/note-ish types) and a ``date``.
#
# Everything below is written to FAIL SOFT: an endpoint that 404s, returns None
# or answers in an unexpected shape yields ``available: False`` with no events,
# and the web tier then says "not synced" instead of inventing a plan.
_CALENDAR_MONTH_PATH = "/calendar-service/year/{year}/month/{month}"

# Item types that represent something PLANNED (not something already done).
_PLANNED_ITEM_TYPES: dict[str, str] = {
    "workout": "workout",
    "scheduledworkout": "workout",
    "trainingplan": "workout",
    "race": "race",
    "event": "race",
    "note": "note",
    "goal": "note",
}

# Item types explicitly known to be history, not a plan — skipped without noise.
_COMPLETED_ITEM_TYPES: frozenset[str] = frozenset(
    {"activity", "multisportactivity", "personalrecord", "challenge"}
)


def _month_starts(start: _dt.date, end: _dt.date) -> list[tuple[int, int]]:
    """Every ``(year, month)`` (1-based month) the window touches, in order."""
    months: list[tuple[int, int]] = []
    year, month = start.year, start.month
    while (year, month) <= (end.year, end.month):
        months.append((year, month))
        year, month = (year + 1, 1) if month == 12 else (year, month + 1)
    return months


def fetch_planned_events(api: Any, start: _dt.date, end: _dt.date) -> dict[str, Any]:
    """Planned calendar items in ``[start, end]``, normalised and best-effort.

    Returns ``{"available": bool, "source": str, "events": [...]}``. ``available``
    is True only when Garmin actually answered a calendar month with a usable
    payload — an account/endpoint that serves nothing is reported honestly rather
    than as "no planned workouts".
    """
    available = False
    events: list[dict[str, Any]] = []
    for year, month in _month_starts(start, end):
        # Zero-based month index (see the ASSUMPTION above).
        payload = _try_connectapi(
            api, _CALENDAR_MONTH_PATH.format(year=year, month=month - 1)
        )
        items = _calendar_items(payload)
        if items is None:
            continue
        available = True
        for item in items:
            event = _planned_event(item, start, end)
            if event is not None:
                events.append(event)
    events.sort(key=lambda e: (e["day"], e["time"] or "", e["id"]))
    return {
        "available": available,
        "source": "calendar-service",
        "events": events,
    }


def _calendar_items(payload: Any) -> list[Any] | None:
    """The item list out of a calendar payload; None when the shape is unusable."""
    if isinstance(payload, list):
        return payload
    if isinstance(payload, dict):
        for key in ("calendarItems", "items", "calendarItemList"):
            value = payload.get(key)
            if isinstance(value, list):
                return value
    return None


def _planned_event(item: Any, start: _dt.date, end: _dt.date) -> dict[str, Any] | None:
    """One calendar item -> the planned-event shape, or None when not a plan."""
    if not isinstance(item, dict):
        return None
    raw_type = item.get("itemType") or item.get("type") or ""
    key = str(raw_type).replace("_", "").replace(" ", "").lower()
    if key in _COMPLETED_ITEM_TYPES:
        return None
    kind = _PLANNED_ITEM_TYPES.get(key)
    if kind is None:
        # Unknown type: keep it only when it clearly is not a finished activity
        # and it has no activityId (which would mark it as history).
        if item.get("activityId") is not None or not raw_type:
            return None
        kind = "workout"

    day = _calendar_day(item)
    if day is None or not (start.isoformat() <= day <= end.isoformat()):
        return None

    event: dict[str, Any] = {
        "id": str(
            item.get("id")
            or item.get("scheduleId")
            or item.get("workoutId")
            or f"{day}-{kind}"
        ),
        "day": day,
        "time": _calendar_time(item),
        "kind": kind,
        "title": _first_text(item, ("title", "workoutName", "name", "eventName")) or "",
        "sport": _calendar_sport(item),
        "description": _first_text(item, ("description", "workoutDescription", "note")),
        "estimatedDurationS": _number(
            _first_value(item, ("estimatedDurationInSecs", "duration", "estimatedDuration"))
        ),
        "estimatedDistanceM": _number(
            _first_value(item, ("distanceInMeters", "estimatedDistanceInMeters", "distance"))
        ),
        "targetLoad": _number(
            _first_value(item, ("trainingLoad", "estimatedTrainingLoad", "tss"))
        ),
    }
    return event


def _first_value(item: dict[str, Any], keys: tuple[str, ...]) -> Any:
    for key in keys:
        if item.get(key) is not None:
            return item[key]
    return None


def _first_text(item: dict[str, Any], keys: tuple[str, ...]) -> str | None:
    value = _first_value(item, keys)
    return value if isinstance(value, str) and value.strip() else None


def _calendar_day(item: dict[str, Any]) -> str | None:
    """``YYYY-MM-DD`` for a calendar item, from whichever date key it carries."""
    value = _first_value(item, ("date", "calendarDate", "scheduledDate", "startDate"))
    if isinstance(value, str) and len(value) >= 10 and value[4] == "-" and value[7] == "-":
        return value[:10]
    return None


def _calendar_time(item: dict[str, Any]) -> str | None:
    """Local ``HH:MM`` when the plan pins a time, else None."""
    value = _first_value(item, ("startTimeLocal", "scheduledTime", "startTime"))
    if not isinstance(value, str):
        return None
    text = value.replace("T", " ")
    # "YYYY-MM-DD HH:MM[:SS]" or a bare "HH:MM[:SS]".
    candidate = text[11:16] if len(text) >= 16 and text[4] == "-" else text[:5]
    if len(candidate) == 5 and candidate[2] == ":" and candidate.replace(":", "").isdigit():
        return candidate
    return None


def _calendar_sport(item: dict[str, Any]) -> str | None:
    """Garmin ``typeKey`` for the planned sport, so the web renders it normally."""
    value = _first_value(item, ("sportTypeKey", "activityTypeKey", "workoutTypeKey"))
    if isinstance(value, str) and value:
        return value
    for key in ("sportType", "activityType", "workoutType"):
        nested = item.get(key)
        if isinstance(nested, dict):
            nested_value = nested.get("typeKey") or nested.get("sportTypeKey")
            if isinstance(nested_value, str) and nested_value:
                return nested_value
    return None


def _jsonify(value: Any) -> Any:
    """Recursively coerce garmy return values into JSON-serialisable data."""
    if value is None or isinstance(value, (str, int, float, bool)):
        return value
    if isinstance(value, (_dt.date, _dt.datetime)):
        return value.isoformat()
    if isinstance(value, dict):
        return {str(k): _jsonify(v) for k, v in value.items()}
    if isinstance(value, (list, tuple)):
        return [_jsonify(v) for v in value]
    as_dict = _to_dict(value)
    if as_dict is not None:
        return {k: _jsonify(v) for k, v in as_dict.items()}
    return str(value)
