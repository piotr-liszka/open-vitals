"""FastAPI app for the Garmin sidecar.

Routes: /health, /status, /login, /metrics/{name}, /metrics/{name}/range,
/activities, /activities/{activity_id}/details, /weight/range,
/calendar/planned, /workouts (+ /{id}/schedule, DELETE), /diagnostics, /session.
Multi-tenant (spec 012): every Garmin-touching endpoint REQUIRES an
``X-User-Id`` header and is scoped to that user's encrypted token slot; only
/health is unauthenticated. Built via a ``create_app`` factory so tests can
inject an isolated :class:`Settings` and an in-memory :class:`TokenStore`.
Logging never emits credentials, tokens, the user id, or metric payloads.

The local-data-sync surface (web tier syncs ALL Garmin data into its own store,
then serves charts/maps/MCP from it) is served by three reads: ``/activities``
(raw newest-first page for full-history backfill), ``/activities/{id}/details``
(per-activity time-series streams for maps/zones/PMC), and ``/weight/range``
(weigh-in history for the weight chart).
"""

from __future__ import annotations

import datetime as _dt
import hmac
import logging
import re
from contextlib import asynccontextmanager
from typing import Any

from fastapi import Depends, FastAPI, Header, HTTPException, Query, Request, status
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

from . import diagnostics
from .auth import GarminAuth
from .config import Settings, get_settings
from .errors import (
    UPSTREAM_HTTP_STATUS,
    GarminUpstreamError,
    InvalidCredentials,
    InvalidDateRange,
    InvalidWorkout,
    MfaRequired,
    NotAuthenticated,
    UnknownMetric,
)
from .metrics import _MAX_ACTIVITY_PAGE_SIZE, SUPPORTED_METRICS, MetricsService
from .tokens import PostgresTokenStore, TokenStore

logger = logging.getLogger("garmin-sidecar")


# --- request / response models ------------------------------------------------

class LoginRequest(BaseModel):
    """Login payload. Values are used once and never stored or logged."""

    email: str = Field(min_length=3, max_length=254)
    password: str = Field(min_length=1, max_length=512)
    mfa_code: str | None = Field(default=None, min_length=4, max_length=10)


class StatusResponse(BaseModel):
    authenticated: bool
    display_name: str | None = None
    expires_at: float | int | None = None


# Workout authoring (spec 050). Field names are camelCase — unlike the rest of
# this module — because these models ARE the wire contract shared with the web
# tier's `AuthoredWorkout`/`WorkoutStep` types, and a step tree round-trips
# through them unchanged. Bounds are deliberate: they keep a malformed or hostile
# payload from ever reaching Garmin.

class WorkoutTargetModel(BaseModel):
    """Intensity target for one step. Validated against the sport in `workouts`."""

    type: str = Field(min_length=1, max_length=16)
    low: float | None = None
    high: float | None = None
    unit: str | None = Field(default=None, max_length=16)


class WorkoutStepModel(BaseModel):
    """One step, or (``kind: "repeat"``) a block wrapping child steps."""

    kind: str = Field(min_length=1, max_length=16)
    durationType: str | None = Field(default=None, max_length=16)
    durationValue: float | None = Field(default=None, ge=0, le=1_000_000)
    target: WorkoutTargetModel | None = None
    repeats: int | None = Field(default=None, ge=1, le=50)
    steps: list["WorkoutStepModel"] | None = Field(default=None, max_length=40)
    note: str | None = Field(default=None, max_length=512)


class WorkoutCreateRequest(BaseModel):
    sport: str = Field(min_length=1, max_length=64)
    title: str = Field(min_length=1, max_length=80)
    steps: list[WorkoutStepModel] = Field(min_length=1, max_length=50)


class WorkoutScheduleRequest(BaseModel):
    day: str = Field(min_length=10, max_length=10)


# --- dependency accessors (read wired singletons off app.state) ---------------

def _auth(request: Request) -> GarminAuth:
    return request.app.state.garmin_auth


def _metrics(request: Request) -> MetricsService:
    return request.app.state.metrics_service


