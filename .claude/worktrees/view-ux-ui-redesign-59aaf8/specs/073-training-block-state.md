# Spec 073 — Trwały stan planu: blok treningowy, który pamięta, w którym jestem tygodniu

- **Status:** Closed <!-- Draft → Approved → Closed -->
- **Module:** `apps/web/src/modules/block/` + `lib/server/store/` + `lib/mcp/`
- **Owner agent:** module-dev
- **Depends on:** 015 (local store), 050 (authored workouts), 060 (season goals), 069 (workout library)

## Context

Coaching feedback, August 2026: *"Dziś każda rozmowa startuje od zera: czytam 90 dni surowych aktywności
i od nowa wyprowadzam, na jakim jestem etapie."* The gap is not data — there is more physiology here than
any coach needs. The gap is **memory of the plan**.

`get_goal_plan` (spec 060) knows the phase, because it derives it from days-out to the race. It does not
know *this athlete's plan*: that week 7 is 2×10 min at threshold, that volume should land at 34 km, that
there are four runs a week and no bike between December and February, that easy pace is 6:10–6:30/km
because of a 5 km test three weeks ago. All of that is re-typed into every conversation or silently lost.

This is the difference between "ask for a plan" and "coach me week to week", and it is the one item on the
coach's list that needs a new data model rather than an exposure layer.

**The design decision this spec makes:** a block week does **not** hold its own session list. Sessions are
already a first-class row — authored workouts (spec 050) with a day, a step tree, a push state and a
Garmin calendar entry. A parallel `sessions[]` on the block would create two answers to "what am I doing on
Tuesday" that drift apart on the first correction — exactly the drift spec 069 removed for the library. The
block owns **targets and rules**; the week's sessions are the authored workouts falling inside it.

## Requirements (acceptance criteria)

### Store

- [x] A `training_blocks` table, per-user: `goal_id` (nullable → `season_goals`, `ON DELETE SET NULL`),
      `name`, `start_day` (a Monday), `weeks` (1–52), `paces` jsonb, `constraints` jsonb, `note`.
- [x] A `training_block_weeks` table: `(block_id, week_number)` unique, with `phase` (nullable override),
      `volume_target_km`, `focus`, `note`. A week with no row is a real week with no targets set.
- [x] `paces` is a record of named ranges in **seconds per km**: `easy`, `long`, `threshold`, `interval`,
      `goal`. Every key optional; a range is `{ lowS, highS }` with `lowS <= highS`.
- [x] `constraints` is a list of short free-text rules ("4 biegi/tydz", "brak roweru XII–II", "kolana"),
      capped at 20 entries × 200 chars. Free text on purpose: the value is that the athlete stops
      repeating them, not that the system parses them.
- [x] Blocks of one user may not overlap in time — creating an overlapping block is a validation error
      naming the block already covering those days.
- [x] `LocalStore` gains block CRUD in **both** adapters (pg + memory), held to a shared contract test
      like spec 060's `goal-contract.test.ts`.

### Derivation

- [x] `weekNumber` is derived from today and `start_day` (1-based, local days, Monday weeks) — never
      stored as "current". A block that ended returns `done`; a block that has not started returns its
      first week with `startsIn`.
- [x] `phase` falls back to `goalPhase(daysOut)` from spec 060's analytics when the week has no override,
      so a block attached to a goal gets phases without anyone typing them.
- [x] The week's `sessions[]` are the authored workouts (spec 050) in `[weekStart, weekStart+6]`, each with
      its title, sport, day, estimated distance/duration and push state.
- [x] `volumeActualKm` for the current week comes from synced activities in the same range, so plan and
      reality are in one payload without a second call.

### MCP tools

- [x] `create_training_block`, `get_current_week`, `update_training_block`, `list_training_blocks`,
      registered behind one optional deps object like the workout and season tools.
- [x] `get_current_week()` takes **no required arguments** — today resolves the block and the week.
- [x] `get_current_week()` returns `daysToGoal` and the goal title when the block is attached to a goal.
- [x] Write tools go through the **same validator as the HTTP boundary**, the rule spec 060 set.
- [x] Server `instructions` say to call `get_current_week` before advising on any session.

### General

