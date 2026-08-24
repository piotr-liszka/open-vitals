# Spec 027 — Sync freshness in the sidebar + 30-minute auto sync with fast return

- **Status:** Closed <!-- Draft → Approved → Closed -->
- **Module:** `apps/web/src/modules/sync/` (+ `lib/server/sync/scheduler.ts`, `lib/server/sync/engine.ts`, `lib/ui/AppShell.svelte`)
- **Owner agent:** module-dev
- **Depends on:** 015 (local store + scheduler), 019 (sync diagnostics)

## Context

The sidebar footer shows only the **build** stamp ("Wersja · 11 sie 2026, 12:53"), which people read as
"my data is from 12:53" — it is not, it is when the code was built. Nothing in the chrome says when the
data was last pulled, there is no way to pull it from wherever you are (you must navigate to `/dane`), and
the background scheduler runs **once a day**, so the app can sit half a day stale without a hint.

This spec puts data freshness next to the version stamp: last sync time, a one-click sync button, and a
live indicator counting down to the next automatic sync. The scheduler drops from 24 h to **30 min**, which
is only affordable with a **fast return**: a two-call probe that ends the tick immediately when nothing
upstream changed, instead of walking every phase against Garmin 48 times a day.

## Requirements (acceptance criteria)

- [x] The sidebar footer shows **"Ostatnia synchronizacja"** with the local-time stamp of the last sync
      (`—`/"nigdy" when there is none), next to the existing `Wersja` block.
- [x] A **quick sync button** sits in that footer: one click starts an incremental sync, shows a running
      state, and updates the stamp when the run finishes — from any page, without navigating to `/dane`.
- [x] An **animated indicator** shows that an automatic sync is pending and when it lands
      ("Auto za ~12 min"); it pulses only while the tab is visible, and respects
      `prefers-reduced-motion` (no pulse, text still correct).
- [x] The scheduler ticks **every 30 minutes** (default; overridable via `SYNC_INTERVAL_MINUTES`).
- [x] **Fast return:** a scheduled tick first probes upstream (newest activity page + today's step
      count). If the probe matches the stored signature, the tick ends **without** a sync run — no run
      row, no phase work, `lastCheckAt` recorded — and the API reports `unchanged`.
- [x] A probe failure (sidecar down, rate limited, no signature yet) **fails open**: the tick syncs
      normally rather than skipping.
- [x] A manual sync is never skipped — fast return applies to scheduled ticks only.
- [x] `GET /api/sync/status` reports freshness: `lastSyncAt`, `lastCheckAt`, `lastResult`, and
      `autoSync: { intervalMs, nextRunAt }`.
- [x] Unit + API-integration tests pass (no e2e)
- [x] Built only from `lib/ui` components + design tokens
- [x] No secrets logged or committed

## API contract

`apps/web/src/modules/sync/sync.types.ts`

```
GET /api/sync/status?runId=
  res: {
    run: SyncRun | null,
    progress: number,
    lastSyncAt: string | null,     // ISO — last run that actually wrote data
    lastCheckAt: string | null,    // ISO — last tick, including skipped ones
    lastResult: 'synced' | 'unchanged' | null,
    autoSync: { intervalMs: number, nextRunAt: string | null } | null  // null when no scheduler (dev/mock)
  }
  errors: 401 → { error: 'unauthorized' }

POST /api/sync   (unchanged) — quick button uses kind=incremental
```

Freshness fields come from the per-user `SyncState` (`cursor.lastCheckAt` / `cursor.lastResult` +
`lastSyncAt`); `autoSync` comes from the scheduler handle on the container.

## UI

- `lib/ui/AppShell.svelte` gains an optional `footer?: Snippet`, rendered **above** the build stamp in
  the sidebar (same hairline-separated rhythm, tokens only).
- `lib/ui/IconButton.svelte` — NEW shared component: the square, icon-only action the quick-sync
  button needs (`Button` is built around a text label). Also gains a `refresh` glyph in `lib/ui/icons`.
- `modules/sync/SyncFooter.svelte` — owns the fetch/poll state, composes `IconButton` (`size="sm"`,
  `loading` while a run is in flight) and a token-driven pulse dot. Polls `/api/sync/status` every 60 s while
  visible, every 2 s while a run is in flight, and on re-focus. Renders nothing when unauthenticated
  (401) so the landing/login chrome is unaffected.
- States: never synced (`nigdy`), idle with stamp, running (progress % + disabled button), unchanged
  (stamp + "bez zmian" hint), error (tone-danger hint, button stays usable).
- Every AppShell page passes the footer snippet; light + dark come from tokens.

## Design / implementation notes

- **Scheduler** (`lib/server/sync/scheduler.ts`): `startSyncScheduler` replaces `startDailyScheduler`,
  default interval 30 min from `Config.syncIntervalMinutes` (env `SYNC_INTERVAL_MINUTES`). The returned
  handle exposes `nextRunAt(): Date` and `intervalMs`, and is stored on the container so the status API
  can report it. `runScheduledSync` stays pure/awaitable and now calls `syncEngine.syncIfChanged`.
- **Fast return** (`lib/server/sync/engine.ts`): new `SyncEngine.syncIfChanged(userId, opts)`:
  1. `source.listActivitiesPage(PROBE_ACTIVITIES, 0)` + `source.getMetricRange('steps', today, today)`.
  2. Signature = newest activity id + its start time + probe page length + today's step count + `today`.
     The day key is part of it, so a day rollover always syncs.
  3. Equal to `cursor.probeSignature` ⇒ skip: write `lastCheckAt`/`lastResult: 'unchanged'`, return `null`.
  4. Otherwise run `syncUser`, then store the fresh signature.
  Probe errors ⇒ fall through to a normal sync (fail open). Nothing about the probe is logged beyond
  counts/ids (no payloads).
- Ports & adapters unchanged: the engine keeps taking `store`, `sourceFor`, `clock`, `logger`, `random`;
  the scheduler keeps taking `users`, `syncEngine`, `logger`.
- Edge cases: sidecar down (probe fails → normal sync → run records the failure); user with no
  activities at all (probe signature still defined by steps + day); process restart (next tick is
  interval-from-start, and `nextRunAt` reports it honestly).

## Test plan

- **Unit (scheduler):** ticks call `syncIfChanged` per user; a per-user throw is contained; `nextRunAt`
  advances by the interval; `intervalMs` honours config.
- **Unit (engine fast return):** unchanged signature ⇒ no run row created, `lastCheckAt` written,
  returns `null`; changed activity ⇒ full run; changed step count ⇒ full run; day rollover ⇒ full run;
  probe throw ⇒ full run; first-ever tick (no stored signature) ⇒ full run.
- **API integration (mock adapters):** `GET /api/sync/status` returns the freshness fields + `autoSync`
  for the signed-in user; 401 without a session; another user's run never leaks.
- **Component:** `SyncFooter` renders "nigdy" with no sync, the stamp when given one, disables the
  button while running, and hides itself on 401.

## Closeout

- Commits: `e2fecf8` — feat: sync freshness in the sidebar, honest start-page trends, tile-safe readouts (specs 027-029)
- Notes / follow-ups: A permanently disconnected account now records a failed run per tick (48/day instead of 1)
  because the probe fails open — noisy but honest, and the sidebar surfaces it. If it becomes a
  nuisance, classify `not_connected` as "skip the tick" rather than "sync anyway".
  The probe signature is captured BEFORE the run, so a change landing mid-run is picked up by the
  next tick rather than that one.
