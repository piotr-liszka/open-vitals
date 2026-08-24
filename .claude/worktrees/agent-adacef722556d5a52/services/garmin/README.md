# Garmin sidecar

The **only** component allowed to reach Garmin Connect. It exists because Garmin fronts its API with
Cloudflare TLS fingerprinting that blocks plain HTTP clients; `garmy` + `curl_cffi` (browser impersonation)
gets through. FastAPI + uvicorn, **internal-only** (never LAN/internet-published), **multi-tenant**: every
Garmin-touching request carries an opaque `X-User-Id` header and is scoped to that user's Fernet-encrypted
token row (see AGENTS.md §1–§3, §10).

All `garmy` calls live behind one seam — `app/garmy_client.py` — so the library is trivially mocked in tests
and every uncertain call is `# ASSUMPTION:` tagged in one place. Tests mock garmy at that boundary and run
fully offline.

## Endpoints

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET | `/health` | none | Liveness probe; never touches Garmin. |
| GET | `/status` | `X-User-Id` | `{authenticated, display_name?, expires_at?}`. |
| POST | `/login` | `X-User-Id` | Body `{email, password, mfa_code?}`. 202 `{mfa_required:true}` when a code is needed. Credentials used once, never stored/logged. |
| GET | `/metrics/{name}?date=` | `X-User-Id` | One day of a metric → `{metric, date, data}`. |
| GET | `/metrics/{name}/range?start=&end=` | `X-User-Id` | Per-day sweep (≤ 31 days) → `{metric, start, end, days:[{date,data}]}`. |
| GET | `/activities?limit=&start=` | `X-User-Id` | **Full-history backfill page** (see below). |
| GET | `/activities/{activity_id}/details` | `X-User-Id` | **Per-activity time-series streams** (see below). |
| GET | `/weight/range?start=&end=` | `X-User-Id` | **Weigh-in history** (see below). |
| GET | `/calendar/planned?start=&end=` | `X-User-Id` | **Planned workouts / races** (spec 024, see below). |
| GET | `/diagnostics?limit=` | `X-User-Id` | **Recent log records for this user** (spec 019, see below). |
| DELETE | `/session` | `X-User-Id` | Clear the user's stored tokens → `{cleared}`. |

Shared contract: missing/blank `X-User-Id` → **400**; no valid stored tokens → **409** `not authenticated`;
bad date/param → **422**; malformed range → **400**. Only `/health` is unauthenticated. Logs never contain
credentials, tokens, the user id, or metric payloads.

### Failure classification (spec 019)

Every Garmin-touching route now answers a failure with the human `detail` string it always had **plus** a
machine-readable `error` object, and picks the status from the classification:

```jsonc
{ "detail": "garmin request failed",
  "error": { "code": "rate_limited", "reason": "rate_limited (HTTPError, HTTP 429)",
             "endpoint": "metrics/sleep/range", "retryable": true, "upstreamStatus": 429 } }
```

| `code` | HTTP | Meaning / what the user must do |
|--------|------|---------------------------------|
| `rate_limited` | 429 | Garmin is throttling us — back off and retry later. |
| `token_rejected` | 409 | Garmin refused the stored tokens — the user must reconnect the account. |
| `not_connected` | 409 | No tokens stored for this user at all. |
| `blocked` | 502 | Cloudflare/transport blocked the call (the reason this sidecar exists). |
| `timeout` | 504 | Upstream did not answer in time. |
| `not_found` | 404 | Garmin does not serve that endpoint. |
| `upstream_error` | 502 | Anything else. |

