# Spec 081 — Ten sam trening, po numerze: twarde powiązanie planu z wykonaniem

- **Status:** Approved <!-- Draft → Approved → Closed -->
- **Module:** `apps/web/src/lib/server/sync/` + `apps/web/src/modules/week-review/` + `apps/web/src/modules/workouts/`
- **Owner agent:** module-dev
- **Depends on:** 050 (authored workouts + push), 066 (planner), 078 (week review / matching)

> **Renumbered from 080.** The check-in redesign took 080 on `origin/main` while this one was being
> written locally. Same collision as 075 → 077; the number is claimed by whoever pushes first.

## Context

Spec 078 answers "was this session done?" by guessing: same sport family, same day, then ±1 day,
closest on the plan's own axis. The guess is good and it is the right fallback, but it is still a
guess — two similar runs on one day, or a session moved by two days, and the review reports chaos
where there was none.

There is already a hard identifier on both ends, and nothing uses it. When the push phase creates a
workout on Garmin it stores the returned id as `authored_workouts.garmin_workout_id`
([engine.ts:587](../apps/web/src/lib/server/sync/engine.ts)). When the athlete starts **that
scheduled workout** from the watch, Garmin stamps the resulting activity with the same `workoutId` —
and `normalizeActivity` keeps the entire upstream payload in `synced_activities.raw`, so the field is
already sitting in the database on every activity ever synced. Nothing in the path filters unknown
keys: `garmy`'s `accessor.raw()` returns upstream dicts, `_jsonify` copies dicts wholesale, and the
web tier stores `raw` verbatim.

So this spec adds no new call to Garmin and no marker in a workout title. It reads an id that is
already there, uses it when present, and leaves the spec-078 heuristic in charge when it is not.

**Unverified premise, and the reason the design degrades rather than switches:** that Garmin populates
`workoutId` on *this athlete's* activity summaries has not been confirmed against real data — the
plumbing is confirmed field-agnostic, the field's presence is not. The first requirement below is the
check. If it comes back empty, only the diagnostic ships and the rest of the spec is withdrawn, not
half-built.

## Requirements (acceptance criteria)

### Confirm the premise first

- [ ] Confirmed against real synced data that `synced_activities.raw` carries a non-null `workoutId`
      on activities executed from a pushed workout, and how it is typed (number vs string). Recorded
      in Closeout. **No further requirement is implemented before this one passes.**

### Extract (`sync/normalize.ts` + store)

- [ ] `ActivitySummary` gains `garminWorkoutId: string | null`, read from the summary's `workoutId`
      and coerced to a string — Garmin returns the id as a number in some payload shapes and the
      column it is compared against is `text`. Absent, null, or non-scalar → null, never a throw.
- [ ] `synced_activities` gains a `garmin_workout_id text` column (`ADD COLUMN IF NOT EXISTS`, in
      `MIGRATIONS`), written by `putActivities` and read back by every activity query. A first-class
      column and not a `raw->>'workoutId'` probe at each call site: the store's two adapters would
      otherwise each grow their own jsonb dialect for one field.
- [ ] The same migration **backfills from the rows already stored** —
      `UPDATE synced_activities SET garmin_workout_id = raw->>'workoutId' WHERE …` — so history links
      up without re-syncing anything from Garmin.
- [ ] Backfill and column are indexed for the lookup the matcher does:
      `(user_id, garmin_workout_id) WHERE garmin_workout_id IS NOT NULL`.

### Match (`week-review.match.ts`, still pure)

- [ ] `PlannedSession` gains `garminWorkoutId: string | null`, `CompletedActivity` gains the same.
- [ ] A **pass 0** runs before the existing same-day pass and matches on equal, non-null
      `garminWorkoutId`. An id match is **not** subject to `MAX_DAY_SHIFT`: if the watch says this
      activity was that session, a three-day slip is still that session, reported with its real
      `dayShift`.
- [ ] `Match` carries `matchedBy: 'workout-id' | 'heuristic'`, so a review can say which pairings are
      known and which are inferred. A UI that shows both identically would launder a guess into a fact.
- [ ] Where two activities carry the same id (the athlete ran the scheduled session twice), the one
      closest to the planned day wins and the other falls to `unplanned[]`.
