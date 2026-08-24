# Spec 050 — Authored workouts (MCP) + push to the Garmin calendar

- **Status:** Approved <!-- Draft → Approved → Closed -->
- **Module:** `apps/web/src/lib/mcp/`, `apps/web/src/lib/server/{store,sync,garmin,interfaces}`, `services/garmin/`
- **Owner agent:** garmin-integrator (sidecar + push) · module-dev (store, sync phase, MCP tools)
- **Depends on:** 015 (local store) · 019 (sync diagnostics) · 022 (start-page timeline) · 024 (planned-workout read) · 020 (`lib/sport-labels`)

## Context

Everything in this system is read-only: the sidecar's only non-GET route is `POST /login`, and spec 024
*reads* the Garmin training calendar but never writes to it. The athlete wants the opposite direction —
compose a session in conversation ("4×8 min at threshold on the bike Thursday"), have it stored locally,
and have it appear on the watch. Sessions must cover several sports (run, ride, walk, swim, strength),
not just one, and a stored session is later going to be **matched against the activity that fulfilled it**
so planned and actual can be compared — so its identity and shape must survive that follow-up (spec 052).

The write path itself is as unverified as spec 024's read: garmy 1.0.0 exposes no workout accessor, so
this goes through the same `APIClient.connectapi` escape hatch — which does accept
`method="POST", json=…` ([garmy/core/client.py:339](../services/garmin/.venv/lib/python3.12/site-packages/garmy/core/client.py:339)).
Because a bad push is visible on the user's watch, the local store is the source of truth, the push is a
**separate, retryable sync phase**, and delete-upstream ships in the same slice as create.

## Requirements (acceptance criteria)

**Local authoring (source of truth)**

- [x] `LocalStore` gains `createWorkout` / `listWorkouts` / `getWorkout` / `updateWorkout` /
      `deleteWorkout`, per user, implemented in **both** the pg adapter and the in-memory fake.
- [x] A workout is stored with a sport-agnostic step tree: ordered steps with `kind`
      (`warmup`/`work`/`recovery`/`rest`/`cooldown`/`repeat`), a duration (`time`/`distance`/`lap`/`calories`)
      and an optional target (`pace`/`speed`/`power`/`hr`/`cadence`/`none`) with a low/high range.
      `repeat` steps nest child steps, so `5 × (1 km @ pace + 2 min easy)` is one node.
- [x] Sport is a Garmin `typeKey` validated against `SPORT_LABELS` (spec 020) — `running`, `cycling`,
      `walking`, `lap_swimming`, `strength_training`, … — and the allowed **target types are checked per
      sport family**: no power target on a walk, no pace target on a strength session.
- [x] Each workout carries a stable local `id`, its scheduled `day` (+ optional `time`), and a nullable
      `matchedActivityId` column reserved for spec 052. Nothing in this spec populates it.
- [x] Deleting a locally-authored workout that was already pushed also removes it upstream (or records
      the failure) — a local delete never silently leaves a session on the watch.

**MCP (the authoring surface)**

- [x] MCP gains `create_workout`, `list_workouts`, `update_workout`, `delete_workout`, each validated with
      zod and each scoped to the resolved user.
- [x] `createMcpServer` receives the `LocalStore` + `userId` alongside the `GarminService`; existing
      read tools are unchanged.
- [x] The MCP server `instructions` string no longer claims "Read-only access" — it states which tools write.
- [x] Write tools are refused with a clear error unless the user has accepted a **new consent feature**
      (`workout_write`); the read tools stay available without it.
- [x] `create_workout` accepts either an explicit step tree or a named preset (`intervals`, `tempo`,
      `long`, `easy`, `ftp_test`) parameterised by sport + duration/distance, so a session can be created
      in one call.

**Push to Garmin**

- [x] The sidecar exposes `POST /workouts`, `POST /workouts/{workout_id}/schedule`,
      `DELETE /workouts/{workout_id}`, mapping our step tree onto Garmin's workout model
      (`sportType` + `workoutSegments` + `executableStepDTO`/`repeatGroupDTO`).
- [x] Every sidecar write is best-effort and **honest**: a 404/unsupported endpoint yields
      `supported: false`, never a pretended success and never an exception; a rejected payload returns
      the upstream status.
