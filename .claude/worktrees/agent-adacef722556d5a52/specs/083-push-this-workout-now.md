# Spec 083 — Wyślij ten trening: push na żądanie, zamiast w tle

- **Status:** Closed <!-- Draft → Approved → Closed -->
- **Module:** `apps/web/src/modules/workouts/` + `lib/server/sync/` + `lib/server/features/`
- **Owner agent:** module-dev
- **Depends on:** 050 (authored workouts + push), 066 (planner), 071 (feature switches)

## Context

From the athlete, August 2026: *"nie chciałbym żeby synchronizacja działa się automatycznie […] dodaj
przycisk który wyśle ten konkretny trening na Garmina (jeśli nie istnieje) i przypisze do dnia (jeśli
go tam nie ma)."* Today the only way a session reaches the watch is the background sync's push phase:
the athlete writes a workout, it sits `W kolejce`, and something happens up to twenty minutes later.
Wanting to press a button and know is a reasonable thing to want.

There is a structural problem behind the request. `workout_write` is a **single** switch doing two
different jobs — "this app may write to my Garmin account at all" and "push everything automatically
on every sync" ([registry.ts:23](../apps/web/src/lib/server/features/registry.ts)). Turning off the
automatic behaviour today also turns off creating a workout locally, which is why the switch cannot
answer the request on its own. Splitting it is most of this spec; the button is the easy half.

## Requirements (acceptance criteria)

### Split the switch

- [x] A new switch `workout_auto_push` — "push planned sessions to Garmin automatically during sync" —
      `defaultEnabled: true`, read by the sync engine's push phase and by nothing else.
- [x] `workout_write` keeps its id (existing rows must keep meaning what they meant) but is retitled
      and re-summarised: it is now permission to write at all, not a statement about automation. Its
      current title literally says *"Automatyczny zapis treningów"*, which becomes false here.
- [x] The engine's push phase requires **both**. The manual push requires only `workout_write` — that
      is the entire point: automation off, button still works.
- [x] Both switches appear in Settings with copy that makes the difference obvious. A registry entry
      with no consumer is banned by the registry's own doc comment, and two switches whose difference
      nobody can state are the same failure one step later.

### One push path, two callers

- [x] The per-workout body of the engine's push loop ([engine.ts:587](../apps/web/src/lib/server/sync/engine.ts))
      is extracted into `pushWorkout(deps, userId, workout)` — create when there is no
      `garminWorkoutId`, then schedule — returning a discriminated result
      (`pushed` | `unsupported` | `failed`) rather than writing UI strings.
- [x] The sync engine calls it in its loop; the new endpoint calls it once. Neither keeps its own copy
      of the idempotency rule. Two implementations of "have we already created this?" is how a session
      ends up in the library twice.
- [x] Idempotency is unchanged and load-bearing: an existing `garminWorkoutId` is **never** re-created,
      only its missing schedule is filled in. Pressing the button twice does nothing the second time.
- [x] It schedules the workout on **the day it sits on in the planner**, not on today. A session
      written for Wednesday belongs on Wednesday whichever day the button was pressed.

### The endpoint

- [x] `POST /api/workouts/[id]/push` → the module's handler, returning the updated
      `AuthoredWorkoutView` so the panel re-renders from the server's truth rather than guessing.
- [x] 403 when `workout_write` is off (the existing `WorkoutWriteDisabledError` path), 404 for
      another user's id or one that does not exist, 200 with the unchanged view when there was
      nothing to do.
- [x] Garmin refusing the workout (`unsupported`) is a **200 with the view carrying `pushState:
      'unsupported'` and its reason**, not a 5xx. It is an answer about the workout, not a broken
      request, and the panel needs the reason to show it.
- [x] Rate-limited per user via the injected `createRateLimiter` (as `/mcp` and Garmin login already
      are) → 429 + `Retry-After`. The button is one click from an unbounded write loop against a
      third-party API.

### The button

- [x] In the day panel, beside `Edytuj` / `Usuń`: **`Wyślij na Garmina`**, on an authored session only
      — a session read from Garmin's calendar has nothing to send.