- [ ] Passes 1 and 2 are unchanged and still run for everything pass 0 did not claim. Every existing
      spec-078 matching test still passes untouched.

### Surface

- [ ] `get_week_review` reports `matchedBy` per matched pair.
- [ ] The planner (`/training/plan`) marks a session that was done. It currently loads no activities
      at all; it loads the grid range's activities and runs the **same** `matchWeek` — the completion
      state is derived on read, never a second stored copy that can drift from the activity table.
- [ ] The day panel distinguishes done from shortened, and shows the day shift when there was one.

### General

- [ ] Unit + API-integration tests pass (no e2e)
- [ ] Built only from `lib/ui` components + design tokens
- [ ] No secrets logged or committed

## API contract

No new endpoint. Two payloads grow one field each.

```
get_week_review           res.matched[].matchedBy: 'workout-id' | 'heuristic'
GET /training/plan (load) data.planner.workouts[].completion:
                            { activityId, adherence, adherenceRatio, dayShift, matchedBy } | null
```

`ActivitySummary.garminWorkoutId` is internal — it is the join key, not something an MCP client reads.

## UI

`PlannerCalendar.svelte` / `PlannerView.svelte`, from `lib/ui` + tokens:

- **Done** — the existing session chip gains a completion marker; `--color-success` family.
- **Shortened** — same marker, warning tone, with the ratio in the day panel (`82 % planu`).
- **Moved** — day panel only: `wykonane dzień później`. Never on the chip; a calendar cell is too
  small to carry a caveat and a marker that means two things means neither.
- **Inferred vs known** — a heuristic match is stated as such in the day panel. Not a separate colour:
  the distinction matters when you are reading the detail, and would be noise on the grid.
- Light + dark via tokens. Loading/empty/error states of the planner are unchanged — activities that
  fail to load leave sessions unmarked rather than blocking the plan.

## Design / implementation notes

- **Nothing is sent to Garmin.** `create_workout` / `schedule_workout` are untouched; no identifier is
  written into a workout title or description. Garmin overwrites activity names anyway, so a title
  marker would be both fragile and visible junk on the watch.
- **`authored_workouts.matched_activity_id` stays unused and is not dropped.** Deriving completion on
  read is what keeps it honest — a deleted or re-synced activity cannot leave a stale "done" behind.
  The column is the right home for a *manual* override ("no, THIS activity was that session"), which
  is a separate spec if it is ever wanted. Its comment in `db/index.ts` is updated to say so, because
  "reserved for spec 052" now points at a spec that answered the question differently.
- **The id only appears when the session was started from the watch's scheduled-workout list.** A
  plain "start run" carries no `workoutId`. This is a Garmin behaviour, not something the app can fix,
  and it is exactly why pass 0 is an addition to the heuristic and never a replacement.
- Ports & adapters unchanged: the matcher stays pure, the store keeps both adapters in step via the
  existing contract test, and the planner takes its activities from the injected store like every
  other loader.

## Test plan

- **Unit (`week-review.match.test.ts`):**
  - id match beats a same-day heuristic candidate of a different session;
  - id match survives a shift larger than `MAX_DAY_SHIFT`, and reports the real `dayShift`;
  - two activities with one id → nearest day matched, the other lands in `unplanned[]`;
  - all-null ids → results identical to spec 078's, asserted against the existing fixtures.
- **Unit (`normalize.test.ts`):** numeric `workoutId` → string; missing/null → null; a non-scalar
  value → null, no throw.
- **Store contract:** `garminWorkoutId` round-trips through both the memory and pg adapters
  (pg only with `TEST_DATABASE_URL` set — a green run without it has NOT exercised the adapter).
- **API integration:** `week-review.api.test.ts` asserts `matchedBy` in the JSON contract; a planner
  load test asserts a session with a matching activity comes back with `completion` and one without
  comes back `null`.
- **Sidecar:** none — no sidecar change.

## Closeout

- Commits: —
- Notes / follow-ups:
  - Result of the premise check (§Requirements 1): —
  - Manual override of a match, on `matched_activity_id`: not in scope, own spec if wanted.