- [x] A new sync phase (`workoutPush`, after `planned`) pushes `pending` rows, records
      `garminWorkoutId` + `garminScheduleId`, and moves the row to `pushed`. Failures become
      `failed` + a retry on the next tick; unsupported endpoints become `unsupported` and stop retrying.
- [x] Pushing is **idempotent**: a row that already has a `garminWorkoutId` is never created twice.
- [x] The spec-024 calendar read does not duplicate our own sessions — a planned event whose Garmin id
      matches a local `garminWorkoutId` is folded into the local row, not listed twice.
- [x] `GARMIN_WORKOUT_PUSH` (default `off`) gates the phase, so the unverified endpoints can be enabled
      per deployment after a real-account check.
- [x] Unit + API-integration tests pass (no e2e); sidecar pytest covers the mapping and every failure mode.
- [x] Built only from `lib/ui` components + design tokens (the two small UI touches below).
- [x] No secrets logged or committed — the sync log records **counts and states only**, never workout
      titles, notes or step targets (same rule spec 024 set).

## API contract

```
# MCP tools (lib/mcp/workout-tools.ts — args validated with zod)
create_workout   { sport, day, time?, title, steps? , preset?, note? }
                 → { id, sport, day, title, stepCount, pushState: "pending" }
list_workouts    { from?, to? }        → { workouts: [ { id, sport, day, title, pushState, garminWorkoutId? } ] }
update_workout   { id, ...partial }    → same shape as create   (resets pushState to "pending")
delete_workout   { id }                → { id, deleted: true, upstreamRemoved: boolean }
errors: unknown id → isError text · missing workout_write consent → isError text · sidecar down → isError text

# sidecar (internal only)                                        X-User-Id: <uid>
POST   /workouts                  req: { sport, title, steps: [...] }
                                  res 200: { supported: true, workoutId }  | { supported: false }
POST   /workouts/{id}/schedule    req: { day: "YYYY-MM-DD" }
                                  res 200: { supported: true, scheduleId } | { supported: false }
DELETE /workouts/{id}             res 200: { supported: boolean, removed: boolean }
errors: 409 (not connected) · 422 (bad payload/date) · 502 (upstream)
```

New/changed types: `AuthoredWorkout`, `WorkoutStep`, `WorkoutTarget`, `WorkoutPushState` in
`lib/server/store/types.ts`; `createWorkout`/`scheduleWorkout`/`deleteWorkout` as **optional** members of
`GarminSource` in `lib/server/interfaces.ts` (mirroring how `getPlannedEvents?` is optional, so the mock
and dev adapters stay valid); `SyncStateDetail.workoutPush` in the sync contract.

## UI

Minimal — the builder UI is deliberately a later spec.

- `/dane` gains one phase row for the push ("Wysyłka treningów: N wysłanych / N oczekuje / niewspierane"),
  reusing the existing phase-row pattern from spec 019.
- The start-page timeline marks a locally-authored session with a state badge (oczekuje / w Garminie /
  błąd) via an existing `lib/ui` badge, so an unpushed plan is never mistaken for one on the watch.
- Light + dark come from tokens; no new component unless the badge variant is missing, in which case it
  is added to `lib/ui`.

## Design / implementation notes

- **Store is authoritative.** Garmin is a *projection* of local rows. That inverts spec 024 (where Garmin
  is authoritative and the window is replaced wholesale), so the two must not fight: the 024 replace only
  ever touches rows with `source = 'garmin'`, and locally authored rows live in their own table.
- **Ports & adapters (§4).** MCP tools take the store as an injected dependency; the sidecar write goes
  behind the `GarminSource` port with a mock adapter that records calls, so tests and `make dev` stay
  offline. No `fetch`/`Date.now()` inside handlers.
- **Sport → Garmin mapping** lives in one table next to the sidecar mapper: `running` → `sportType`
  running, `cycling` → cycling, `lap_swimming` → swimming, `walking` → walking, `strength_training` →
  strength. A sport with no Garmin workout equivalent stays local-only with `pushState: 'unsupported'`.
