# Spec 045 — Pace shape, and intensity minutes

- **Status:** Closed <!-- Draft → Approved → Closed -->
- **Module:** `apps/web/src/lib/analytics/pacing.ts` + `lib/server/analytics/intensity-mix.ts` + `modules/`
- **Owner agent:** module-dev
- **Depends on:** 026 (stream helpers), 038 (efficiency card it joins), 044 (intensity classification)

## Context

Two small additions with the same shape: a number the app already has the ingredients for, and no way for
the athlete to see it.

**1. Pace shape.** Every session reports an average pace, which says nothing about how the effort was
*distributed* — and after a hard session that is the first thing the athlete wants to know. Did they pace
it, or go out too hard? An average cannot tell a negative split from a fade from an interval session.

**2. Intensity minutes.** Spec 044 classifies every session into easy / moderate / hard. That same
classification gives the WHO's 150-weighted-minutes-a-week guideline for free — the one volume target that
exists for everybody rather than for athletes, and the natural companion to a page otherwise full of
athlete-only metrics. It also covers the walking half of this multisport user's training, where TSS says
very little.

## Requirements (acceptance criteria)

- [x] A pure `lib/analytics/pacing.ts` exports `pacing` and `shapeOf`. No store, no clock, no Garmin.
- [x] The halves are split by **distance**, not by time. Splitting a fading run by time puts more than half
      its distance in the first half and understates the fade.
- [x] The split point is **interpolated within a sample**, so a watch recording every 30 s does not
      quantise the halves.
- [x] Variability is the coefficient of variation of pace over ten equal-distance chunks, and it is checked
      **first** when classifying: an interval session's split balance is an accident of where the reps
      fell, so it must read as `variable` rather than `faded`.
- [x] A session under `MIN_DISTANCE_M`, with unusable axes, or whose clock never advanced is not judged.
- [x] Offered for **every** sport with a distance axis — pacing is not a running-only question.
- [x] `weeklyIntensityMinutes` gives weighted minutes per week (vigorous counted double) on a
      caller-supplied week lattice, with a `metTarget` flag against the WHO's 150.
- [x] Easy-band time earns **no** minutes, which is the deliberate difference between this and the volume
      chart: a stroll is healthy and is not moderate-intensity activity.
- [x] Weeks with no qualifying activity are **zeros, not gaps** — unlike an efficiency trend, a week with
      no training genuinely scored none, and that is the point of a guideline.
- [x] The activity page shows the pace shape alongside the aerobic-efficiency numbers (they answer the same
      "how did this session go" question) and states that the halves were split by distance.
- [x] The training page charts the weekly minutes with the target as a baseline, counts the weeks that met
      it, and hides the section when no week scored a qualifying minute.
- [x] Unit + API-integration tests pass (no e2e)
- [x] Built only from `lib/ui` components + design tokens
- [x] No secrets logged or committed

## API contract

No new endpoints.

```ts
// ActivityDetailData
readonly pacing: Pacing | null;
// { splitPct, firstHalfPaceSecPerKm, secondHalfPaceSecPerKm, variabilityPct, shape, chunks }

// TrainingOverviewData
readonly intensityWeeks: IntensityWeek[];
// { week, moderateMinutes, vigorousMinutes, weightedMinutes, metTarget }
```

## UI

Pace shape joins `ActivityEfficiency.svelte` as a wide block with a shape badge and its explanation.
Intensity minutes join `IntensityMixCard.svelte` as a second section with a `BarChart` and the target as
its `baseline`.

## Design / implementation notes

- Both additions attach to existing cards rather than adding new ones. The pace shape answers the same
  question as decoupling ("how did this session go?"), and the minutes use the same classification as the
  mix — separating them would make the page longer without making it clearer.
- `shapeOf` is exported separately from `pacing` so the classification rule is testable without building a
  stream, and the ordering (variability before split) is asserted directly.

## Test plan

- **Unit (`pacing.test.ts`):** steady/fade/negative-split detection; the distance-split proof with exact
  expected paces; an interval session classified as variable; chunk count; the short-session, unusable-axis
  and stalled-clock refusals; a mid-session stop; sample interpolation. Plus `shapeOf`'s ordering and
  boundaries.
- **Unit (`intensity-mix.test.ts`):** the double weighting, easy time earning nothing, the target flag,
  zeros for an untrained week, zeros with no max HR, lattice filtering and unclassifiable sessions.
- **API integration:** the pace shape on a run and a ride, and its absence without a distance axis or on a
  too-short session.
- **Unit (component tests):** the pace-shape block on its own with no HR data, each shape's wording, the
  distance-split note; and the minutes chart, its two summary sentences, and the hidden-when-empty path.

## Closeout

- Commits: `eed2bd0` — feat: pace shape per activity, weekly intensity minutes (spec 045)
- Notes / follow-ups:
  - Chunk variability cannot distinguish deliberate intervals from a collapse, and it does not try: it
    reports `variable` and the card says the split balance means nothing there. Reading Garmin's typed
    splits (already stored) would let the page say "interval session" outright.
  - Intensity minutes here are derived from average HR per session, so they will not match Garmin's own
    figure, which accumulates minute by minute. Garmin's own value IS in the raw payload and is shown
    per activity — this is the weekly aggregate that bulk reads cannot get at, and the difference is worth
    documenting if the two are ever shown side by side.
  - Not done: pace shape against the athlete's own norm ("you fade on long runs more than usual"), which
    needs the shape stored per activity.
