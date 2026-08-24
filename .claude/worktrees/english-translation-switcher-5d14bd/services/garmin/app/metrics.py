"""Metric reads: thin wrappers over garmy's APIClient returning plain JSON.

Requires valid stored tokens; otherwise raises :class:`NotAuthenticated` (mapped
to HTTP 409). Metric payloads are treated as untrusted data and are never logged
(AGENTS.md §10).
"""

from __future__ import annotations

import contextlib
import datetime as _dt
import logging
from typing import Any, Callable, Iterator

from . import garmy_client, workouts
from .errors import (
    GarminUpstreamError,
    InvalidDateRange,
    InvalidWorkout,
    NotAuthenticated,
    UnknownMetric,
    classify_upstream,
)
from .tokens import TokenStore

logger = logging.getLogger("garmin-sidecar.metrics")

# Maximum number of days (inclusive) a single range request may span. Kept small
# because this runs on a modest machine and each day is a separate garmy call.
_MAX_RANGE_DAYS = 31

# Hard cap on one raw activity-list page. The web tier paginates the user's
# ENTIRE history by walking ``start`` forward until it gets an empty page back;
# nothing sweeps server-side, so the only guard is a sane per-page size.
_MAX_ACTIVITY_PAGE_SIZE = 100

# Weigh-ins come back in ONE upstream call, so a year-wide window is cheap; still
# bounded so a caller cannot request an unbounded span. Wider than
# ``_MAX_RANGE_DAYS`` (which caps per-day metric sweeps) precisely because this
# is a single request, not one-call-per-day.
_MAX_WEIGHT_RANGE_DAYS = 366

# Planned workouts are read a calendar MONTH at a time upstream, so a window of
# up to ~14 months costs at most 14 calls. The start page only ever asks for the
# next 7–14 days; the cap just stops a caller sweeping a decade of calendars.
_MAX_PLANNED_RANGE_DAYS = 400

# Public metric name -> garmy accessor name. Isolating the mapping here means a
# rename in garmy is a one-line change.
# ASSUMPTION: these are garmy's accessor keys. resting_heart_rate is assumed to
# live under the "heart_rate" accessor; activities under an "activities"
# accessor. Verify against the installed garmy metric registry.
# ASSUMPTION (spec 008): spo2/respiration/calories/body_composition are the
# garmy accessor keys. spo2 may be "spo2" or "pulse_ox"; body_composition may be
# "body_composition" or "weight". Verify against the installed garmy registry.
_METRIC_MAP: dict[str, str] = {
    "sleep": "sleep",
    "steps": "steps",
    "hrv": "hrv",
    "body_battery": "body_battery",
    "stress": "stress",
    "resting_heart_rate": "heart_rate",
    "activities": "activities",
    "spo2": "spo2",
    "respiration": "respiration",
    "calories": "calories",
    "body_composition": "body_composition",
    # Garmin's OWN readiness score (spec 059), distinct from the composite the
    # web tier computes from raw channels. Carries recoveryTime in MINUTES
    # (spec 070) and the `timestamp` it was computed at, which the web tier
    # counts down from (spec 075) — pass the document through untouched.
    "training_readiness": "training_readiness",
}

SUPPORTED_METRICS: tuple[str, ...] = tuple(_METRIC_MAP)