- [x] Unit + API-integration tests pass (no e2e)
- [x] Built only from `lib/ui` components + design tokens
- [x] No secrets logged or committed

## API contract

Types in `modules/block/block.types.ts`.

```
GET  /api/block/current           res: { block, week, sessions[], paces, constraints, goal } | { block: null }
POST /api/block                   req: NewBlockInput            res: { block }      errors: 400 validation
PATCH /api/block/:id              req: BlockPatch               res: { block }      errors: 400, 404
DELETE /api/block/:id                                           res: { deleted }    errors: 404

create_training_block  { name, startDate, weeks, goalId?, paces?, constraints?, note? }
get_current_week       { }                → { blockName, weekNumber, weeks, phase, volumeTargetKm,
                                              volumeActualKm, sessions[], paces{}, constraints[],
                                              goal? { title, day, daysOut } }
update_training_block  { blockId, patch } → patch: { name?, weeks?, paces?, constraints?, note?,
                                              weekTargets?: [{ weekNumber, phase?, volumeTargetKm?, focus? }] }
list_training_blocks   { goalId? }        → blocks with start/end day, week count, current week if live
```

## UI

A `BlockCard` in the training section (`/training`), built from `lib/ui` `Card` / `StatTile` / `Badge`:

- **Success:** block name, week *n* of *m*, phase badge, planned vs actual volume, the week's sessions as
  a compact list with push state, paces as a small table, constraints as chips.
- **Empty:** no block — a short paragraph explaining what a block is and why it exists. No create
  form yet: blocks are authored over MCP in this spec, which is where the plan conversation happens.
- **Loading / error:** none needed — the card is server-rendered with the page, so it has no client
  fetch to be pending or to fail.
- Light + dark through tokens only.

## Design / implementation notes

- Ports & adapters: block CRUD is `LocalStore` surface, injected. `Clock` resolves today; `Random` mints ids
  — never `Date.now()` or `Math.random()` inside the handler (AGENTS.md §2 rule 4).
- Week arithmetic is pure and lives in `$lib/blocks.ts` — in `lib/`, not the module, because BOTH store
  adapters need the same span rule to check overlap, and `lib/` is the only sanctioned way to share it
  (AGENTS.md §5). It is unit-testable against fixed days: DST is the edge case, which is why weeks are
  counted in local calendar days, not in 7×86400 seconds.
- Overlap validation runs in the store adapter *and* the validator: the validator gives the good message,
  the adapter is the race-proof guard.
- `goal_id ON DELETE SET NULL`, not CASCADE — deleting a race must not silently delete eight weeks of plan.

## Test plan

- **Unit:** week derivation (before start, week 1, mid-block, last day, after end, DST week); paces range
  validation; constraint caps; overlap detection; phase fallback to `goalPhase`.
- **Contract (both store adapters):** create/get/list/update/delete, per-user isolation, overlap rejection,
  week-target upsert.
- **API integration (mock adapters):** `/api/block/current` with and without a block; create validation
  errors; patch of week targets.
- **MCP:** each tool invoked with a mock store; assert flattened shape, `get_current_week` with no args, and
  that the write tools reject what the HTTP validator rejects.

## Closeout

- Commits: shipped to `main` in one commit (see `git log --grep 'spec 073'`).
- Approval note: the spec was written and built in one pass, so the `Draft → Approved` step was not
  a separate gate — the owner approved by shipping it.
- Verified against a real Postgres, not only the in-memory fake: `TEST_DATABASE_URL=… pnpm run test`.
  That run is what caught the missing overlap guard in the pg `updateBlock` — the fake had it, the
  adapter did not, and no suite had ever exercised the pg half.
- Notes / follow-ups:
  - `get_week_review` (planned vs actual per session) is spec 074 and depends on this.
  - `soreness` in `get_current_week` (the coach's ask) waits on the journal — spec 062.
  - Two PRE-EXISTING defects surfaced while verifying against Postgres, both outside this spec:
    the store contract suites hard-coded global primary keys so their pg halves had never run
    (fixed here for goals/workouts/blocks), and spec 054's pg `putStreams` resets `efforts_v` but
    does not delete the derived rows, so a repaired stream keeps serving stale best efforts.
