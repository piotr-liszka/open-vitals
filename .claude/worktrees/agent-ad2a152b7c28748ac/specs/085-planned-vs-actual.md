# Spec 085 — Plan kontra wykonanie: co miało być, co było, co poprawić

- **Status:** Closed <!-- Draft → Approved → Closed -->
- **Module:** `apps/web/src/modules/activity-detail/`
- **Owner agent:** module-dev
- **Depends on:** 024 (synced calendar), 026 (training verdict), 050/066 (authored workouts + steps), 069 (library), 082 (description/provenance)

## Context

The activity page already matches a session to the day's plan, but the result is a one-line footnote
at the bottom of "Ocena treningu" — a badge with the plan's title and, most of the time, the sentence
*"Ten wpis w kalendarzu nie ma mierzalnych celów do porównania."* Two separate problems produce that.

**First, we read the wrong half of the plan.** `loadPlanned` reads only `store.listPlannedEvents` —
the *Garmin* calendar, whose entries are a title and a description and rarely carry
`estimatedDurationS`/`estimatedDistanceM`. The athlete's **own** authored workouts (spec 050/066)
sit in `authored_workouts` on the very same day, carry a full structured `WorkoutStep[]` with
duration, distance and target ranges (pace/power/HR), and are never consulted. The one source that
always has measurable targets is the one we ignore.

**Second, even a matched plan gets no room.** The athlete asked for a section of its own, an explicit
percentage, a target-vs-actual comparison — including inside **Przebieg**, where the planned
structure can be laid against what was really run — a few indicators, and a short "what to do
differently next time". A badge in a card footer answers none of that.

Nothing here needs a new call to Garmin. Every input is already synced and already parsed.

## Requirements (acceptance criteria)

### Read both halves of the plan (`activity-detail.api.ts`)

- [x] `loadPlanned` reads authored workouts for the same ±`CALENDAR_PROBE_DAYS` window via
      `store.listWorkouts({ from, to })` alongside `listPlannedEvents`, and folds both into
      `PlannedInput.sameDay`.
- [x] `calendarHasData` is true when **either** source holds anything near the date, so an athlete
      who plans only in OpenVitals never sees "kalendarz nie zsynchronizowany".
- [x] `PlannedCandidate` gains `origin: 'garmin' | 'authored'` and `steps: readonly WorkoutStep[] | null`.
      For an authored workout, `estimatedDurationS`/`estimatedDistanceM` are derived with the existing
      `estimateWorkoutDurationS`/`estimateWorkoutDistanceM` — not re-implemented.

### Match (`activity-comparison.ts`, still pure)

- [x] `matchPlanned` prefers an **authored** candidate over a Garmin one when both match the day and
      sport family, because only the authored one carries targets. Existing tie-breaks
      (workout → race → note, then most targets, then id) keep their order after that.
- [x] A plan naming a different sport family is still not a match. No behaviour change there.

### Score (`activity-comparison.ts`)

- [x] `PlannedStepComparison` gains the intensity keys `'pace' | 'power' | 'hr'` next to
      `duration | distance | load`, each carrying the plan's target range and what was actually held
      (avg pace / NP / avg HR), so a session can be off-plan on intensity while on-plan on distance.
- [x] Intensity targets are read off the step tree: the **work** steps' target range, collapsed to one
      low/high band per target type. Steps with `target.type === 'none'` contribute nothing.
- [x] `met` for an intensity step is "inside the band" (inclusive), not the ±10% rule — a band is
      already a tolerance and applying a second one would widen it twice.
- [x] `compliancePct` keeps its meaning (100 = exactly on plan, deviation in either direction costs)
      and now averages over the intensity steps too. `null` only when the plan set no measurable
      target at all.
