# Spec 042 — Grade-adjusted pace, and the speed–duration curve

- **Status:** Closed <!-- Draft → Approved → Closed -->
- **Module:** `apps/web/src/lib/analytics/pace-model.ts` + `modules/activity-detail/` + `modules/running/`
- **Owner agent:** module-dev
- **Depends on:** 023 (activity stats + the documented GAP absence), 026 (stream charts), 018 (running page)

## Context

Two gaps, both of which the app already holds the data for.

**1. Grade-adjusted pace.** 5:30/km up a 6% climb is a far harder effort than 5:30/km on the flat.
Spec 023's closeout documented that Garmin does not compute the correction and Strava paywalls it — and
that the row on our detail page therefore renders a dash with an explanation. We store a `grade`
stream, so it is arithmetic, and that dash can become a number.

**2. A speed–duration curve.** The cycling side has `meanMaxCurve` and derives FTP from it. The running
twin — best average speed sustained over each duration — does not exist, even though it is what pace
zones and race predictions should be built on. From two points on it comes **critical speed**: the
sustainable-pace asymptote, running's FTP, derived from training the athlete already did rather than from
a test.

## Requirements (acceptance criteria)

- [x] A pure `lib/analytics/pace-model.ts` exports `gradeCostFactor`, `gradeAdjustedSpeed`,
      `gradeAdjustedStream`, `meanGradeAdjustedSpeed`, `speedDurationCurve`, `mergeSpeedCurves` and
      `criticalSpeed`. No store, no clock, no Garmin.
- [x] `gradeCostFactor` is a parabola whose **vertex is at the cheapest gradient**, pinned through
      `f(0) = 1` and `f(+10) ≈ 1.5`. That construction — rather than three free coefficients — is what
      guarantees the cost turns back **up** below −10% instead of promising ever-cheaper running.
- [x] It rises monotonically uphill, clamps beyond ±`MAX_GRADE_PCT`, treats an unusable gradient as flat,
      and never claims running is more than free.
- [x] `meanGradeAdjustedSpeed` is **time-weighted**, so a sample at a standstill cannot count as much as a
      minute of running.
- [x] The activity page's `Tempo skorygowane` row becomes a real number wherever a grade stream exists,
      and the stream stack gains a derived GAP chart — for pace sports only, and only when a grade stream
      exists, so a flat run never gets a duplicate of its pace chart.
- [x] `speedDurationCurve` uses a prefix-sum sliding window (O(n) per duration), omits durations longer
      than the session, honours a sample interval other than 1 s, and **includes** stopped samples — a
      window containing a rest genuinely averaged less, and excluding rests would silently redefine the
      metric as "best speed while moving".
- [x] `mergeSpeedCurves` takes the envelope across sessions, because one session is a day's shape and the
      envelope is the runner.
- [x] `criticalSpeed` solves `d = CS·t + D′` from a short and a long point, refuses two points closer
      than 2× apart (noise would dominate the slope), and never reports a negative anaerobic capacity.
- [x] The running page charts the curve from a bounded batched speed-only read and states the 1 Hz
      assumption and that it is training data, not a test result.
- [x] Unit + API-integration tests pass (no e2e)
- [x] Built only from `lib/ui` components + design tokens
- [x] No secrets logged or committed

## API contract

No new endpoint. `ActivityStats.pace.gradeAdjustedSecPerKm` is now populated from streams.
`RunningData` gains:

```ts
speedCurve: SpeedDurationPoint[];      // { durationS, speedMps, paceSecPerKm }, ascending
criticalSpeed: CriticalSpeed | null;   // { speedMps, paceSecPerKm, dPrimeM, fromDurationsS }
```

## UI

Activity page: one more chart in the `Wysiłek` group, and a filled-in row in the pace group. Running
page: a `Krzywa tempa` card (`Card` + `TrendChart` + tokens) with critical speed and D′ above the curve,
plus the caveats in the note.

## Design / implementation notes

- The cost model is explicitly a MODEL: two runners do not pay the same hill penalty and the curve is
  fitted to level-ground economy. Good enough to make a hilly run comparable to a flat one; not good
  enough to quote as a race time. Said in the engine header and on the chart's note.
- The handler now resolves the elapsed axis once and shares it between GAP, best efforts and the curve
  rather than recomputing it three times.
- The running page's curve read reuses the bounded batched pattern the HR-zone split already established,
  and inherits its 1 Hz assumption — which is stated to the reader rather than hidden.

## Test plan

- **Unit (`pace-model.test.ts`):** the flat anchor, the +10% anchor, the vertex being a true minimum with
  the curve rising either side, uphill monotonicity, clamping, NaN handling, the free-running floor;
  uphill/downhill direction of GAP; stream gaps; time-weighting; curve window selection, the rest-inside-
  window rule, sample-interval handling, degenerate inputs; envelope merging; and critical speed
  recovering known parameters, choosing anchors, refusing close points, and flooring D′.
- **API integration:** the GAP stat derived uphill and downhill and absent without a grade stream; the
  curve built as an envelope across runs, critical speed estimated, and both empty without speed streams.

## Closeout

- Commits: `e63dffd` — feat: grade-adjusted pace and the speed-duration curve (spec 042)
- Notes / follow-ups:
  - A test records that Garmin sends no grade-adjusted field at all, so the handler's `??` deference is
    future-proofing rather than live behaviour.
  - The curve assumes 1 Hz because no time stream is loaded in the batched read. Loading `time` too would
    fix the short end for watches that sample every 4 s; it doubles the read, so it is a deliberate trade
    rather than an oversight.
  - GAP is not yet fed into best efforts (spec 040) or into the matched-route ranking (spec 041). Ranking
    a hilly route's outings by GAP rather than raw pace would be strictly fairer.
  - `speedDurationCurve` is sport-agnostic; the walking page can take it unchanged.