def _user_id(x_user_id: str | None = Header(default=None, alias="X-User-Id")) -> str:
    """Extract + validate the required ``X-User-Id`` header.

    Missing or empty/whitespace-only → HTTP 400. The returned value is the opaque
    user scope threaded into the token store; it is never logged.
    """
    if x_user_id is None or not x_user_id.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="X-User-Id header is required",
        )
    return x_user_id.strip()


def _parse_date(value: str | None) -> _dt.date | None:
    """Validate an optional YYYY-MM-DD query param."""
    if value is None or value == "":
        return None
    try:
        return _dt.date.fromisoformat(value)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="date must be YYYY-MM-DD",
        ) from exc


def _require_date(value: str, field: str) -> _dt.date:
    """Validate a required YYYY-MM-DD query param (422 on bad format)."""
    parsed = _parse_date(value)
    if parsed is None:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"{field} is required and must be YYYY-MM-DD",
        )
    return parsed


_WORKOUT_ID_RE = re.compile(r"^[A-Za-z0-9_-]{1,64}$")


def _workout_id_param(workout_id: str) -> str:
    """Validate a Garmin workout id before it is interpolated into an upstream path.

    The id comes back from Garmin and is stored by the web tier, but it arrives
    here as a path segment — so it is checked against a strict allow-list rather
    than trusted, or a crafted value could reshape the URL the sidecar calls.
    """
    if not _WORKOUT_ID_RE.match(workout_id):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="workout_id must be 1-64 chars of [A-Za-z0-9_-]",
        )
    return workout_id


#: Paths reachable without the shared internal key. Only liveness — it must stay
#: probe-able by Docker/compose, and it never touches Garmin or the token store.
_UNAUTHENTICATED_PATHS = frozenset({"/health"})


def _internal_key_ok(configured: str | None, presented: str | None) -> bool:
    """Constant-time check of the ``X-Internal-Key`` header against config.

    ``configured is None`` means the guardrail is disabled (see Settings), so
    everything passes — the pre-spec-055 behaviour, kept so an in-place upgrade
    does not take the stack down before ``.env`` is updated.
    """
    if configured is None:
        return True
    return presented is not None and hmac.compare_digest(configured, presented)


def _configure_logging(level: str) -> None:
    """Set up plain logging. No formatter emits request bodies or secrets."""
    logging.basicConfig(
        level=getattr(logging, level.upper(), logging.INFO),
        format="%(asctime)s %(levelname)s %(name)s %(message)s",
    )


def _upstream_response(
    exc: GarminUpstreamError, fallback_detail: str, force_status: int | None = None
) -> Any:
    """Map a classified upstream failure to its HTTP response (spec 019).

    The body keeps the human ``detail`` string every existing caller reads and
    ADDS a machine-readable ``error`` object (code / reason / endpoint /
    retryable) so the web tier can tell a rate limit apart from an expired
    token. Nothing in it is derived from the upstream exception's text.
    """
    return _json(
        force_status or UPSTREAM_HTTP_STATUS.get(exc.code, status.HTTP_502_BAD_GATEWAY),
        {"detail": fallback_detail, "error": exc.payload()},
    )


def _not_authenticated_response() -> Any:
    """409 for "no usable tokens", in the same shape as an upstream failure."""
    return _json(
        status.HTTP_409_CONFLICT,
        {
            "detail": "not authenticated",
            "error": {
                "code": "not_connected",
                "reason": "no valid Garmin tokens for this user",
                "retryable": False,
            },
        },
    )


def _build_default_store(settings: Settings) -> TokenStore:
    """Build the production Postgres-backed token store from settings."""
    if not settings.database_url:
        raise RuntimeError("DATABASE_URL is required for the Postgres token store")
    return PostgresTokenStore(settings.database_url, settings.token_encryption_key)


