# Spec 026 — Activity detail: charts, grouped stats, laps and a training verdict

- **Status:** Approved <!-- Draft → Approved → Closed -->
- **Module:** `apps/web/src/modules/activity-detail/`
- **Owner agent:** module-dev
- **Depends on:** 015 (local store), 016/017 (chart read-out + axes), 023 (activity data depth),
  025 (multisport training — `sportKeysInGroup` + the `sports` store filter)

## Context

Spec 023 fixed the data half: HR streams are no longer dropped, a dozen more streams are captured,
laps and Garmin's typed splits are fetched, and the rich `raw` payload is projected into a typed
`ActivityStats`. None of it was on screen. The activity page still showed six tiles, a map, a power
curve and two zone widgets — while `calories` and `trainingLoad` sat in the contract unrendered.

This spec is the **UI half**: draw a chart for every stream the device recorded, group the long tail
of numbers into readable clusters instead of a wall of tiles, put laps and the run/walk breakdown on
the page, and answer the question the user actually asked at the top — *how good was this session?*

The user's own words: more charts (elevation, pace, HR, stamina, performance condition, cadence,
vertical ratio, GCT balance, respiration, run/walk), more stats (a seventeen-group list), a
comparison to the training it belonged to, and "all charts need legend, x-axis, y-axis, and should
be interactive".

## Requirements (acceptance criteria)

- [x] A time-series chart is rendered **for every stream that exists** — HR, pace/speed, power,
      cadence, elevation, grade, temperature, respiration, stamina (+ potential), performance
      condition, vertical ratio, vertical oscillation, ground-contact time, ground-contact balance,
      stride length — and **no frame at all** for a stream the device did not record.
- [x] Every chart has a labelled y axis with its unit printed once, an x axis, a hover read-out and
      keyboard access (inherited from `TrendChart`, spec 017).
- [x] The x axis is **elapsed time or distance covered**, switchable; picking distance *re-samples*
      the streams onto an evenly-spaced distance lattice rather than relabelling a time axis. The
      switch is hidden when no speed stream exists, because distance cannot then be derived.
- [x] All charts share ONE sample lattice, so clicking any chart pins the same moment in every
      chart, and a read-out strip resolves that moment to a time, a distance and one value per metric.
- [x] Charts are grouped (Wysiłek · Teren i warunki · Fizjologia · Dynamika biegu), not stacked as a
      flat list of sixteen frames.
- [x] The stats are rendered as **grouped sections** mirroring the user's list — Czas i ruch, Tempo i
      prędkość, Wysokość, Tętno, Moc, Dynamika biegu/Kadencja, Kalorie i nawodnienie, Efekt
      treningowy, Fizjologia, Temperatura, Minuty intensywności — never one flat grid.
- [x] A group with nothing measured in it is **not rendered**; sport-irrelevant groups collapse
      (running dynamics → cadence only on a ride, no min/km rows for cycling).
- [x] Inside a rendered group, a **genuinely unavailable** value renders `—` with the reason (tooltip
      + screen-reader text). A row with neither value nor reason is dropped.
- [x] `calories` and `trainingLoad` — in the projection since spec 015, never drawn — now appear.
- [x] Laps render as a table with **only the columns some lap actually filled in**; Garmin's typed
      splits render as a composition bar + summary (run / walk / stand, interval work / rest).
- [x] A "how good was this session?" verdict sits at the top: the workout planned for that day (from
      the calendar spec 024 syncs) scored against what was actually done, **plus** the session against
      the athlete's own recent training. Nothing is fabricated when either side is missing.
- [x] The existing route map, power curve, power-zone donut and IF/TSS/NP card are **re-homed** into
      the new structure, not appended.
- [x] Unit + API-integration tests pass (no e2e).
- [x] Built only from `lib/ui` components + design tokens.
- [x] No secrets logged or committed.

## API contract

No new endpoint. `ActivityDetailData` (`activity-detail.types.ts`) gains one field:

```ts
readonly trainingComparison: TrainingComparison | null;
```

```ts
interface TrainingComparison {
  load: number | null;             // stress score for this session
  loadMethod: 'garmin' | 'power' | 'hr' | 'none';
  recentMedianLoad: number | null; // median comparable session, last 42 days
  recentCount: number;
  vsRecentPct: number | null;      // load / median − 1, percent
  ctlBefore: number | null;        // fitness on the eve of the session
  atlBefore: number | null;        // fatigue on the eve of the session
  tsbBefore: number | null;        // form carried into it (ctl − atl)
  bandBefore: TrainingBand | null;
  loadRatio: number | null;        // load / ctlBefore
  verdict: 'easy' | 'steady' | 'hard' | 'peak' | 'unknown';
  summary: string;                 // one plain Polish sentence
  windowDays: 42;
  plannedWorkout: PlannedWorkoutComparison | null;
  plannedWorkoutStatus: 'not-synced' | 'none-scheduled' | 'linked';
}

interface PlannedWorkoutComparison {
  workoutId: string; name: string; scheduledDay: DayKey;
  kind: 'workout' | 'race' | 'note'; description: string | null;
  targetDurationS: number | null; targetDistanceM: number | null; targetLoad: number | null;
  steps: PlannedStepComparison[];   // { key: 'duration'|'distance'|'load', target, actual, met }
  compliancePct: number | null;     // 100 = exactly on plan
}
```

