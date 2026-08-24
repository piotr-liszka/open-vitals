# Spec 060 — Cele sezonu: goals, countdown and the trajectory to them

- **Status:** Closed <!-- Draft → Approved → Closed -->
- **Module:** `apps/web/src/modules/season/` + `lib/server/analytics/season.ts` + `lib/server/store/` + `lib/mcp/`
- **Owner agent:** module-dev
- **Depends on:** 018 (local dates), 024 (planned events), 025 (training section + sub-nav), 039 (load ramp & per-sport fitness), 043 (race predictor), 047 (global range switch), 050 (authored rows as source of truth)

## Context

Every number in the app is **retrospective**. Spec 039 says how fast load is being added, spec 043 says what
the athlete could run today, spec 044 says whether the easy sessions were easy — all of it answers *what
happened*. Nothing in OpenVitals knows what any of it is **for**. An athlete with a race in eleven weeks and one
with no race at all get the identical dashboard, and the single most consulted number in the sport — "am I
on track?" — is the one question the app cannot form, because it has never been told the target.

The inputs are all already here. `buildTrainingLoad` gives CTL today and the whole curve behind it,
`loadRisk` gives the ramp and the ceiling a safe ramp must respect, `predictRaces` gives a predicted finish
time from the athlete's own bests, and `listPlannedEvents` already syncs Garmin calendar entries with
`kind: 'race'` — so the races are frequently *in the database already*, unlabelled and unused.

What is missing is a **target**: a day, a sport, and optionally a distance and a time. From that one row the
retrospective machinery becomes prospective — days out, which phase of the block today sits in, the CTL the
athlete would need by taper and whether the current ramp gets there without crossing spec 039's safe rate,
and (for a run race with a distance) the predicted time against the wanted time.

This is deliberately **multisport and multi-goal**: a list of targets, each owned by one sport family, each
scored against **that family's** CTL from spec 039 rather than the whole-athlete number. A cyclist's gran
fondo in June and a half marathon in October are two different trajectories on two different curves, and the
whole-athlete CTL that spec 039 already calls a liar for this exact case must not be the thing a goal is
judged against.

**Not** a training-plan generator. The app does not author the block, and this spec adds no prescription of
sessions — spec 050 already owns authoring workouts. This says where the athlete is against where they said
they wanted to be, and stops there.

## Requirements (acceptance criteria)

### Storage

- [x] A `season_goals` table, per-user and cascading on user delete, holding: `id`, `user_id`, `day`,
      `sport` (a `SportGroup`), `title`, `kind` (`race` | `fitness`), `distance_m`, `target_time_s`,
      `target_ctl`, `priority` (`a` | `b` | `c`), `note`, `source` (`manual` | `garmin`),
      `garmin_event_id`, `created_at`, `updated_at`. Indexed by `(user_id, day)`.
- [x] A **partial unique index** on `(user_id, garmin_event_id) WHERE garmin_event_id IS NOT NULL`, so
      importing the same synced race twice is impossible however the request races (the guard spec 050 uses
      for the same reason).
- [x] `LocalStore` gains `createGoal` / `getGoal` / `listGoals` / `updateGoal` / `deleteGoal`, implemented in
      **both** the pg adapter and the in-memory fake, every method scoped by `userId`.
- [x] A goal for a user is never readable, patchable or deletable through another user's id — asserted, not
      assumed.

### Analytics (pure)

- [x] A pure `lib/server/analytics/season.ts` — no store, no clock, no `Date`, no Garmin — exporting:
  - [x] `goalPhase(daysOut)` → `race-week` | `taper` | `peak` | `build` | `base` | `far` | `done`, from
        named day thresholds rather than magic numbers inline.
  - [x] `requiredRamp(currentCtl, targetCtl, daysToTaper)` → the CTL gain per week the goal implies, `null`
        when there is no target CTL or no time left to build.
  - [x] `taperCheck(series, raceDay, today)` → whether load is actually coming **down** inside the taper
        window: last-7-day load against the preceding 28-day mean, with a verdict and both numbers.
  - [x] `goalStatus(...)` → one of `on-track` | `ahead` | `behind` | `at-risk` | `unknown`, where
        **`at-risk` outranks `behind`**: a ramp steeper than spec 039's `RAMP_HIGH` is a worse finding than
        being under target, and an athlete told only "behind" would respond by making it worse.
  - [x] `projectCtl(currentCtl, rampPerWeek, days)` → the CTL the current ramp actually lands on, so the
        verdict and the number the reader sees come from the same projection.
