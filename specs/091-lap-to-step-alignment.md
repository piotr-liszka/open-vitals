# Spec 091 — Który krok planu to które okrążenie

- **Status:** Closed <!-- Draft → Approved → Closed -->
- **Module:** `apps/web/src/modules/activity-detail/`
- **Owner agent:** module-dev
- **Depends on:** 085 (plan vs actual)

## Context

Spec 085 compares a planned session to what was done on **session aggregates** — average pace,
normalised power, average heart rate — and its own closeout names the cost: for an interval session
the aggregate sits between the work and the recovery bands, so a perfectly executed 5×1k reads as
"outside the band". The athlete's plans are exactly this shape (`Easy 6 km + przebiezki`,
`4×2 min @166 spm`), so the case the comparison handles worst is their normal week.

The data to fix it is already loaded: the activity's laps are on the page, and the plan's flattened
step sequence was built for the Przebieg strip. What is missing is the correspondence between them.

## Requirements (acceptance criteria)

- [x] A pure aligner maps planned steps to executed laps in order, allowing for a lap the athlete
      never pressed (one planned step spanning several laps, or several steps inside one lap).
- [x] Alignment is **reported, not assumed**: each pairing carries a confidence, and a session whose
      laps cannot be reconciled with the plan says so rather than showing a confident wrong mapping.
      A missed lap press must not silently shift every subsequent pairing.
- [x] Where alignment succeeds, intensity is scored **per step against that step's own laps** instead
      of against the session aggregate — so an interval session executed correctly reads as on-plan.
- [x] Where it fails, the comparison falls back to spec 085's aggregate scoring, unchanged, and the
      card says which of the two produced the number on screen.
- [x] The Przebieg strip marks the executed extent of each planned block, so the eye can check the
      aligner rather than trust it.
- [x] `compliancePct` continues to mean exactly what spec 085 defined; only its inputs get more
      precise.
- [x] Copy in `pl.ts` + `en.ts`.
- [x] Unit + API-integration tests pass (no e2e)
- [x] Built only from `lib/ui` components + design tokens
- [x] No secrets logged or committed

## API contract

No new endpoint. The existing activity payload's `plannedWorkout` gains per-step alignment:

```
steps[].alignment: { lapIndices: number[], confidence: 'exact'|'approximate'|'none' } | null
```

## UI

`PlannedVsActual.svelte` gains a per-step actual drawn from the aligned laps, and `TimelineStrip`
gains the executed extent. Existing `lib/ui` components only.

## Design / implementation notes

- The aligner is pure and client-safe, beside `activity-plan.ts`. Laps in, steps in, pairing out —
  no store, no clock.
- Distance-based steps align on cumulative distance; time-based steps on cumulative elapsed time.
  A `lap`-typed step aligns on the lap boundary itself, which is what it means.
- Tolerance must be generous in one direction only: an athlete overshooting a 1 km rep by 40 m is the
  same rep; a 400 m lap is not.

## Test plan

- **Unit:** a clean 5×(1k + 400m) session aligns one step per lap; the same session with the warmup
  and first rep in one lap still aligns; a session whose laps bear no relation to the plan reports
  `none` and does not pair; per-step intensity scoring inside vs outside the band.
- **API integration (mock adapters):** an interval activity with matching laps returns per-step
  alignment and a compliance that reflects the work steps, not the blended average; the same activity
  with no laps falls back to aggregate scoring.
- **Component:** the card shows per-step actuals when aligned and says so when it fell back.

## Closeout

- Commits: this change.
- **Aligned on `laps`, not `typedSplits`.** `activity-laps.ts` documents the typed splits as
  aggregates, not a sequence — `buildSplitSummary` folds them into one row per class with a `count`
  of merged stretches, and says outright that the page never draws them as a timeline because the
  order is unknown. An aligner needs an ordered, non-overlapping partition; only `laps` supplies one.
- The aligner solves the whole segmentation at once (a small DP over lap boundaries) rather than
  walking greedily, so a merged lap is paid for locally instead of cascading through everything after
  it — which is the failure the requirement about a missed lap press was written against.
- Tolerance is asymmetric on purpose: 25% over, 10% under. A 1 km rep run to 1040 m is the same rep;
  a 400 m lap is not.
- Below 60% of steps landing within tolerance the result is `unreconciled` and pairs NOTHING, falling
  back to spec 085's aggregate scoring. A step swallowed by a neighbour's lap reports `none` with no
  lap indices rather than splitting that lap, which would invent a measurement.
- `met` for an intensity row is now "every judged rep was in band" and the score is the mean of the
  per-rep scores, so the two can no longer disagree — the trap spec 085's closeout named.
- The API carries more than this spec's contract line: `alignment` adds `startS`/`endS`/`distanceM`/
  `durationS`/`paceSecPerKm`/`avgHr`/`power`, and `PlannedWorkoutComparison.intensitySource`
  (`'per-step' | 'session-average'`) is how the card says which comparison produced the number.
  Without them the strip and card would redo lap arithmetic in the browser off data already computed.
- The alignment is computed twice — once in `buildPlannedComparison`, once in the API for
  `plannedStructure` — mirroring the existing double `matchPlanned` call, so a caller cannot hand the
  scorer an alignment belonging to a different plan. Bounded by `MAX_ALIGNMENT_WORK`.
- Follow-ups:
  - The strictest edge of the gate: a step whose laps do not record its axis at all (a treadmill lap
    with no distance, against a distance step) is never `exact`, so a single-step plan in that
    situation reports `unreconciled` rather than pairing approximately.
