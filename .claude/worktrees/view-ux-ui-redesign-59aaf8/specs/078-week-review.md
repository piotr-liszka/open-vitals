# Spec 078 — Plan kontra rzeczywistość: przegląd tygodnia w jednym wywołaniu

- **Status:** Closed <!-- Draft → Approved → Closed -->
- **Module:** `apps/web/src/modules/week-review/` + `lib/mcp/`
- **Owner agent:** module-dev
- **Depends on:** 050 (authored workouts), 056 (weekly summary), 062 (journal), 073 (training blocks)

## Context

Coaching feedback, August 2026: *"Zestawienie zaplanowanego z wykonanym w jednym wywołaniu. Dziś
muszę to składać ręcznie z `list_workouts` + `get_metric_range`. [To] łatwo się pomylić."*

Spec 073 answered half of it for the **current** week: `get_current_week` already returns the volume
target against what has actually been run. What it does not do is match a planned session to the
activity that fulfilled it, and it cannot look at a week that is already over — which is exactly
when a review happens.

The matching is the whole feature, and it is where a naive version misleads. A session written for
Tuesday and run on Wednesday is not a missed session plus an unplanned one; reporting it that way
would make a good week read as chaos, and the coach would stop trusting the numbers. So matching
allows a one-day shift and **says when it used one**.

## Requirements (acceptance criteria)

### Matching (pure, in `week-review.match.ts`)

- [x] Same-day matches are made FIRST, across all planned sessions, before any shifted match is
      considered. Otherwise a Monday session could claim Tuesday's activity while Tuesday's own
      session goes unmatched.
- [x] A second pass matches still-unplanned sessions to activities **±1 day** away, and the result
      carries `dayShift` so a moved session is visibly moved rather than silently on time.
- [x] Matching is by **sport family**, not exact Garmin sport key — a planned `running` is fulfilled
      by a `treadmill_running`.
- [x] Where several candidates fit, the closest one on the axis the plan used (distance if the plan
      has one, else duration) wins. An activity is used at most once.
- [x] `adherence` per matched pair is BOTH a ratio and a label: `done` at ≥90 % of what was planned,
      `shortened` below it. A plan with no distance and no duration (a lap-button session) reports
      `done` with a null ratio rather than inventing a judgement.
- [x] `missed[]` is planned sessions with no match; `unplanned[]` is activities that matched nothing.

### Payload

- [x] `planned` carries BOTH the block's `volumeTargetKm` (spec 073, may be null) and the sum of the
      planned sessions' own estimates. They are different numbers and conflating them is how a
      review lies: the target is what the week was for, the sum is what was actually written down.
- [x] `actual` carries the volume really covered and the session count.
- [x] Any RPE logged against a matched activity (spec 062) rides along on the match, because "was it
      done" and "what did it cost" are the same question to a coach.
- [x] `weekStart` is optional: with no argument the review is of the week containing today, snapped
      to its Monday. Any day inside a week resolves to that week.
- [x] A week with nothing planned and nothing done says so, rather than returning empty arrays that
      read as a failed week.

### MCP

- [x] `get_week_review(weekStart?)`, registered behind the block deps object it shares.
- [x] Numbers pre-rounded, paces pre-converted, and the verdict already a sentence.

### General

- [x] Unit + API-integration tests pass (no e2e)
- [x] No secrets logged or committed

## API contract

```
get_week_review { weekStart? }
  → { weekStart, weekEnd, block?: { name, weekNumber, weeks, phase, focus },
      planned: { volumeTargetKm, sessionsVolumeKm, sessions },
      actual:  { volumeKm, sessions },
      matched: [{ planned: {...}, completed: {...}, adherence, adherenceRatio, dayShift?, rpe? }],
      missed:  [{ day, title, sport, estimatedDistanceM }],
      unplanned: [{ day, name, sport, distanceM, pace }],
      verdict: string }
```

## UI

N/A — backend only for now. `get_current_week`'s card (spec 073) already shows the live week; a
past-week review is a coaching-conversation surface, not a dashboard one.

## Design / implementation notes

- The matcher is pure and takes plain arrays, so every rule above is unit-testable against fixtures
  without a store.
- Reuses `listWorkouts` and `listActivities`; no new store method and no new maths.
- **Edge case that decides the design:** two sessions of the same sport on one day (a double). The
  closest-on-axis rule handles it, and using each activity at most once stops both plans claiming
  the same run.

## Test plan

- **Unit:** same-day priority over shifted; a moved session reports its shift; sport-family match;
  a double matched to the right pair; adherence bands either side of 90 %; a lap-button plan with no
  axis; unmatched on both sides.
- **API integration (mock adapters):** a week with a block and one without; a week with nothing in
  it; per-user isolation.
- **MCP:** default (no argument) resolves the current week; an explicit mid-week day snaps to Monday.

## Closeout

- Commits: shipped to `main` (see `git log --grep 'spec 078'`).
- The two-pass matcher is the part worth remembering. A single greedy pass lets Monday's session
  claim Tuesday's activity — it is within the one-day tolerance — while Tuesday's own session, which
  that activity actually was, falls to `missed`. There is a test named for exactly that.
- This closes the coach's P1 list. What remains from the original feedback is P2 and exposure-only:
  `get_load_series` (CTL/ATL/ACWR, already computed in `lib/server/analytics/load-risk.ts`),
  `get_personal_bests` (spec 054's stored leaderboard), and `mark_as_time_trial` — for which
  `update_training_block` is already a workable manual path.