- [x] States: idle → sending (disabled, busy) → the resulting push state. Failure shows the reason
      already stored in `pushError` and leaves the button pressable again.
- [x] Hidden, with a one-line explanation, when `workout_write` is off. Never rendered as a button
      that 403s.
- [x] When the session already carries a Garmin id and a schedule, the control says so
      (`Na Garminie`) instead of offering a push that would be a no-op.
- [x] `lib/ui` components + design tokens only; light + dark; the busy state is announced to screen
      readers, not colour-only.

### General

- [x] Unit + API-integration tests pass (no e2e)
- [x] No secrets logged or committed

## API contract

```
POST /api/workouts/[id]/push   req: (no body)
                               res 200: AuthoredWorkoutView   (pushState: pushed|unsupported|failed)
                               403 workout_write off · 404 unknown id · 429 Retry-After · 502 sidecar down
```

No change to `AuthoredWorkoutView` — `pushState`, `pushError` and `onGarmin` already carry everything
the panel needs to draw the result.

## UI

`PlannerView.svelte` (day panel) + a `lib/ui` button; no new component. States: idle / busy /
`Na Garminie` / error with reason. The existing `W kolejce` chip keeps its meaning — it now means
"waiting for automatic push", which is honest when automation is on and is exactly why the button
exists when it is off.

## Design / implementation notes

- **Out of scope, and it bounds what the button promises:** a session edited AFTER it was pushed keeps
  its `garminWorkoutId`, so `pushWorkout` skips the create and only re-schedules — the edited steps
  never reach Garmin. `updateWorkout`'s own comment says the reset to `pending` exists so the athlete
  cannot "edit an interval here and ride the old one"
  ([workouts.api.ts:162](../apps/web/src/modules/workouts/workouts.api.ts)), and that is precisely what
  still happens. This spec deliberately does not fix it — the requested behaviour is create-if-missing
  — but the button must not claim otherwise: when the row has a Garmin id and local edits after it,
  the panel says the version on Garmin may be older. The fix (delete + recreate upstream, or Garmin's
  update endpoint) is its own spec.
- Ports & adapters unchanged. `pushWorkout` takes the store, the source and the clock as arguments —
  the same objects the engine already holds — so the endpoint builds them from the container like
  every other route.
- Nothing here changes what is SENT to Garmin; spec 082 owns the payload.

## Test plan

- **Unit (`pushWorkout`):** no id → create + schedule; existing id → schedule only, create never
  called; unsupported sport → `unsupported` with the reason and no schedule attempt; schedule refused
  → `failed` with the id kept, so the retry does not duplicate.
- **Unit (registry):** both switches present; the engine's phase is skipped with `workout_auto_push`
  off and `workout_write` on; the manual path runs in that same state.
- **API integration (mock adapters):** 200 + view shape; 403 with the write switch off; 404 for
  another user's workout; 429 past the limit; a second call right after a successful one makes no
  further adapter calls and returns the same view.
- **Component:** NOT written. `PlannerView` reaches for `$app/stores`, `goto` and `invalidateAll`, so
  mounting it costs more scaffolding than the three states are worth here; the button's states are
  driven entirely by `pushState` / `pushError`, which the API tests already pin down. Recorded rather
  than quietly dropped.

## Closeout

- Commits: —
- What landed:
  - `workout_auto_push` added to the registry (default on, so an upgrade changes nothing for anyone
    who never opens Settings); `workout_write` retitled to permission rather than automation; the
    engine's phase requires both, the manual path only the first.
  - `lib/server/sync/workout-push.ts` — `pushWorkout()` + `canPush()`, called by the engine's loop
    and by the endpoint. The engine's push phase lost ~55 lines and gained no behaviour: its whole
    existing suite passes untouched, which is the evidence the extraction was faithful.
  - `POST /api/workouts/[id]/push`, rate-limited at 20/min per user via a new container limiter.
  - Day-panel button, with `Na Garminie` in place of a no-op press and a plain warning when the row
    has local edits on top of a version already sent.
- Verified: `pnpm run verify` green (2437 tests, check, lint, build); `pytest` green (189).
- Notes / follow-ups:
  - Re-push of a session edited after it reached Garmin: spec 084.