- **Unverified upstream.** `/workout-service/workout` (create), `/workout-service/schedule/{id}` (schedule)
  and `DELETE /workout-service/workout/{id}` are the candidates spec 024's closeout already named. Every
  uncertain call gets an `# ASSUMPTION:` tag, as in `garmy_client.py` today. **Verification order matters:
  land the sidecar + one throwaway create/delete against the real account before the MCP tools go in** —
  if the path is wrong, the fix is a path constant, not a redesign.
- **Storage:** `authored_workouts (id, user_id, day, time_local, sport, title, steps jsonb, note,
  push_state, push_error, garmin_workout_id, garmin_schedule_id, matched_activity_id, created_at,
  updated_at)`, PK `id`, index on `(user_id, day)`, unique on `(user_id, garmin_workout_id)`, cascading on
  user delete. `steps` is JSONB because the tree is nested and read whole — never queried into.
- **Forward hook for spec 052:** `matched_activity_id` plus the stable `(user_id, day, sport)` triple is
  everything a planned-vs-actual matcher needs; the compare logic, tolerance windows and the UI are that
  spec's, not this one's.
- **Edge cases:** sidecar down → phase `failed`, rows stay `pending`; Garmin not connected → 409, phase
  skipped with a reason; a workout edited after a successful push → re-push as an update (delete + create
  if `PUT` proves unavailable); a day in the past → allowed locally, not scheduled upstream.

## Test plan

- **Unit (store contract):** authored workouts round-trip in both adapters; per-user isolation; delete
  removes the row; push-state transitions; the spec-024 window replace leaves authored rows untouched.
- **Unit (validation):** step tree validated (nested repeats, bad duration type rejected); per-sport target
  rules (power on a walk rejected, pace on strength rejected); presets expand to the expected step counts;
  unknown sport key rejected.
- **Unit (sync engine):** pending rows are pushed and marked with the returned ids; a failing push retries
  next tick; an `unsupported` response stops retrying; a row with a `garminWorkoutId` is never re-created;
  a source without `createWorkout` skips the phase entirely.
- **MCP tools:** each tool invoked with a mock store + mock `GarminService`, asserting content shape;
  missing `workout-write` consent returns `isError`; a tool never returns another user's workout.
- **API integration (mock adapters):** the consent endpoint gates `workout-write`; `/dane` renders the new
  phase row for pushed / pending / unsupported.
- **Sidecar (pytest):** our step tree maps to the expected Garmin payload (including a nested repeat group
  and each sport); a 404 endpoint yields `supported: false`; a 4xx upstream propagates its status; range +
  auth + `X-User-Id` validation; delete of an unknown id is not fatal.

## Closeout

- Commits: _pending_ (implemented on `main`, not yet committed)
- **Verification still outstanding — the one step I cannot do:** `GARMIN_WORKOUT_PUSH` ships `off`, so
  nothing has written to a real Garmin account yet. Run
  `USER_ID=<uid> scripts/verify-workout-push.sh` against a live stack (it creates one throwaway
  workout, schedules it tomorrow, waits for you to look at Garmin Connect, then deletes it). If the
  paths are wrong, the fix is the three constants at the top of `services/garmin/app/workouts.py`;
  every mapping and failure mode around them is already tested.
- Known limitation: the timeline's forward half spans today+1…+N, so a session authored for TODAY
  shows in `list_workouts` but not on the start-page timeline. Widening the forward window means
  touching the horizontal axis' day columns — its own small change.
- Notes / follow-ups:
  - **Spec 052** — match an authored workout to the activity that fulfilled it and compare planned vs
    actual (duration, distance, per-step target adherence). `authored_workouts.matched_activity_id`
    is already in the schema and stays null until then.
  - Spec 024's calendar read is still not wired into the timeline (`plannedWorkouts` is injected
    nowhere), so GARMIN's own plans remain invisible; authored sessions now render regardless. Wiring
    it needs a source of truth for "was the calendar readable this sync" — the last run's
    `detail.planned.available`.
  - A builder UI (`modules/workout-builder/`) if authoring by conversation proves insufficient.
  - A reusable workout **library** (author once, schedule many times) if repeating sessions becomes common;
    today a repeat is a new row with the same steps.