The classification is derived from the exception's **class name and HTTP status only** — never its message —
so no upstream text can leak into a response or a log. `/login` always answers 502 on an upstream failure
(retrying the credentials, not reconnecting, is the user's next step).

### `GET /diagnostics?limit=` — the sidecar's own log tail

A bounded in-memory ring buffer (`DIAGNOSTICS_BUFFER_SIZE`, default 400 records **per process**) of this
service's log records, so the web app's `/dane` page can show *why* Garmin refused a request instead of a
generic "unavailable". Returns `{entries: [{t, level, logger, msg, code?, endpoint?}], capacity}` where `t`
is epoch seconds.

Safety properties (this is a log surface, so they are structural, not conventions):

- **Per-user scoped.** An HTTP middleware binds the request's `X-User-Id` to a contextvar; every record is
  tagged with it at emit time and `snapshot()` returns only the asking user's records — untagged startup
  records are returned to nobody. The scope tag is stripped before the record leaves the process.
- **Sanitised.** E-mail-shaped and long token-shaped substrings are replaced with `***` and each line is
  truncated. Our own log lines never carry payloads/credentials in the first place; this is defence in depth.
- **Bounded and volatile.** Nothing is persisted; a restart empties it. It is a diagnostic tail, not a log store.
- **Internal-only.** The sidecar is never published (AGENTS.md §3); the web app proxies this at
  `GET /api/sync/diagnostics` behind the user's session.

### `GET /calendar/planned?start=&end=` — planned workouts (spec 024)

Scheduled workouts/races in `[start, end]` (span capped at 400 days), read a **calendar month at a time**
from `/calendar-service/year/{year}/month/{month}` — where `month` is **zero-based**. Returns:

```jsonc
{ "start": "...", "end": "...", "available": true, "source": "calendar-service",
  "events": [ { "id": "5001", "day": "2026-08-10", "time": "18:00", "kind": "workout",
                "title": "…", "sport": "running", "description": null,
                "estimatedDurationS": 3600, "estimatedDistanceM": 12000, "targetLoad": null } ] }
```

`kind` is `workout` | `race` | `note`; already-completed calendar items (`activity`, `personalRecord`, …)
are filtered out. **`available: false` means Garmin served no usable calendar for this account** — which is
NOT the same as "no plans scheduled", and the web tier renders it as "not synced" rather than an empty plan.
This whole path is unverified against a live account (see ASSUMPTIONS below).

### Local-data-sync surface

The app syncs ALL Garmin data into its own store and serves charts/maps/MCP from it. Three reads feed that:

**`GET /activities?limit=&start=`** — a raw, newest-first page of the activity list, straight from garmy's
`ActivitiesAccessor.raw(limit, start)`. `limit` is `1..100` (default 20, 422 outside), `start ≥ 0` (default 0).
Returns a **JSON array** of raw garmy activity-summary dicts. The web tier paginates the user's ENTIRE history
by walking `start` forward until it gets `[]` back (the exhaustion signal) — nothing sweeps server-side.
`/metrics/activities` (date-filtered, page-capped) is unchanged and still available.

**`GET /activities/{activity_id}/details`** — per-activity time-series streams, laps and summary for route maps,
the GPS heatmap, power curves, HR/power zones, running dynamics and PMC. `activity_id` is an int (non-int → 422).
**Every key is camelCase** — the exact contract `GarminActivityDetails` declares in the web tier (spec 023; this
endpoint used to emit snake_case `heart_rate`, which the web never read, so HR was silently lost on every sync).
Returns:

```jsonc
{
  "activityId": 1000,
  "summary": { /* Garmin summaryDTO */ },
  "gps":  [[lat, lng, elevation?], ...],  // omitted if no coordinates
  "time": [ ... ],                        // SECONDS FROM START, always
  // scalar streams, each omitted when the device did not record it:
  "heartRate": [], "power": [], "cadence": [], "fractionalCadence": [], "speed": [], "elevation": [],
  "grade": [], "temperature": [], "respirationRate": [], "verticalRatio": [], "verticalOscillation": [],
  "groundContactTime": [], "groundContactBalance": [], "strideLength": [], "stamina": [],
  "staminaPotential": [], "performanceCondition": [], "movingDuration": [],
  "moving": [1, 0, ...],                  // derived: 1 = moving, 0 = standing (delta of movingDuration)
  "laps":        [ { "index": 1, "distanceM": 1000, "durationS": 300, ... } ],
  "typedSplits": [ { "index": 1, "type": "RWD_RUN", "durationS": 480, "count": 4 } ]
}
```

Streams Garmin never recorded for the activity are **omitted** rather than returned empty/null — partial data
is fine, and descriptors vary by device and sport so every stream must be treated as optional. Decoded from
Garmin's `metricDescriptors` (column index → metric key) + `activityDetailMetrics` rows; GPS falls back to
`geoPolylineDTO.polyline` when the metric columns carry no lat/lng. `time` is normalised to seconds from start:
a cumulative duration column wins over `directTimestamp`, whose epoch **milliseconds** are rebased and rescaled.
`laps`/`typedSplits` come from `/splits` + `/typedsplits` and are best-effort — a failure there never fails the
request, the keys are simply absent.

**`GET /weight/range?start=&end=`** — all weigh-ins in `[start, end]` from a **single** upstream call
(Garmin's `weight/dateRange`), which is far cheaper than the per-day `body_composition` metric and is what the
Withings-parity weight chart wants. Span capped at 366 days. Returns `{start, end, data}` where `data` is
garmy's raw weigh-in payload. The per-day `/metrics/body_composition[/range]` path still works and covers the
same data one day at a time.

## garmy accessors used

- Activities list / page: `api.metrics.get("activities").raw(limit, start)` (garmy `ActivitiesAccessor`).
- Per-day metrics: `api.metrics.get(name).raw(date)` / `.get(date)`.
- Activity detail + weigh-ins: **`api.connectapi(path)`** directly — garmy 1.0.0 ships no metric accessor for
  either, so the sidecar hits `activity-service` / `weight-service` through garmy's authenticated HTTP client.

## ASSUMPTIONS to verify against a live garmy/Garmin

These are the least-certain calls (all `# ASSUMPTION:` tagged in `app/garmy_client.py`):

- **Activity detail path & sample caps** — `/activity-service/activity/{id}/details?maxChartSize=2000&maxPolylineSize=4000`.
  Verify the path and the exact cap query-param names (they widen the returned resolution; the default truncates
  long rides).
- **Descriptor keys** — the classic `directLatitude/directLongitude/directElevation/directHeartRate/directPower/
  directSpeed/directBikeCadence/directRunCadence/directTimestamp` (+ `sumElapsedDuration`/`sumDuration` for time),
  plus (spec 023) `directRespirationRate`, `directVerticalRatio`, `directVerticalOscillation`,
  `directGroundContactTime`, `directGroundContactBalanceLeft`, `directStrideLength`, `directAirTemperature`,
  `directGrade`, `directAvailableStamina`, `directPotentialStamina`, `directPerformanceCondition`,
  `directFractionalCadence`, `sumMovingDuration`. Confirm the set against a live details payload and add any
  sport-specific keys — an unknown key is ignored, so a wrong guess costs a missing stream, never an error.
- **Lap / split endpoints** — `/activity-service/activity/{id}/splits` (laps under `lapDTOs`) and
  `/activity-service/activity/{id}/typedsplits` (run/walk/stand and interval splits under `splits`). Verify both
  paths and the lap field names; unrecognised fields are dropped rather than surfaced.
- **`directTimestamp` unit** — assumed epoch **milliseconds** (detected: ≥ 1e11 is treated as ms).
- **Summary source** — the base activity endpoint `/activity-service/activity/{id}` carrying the summary under
  `summaryDTO`.
- **Polyline fallback** — `geoPolylineDTO.polyline` is a list of `{lat, lon, altitude}`.
- **Weigh-in endpoint & units** — `/weight-service/weight/dateRange?startDate=&endDate=`; weight is returned in
  **grams** (the web tier converts to kg). Confirm both.
- **Training calendar (spec 024, the least certain of the lot)** —
  `/calendar-service/year/{year}/month/{month}` with a **zero-based** month, answering
  `{"calendarItems": [...]}` where each item carries an `itemType` and a `date`. garmy has no accessor to
  cross-check against and there is no Garmin access in the build environment, so this is a documented guess
  that **fails soft**: a 404/None/unknown shape yields `available: false` and an empty list, and the app then
  says "not synced" instead of "no planned workouts". If it turns out wrong, the fix is one path constant plus
  the `itemType` map. A richer second source (`/workout-service/workouts` + `/workout-service/schedule/{id}`)
  would give per-step targets and can be added without changing the web contract.
- Plus the pre-existing login/token/metric-accessor assumptions already documented in `garmy_client.py`.

## Fallback: one-time browser-assisted token seeding

Headless login is the normal path (`POST /login`), but Garmin occasionally answers a datacentre IP with a
Cloudflare challenge that `curl_cffi`'s impersonation cannot clear — the symptom is a `blocked` classification
on `/login` (HTTP 502, `error.code = "blocked"`) that persists across retries and MFA codes. The account is
fine; only the *first* handshake is refused. Because everything after login runs on the OAuth tokens, seeding
those tokens once from a machine Garmin trusts is enough, and the sidecar keeps working normally afterwards
(it refreshes OAuth2 on its own).

**Procedure (do this on your own laptop, never on a shared host):**

1. On a normal desktop with a browser-grade IP, obtain the token pair with a garmy/garth-style login:

   ```bash
   python -m venv .venv && . .venv/bin/activate && pip install garmy
   python - <<'PY'
   import json
   from garmy import AuthClient
   auth = AuthClient()
   auth.login("you@example.com", "…")        # completes MFA interactively
   tm = auth.token_manager
   print(json.dumps({
       "oauth1": tm.oauth1_token.__dict__,
       "oauth2": tm.oauth2_token.__dict__,
   }))
   PY
   ```

2. Copy the printed JSON to the host running the sidecar and store it **encrypted, per user**, using the same
   Fernet key the sidecar has (`TOKEN_ENCRYPTION_KEY`) and the same opaque user id the web tier sends as
   `X-User-Id`:

   ```bash
   docker compose exec garmin python - <<'PY'
   import json, os
   from app.config import get_settings
   from app.tokens import PostgresTokenStore
   s = get_settings()
   store = PostgresTokenStore(s.database_url, s.token_encryption_key)
   store.ensure_ready()
   store.save(os.environ["USER_ID"], json.loads(os.environ["BUNDLE"]))
   PY
   ```

   Pass `USER_ID` and `BUNDLE` via the environment (or stdin) so the token material never lands in shell
   history, a file, or a log line.

3. Verify with `GET /status` for that `X-User-Id` — it must report `authenticated: true`. From then on the
   normal sync works; `/login` is only needed again if the tokens are revoked.

Rules: the bundle is credential material — never commit it, never paste it into an issue, never log it. The
plaintext e-mail/password are used **once** on the laptop and are never sent to this service. Delete the
temporary venv/output afterwards. If `/diagnostics` keeps reporting `blocked` even after seeding, the block is
on the data path (not just login) and the host's IP itself is the problem.

## Tests

pytest, garmy mocked at the `garmy_client` boundary (fake `AuthClient`/`APIClient` in `tests/conftest.py`,
including a fake `connectapi`). Deterministic, offline, no real Garmin/Postgres. Run exactly as CI does:

```bash
# from services/garmin
docker run --rm -v "$PWD":/app -w /app python:3.12-slim \
  sh -c "pip install -q -r requirements.txt && python -m pytest -q"
```

New coverage lives in `tests/test_backfill.py` (page shape + pagination + exhaustion; detail streams + omission +
non-int id; weight window + range guards; the 400/409 contract for each) plus stream-parser unit tests,
`tests/test_diagnostics.py` (failure classification table, the 429/409/502 error bodies, the range aborting on a
rate limit, and the buffer being bounded / sanitised / per-user / header-gated) and `tests/test_planned.py`
(calendar normalisation, completed items filtered out, honest `available: false`, zero-based month paths).

## Environment

| Var | Default | Purpose |
|-----|---------|---------|
| `TOKEN_ENCRYPTION_KEY` | — (required) | Fernet key encrypting token bundles at rest. |
| `DATABASE_URL` | — (required in prod) | Postgres holding the per-user token ciphertext. |
| `HOST` / `PORT` | `0.0.0.0` / `8081` | Bind address — internal Docker network only. |
| `LOG_LEVEL` | `INFO` | Logging verbosity. |
| `DIAGNOSTICS_BUFFER_SIZE` | `400` | Records kept in the in-memory `/diagnostics` ring buffer. |
