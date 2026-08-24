# Spec 019 — Sync diagnostics + history depth

- **Status:** Approved <!-- Draft → Approved → Closed -->
- **Module:** `services/garmin/`, `apps/web/src/lib/server/{garmin,sync,store,db}`, `apps/web/src/modules/sync/`
- **Owner agent:** garmin-integrator
- **Depends on:** 015 (local data store), 018 (local dates)

## Context

Two user complaints, one root cause each.

1. *"Display more detailed log from Python in /dane."* The sidecar logged only to stdout, and the web
   adapter collapsed **every** transport failure — a 45 s timeout, a Cloudflare block, a 429, an
   expired token, a dead container — into a bare `GarminUnavailableError`. The sync engine then
   recorded `err.name`, so the richest sentence /dane could ever print was
   `… nie powiodło się (GarminUnavailableError)`. Making the log box bigger would have changed
   nothing: the reason never crossed the process boundary.
2. *"Do we have older data?"* Activities backfill to full history, but daily health metrics were
   capped at 365 days, the walk stopped after 2 consecutive empty 31-day chunks (so any real gap in
   wearing the watch truncated everything older), and the cursor was reset to `today` at the end of
   **every** run — so an incremental sync only ever re-pulled ~10 days and history never deepened.
   The user chose: **backfill health metrics to the same horizon as activities, and make sure history
   is never silently truncated.**

A third, quieter bug fell out of the same area: `coverage()` in the pg adapter took `min(day)` over
all `synced_metric_days` rows while counting `present_days` only where `data IS NOT NULL`. The engine
writes a row for every day it *checked*, so "Dane od" named a day holding nothing — and because the
in-memory fake filtered nulls, the two adapters disagreed and every test passed while prod lied.

## Requirements (acceptance criteria)

- [x] The sidecar classifies upstream failures (`rate_limited`, `token_rejected`, `blocked`,
      `timeout`, `not_found`, `upstream_error`) and returns them as a structured `error` object
      alongside the existing human `detail` string, with an appropriate HTTP status (429 / 409 / 502 / 504).
- [x] The classification is derived from the exception's TYPE and HTTP status only — never its message —
      so no upstream text can be echoed into a response or a log.
- [x] An arbitrary garmy exception can no longer escape as an unclassified HTTP 500.
- [x] The sidecar exposes `GET /diagnostics` — a bounded, in-memory, **per-user-scoped**, sanitised
      tail of its own log records. Internal-only; never reachable from the LAN.
- [x] The web adapter parses the structured error into a typed `GarminFailure`
      (`code` / `retryable` / `status` / `upstreamStatus` / `endpoint` / `reason`) carried on the thrown error.
- [x] The sync engine records that classification per phase and per log line (`phase`, `code`,
      `retryable`, `metric`, `day`), so /dane can tell "Garmin rate-limited me" from "my token
      expired" from "the sidecar was down".
- [x] `/dane` renders the run log with severity filter, timestamp, phase, metric/day and the real
      reason, plus an on-demand panel showing the sidecar's own log tail.
- [x] Daily-metric history walks backwards from a **persisted frontier**, bounded per run, and keeps
      deepening on every sync (including the nightly scheduled one) until history runs out.
- [x] The walk survives a cancel or a restart: the frontier is persisted after every chunk.
- [x] The freshness window reaches back to the last run (not just `incrementalDays` before today), so
      downtime leaves no permanent hole — the backwards walk only ever covers days older than the frontier.
- [x] The empty-chunk heuristic no longer truncates across a real gap in the data (12 consecutive
      empty chunks ≈ 1 year, versus the old 2 months).
- [x] `/dane` shows backfill progress ("uzupełniono do …, zostało ~N dni").
- [x] `coverage()` reports `firstDay`/`lastDay`/`presentDays` over days that actually hold data, in
      **both** adapters, guarded by a shared contract test.
- [x] "Today" in the engine comes from `$lib/date` in the app timezone, not UTC.
- [x] Unit + API-integration tests pass (no e2e).
- [x] Built only from `lib/ui` components + design tokens.
- [x] No secrets logged or committed.

## API contract

```
# sidecar (internal only)
GET /diagnostics?limit=1..400        X-User-Id: <uid>
  res 200: { entries: [{ t: number, level: string, logger: string, msg: string,
                         code?: string, endpoint?: string }], capacity: number }
  errors: 400 (missing X-User-Id)

# every Garmin-touching sidecar route, on failure
  res 4xx/5xx: { detail: string,
                 error: { code, reason, retryable, endpoint?, upstreamStatus? } }
  429 rate_limited · 409 token_rejected/not_connected · 504 timeout · 502 everything else

# web (session-authenticated)
GET /api/sync/diagnostics?limit=      res: SidecarLogResponse
  { available: boolean, entries: SidecarLogEntry[], reason?: string, status?: number }
```

