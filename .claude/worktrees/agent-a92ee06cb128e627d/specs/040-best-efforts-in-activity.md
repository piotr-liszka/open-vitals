# Spec 040 — Best efforts inside one activity

- **Status:** Closed <!-- Draft → Approved → Closed -->
- **Module:** `apps/web/src/lib/analytics/best-efforts.ts` + `modules/activity-detail/`
- **Owner agent:** module-dev
- **Depends on:** 026 (activity stream charts + lattice helpers), 038 (`lib/analytics/` boundary)

## Context

We already ship the power version of this idea: `meanMaxCurve` answers "the best average power I held
for five minutes, anywhere in this ride". Its distance-based twin — "the fastest 1 km of this session"
— is missing, and it is the more useful one for a runner.

A 5 km personal best inside a 15 km long run is invisible on a page that only reports whole-activity
averages. Strava calls these Best Efforts and they are among the most-looked-at numbers it has. The
inputs are already computed by client-safe helpers `activity-charts.ts` uses for its distance axis, so
no new stream work is needed.

## Requirements (acceptance criteria)

- [x] A pure `lib/analytics/best-efforts.ts` exports `bestEfforts` and the standard `EFFORT_DISTANCES`
      (400 m, 1 km, 1 mila, 5 km, 10 km, 15 km, półmaraton, maraton — ascending).
- [x] For each target it finds the **shortest time window** covering at least that distance, in one
      linear two-pointer pass per distance rather than an O(n²) scan.
- [x] A distance the session did not cover is **absent**, never extrapolated from a partial split.
- [x] The window covers *at least* the target, so the covered distance is reported and the pace is
      computed over **that**, not over the nominal target — otherwise a coarse sample interval would
      flatter every effort.
- [x] Each effort reports where in the session it started and how many samples are behind it, so the
      resolution of the number is visible.
- [x] Degenerate input is refused, not guessed: missing streams, a single sample, mismatched lengths, or
      a stalled clock all yield no efforts.
- [x] Efforts are offered for **pace sports only**. "The fastest kilometre of this ride" is a descent,
      not a result.
- [x] The activity page renders them as a table that scrolls inside its own box, with the overshoot rule
      stated on the page and a note about sample rate shown only when the windows actually overshoot.
- [x] Unit + API-integration tests pass (no e2e)
- [x] Built only from `lib/ui` components + design tokens
- [x] No secrets logged or committed

## API contract

No new endpoint. `ActivityDetailData` gains:

```ts
readonly bestEfforts: readonly BestEffort[];
// { key, label, metres, durationS, actualM, paceSecPerKm, startS, samples } — shortest distance first
```

## UI

`ActivityBestEfforts.svelte` from `Card` + tokens: distance, time, pace, start offset and measured
distance. Nothing renders when the list is empty.

## Design / implementation notes

- The distance axis comes from `cumulativeDistance` (Σ v·Δt over the speed stream) and the time axis from
  `elapsedSeconds` — the same two helpers the charts use, so an effort's window matches what the chart
  draws rather than being derived a second, subtly different way.
- Because cumulative distance is non-decreasing, a window that already covers the target cannot get
  shorter by moving its start backwards. That is what licenses the single forward pass; the comment says
  so at the loop, since it is the one non-obvious line in the file.

## Test plan

- **Unit (`best-efforts.test.ts`):** a steady effort; a surge buried mid-run found at the right offset;
  the fastest window rather than the first; absent distances; pace computed over the measured distance
  on a coarse 10-second sample; a mid-session stop; every degenerate input; a marathon split inside a
  50 km run.
- **API integration (`activity-detail.api.test.ts`):** every distance a run contained, none for a ride,
  none without a speed stream, none for a too-short run, and an empty array with no streams at all.
- **Unit (`ActivityBestEfforts.svelte.test.ts`):** the empty path, the rows, the start offset, the
  measured-distance explanation, the conditional sample-rate warning, and table header scopes.

## Closeout

- Commits: `a6154a4` — feat(activity): best efforts inside one activity (spec 040)
- Notes / follow-ups:
  - **Not done here, and the obvious next step:** ranking these efforts against the athlete's history
    ("your fastest 5 km in 14 months"). Doing it honestly means best efforts for every past session,
    which means a stream read per activity — so it wants a stored per-activity efforts table populated
    at sync time, not a page-load computation. Spec 036's ranking engine can then consume it unchanged.
  - `EFFORT_DISTANCES` is a parameter, so a caller can ask for a custom set (a track session's 200 m,
    say) without touching the engine.
  - Efforts are found on the raw stream, so a GPS spike can inflate one. Spec 036's suspect flags cover
    the same session, but the two do not yet talk to each other.
