# Spec 066 — Workout planner under Trening

- **Status:** Closed
- **Module:** `apps/web/src/modules/workouts/`
- **Owner agent:** module-dev
- **Depends on:** 050 (authored workouts + Garmin push), 024 (synced planned events), 025 (training section)

## Context

Spec 050 built the whole authored-workout stack — a validated step model in `$lib/workouts`, store
rows, MCP tools to create/update/delete, and a sync phase that pushes sessions to the Garmin calendar
and onto the watch. It shipped without a single pixel of UI. Today the only way to see what you have
planned is to ask an assistant to list it, and the only way to fix a date is to ask it again.

That is a strange place to stop, because a plan is the one thing in this app that is inherently
*spatial*: "what does my week look like" and "is that block too heavy" are questions a calendar answers
at a glance and a list cannot answer at all. The data is already there — `listWorkouts` for what the
athlete authored, `listPlannedEvents` for what Garmin already knew — and neither has ever been drawn.

So: a month calendar under `Trening`, with the selected day's sessions beside it, and a step builder
that covers the **whole** model. MCP stays the fast path for composing a block; the UI is where you see
the shape of it and fix the one interval that was wrong.

Both sources are drawn together and marked apart. A session the athlete wrote here and one Garmin
already had are different things — only the first can be edited, and only the first has a push state —
so the calendar shows both and the panel says which is which.

## Requirements (acceptance criteria)

- [x] `Trening → Plan` is a tab in the training SubNav, offered unconditionally like `Cele`
- [x] A month calendar marks every day holding an authored workout or a synced planned event
- [x] Previous/next month navigation, and the month is in the URL so a view is linkable
- [x] Selecting a day lists that day's sessions with sport, title, time and estimated duration
- [x] Each authored session renders its full step structure, repeat blocks included
- [x] Each authored session shows its Garmin push state (`pending` / `pushed` / `failed` / `unsupported`)
- [x] Synced Garmin events are shown, visually distinguished, and are not editable
- [x] A workout can be created, edited and deleted from the UI
- [x] The editor covers the whole model: every step kind, every duration type, targets valid for the sport, and repeat blocks
- [x] Targets offered are filtered to those `WORKOUT_TARGETS_BY_GROUP` allows for the chosen sport
- [x] Server-side validation is `normalizeWorkout` — the same function the MCP tools use, not a second copy
- [x] Deleting asks for confirmation and warns when the session has already reached Garmin
- [x] Writes are gated on the `workout_write` consent feature, and the page says so when it is off
- [x] Unit + API-integration tests pass (no e2e)
- [x] Built only from `lib/ui` components + design tokens
- [x] No secrets logged or committed

## API contract

```
POST   /api/workouts          req: WorkoutDraft   res 201 AuthoredWorkoutView | 400 { error } | 403 | 401
PATCH  /api/workouts/<id>     req: WorkoutDraft   res 200 AuthoredWorkoutView | 400 | 403 | 404 | 401
DELETE /api/workouts/<id>                         res 200 { deleted, onGarmin } | 403 | 404 | 401

WorkoutDraft = { day, time, sport, title, steps, note }
```

There is deliberately **no GET endpoint**. Reading is the page's `+page.server.ts` load, and every
write ends in `invalidateAll()` — so the server load is the single description of what the planner
shows, rather than a load and a fetch that can disagree about the same window.

`normalizeWorkout` from `$lib/workouts` is the trust boundary on every write. It already throws
`WorkoutValidationError` with a human-readable reason, which the handler maps to a 400 — the UI shows
that text rather than inventing its own message, so the rule and the explanation cannot drift apart.

Deleting a workout that has reached Garmin only removes the local row here; the sync engine owns
upstream cleanup exactly as it does for the MCP delete tool. The confirmation says so.

## UI

- `PlannerCalendar.svelte` — the month grid; marks days by source, keyboard-navigable, selection is a URL param.
- `PlannerView.svelte` — the two-pane layout, and the selected day's sessions with their step
  structure, push state and edit/delete.