- [x] `unknown` — never a guessed verdict — whenever the family is under spec 039's history floor, or the
      goal has no target of any kind to be measured against.
- [x] A goal in the **past** is `done` and reports no trajectory, no ramp, and no taper verdict.

### Targets and predictions

- [x] When a `race` goal names a distance **and** its sport family is `run`, the payload carries the
      predicted time from spec 043 (`predictRaces` over the athlete's own bests) and, when a target time was
      set, the signed gap between them.
- [x] A prediction is reported with the same honesty spec 043 requires: it names the best it came from and
      whether the extrapolation is confident, and is **absent** rather than invented when no best is close
      enough.
- [x] `targetCtl` is optional. When the athlete has not set one, the goal still reports countdown, phase and
      taper check — it simply has no trajectory. No default target is fabricated from the distance.

### Importing what Garmin already knows

- [x] The payload lists **suggestions**: future `listPlannedEvents` entries with `kind: 'race'` that no goal
      is linked to yet, so an athlete whose races are already on their Garmin calendar adopts them in one
      click instead of retyping them.
- [x] Importing a suggestion writes `source: 'garmin'` and its `garmin_event_id`; a suggestion already
      imported never appears in the list again.
- [x] Deleting an imported goal does **not** delete the synced planned event (we do not own it), and the
      suggestion legitimately returns.

### Surfaces

- [x] `/training/cele` renders the goals list, each goal's countdown, phase, trajectory and verdict, plus the
      suggestion list and the create form. Honest **empty / no-history / consent-off** states. (No loading
      state: the page is server-loaded, so there is nothing to spin on. No separate *not-connected* state
      either — a disconnected account is indistinguishable from an empty one here, and the no-history
      banner already says the true thing.)
- [x] The tab appears in the training `SubNav` (spec 025) — no new primary-nav entry, since spec 048 spent a
      whole spec getting that list down to seven.
- [x] `GET/POST /api/season/goals` and `PATCH/DELETE /api/season/goals/[id]`, validating every field before
      use and returning typed 4xx on bad input.
- [x] MCP gains `list_goals`, `get_goal_plan`, `create_goal` and `delete_goal`, registered in
      `create-server.ts`, so a connected assistant can both read the plan and put a race on it.
- [x] Consent-gated exactly like the rest of the processed experience (`detailed_analytics`): degrades to a
      disabled payload rather than throwing.
- [x] Unit + API-integration tests pass (no e2e)
- [x] Built only from `lib/ui` components + design tokens
- [x] No secrets logged or committed

## API contract

Types live in `modules/season/season.types.ts`; the analytics types in `lib/server/analytics/season.ts`.

```
GET    /api/season/goals            res: SeasonData
POST   /api/season/goals            req: NewGoalInput          res: { goal: Goal }        400 → { error }
PATCH  /api/season/goals/[id]       req: GoalPatch             res: { goal: Goal }        400/404 → { error }
DELETE /api/season/goals/[id]                                  res: { deleted: true }     404 → { error }
```

```ts
interface SeasonData {
  readonly enabled: boolean;          // false when consent is off / not connected
  readonly today: DayKey;
  readonly goals: GoalStatus[];       // soonest future goal first, past goals after
  readonly suggestions: GoalSuggestion[];
  readonly hasData: boolean;          // enough history for any trajectory at all
}

interface GoalStatus {
  readonly goal: Goal;
  readonly daysOut: number;           // negative once the day has passed
  readonly weeksOut: number;
  readonly phase: GoalPhase;
  readonly ctl: number | null;        // this family's CTL today (spec 039)
  readonly projectedCtl: number | null;
  readonly rampPerWeek: number | null;
  readonly requiredRampPerWeek: number | null;
  readonly taper: TaperCheck | null;  // only inside the taper window
  readonly prediction: GoalPrediction | null;
  readonly status: GoalStatusBand;
  readonly note: string;              // one Polish sentence, the verdict in words
}
```

MCP tools:

```
list_goals      {}                                   → every goal with countdown, phase and verdict
get_goal_plan   { goalId }                           → one goal's full trajectory + prediction
create_goal     { day, sport, title, kind, … }       → the created goal
delete_goal     { goalId }                           → { deleted: true }
```

## UI

`/training/cele`, composed from `lib/ui` only: `Card` per goal, `StatTile` for days-out / CTL / required
ramp, the shared `TrendChart` for the CTL curve with the target marked, `Badge` for phase and verdict band,
`SegmentedControl` for priority, `Button` for the actions. The create form uses labelled native inputs tied
to their labels, and the sport select offers only families the athlete actually records — the same rule
`trainingTabs` already applies, so nobody is offered a swim goal they have no swims for.

Verdict colour comes from the existing band tokens (the load-risk card's vocabulary), so `at-risk` reads the
same red it reads on the overview. Light + dark via tokens only.

States: loading skeleton; **empty** — an invitation naming what a goal unlocks, plus the suggestion list when
Garmin already knows about a race; not-connected and consent-off reuse the existing gates.

## Design / implementation notes

- **Ports touched:** `LocalStore` (five new methods, both adapters), `db/index.ts` (one new table +
  migration statements). Nothing new is injected beyond what `/training` already takes: `store`, `settings`,
  `clock`.
- **Per-family CTL, not whole-athlete.** Each goal's trajectory runs `buildTrainingLoad` over that family's
  activities alone, exactly as spec 039's `perSport` does. Reusing the whole-athlete curve would reproduce
  the bug spec 039 was written to fix.
- **The taper is the phase everything else hangs off.** `requiredRamp` measures to the **start of the
  taper**, not to race day — a plan that reaches its target CTL on race morning has skipped the taper, which
  is the opposite of ready.
- **`at-risk` outranks `behind`** in `goalStatus`. Stated as a rule in code with the reason, because the
  obvious ordering (worst gap wins) produces exactly the advice that hurts the athlete.
- **Deliberately not range-driven** (spec 047), like the PMC card it sits beside: a goal's horizon is the
  goal's own, and the global 7-day window would truncate a sixteen-week build into meaninglessness.
- **Edge cases:** goal in the past (`done`, no trajectory); goal today (`race-week`, `daysOut: 0`); family
  under the history floor (`unknown`, null numbers, no scary ratio from three sessions); no target CTL and no
  target time (countdown only); a synced race deleted upstream after import (the goal survives — it is ours
  now); two goals on the same day in different sports (both scored, independently).
- Every field of `NewGoalInput` is validated at the boundary — day is a real `DayKey`, sport is a known
  `SportGroup`, distances and times are finite and positive — and rejected with a typed 400 rather than
  reaching the store.

## Test plan

- **Unit (`season.test.ts`):** phase thresholds either side of every boundary; `requiredRamp` with no target,
  no time left, and a normal build; `projectCtl` over a known ramp; `taperCheck` for load falling, flat and
  rising; `goalStatus` for each band, including the explicit assertion that a steep ramp under target reports
  `at-risk` and not `behind`; the history floor returning `unknown`; a past goal returning `done`.
- **Unit (store fake):** CRUD round-trip; per-user isolation on read, patch and delete; the
  `garmin_event_id` uniqueness guard rejecting a double import.
- **API integration (mock adapters):** `GET` with no goals (empty + suggestions), with a future run goal
  (prediction present), with a past goal (`done`); `POST` valid → 200 and persisted; `POST` with a bad day,
  unknown sport and negative distance → 400 each; `PATCH` unknown id → 404; `DELETE` → gone from the next
  `GET`, and its suggestion returning; consent off → `enabled: false` without throwing.
- **MCP:** each of the four tools invoked against a mock store; assert the returned content shape, and that
  `create_goal` validates the same way the HTTP boundary does.

## Closeout

- Commits: `ee18282` — feat: cele sezonu — goals, countdown and the trajectory to them (spec 060).
- Verified with `pnpm run verify` (test + check + lint + build) — 1671 tests, 0 svelte-check problems.
- **Deliberately not built here**, in scope order for a follow-up:
  - The CTL curve with the target plotted on it. The card states the projection numerically; drawing it
    wants a `TrendChart` variant with a target line and a taper marker, which is a `lib/ui` change and so a
    ui-designer job rather than a module one.
  - Editing a goal from the web UI. `PATCH /api/season/goals/[id]` is implemented, validated and tested; the
    view only creates and deletes. An athlete who mistypes a date deletes and re-adds today.
  - Suggestions come only from Garmin planned events with `kind: 'race'`. Garmin's own calendar is
    inconsistent about that flag, so some races arrive as `note` and will not be offered.
- **Notes:** `requiredRamp` measuring to the start of the taper rather than to race day is the one
  non-obvious decision here — see the doc comment on it. `at-risk` outranking `behind` in `goalStatus` is a
  safety property with a dedicated test; do not "fix" the ordering to a largest-gap-wins rule.