### Item 5.3 — comparison to the training: what was chosen and why

The user asked to compare an activity with the **planned workout** it belonged to. When this work
started that link did not exist. Mid-flight, **spec 024 landed the calendar sync**
(`/calendar-service/`, `LocalStore.listPlannedEvents`, `PlannedEvent` with
`estimatedDurationS` / `estimatedDistanceM` / `targetLoad`), so the page now does **both**:

1. **Against the plan (the literal ask).** `matchPlanned` picks the event scheduled on the activity's
   own day whose sport family matches — a plan naming no sport matches anything, a Tuesday swim never
   fulfils a Tuesday interval run — preferring workouts over races and the most specific target over
   the vaguest. Each target the plan actually set becomes a step (czas / dystans / obciążenie) scored
   against what was done, `met` inside ±10%. `compliancePct` penalises deviation **in either
   direction**: going 150% of the prescribed hour is as much a departure from the plan as doing half.
2. **Against the athlete's own recent training (the more robust answer).** Stress vs. the **median
   comparable session of the last 42 days**; stress vs. **CTL** on the eve (`loadRatio`); the **TSB**
   carried into it; a one-sentence Polish summary and a four-way verdict badge.

**Honesty about the empty case.** "No plan matched" has two very different meanings, and the page
distinguishes them: `none-scheduled` (the calendar covers this date and had nothing for this sport —
the session was off-plan) vs. `not-synced` (we hold no calendar data within ±30 days, so we cannot
tell). Claiming the first when the truth is the second would invent a rest day the athlete never
planned.

**Scoring of the *load* comparison is restricted on purpose.** Both the session and its history are
scored on the same chain — Garmin's own training load, else HR TRIMP — never power TSS. Deriving
power TSS for the history would need a second heavy stream query, and mixing methods would compare
apples to oranges. The power-derived TSS still appears on its own in the IF/TSS card.

## UI

`lib/ui` used: `Card`, `Badge`, `StatTile`, `Table`, `StackedBar`, `SegmentedControl`, `TrendChart`,
`LeafletMap`. Tokens only; no raw colour or magic px. Both themes work through tokens; the section
markers and chart lines use `--lane-*`.

**Section order (top → bottom):**

1. **Identity** — breadcrumb, name, sport badge, Polish weekday + date + time.
2. **Kluczowe liczby** — up to eight `StatTile`s, sport-aware (tempo for a run, prędkość for a ride),
   including the previously-unrendered kalorie and obciążenie.
3. **Ocena treningu** — the verdict (item 5.3) + IF/TSS/NP/kJ + the matched planned workout with a
   per-target hit/miss and a compliance score, or the two-way empty state.
4. **Trasa** — the interactive map (GPS only).
5. **Przebieg** — the grouped stream charts on one shared crosshair, with the time/distance switch.
6. **Strefy intensywności** — HR zone bars + the power-zone donut; then **Najlepsza moc**.
7. **Bieg, marsz i postoje** (typed splits) and **Okrążenia** (lap table).
8. **Szczegóły** — the grouped stat sections.

States: sections 4–8 each disappear when their data does not exist (a treadmill run is a short page);
"Szczegóły" falls back to an explanatory empty state; the charts panel shows a hover invitation until
a moment is pinned; every absent leaf is an explained `—`.

## Design / implementation notes

- **Pure core, thin components.** `activity-format.ts`, `activity-charts.ts`, `activity-stat-groups.ts`,
  `activity-laps.ts` and `activity-comparison.ts` hold every decision; the `.svelte` files only draw.
  All are total functions over injected data — no clock, no I/O, no `process.env`.
- **The handler stays a port consumer.** `loadActivityDetail` adds ONE bounded query
  (`listActivities` over a 120-day window, filtered to the same sport family) to seed the comparison.
  120 days rather than 42 because CTL has a 42-day time constant and starts from zero.
- **Determinism.** The verdict is anchored on the activity's own local day, never on "today", so an
  old activity's page never changes meaning. `startTimeLocal` is Garmin's wall clock — the day key is
  a slice, with no timezone maths — and Polish rendering goes through `$lib/date` (`formatDay`).
