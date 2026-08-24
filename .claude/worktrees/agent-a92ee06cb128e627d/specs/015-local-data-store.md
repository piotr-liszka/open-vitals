# Spec 015 — Local data store, sync engine & scheduler

Status: **Closed** (backbone) · 2026-08-09

## Context

The app was a live pass-through: every dashboard/analytics/insights/MCP read hit the sidecar → Garmin
in real time (heavy, 31-day-capped, no history). This spec inverts that: **all Garmin data is synced
into a local per-user store, and every read path serves local data.** Foundation for charts, maps,
activities, dashboards and local MCP (specs 016+). Decisions confirmed with the user: backfill **all
available history**; sync **daily + on demand + a login-time prompt**; map tiles via OSM/CARTO.

## What shipped

- **LocalStore port** (`lib/server/store/types.ts`) + Postgres adapter (`store/pg.ts`) + in-memory
  fake (`store/memory.ts`, contract-tested). Tables (`db/index.ts`): `synced_metric_days`,
  `synced_activities`, `synced_activity_streams`, `synced_weight`, `sync_state`, `sync_runs`. All
  per-user, cascade on delete, idempotent upserts.
- **Composite read service** (`store/local-garmin.ts`): `getMetric`/`getMetricRange` resolve from the
  store; `login`/`getStatus`/`disconnect` pass through to the sidecar. `container.garminFor` returns
  this, so analytics/insights/MCP read local data **unchanged**. `container.garminSyncFor` returns the
  raw sidecar `GarminSyncSource` (the only Garmin-touching path) used solely by the sync engine.
- **Sidecar (garmin-integrator):** new `GET /activities?limit=&start=` (full-history paging),
  `GET /activities/{id}/details` (GPS/HR/power/… streams, absent ones omitted),
  `GET /weight/range` (grams → web converts). Web adapters: `GarminSyncSource` on the http-adapter +
  dev-mock. ASSUMPTIONS tagged in `services/garmin/app/garmy_client.py` need live-garmy verification.
- **Sync engine** (`sync/engine.ts`): `full` backfill (walk metrics back in ≤31-day chunks until
  history runs dry / 5y floor; page all activities; fetch streams for GPS/power activities; pull
  weigh-ins) and `incremental` top-up; progress tracked in `sync_runs` (done/total/step).
- **Scheduler** (`sync/scheduler.ts`): daily incremental sync for every user; started once in prod
  from hooks. On-demand: `POST /api/sync` (non-blocking, coalesces in-flight), `GET /api/sync/status`
  (progress polling), `GET /api/data/coverage` ("how much data").
- **UI:** `lib/ui/ProgressBar.svelte`; `/data` page ("Twoje dane") with coverage tiles, per-metric
  coverage table, live progress bar, Sync-now / Full-sync, and a login/stale refresh prompt.
  Centralized nav (`lib/nav.ts` + `lib/ui/NavLinks.svelte`). Shared map (`lib/ui/LeafletMap.svelte`,
  bundled Leaflet, CSP-safe).

## Tests

Web: 230 green (store contract, sync engine full/incremental/not-connected/idempotent, sync API
non-blocking + coalescing + isolation, scheduler). `pnpm run check` clean. Sidecar: pytest green.

## Follow-ups

- MCP: add local-only tools (activities, coverage, weight, training-load) — see spec 017+.
- Login prompt is stale-based; a per-login cookie is a later refinement.
- Verify the sidecar garmy ASSUMPTIONS against a live account.
