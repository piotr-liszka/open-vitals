# Spec 024 — Planned workouts (Garmin training calendar)

- **Status:** Approved <!-- Draft → Approved → Closed -->
- **Module:** `services/garmin/`, `apps/web/src/lib/server/{garmin,sync,store,db}`
- **Owner agent:** garmin-integrator
- **Depends on:** 015 (local data store), 019 (sync diagnostics), 022 (start-page timeline)

## Context

The start-page timeline (spec 022) has a forward half: *"what is in the next 7 days"*. Its
`PlannedEvent[]` contract exists but returns empty in production, because nothing in this system had
ever called Garmin's calendar. garmy 1.0.0 ships **no** calendar or workout accessor — its metric
modules stop at activities/body_battery/…/training_readiness — so the only way in is the sidecar's
existing `APIClient.connectapi(path)` escape hatch, against endpoints we cannot verify offline.

This spec adds the fetch, the sync phase and the store table, and is deliberately explicit about the
uncertainty: if Garmin serves nothing for this account, the feed must say **"not synced"**, never
"you have no plans".

## Requirements (acceptance criteria)

- [x] The sidecar exposes `GET /calendar/planned?start=&end=` returning normalised planned items.
- [x] The read is best-effort: a missing/404/garbage endpoint yields `available: false` with an empty
      list, never an exception and never an invented plan.
- [x] Completed calendar items (an activity that already happened) are filtered out — only future
      *plans* are returned.
- [x] The web adapter parses the feed into `GarminPlannedFeed`, dropping malformed rows.
- [x] The sync engine pulls a rolling window (yesterday … +28 days) and **replaces** it in the store,
      so a plan deleted in Garmin disappears locally too.
- [x] The store exposes `replacePlannedEvents` / `listPlannedEvents`, per user, in both adapters.
- [x] `/dane` shows the phase outcome, distinguishing "no calendar for this account" from a failure.
- [x] Unit + API-integration tests pass (no e2e).
- [x] No secrets logged or committed (counts only — never plan titles or notes).

## API contract

```
# sidecar (internal only)
GET /calendar/planned?start=YYYY-MM-DD&end=YYYY-MM-DD    X-User-Id: <uid>
  res 200: { start, end, available: boolean, source: "calendar-service",
             events: [{ id, day, time|null, kind: "workout"|"race"|"note", title,
                        sport|null, description|null, estimatedDurationS|null,
                        estimatedDistanceM|null, targetLoad|null }] }
  errors: 400 (bad/too-wide range) · 409 (not connected) · 422 (bad date) · 502 (upstream)
```

Web types: `GarminPlannedEvent` / `GarminPlannedFeed` (`lib/server/interfaces.ts`), `PlannedEvent`
(`lib/server/store/types.ts`). The timeline slice maps the store rows onto its own `PlannedEvent`
contract in `modules/timeline/timeline.types.ts` — it owns that mapping; this spec owns everything
below it.

## UI

N/A directly. `/dane` gains one phase row ("Plan treningowy: N zaplanowanych" / "kalendarz
niedostępny w Garminie"). The start-page timeline consumes `store.listPlannedEvents(userId, from, to)`
and sets `PlannedFeed.status` to `ok` / `empty` / `not_synced` accordingly.

## Design / implementation notes

`garmy_client.fetch_planned_events` walks the calendar **month by month** over the window and calls
`/calendar-service/year/{year}/month/{month}` — where `month` is **zero-based** (January = 0), the
quirk every third-party Garmin client documents. Each `calendarItems` entry is classified by
`itemType`: `workout`/`trainingplan` → `workout`, `race`/`event` → `race`, `note`/`goal` → `note`,
while `activity`/`multisportactivity`/`personalrecord`/`challenge` are history and dropped. Field
names are probed across several plausible spellings, and any item without a usable date is skipped.

**This path is UNVERIFIED against a live Garmin account** — there is no Garmin access in the build
environment, and garmy exposes nothing to confirm it against. Every uncertain call is `# ASSUMPTION:`
tagged in `garmy_client.py`. The failure mode is therefore designed to be honest rather than clever:
`available: false` propagates all the way to `PlannedFeed.status = 'not_synced'`.

Storage: `synced_planned_events (user_id, event_id, day, time_local, kind, title, sport, description,
duration_s, distance_m, target_load, source, synced_at)`, PK `(user_id, event_id)`, index on
`(user_id, day)`, cascading on user delete. The engine rewrites the whole window in one transaction.

## Test plan

- **Sidecar (pytest):** items normalised (workout + race), completed activities filtered, an empty
  month reported as `available: true` with no events, an unavailable/erroring endpoint reported as
  `available: false`, range + auth + `X-User-Id` validation, and a guard that the month path is
  zero-based.
- **Unit (adapter):** feed normalisation drops malformed rows; `available: false` is preserved.
- **Unit (engine):** the window is stored; a second sync with no plans clears it; an unavailable
  calendar stores nothing; a source without `getPlannedEvents` skips the phase entirely.
- **Contract (store):** planned events round-trip and a window replace deletes what is gone.

## Closeout

- Commits: _pending_
- Notes / follow-ups: if `/calendar-service` turns out to be wrong for a real account, the fix is one
  path constant plus the item-type map — the sidecar test fixture already models the payload shape.
  A second candidate (`/workout-service/workouts`, scheduled via `/workout-service/schedule/{id}`)
  would give richer step-by-step targets and can be added as a second source without changing the
  store or the web contract.