- `WorkoutEditor.svelte` — the step builder: add/remove/reorder steps, nest a repeat block, pick targets.
- `WorkoutSteps.svelte` — read-only rendering of a step tree, shared by the day panel and the editor preview.
- Reuses `SubNav`, `Card`, `Button`, `Field`, `Input`, `Badge`, `ConfirmDialog` (spec 064), `Icon`.
- States: empty month, day with no sessions, consent off, validation error, push failed.

## Design / implementation notes

- **The model is not re-declared.** `WorkoutStep`, the limits and `normalizeWorkout` come from
  `$lib/workouts`, which is already client-safe for exactly this reason (spec 050 put it outside
  `$lib/server` so "any future builder UI" could share it). A second definition of a valid workout is
  the one thing this spec must not create.
- **`planner.ts` is pure** — month grid, week alignment (Monday-first, Polish locale) and grouping
  sessions by day. Calendar arithmetic is where off-by-one bugs live, so it is unit-tested away from
  any store.
- **One read per month**, bounded by the visible grid's own from/to — including the leading and
  trailing days of adjacent months the grid displays, or those cells would lie by omission.
- **Repeat nesting is one level**, because `normalizeWorkout` refuses deeper and Garmin's own editor
  allows one. The builder offers no control that would produce something the validator rejects.
- **Deletion warns differently once pushed.** A local-only row is a clean delete; a pushed one leaves
  the sync engine to clean up upstream, and saying that is the difference between an informed
  confirmation and a surprise on the watch.

## Test plan

- **Unit:** `planner.ts` — a month grid is 6×7, starts on Monday, marks the right days, and places the
  1st correctly for a month starting on a Sunday; grouping puts each session on its own local day.
  `workout-format.ts` — a repeat block renders as `5× (1 km + 2 min)`, a lap step as `do przycisku`.
- **API integration (mock adapters):** create → list round-trips the step tree; an invalid step returns
  400 with the validator's own reason; PATCH of a missing id is 404; DELETE removes the row; every
  handler refuses an unauthenticated caller; writes refuse when `workout_write` consent is off.

## Closeout

- Commits: see `feat(workouts): a planner for the sessions spec 050 could only write blind (spec 066)`
- Verified in a running app (mock adapters): the August grid places the 1st under Saturday, rings
  today and dims the borrowed days; with `workout_write` off the panel is read-only and says why;
  after accepting it, a `5× (1 km @ 4:10–4:20/km)` session was built THROUGH THE UI — repeat block,
  distance step, pace target — saved, and came back as `1:01:15 · 5 km`, badge `W kolejce`, with the
  block rendered under its accent rule and a dot on the 15th. Two hostile drafts posted straight at the
  endpoint were refused by the shared validator with its own words: *"target 'power' does not apply to
  this sport — allowed: pace, speed, hr"* and *"repeat blocks cannot be nested"*.

### Two bugs the tests could not have caught

1. **An off-by-one in the month grid.** `dayOfWeek` is 0-based (0 = Monday) and reads like it is
   1-based, so hand-rolled `-(dayOfWeek(first) - 1)` arithmetic shifted every month whose 1st is not a
   Monday. `$lib/date` already had `startOfWeek` for exactly this. The unit tests caught it — which is
   the entire argument for `planner.ts` being pure and separate.
2. **`+server.ts` may export nothing but method handlers.** The error→HTTP mapper was exported from
   the create route and imported by the `[id]` route; that fails at BUILD time only, sailing past
   `test`, `check` and `lint` exactly as AGENTS.md §7 warns. It moved into the module, which is where
   AGENTS.md §9 says a typed error should be mapped to a status anyway.

- Follow-ups: rescheduling is by editing the day in the editor, not by dragging a session between
  calendar cells. Dragging is the nicer gesture and the grid is already built for it; it wants its own
  spec rather than being bolted on here.