class MetricsService:
    """Fetch Garmin metrics through garmy using the stored token bundle."""

    def __init__(self, store: TokenStore) -> None:
        self._store = store

    @contextlib.contextmanager
    def _upstream(self, endpoint: str) -> Iterator[None]:
        """Classify anything garmy throws into a typed, secret-free upstream error.

        Without this an arbitrary garmy/transport exception escaped as a bare
        HTTP 500 and the web tier could only ever report "unavailable" (spec
        019). The classification (rate_limited / token_rejected / blocked /
        timeout) is what makes the /dane log actionable. Domain errors pass
        through untouched.
        """
        try:
            yield
        except (
            NotAuthenticated,
            UnknownMetric,
            InvalidDateRange,
            InvalidWorkout,
            GarminUpstreamError,
        ):
            raise
        except Exception as exc:
            err = classify_upstream(exc, endpoint)
            # Classification + endpoint only — never the upstream message.
            logger.warning(
                "Upstream call failed (%s) for %s.",
                err.code,
                endpoint,
                extra={"code": err.code, "endpoint": endpoint},
            )
            raise err from None

    def _api_client(self, user_id: str) -> Any:
        """Build a user's authenticated garmy APIClient or raise NotAuthenticated."""
        bundle = self._store.load(user_id)
        if not bundle:
            raise NotAuthenticated("not authenticated")
        auth = garmy_client.make_auth_client()
        garmy_client.restore_token_bundle(auth, bundle)
        garmy_client.ensure_valid(auth)
        return garmy_client.make_api_client(auth)

    def get_metric(
        self, user_id: str, name: str, date: _dt.date | None = None
    ) -> dict[str, Any]:
        """Dispatch to the per-metric fetcher for a user and wrap the result.

        Returns ``{"metric", "date", "data"}``. Raises :class:`UnknownMetric`
        (404) for unsupported names and :class:`NotAuthenticated` (409) when no
        valid tokens are present for ``user_id``.
        """
        fetcher = self._dispatch(name)
        api = self._api_client(user_id)
        with self._upstream(f"metrics/{name}"):
            data = fetcher(api, date)
        logger.info("Served metric '%s'.", name)  # name only; never the payload
        return {
            "metric": name,
            "date": date.isoformat() if date is not None else None,
            "data": data,
        }

    def get_metric_range(
        self, user_id: str, name: str, start: _dt.date, end: _dt.date
    ) -> dict[str, Any]:
        """Fetch a metric for every day in ``[start, end]`` (inclusive).

        Returns ``{"metric", "start", "end", "days": [{"date", "data"}]}``.

        Validates the name (UnknownMetric -> 404) and the range (InvalidDateRange
        -> 400: ``start`` must be <= ``end`` and the span may not exceed
        ``_MAX_RANGE_DAYS``). Builds ONE authenticated api client and reuses it
        for every day (no per-day re-auth). A transient per-day failure sets that
        day's ``data`` to null instead of failing the whole range; only the
        metric name and date are logged, never the payload. NotAuthenticated and
        UnknownMetric propagate.
        """
        fetcher = self._dispatch(name)  # validates name -> UnknownMetric (404)
        if start > end:
            raise InvalidDateRange("start must be on or before end")
        span = (end - start).days + 1
        if span > _MAX_RANGE_DAYS:
            raise InvalidDateRange(
                f"range too large: {span} days (max {_MAX_RANGE_DAYS})"
            )

        api = self._api_client(user_id)  # once; NotAuthenticated (409) if no tokens

        # A metric whose source is a paginated list (activities) can serve the
        # whole span in one sweep; the per-day loop below would re-walk it daily.
        ranger = getattr(self, f"_range_{name}", None)
        if ranger is not None:
            with self._upstream(f"metrics/{name}/range"):
                buckets = ranger(api, start, end)
            days = []
            current = start
            while current <= end:
                stamp = current.isoformat()
                days.append({"date": stamp, "data": buckets.get(stamp, [])})
                current += _dt.timedelta(days=1)
            logger.info(
                "Served metric '%s' range %s..%s (%d days).",
                name,
                start.isoformat(),
                end.isoformat(),
                span,
            )
            return {
                "metric": name,
                "start": start.isoformat(),
                "end": end.isoformat(),
                "days": days,
            }

        days: list[dict[str, Any]] = []
        current = start
        failures: dict[str, int] = {}
        while current <= end:
            try:
                data = fetcher(api, current)
            except (NotAuthenticated, UnknownMetric):
                raise
            except Exception as exc:  # upstream hiccup for a single day
                err = classify_upstream(exc, f"metrics/{name}/range")
                # A rejected token or a rate limit will hit EVERY remaining day
                # of the window, so grinding through 30 more calls only digs the
                # hole deeper: surface it once and let the caller back off.
                if err.code in ("token_rejected", "rate_limited"):
                    logger.warning(
                        "Range aborted for '%s' at %s (%s).",
                        name,
                        current.isoformat(),
                        err.code,
                        extra={"code": err.code, "endpoint": f"metrics/{name}/range"},
                    )
                    raise err from None
                failures[err.code] = failures.get(err.code, 0) + 1
                # name + date + classification only; never the payload (§10).
                logger.warning(
                    "Range fetch failed for '%s' on %s (%s); day set to null.",
                    name,
                    current.isoformat(),
                    err.code,
                    extra={"code": err.code, "endpoint": f"metrics/{name}/range"},
                )
                data = None
            days.append({"date": current.isoformat(), "data": data})
            current += _dt.timedelta(days=1)

        if failures:
            logger.warning(
                "Range '%s' %s..%s completed with %d failed day(s): %s.",
                name,
                start.isoformat(),
                end.isoformat(),
                sum(failures.values()),
                ", ".join(f"{code}×{n}" for code, n in sorted(failures.items())),
            )

        logger.info(
            "Served metric '%s' range %s..%s (%d days).",
            name,
            start.isoformat(),
            end.isoformat(),
            span,
        )
        return {
            "metric": name,
            "start": start.isoformat(),
            "end": end.isoformat(),
            "days": days,
        }

    # -- backfill / detail / weight reads ------------------------------------

    def list_activities(
        self, user_id: str, limit: int = 20, start: int = 0
    ) -> list[Any]:
        """Return one raw, newest-first page of the user's activity list.

        Returns the raw garmy activity-summary dicts for ``[start, start+limit)``
        and ``[]`` once ``start`` runs past the end — the exhaustion signal the
        web tier uses to stop paginating a full-history backfill. ``limit`` is
        bounded by the route (``1..{_MAX_ACTIVITY_PAGE_SIZE}``); nothing sweeps
        server-side. NotAuthenticated (409) when no valid tokens are present.
        """
        api = self._api_client(user_id)  # NotAuthenticated (409) if no tokens
        with self._upstream("activities"):
            page = garmy_client.fetch_activity_page(api, limit, start)
        if not isinstance(page, list):
            page = []
        # count + paging offsets only; never the activity payload (AGENTS.md §10)
        logger.info(
            "Served activities page (limit=%d, start=%d, n=%d).",
            limit,
            start,
            len(page),
        )
        return page

    def get_activity_details(
        self, user_id: str, activity_id: int
    ) -> dict[str, Any]:
        """Return per-activity streams + summary + laps.

        Shape: ``{"activityId", "summary", "laps"?, "typedSplits"?, ...streams}``
        where stream keys are camelCase (``gps``/``heartRate``/``power``/…, see
        ``garmy_client._DESCRIPTOR_TO_STREAM``) and ``time`` is seconds from
        start. Streams Garmin never recorded are omitted (partial data is fine).
        NotAuthenticated (409) when no valid tokens are present.
        """
        api = self._api_client(user_id)  # NotAuthenticated (409) if no tokens
        with self._upstream(f"activities/{activity_id}/details"):
            details = garmy_client.fetch_activity_details(api, activity_id)
        # stream-key count only; never the coordinates/samples (AGENTS.md §10).
        stream_count = sum(
            1
            for key in details
            if key not in ("activityId", "summary", "laps", "typedSplits")
        )
        logger.info("Served activity details (%d streams).", stream_count)
        return details

    def get_weight_range(
        self, user_id: str, start: _dt.date, end: _dt.date
    ) -> dict[str, Any]:
        """Return all weigh-ins in ``[start, end]`` from ONE upstream call.

        Returns ``{"start", "end", "data"}`` where ``data`` is garmy's raw
        weigh-in payload (weight in GRAMS — the web tier converts to kg). Rejects
        ``start > end`` and spans over ``_MAX_WEIGHT_RANGE_DAYS`` with
        InvalidDateRange (400). NotAuthenticated (409) when no valid tokens.
        """
        if start > end:
            raise InvalidDateRange("start must be on or before end")
        span = (end - start).days + 1
        if span > _MAX_WEIGHT_RANGE_DAYS:
            raise InvalidDateRange(
                f"range too large: {span} days (max {_MAX_WEIGHT_RANGE_DAYS})"
            )
        api = self._api_client(user_id)  # NotAuthenticated (409) if no tokens
        with self._upstream("weight/range"):
            data = garmy_client.fetch_weight_range(api, start, end)
        logger.info(
            "Served weight range %s..%s (%d days).",
            start.isoformat(),
            end.isoformat(),
            span,
        )
        return {"start": start.isoformat(), "end": end.isoformat(), "data": data}

    def get_planned_events(
        self, user_id: str, start: _dt.date, end: _dt.date
    ) -> dict[str, Any]:
        """Scheduled workouts/races in ``[start, end]`` from Garmin's calendar.

        Returns ``{"start", "end", "available", "source", "events"}``. garmy has
        no calendar accessor, so this goes through ``APIClient.connectapi``
        against ``/calendar-service`` — an endpoint we cannot verify offline. It
        is therefore best-effort by design: when Garmin answers with nothing
        usable, ``available`` is False and ``events`` is empty, and the web tier
        reports "not synced" rather than inventing a plan (spec 024).
        """
        if start > end:
            raise InvalidDateRange("start must be on or before end")
        span = (end - start).days + 1
        if span > _MAX_PLANNED_RANGE_DAYS:
            raise InvalidDateRange(
                f"range too large: {span} days (max {_MAX_PLANNED_RANGE_DAYS})"
            )
        api = self._api_client(user_id)  # NotAuthenticated (409) if no tokens
        with self._upstream("calendar/planned"):
            result = garmy_client.fetch_planned_events(api, start, end)
        # counts only; never titles/notes (they are user content — AGENTS.md §10)
        logger.info(
            "Served planned events %s..%s (available=%s, n=%d).",
            start.isoformat(),
            end.isoformat(),
            result.get("available"),
            len(result.get("events", [])),
        )
        return {"start": start.isoformat(), "end": end.isoformat(), **result}

    # --- workout WRITES (spec 050) --------------------------------------------
    # The only mutating Garmin calls in the sidecar. Each is best-effort in the
    # same sense as the calendar read: an endpoint Garmin does not serve for this
    # account yields ``supported: False`` instead of an exception, so the web
    # tier can park the row rather than retry it forever. Titles, notes and
    # targets are the athlete's content and are never logged.

    def create_workout(
        self, user_id: str, sport: str, title: str, steps: list[dict[str, Any]]
    ) -> dict[str, Any]:
        """Create a structured workout in the user's Garmin workout library.

        Returns ``{"supported", "workoutId"?}``. :class:`InvalidWorkout` (422)
        when the step tree cannot be mapped; NotAuthenticated (409) with no tokens.
        """
        api = self._api_client(user_id)
        with self._upstream("workouts/create"):
            return workouts.create_workout(api, sport, title, steps)

    def schedule_workout(
        self, user_id: str, workout_id: str, day: _dt.date
    ) -> dict[str, Any]:
        """Pin an existing Garmin workout to ``day``. Returns ``{"supported", "scheduleId"?}``."""
        api = self._api_client(user_id)
        with self._upstream("workouts/schedule"):
            return workouts.schedule_workout(api, workout_id, day)

    def delete_workout(self, user_id: str, workout_id: str) -> dict[str, Any]:
        """Remove a workout upstream. An already-deleted workout is not an error."""
        api = self._api_client(user_id)
        with self._upstream("workouts/delete"):
            return workouts.delete_workout(api, workout_id)

    def _dispatch(self, name: str) -> Callable[[Any, _dt.date | None], Any]:
        """Return the fetcher for a metric name (validates the name)."""
        if name not in _METRIC_MAP:
            raise UnknownMetric(f"unknown metric: {name}")
        return getattr(self, f"_get_{name}", self._get_generic(name))

    # -- per-metric wrappers -------------------------------------------------
    # Each is a thin, individually overridable seam over the generic fetch, so a
    # metric that later needs special handling changes in one place only.

    def _get_generic(self, name: str) -> Callable[[Any, _dt.date | None], Any]:
        garmy_name = _METRIC_MAP[name]

        def fetch(api: Any, date: _dt.date | None) -> Any:
            return garmy_client.fetch_metric(api, garmy_name, date)

        return fetch

    def _get_sleep(self, api: Any, date: _dt.date | None) -> Any:
        return garmy_client.fetch_metric(api, _METRIC_MAP["sleep"], date)

    def _get_steps(self, api: Any, date: _dt.date | None) -> Any:
        # garmy's "steps" accessor returns a rolling multi-day blob, not a clean
        # per-day scalar, which breaks the per-day range model. The daily summary
        # carries an authoritative single-day ``totalSteps`` for the requested date.
        return garmy_client.fetch_metric(api, "daily_summary", date)

    def _get_hrv(self, api: Any, date: _dt.date | None) -> Any:
        return garmy_client.fetch_metric(api, _METRIC_MAP["hrv"], date)

    def _get_body_battery(self, api: Any, date: _dt.date | None) -> Any:
        return garmy_client.fetch_metric(api, _METRIC_MAP["body_battery"], date)

    def _get_stress(self, api: Any, date: _dt.date | None) -> Any:
        return garmy_client.fetch_metric(api, _METRIC_MAP["stress"], date)

    def _get_resting_heart_rate(self, api: Any, date: _dt.date | None) -> Any:
        return garmy_client.fetch_metric(api, _METRIC_MAP["resting_heart_rate"], date)

    def _get_activities(self, api: Any, date: _dt.date | None) -> Any:
        # Activities are a paginated newest-first list, not a per-date document,
        # so they bypass fetch_metric entirely. See garmy_client.fetch_activities.
        return garmy_client.fetch_activities(api, date)

    # -- range overrides -----------------------------------------------------

    def _range_activities(
        self, api: Any, start: _dt.date, end: _dt.date
    ) -> dict[str, list[Any]]:
        """Bucket a whole date range by day from ONE pagination sweep.

        The generic range path calls the per-day fetcher once per day, which for
        a paginated source would re-walk the list up to 31 times. One sweep over
        ``[start, end]`` and a group-by is both cheaper and identical in result.
        """
        buckets: dict[str, list[Any]] = {}
        for activity in garmy_client.fetch_activities(api, start, end):
            stamp = garmy_client.activity_local_date(activity)
            if stamp is not None:
                buckets.setdefault(stamp, []).append(activity)
        return buckets

    def _get_spo2(self, api: Any, date: _dt.date | None) -> Any:
        # garmy exposes no standalone "spo2" metric; the daily summary carries the
        # day's ``averageSpo2`` (and latest/lowest), so source it from there.
        return garmy_client.fetch_metric(api, "daily_summary", date)

    def _get_respiration(self, api: Any, date: _dt.date | None) -> Any:
        return garmy_client.fetch_metric(api, _METRIC_MAP["respiration"], date)

    def _get_calories(self, api: Any, date: _dt.date | None) -> Any:
        return garmy_client.fetch_metric(api, _METRIC_MAP["calories"], date)

    def _get_body_composition(self, api: Any, date: _dt.date | None) -> Any:
        return garmy_client.fetch_metric(api, _METRIC_MAP["body_composition"], date)

    def _get_training_readiness(self, api: Any, date: _dt.date | None) -> Any:
        # Garmin's trainingreadiness endpoint answers with a LIST holding a single
        # object (garmy's own parser does the same unwrap). Every other metric is
        # one document per day, so the list is flattened HERE rather than teaching
        # the web tier a second payload shape (spec 059).
        raw = garmy_client.fetch_metric(api, _METRIC_MAP["training_readiness"], date)
        if isinstance(raw, list):
            # An account or device without Training Readiness answers with [] —
            # that is a legitimate empty day, not a failure.
            return raw[0] if raw else None
        return raw