- **Decimation.** Charts draw ~600 shared lattice points. Garmin's details endpoint already caps
  streams at `maxChartSize=2000`, so this is a mild thinning; exact extremes always come from the stat
  groups, never from reading a chart.
- **Typed splits are aggregates, not a sequence.** Garmin returns one row per class with a `count` of
  stretches (`noOfSplits`), so they are drawn as a composition bar — a timeline would invent an order.
- **Design-system note.** The dense `value / label` readout in `StatSections.svelte` is deliberately
  not `StatTile`: a bordered tile per number would nest cards and stretch the section over three
  screens. It is built from tokens only and is a candidate for promotion to `lib/ui` (see follow-ups).

## Test plan

- **Unit:** `activity-format.test.ts` (Polish formatting, dash-not-zero, absurd-pace rejection);
  `activity-charts.test.ts` (stream discovery, gap handling, distance integration, distance lattice
  stalling on a stop, decimation, sport-aware pace vs speed, two-series stamina);
  `activity-stat-groups.test.ts` (empty groups hidden, explained dashes, sport-awareness, HR-zone
  source preference); `activity-laps.test.ts` (column survival, per-sport pace/speed, split
  aggregation); `activity-comparison.test.ts` (median, verdict buckets, before-the-day isolation,
  window isolation, HR fallback, refusal to score, determinism, plan matching by sport family and
  kind, per-target hit/miss, symmetric compliance penalty, the two empty states).
- **API integration (mock adapters):** `activity-detail.api.test.ts` — the comparison is built from
  store history, a different sport family does not pollute the norm, a first-ever activity still gets
  an honest no-norm comparison, a planned workout in the store is linked and scored, and
  `none-scheduled` is distinguished from `not-synced`.
- **Component (jsdom):** `StatSections.svelte.test.ts` (explained dash + screen-reader text),
  `ActivityStreamsPanel.svelte.test.ts` (one chart per recorded stream, grouping, axis switch only
  with a speed stream, hover invitation).
- **Sidecar (pytest):** N/A — no sidecar change.

## Closeout

- Commits: _(pending)_
- **Rendered as `—` with an explanation, because Garmin genuinely does not give it:**
  - **Tempo skorygowane o nachylenie (grade-adjusted pace)** — absent from the activity payload and
    `summaryDTO`; Strava computes GAP, Garmin does not expose one.
  - **Średnia temperatura** — Garmin reports only `minTemperature`/`maxTemperature`; the average is
    derived from the temperature stream, so a device that did not record one leaves it absent.
  - **Bieg / marsz / stanie** — only recoverable from `/typedsplits`; a sport or watch that generates
    none has no breakdown (`timing.idleS`, duration − moving, is the cheap fallback and is shown).
  - **Odczuwany wysiłek (RPE) i samopoczucie** — only present when the athlete filled them in on the
    watch or in Garmin Connect.
  - **Stamina (na starcie / na końcu / minimalna)** — reported only by newer watches and only for
    some sports; the stamina chart likewise appears only when the stream exists.
  - **Wynik wykonania (execution score)** — Garmin returns it only for a session executed against a
    planned workout; nothing in our payload carries it. (Our own `compliancePct` against the synced
    calendar plan is a different, locally-computed number and is shown when a plan is matched.)
  - **Znormalizowana moc** — only for power-meter activities; the handler computes its own NP from the
    power stream where one exists.
  - **Porównanie z zaplanowanym treningiem** — rendered when a plan is matched; otherwise the block
    states which of the two reasons applies (`none-scheduled` vs `not-synced`, see item 5.3) rather
    than showing a dash.
- **Chart-primitive gaps hit (reported, not patched — `lib/ui` is owned elsewhere):**
  1. `TrendChart` exposes only `selectedIndex` (a *pinned* index) and `onSelect`; there is no
     `hoverIndex` binding, so the shared crosshair works on click/tap, not on hover.
  2. The x axis is categorical (index-based). A true numeric axis is not supported — hence the
     distance mode re-samples onto a distance-uniform lattice instead.
  3. No inverted y axis, so the pace chart necessarily reads "higher = slower"; the chart says so.
  4. The y-gutter width is measured per chart from its widest tick, so stacked charts do not share a
     left edge and their plot areas are a few pixels out of alignment.
- Follow-ups: promote the dense readout grid to `lib/ui` (`ReadoutGrid`); a planned workout's
  individual *steps* (Garmin's interval structure) are not synced — only the whole-session estimates —
  so per-interval adherence is still out of reach; a sticky in-page section nav would help on a long
  ride page; distance could also be integrated from GPS for activities with a track but no speed
  stream.