Types: `apps/web/src/lib/server/interfaces.ts` (`GarminFailure`, `GarminFailureCode`,
`SidecarLogEntry`), `apps/web/src/modules/sync/sync.types.ts` (`SidecarLogResponse`),
`apps/web/src/lib/server/store/types.ts` (`SyncLogEntry`, `SyncDetail`, `SyncPhase`).

## UI

`/dane` (`modules/sync/DataView.svelte`) — `Card`, `Badge`, `Banner`, `Button`, `ProgressBar`,
`StatTile`, `FilterChips`. States: running (progress + live log), succeeded (per-phase rows +
backfill progress line), failed (classified reason on the phase row), sidecar log unavailable
(warning banner naming the classification), empty filter selection. Colours come from tokens
(`--color-danger`, `--lane-amber`, `--color-text-*`), so light and dark both work.

## Design / implementation notes

**Diagnostic channel (three hops).**
1. `services/garmin/app/errors.py::classify_upstream` turns any garmy/transport exception into a
   `GarminUpstreamError` carrying `code`/`reason`/`endpoint`/`retryable`, using only the exception's
   class name and any HTTP status inside it. `MetricsService._upstream()` wraps every garmy call, so
   nothing escapes unclassified.
2. `app/diagnostics.py` mirrors this service's log records into a bounded ring buffer, tagged with the
   request's user scope (a contextvar set by an HTTP **middleware** — a FastAPI sync dependency runs
   in a worker thread, where a contextvar write would not propagate back). Messages are sanitised
   (e-mail-shaped and long token-shaped substrings → `***`, truncated); `snapshot()` returns only the
   asking user's records and strips the scope tag on the way out.
3. `http-adapter.ts::failureOf` parses the `error` object (falling back to a status-derived code for
   an older sidecar image) and throws `GarminNotAuthenticatedError` for `token_rejected`/`not_connected`,
   `GarminUnavailableError` otherwise. The engine's `phaseFailure()` maps the code to Polish text and
   stores code + retryability on both the phase detail and the log line.

**Depth.** `sync_state.cursor` now holds `metricsFrom` (freshness) *and* `metricsBackfilledTo` +
`metricsComplete` + `metricsTarget` (depth). Each run pulls the freshness window, then up to
`backfillChunksPerRun` (8 full / 6 incremental) chunks of 31 days walking back from the frontier,
persisting the frontier after **every** chunk. The walk stops at the 12-year floor, at an explicitly
requested depth, or after 12 consecutive empty chunks. The *reported* target (first activity − 90 days)
drives the progress readout only — the walk is allowed to go past it, because stopping at a guessed
horizon is precisely the silent truncation being fixed here.

**Edge cases:** MFA/not-connected still aborts the whole run (now with a classified reason);
cancellation keeps everything already written plus the frontier; a rate limit inside a range aborts
that range in the sidecar rather than grinding through 30 more doomed day-fetches.

**Migration:** none required for this spec (`sync_state.cursor` is jsonb; unknown keys are additive).
A pre-019 cursor simply has no frontier, so the first run starts the walk from the freshness window.

## Test plan

- **Unit (engine):** history deepens across runs; resumes from the frontier without re-walking; walks
  through a 3-month gap; reports `backfillTo`/`remainingDays`; completes at an explicit depth; keeps
  the frontier on cancel; records `rate_limited` / `sidecar_unreachable` / `token_rejected` distinctly;
  no credential-shaped value in the log.
- **Unit (adapter):** structured error passthrough; token_rejected → not-authenticated; unreachable vs
  timeout; fallback for an old sidecar; endpoint never carries a query string; sidecar log parsing.
- **Contract (store):** `coverage-contract.test.ts` runs the same assertions against the memory fake
  and (with `TEST_DATABASE_URL`) the pg adapter — null-only days are never `firstDay`, footprint counts
  stored rows, per-user isolation.
- **API integration:** `getSidecarLog` returns entries, reports `unsupported` for a mock source, turns
  an unreachable sidecar into a diagnosis, clamps the requested size.
- **Sidecar (pytest):** classification table; 429/409/502 responses with the `error` object; range
  aborts on a rate limit; the diagnostics buffer is bounded, sanitised, per-user, and header-gated.

## Closeout

- Commits: _pending_
- Notes / follow-ups: `dev-mock` does not implement `getDiagnostics`, so `/dane` reports
  `available: false, reason: unsupported` under `GARMIN_ADAPTER=mock` — correct, and cheap to add
  later if the mock ever needs to demo the panel.