- [x] New pure `planTakeaways(comparison)` returns 0–3 short sentences — what was off and in which
      direction, phrased as guidance for next time ("Sesja miała być łatwa, a wyszła o 52% mocniejsza
      od normy — następnym razem trzymaj tempo z planu"). Deterministic, no clock, no store.
      Returns `[]` when the plan was met or nothing is measurable.

### The planned structure against the real one (Przebieg)

- [x] When the matched plan carries `steps`, `ActivityDetailData` exposes a `plannedStructure`:
      the flattened step sequence (repeat blocks expanded) with each step's kind, its planned
      seconds/metres and its target band.
- [x] `ActivityStreamsPanel` draws that sequence as a strip above the stream chart, on the same
      elapsed-time axis, so planned blocks line up with what was actually held. Steps ending on
      `lap` or `calories` have no time extent and are drawn as markers, not blocks.
- [x] The strip is absent — not empty, not a placeholder — when no plan matched or the plan has no steps.

### The section (`PlannedVsActual.svelte`, new)

- [x] A `Card` of its own titled "Plan kontra wykonanie", rendered directly after `TrainingVerdict`,
      only when a plan matched. Shows: plan title + `Badge` for its origin, the compliance percentage
      as the lead figure, a target-vs-actual row per `PlannedStepComparison` (target, actual, met),
      and the takeaway sentences.
- [x] `TrainingVerdict` loses the plan footnote; the plan lives in the new section only. Its
      `not-synced` / `none-scheduled` explanations stay where they are — those are statements about
      the verdict's confidence, not about a plan.
- [x] Copy is in `pl.ts` + `en.ts`, no hardcoded strings in the components.
- [x] Unit + API-integration tests pass (no e2e)
- [x] Built only from `lib/ui` components + design tokens
- [x] No secrets logged or committed

## API contract

No new endpoint. `GET /api/activities/:id` (already served by `activity-detail.api.ts`) grows two
fields on the existing payload — see `activity-detail.types.ts`:

```
res.trainingComparison.plannedWorkout: PlannedWorkoutComparison | null   // steps[] now includes pace/power/hr
res.trainingComparison.plannedTakeaways: PlanTakeaway[]                  // 0–3 { key, metric, pct }
res.plannedStructure: PlannedStructureStep[] | null                      // flattened, for Przebieg
```

## UI

`Card`, `Badge`, `StatTile`, `ProgressBar`, `Table` from `lib/ui`; the strip is drawn inside
`ActivityStreamsPanel` with existing chart tokens (`--lane-*`). States: matched (full section),
no plan (section absent), plan matched but nothing measurable (section shows the plan and says so,
without inventing a percentage). Light + dark via tokens only.

## Design / implementation notes

- `loadPlanned` is the only place that touches the store; `activity-comparison.ts` stays pure —
  activities and plans in, verdict out.
- Two sources, one candidate type: normalising an `AuthoredWorkout` into a `PlannedCandidate` at the
  edge keeps the matcher from learning about two shapes.
- Intensity comparison uses the activity's aggregates (avg pace, NP, avg HR), not per-lap alignment.
  Lap-to-step alignment is a harder problem (a missed lap press shifts everything) and is explicitly
  out of scope; the Przebieg strip shows the two side by side and lets the eye do it.
- `PLAN_TOLERANCE` stays 10% for duration/distance/load.

## Test plan

- **Unit:** `matchPlanned` prefers authored over Garmin on the same day; intensity steps score
  inside/outside band; `complianceOf` with mixed step kinds; `planTakeaways` for on-plan (empty),
  over-distance, and too-hard cases; step-tree flattening expands `repeat` blocks.
- **API integration (mock adapters):** an activity with an authored workout on its day returns
  `plannedWorkout.origin === 'authored'` with a non-null `compliancePct` and a `plannedStructure`;
  the same activity with only a bare Garmin calendar entry returns `compliancePct: null` and
  `plannedStructure: null`; an activity with neither returns `plannedWorkoutStatus: 'none-scheduled'`.
- **Component:** `PlannedVsActual.svelte` renders the percentage and one row per step; renders
  nothing when `plannedWorkout` is null.

## Closeout

- Commits: this change.
- Where the code landed: the whole planned half is a NEW file,
  `modules/activity-detail/activity-plan.ts`, not an extension of `activity-comparison.ts` as the
  headings above imply. `activity-comparison.ts` imports `$lib/server/analytics/training-load`, so a
  component importing the matcher from there fails the production build — and only the production
  build, which is why `pnpm run build` is in `verify`. Every symbol is re-exported from
  `activity-comparison.ts`, so no importer outside the module noticed the move.
- `plannedTakeaways` ships as `PlanTakeaway[]` (`{ key, metric, pct }`), not `string[]`. A pure
  function returning finished Polish prose would be untranslatable and would put copy outside the
  catalog, contradicting this spec's own "copy is in `pl.ts` + `en.ts`". The component renders
  `t(key, { metric, pct })`. Contract line above corrected.
- `PlannedStepComparison.label` was REMOVED — it carried hardcoded Polish in the payload. The
  component keys off `step.key` into `plan.step.*`. Its only consumer was the `TrainingVerdict` plan
  block, which this spec deletes. The row also gained `targetLow`/`targetHigh`; `target` is the band
  midpoint for intensity rows.
- An out-of-band intensity row scores against the BREACHED EDGE, not the midpoint, so anywhere
  inside the band scores 1.0 — otherwise `met: true` and a sub-100% compliance would disagree.
- The Przebieg strip renders on the **Czas** axis only. On the Dystans axis a time-based step
  sequence does not line up with the charts, and a strip that silently stops meaning what it shows
  is worse than an absent one.
- Follow-ups:
  - Lap-to-step alignment is still out of scope (a missed lap press shifts everything). The strip
    puts plan and execution side by side and lets the eye do it.
  - Intensity is compared on session AGGREGATES (avg pace, NP, avg HR). For an interval session the
    aggregate sits between the work and recovery bands, so a perfectly executed 5×1k can read as
    "outside the band". Fixing that needs the lap alignment above.
  - Spec 081 (match by Garmin's own `workoutId`) is still unimplemented, so matching remains
    day + sport family. Two similar runs on one day still pick by the tie-break, not by identity.