def create_app(
    settings: Settings | None = None,
    token_store: TokenStore | None = None,
) -> FastAPI:
    """Build and wire the FastAPI application (ports & adapters via app.state).

    ``token_store`` is injectable so tests supply an in-memory adapter (offline,
    no Postgres); production falls back to the Postgres adapter built from env.
    """
    settings = settings or get_settings()
    _configure_logging(settings.log_level)

    store = token_store or _build_default_store(settings)
    garmin_auth = GarminAuth(store)
    metrics_service = MetricsService(store)
    # Per-app diagnostic ring buffer (spec 019). Each app instance gets its own,
    # so a test never sees another test's records.
    diag = diagnostics.DiagnosticBuffer(settings.diagnostics_buffer_size)
    diagnostics.attach(diag)

    @asynccontextmanager
    async def lifespan(_app: FastAPI):
        # Idempotently prepare backing storage (CREATE TABLE IF NOT EXISTS for
        # Postgres; no-op for the in-memory store). Runs on server startup only.
        store.ensure_ready()
        if settings.internal_api_key is None:
            logger.warning(
                "INTERNAL_API_KEY is not set: any client that can reach this "
                "service may assert any X-User-Id. Set it on both web and garmin."
            )
        yield

    app = FastAPI(title="Garmin Sidecar", version="0.1.0", lifespan=lifespan)
    app.state.settings = settings
    app.state.token_store = store
    app.state.garmin_auth = garmin_auth
    app.state.metrics_service = metrics_service
    app.state.diagnostics = diag

    @app.middleware("http")
    async def _require_internal_key(request: Request, call_next):  # type: ignore[no-untyped-def]
        """Gate every Garmin-touching route on the shared web<->sidecar secret.

        Middleware rather than a per-route dependency on purpose: a control that
        protects "everything except an explicit allow-list" must not depend on
        the author of the next route remembering to opt in.
        """
        if request.url.path not in _UNAUTHENTICATED_PATHS and not _internal_key_ok(
            settings.internal_api_key, request.headers.get("X-Internal-Key")
        ):
            # 403, NOT 401: in this API's vocabulary 401 already means "Garmin
            # rejected the end user's credentials" (see /login). Reusing it here
            # made a web<->sidecar key mismatch indistinguishable from a wrong
            # password, and the web tier duly told the user to check their email
            # and password. This failure is about the CALLER's identity, not the
            # user's. Body stays terse and never says whether a key was configured.
            return JSONResponse(status_code=status.HTTP_403_FORBIDDEN, content={"detail": "unauthorized"})
        return await call_next(request)

    @app.middleware("http")
    async def _scope_diagnostics(request: Request, call_next):  # type: ignore[no-untyped-def]
        """Tag every log record emitted while serving a request with its user.

        Set here (in the request task) rather than in the ``_user_id`` dependency
        because FastAPI runs sync dependencies in a worker thread, where a
        contextvar write would not propagate back to the request context.
        """
        token = diagnostics.set_user_scope((request.headers.get("X-User-Id") or "").strip())
        try:
            return await call_next(request)
        finally:
            diagnostics.reset_user_scope(token)

    # -- routes --------------------------------------------------------------

    @app.get("/health")
    def health() -> dict[str, str]:
        """Liveness probe. Never touches Garmin."""
        return {"status": "ok"}

    @app.get("/status", response_model=StatusResponse)
    def get_status(
        user_id: str = Depends(_user_id),
        auth: GarminAuth = Depends(_auth),
    ) -> dict[str, Any]:
        return auth.status(user_id)

    @app.post("/login")
    def login(
        body: LoginRequest,
        user_id: str = Depends(_user_id),
        auth: GarminAuth = Depends(_auth),
    ) -> Any:
        try:
            result = auth.login(user_id, body.email, body.password, body.mfa_code)
        except MfaRequired:
            # 202: not an error — the client must re-POST with an mfa_code.
            return _json(status.HTTP_202_ACCEPTED, {"mfa_required": True})
        except InvalidCredentials:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="invalid credentials",
            )
        except GarminUpstreamError as exc:
            # A login failure is always 502: the caller's next step is to retry
            # the credentials, never the 409 "reconnect your account" branch.
            return _upstream_response(
                exc, "garmin login failed", force_status=status.HTTP_502_BAD_GATEWAY
            )
        return result

    @app.get("/metrics/{name}")
    def get_metric(
        name: str,
        date: str | None = Query(default=None),
        user_id: str = Depends(_user_id),
        metrics: MetricsService = Depends(_metrics),
    ) -> dict[str, Any]:
        parsed = _parse_date(date)
        try:
            return metrics.get_metric(user_id, name, parsed)
        except UnknownMetric:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"unknown metric; supported: {', '.join(SUPPORTED_METRICS)}",
            )
        except NotAuthenticated:
            return _not_authenticated_response()
        except GarminUpstreamError as exc:
            return _upstream_response(exc, "garmin request failed")

    @app.get("/metrics/{name}/range")
    def get_metric_range(
        name: str,
        start: str = Query(...),
        end: str = Query(...),
        user_id: str = Depends(_user_id),
        metrics: MetricsService = Depends(_metrics),
    ) -> dict[str, Any]:
        start_date = _require_date(start, "start")
        end_date = _require_date(end, "end")
        try:
            return metrics.get_metric_range(user_id, name, start_date, end_date)
        except UnknownMetric:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"unknown metric; supported: {', '.join(SUPPORTED_METRICS)}",
            )
        except InvalidDateRange as exc:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=str(exc),
            )
        except NotAuthenticated:
            return _not_authenticated_response()
        except GarminUpstreamError as exc:
            return _upstream_response(exc, "garmin request failed")

    @app.get("/activities")
    def list_activities(
        limit: int = Query(default=20, ge=1, le=_MAX_ACTIVITY_PAGE_SIZE),
        start: int = Query(default=0, ge=0),
        user_id: str = Depends(_user_id),
        metrics: MetricsService = Depends(_metrics),
    ) -> list[Any]:
        """One raw, newest-first page of the activity list for backfill.

        The web tier walks ``start`` forward (page size ``limit``) until it gets
        an empty array back, covering the user's ENTIRE history. Returns the raw
        garmy activity-summary dicts.
        """
        try:
            return metrics.list_activities(user_id, limit, start)
        except NotAuthenticated:
            return _not_authenticated_response()
        except GarminUpstreamError as exc:
            return _upstream_response(exc, "garmin request failed")

    @app.get("/activities/{activity_id}/details")
    def activity_details(
        activity_id: int,
        user_id: str = Depends(_user_id),
        metrics: MetricsService = Depends(_metrics),
    ) -> dict[str, Any]:
        """Per-activity streams + summary + laps (route maps, zones, PMC, splits).

        ``activity_id`` is an int path param (non-int → 422). Stream keys are
        camelCase — the contract `GarminActivityDetails` declares in the web tier
        — and cover gps/time plus every scalar the device recorded (heartRate,
        power, cadence, speed, elevation, grade, temperature, respirationRate,
        running dynamics, stamina, performanceCondition, moving). Streams the
        device never recorded are omitted, as are `laps`/`typedSplits` when the
        activity has none.
        """
        try:
            return metrics.get_activity_details(user_id, activity_id)
        except NotAuthenticated:
            return _not_authenticated_response()
        except GarminUpstreamError as exc:
            return _upstream_response(exc, "garmin request failed")

    @app.get("/weight/range")
    def weight_range(
        start: str = Query(...),
        end: str = Query(...),
        user_id: str = Depends(_user_id),
        metrics: MetricsService = Depends(_metrics),
    ) -> dict[str, Any]:
        """All weigh-ins in ``[start, end]`` from a single upstream call.

        Returns ``{"start", "end", "data"}``; ``data`` is garmy's raw weigh-in
        payload (weight in grams — the web tier converts to kg).
        """
        start_date = _require_date(start, "start")
        end_date = _require_date(end, "end")
        try:
            return metrics.get_weight_range(user_id, start_date, end_date)
        except InvalidDateRange as exc:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=str(exc),
            )
        except NotAuthenticated:
            return _not_authenticated_response()
        except GarminUpstreamError as exc:
            return _upstream_response(exc, "garmin request failed")

    @app.get("/calendar/planned")
    def planned_events(
        start: str = Query(...),
        end: str = Query(...),
        user_id: str = Depends(_user_id),
        metrics: MetricsService = Depends(_metrics),
    ) -> Any:
        """Planned workouts/races scheduled in ``[start, end]`` (spec 024).

        Returns ``{"start", "end", "available", "source", "events"}``.
        ``available`` is False when Garmin's calendar service answered nothing
        usable for this account — the web tier then reports "not synced" instead
        of pretending the user has an empty plan.
        """
        start_date = _require_date(start, "start")
        end_date = _require_date(end, "end")
        try:
            return metrics.get_planned_events(user_id, start_date, end_date)
        except InvalidDateRange as exc:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=str(exc),
            )
        except NotAuthenticated:
            return _not_authenticated_response()
        except GarminUpstreamError as exc:
            return _upstream_response(exc, "garmin request failed")

    # -- workout writes (spec 050) -------------------------------------------
    # The ONLY mutating Garmin routes besides /login. Each answers
    # ``supported: false`` (HTTP 200) when Garmin does not serve the endpoint for
    # this account, so the caller parks the row instead of retrying forever.

    @app.post("/workouts")
    def create_workout(
        body: WorkoutCreateRequest,
        user_id: str = Depends(_user_id),
        metrics: MetricsService = Depends(_metrics),
    ) -> Any:
        """Create a structured workout in the user's Garmin workout library.

        Returns ``{"supported": true, "workoutId"}`` or ``{"supported": false,
        "reason"}`` — the latter for a sport with no Garmin workout type
        (``unsupported_sport``) or an absent endpoint (``unsupported_endpoint``).
        """
        steps = [step.model_dump() for step in body.steps]
        try:
            return metrics.create_workout(user_id, body.sport, body.title, steps)
        except InvalidWorkout as exc:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)
            )
        except NotAuthenticated:
            return _not_authenticated_response()
        except GarminUpstreamError as exc:
            return _upstream_response(exc, "garmin workout write failed")

    @app.post("/workouts/{workout_id}/schedule")
    def schedule_workout(
        workout_id: str,
        body: WorkoutScheduleRequest,
        user_id: str = Depends(_user_id),
        metrics: MetricsService = Depends(_metrics),
    ) -> Any:
        """Pin an existing workout to a calendar day (``{"day": "YYYY-MM-DD"}``)."""
        validated = _workout_id_param(workout_id)
        day = _require_date(body.day, "day")
        try:
            return metrics.schedule_workout(user_id, validated, day)
        except NotAuthenticated:
            return _not_authenticated_response()
        except GarminUpstreamError as exc:
            return _upstream_response(exc, "garmin workout write failed")

    @app.delete("/workouts/{workout_id}")
    def delete_workout(
        workout_id: str,
        user_id: str = Depends(_user_id),
        metrics: MetricsService = Depends(_metrics),
    ) -> Any:
        """Remove a workout upstream. Already deleted → ``removed: false``, not an error."""
        validated = _workout_id_param(workout_id)
        try:
            return metrics.delete_workout(user_id, validated)
        except NotAuthenticated:
            return _not_authenticated_response()
        except GarminUpstreamError as exc:
            return _upstream_response(exc, "garmin workout write failed")

    @app.get("/diagnostics")
    def get_diagnostics(
        request: Request,
        limit: int = Query(default=100, ge=1, le=400),
        user_id: str = Depends(_user_id),
    ) -> dict[str, Any]:
        """Recent sidecar log records for THIS user (spec 019).

        A bounded in-memory tail, so the web tier's /dane page can show why a
        Garmin call actually failed instead of a bare "unavailable". Records are
        sanitised (no credentials/tokens/e-mails) and scoped: a user only ever
        sees records emitted while serving their own requests. The sidecar is
        internal-only (AGENTS.md §3), so this is never reachable from the LAN.
        """
        buffer: diagnostics.DiagnosticBuffer = request.app.state.diagnostics
        return {
            "entries": buffer.snapshot(user_id, limit),
            "capacity": buffer.capacity,
        }

    @app.delete("/session")
    def clear_session(
        request: Request, user_id: str = Depends(_user_id)
    ) -> dict[str, bool]:
        cleared = request.app.state.token_store.clear(user_id)
        return {"cleared": cleared}

    return app


def _json(status_code: int, payload: dict[str, Any]) -> Any:
    """Small helper for non-200 JSON bodies that are not errors."""
    return JSONResponse(status_code=status_code, content=payload)


# Module-level ASGI app for `uvicorn app.main:app`. Requires env at import time
# (TOKEN_ENCRYPTION_KEY). Tests set that env before importing this module and may
# additionally build isolated instances via create_app(settings=...).
app = create_app()
