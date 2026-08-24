# Spec 036 — Notable and suspect values on an activity

- **Status:** Closed <!-- Draft → Approved → Closed -->
- **Module:** `apps/web/src/modules/activity-detail/`
- **Owner agent:** module-dev
- **Depends on:** 023 (activity stat depth), 026 (activity detail + verdict), 020 (sport taxonomy)

## Context

The activity page prints roughly sixty numbers and treats every one of them as equally interesting.
Two kinds of number are not:

1. **The notable one.** "Maks. prędkość 19,8 km/h" means nothing on its own; "the fastest you have
   run in fourteen months" is the reason to look at the page at all. Strava and Garmin both surface
   this, and we already hold the history needed to compute it — `listActivities` drops the heavy
   `raw` blob, so reading a wide window of comparable sessions is cheap.
2. **The wrong one.** A 42 km/h maximum speed in a run, a moving time longer than the elapsed time,
   400 m of climb on a flat 5 km loop — these are GPS spikes, barometer drift and dropped sensors.
   Garmin and Strava both render them as facts. Saying "this looks like a GPS spike" is something
   neither does, and it is the difference between data the athlete trusts and data they quietly
   discount.

Both are pure functions over data already loaded. Neither needs a new Garmin call.

## Requirements (acceptance criteria)

- [x] A pure `activity-highlights.ts` in the module exports `buildHighlights` and `buildSuspects`.
      It imports nothing from `$lib/server`, so the component can share its types directly.
- [x] `buildHighlights` ranks this session against the athlete's own **earlier** sessions of the same
      sport family on: distance, moving time, elevation gain, average pace (or speed for a ride),
      training load, calories and normalized power. Pace/speed comes from distance ÷ moving time for
      **both** sides, so the comparison is apples to apples on data every session carries.
- [x] Wording is derived, never assumed:
      · nothing earlier beats it and the window reaches the athlete's first session → `Rekord`;
      · nothing earlier beats it but the window is truncated → "najlepszy wynik od …" with the span
        actually examined;
      · something beats it, but the last time was ≥ 6 months ago → "najlepszy od N miesięcy";
      · otherwise a top-3 placing → "N. najlepszy wynik"; anything else is not reported.
- [x] Under `MIN_COMPARABLE` (8) comparable sessions carrying a metric, that metric is **not ranked**
      — a second-ever run is not a record. With no comparable history at all the block is absent.
- [x] Ranking is anchored on the activity's own day (spec 026's rule): a March run's standing does not
      change because it is now August.
- [x] `buildSuspects` flags, with a plain-Polish reason and a `warn`/`info` severity: a maximum speed
      beyond a per-sport ceiling, a maximum far above the average (GPS spike), climb per kilometre
      beyond a plausible ceiling, an implausible maximum heart rate or a lone HR spike, distance ÷
      time disagreeing with the reported average speed, a moving time longer than the elapsed time,
      and a long run of zero cadence mid-session.
- [x] A suspect check whose inputs are missing is silent — never a flag on absent data.
- [x] `GET /api/…` activity detail carries `highlights` and `suspects`; the page renders them above
      the detail grid, records visually distinct from warnings.
- [x] Unit + API-integration tests pass (no e2e)
- [x] Built only from `lib/ui` components + design tokens
- [x] No secrets logged or committed

## API contract

No new endpoint. `ActivityDetailData` (`activity-detail.types.ts`) gains:

```ts
readonly highlights: readonly ActivityHighlight[];   // notable placings, best first
readonly suspects: readonly SuspectValue[];          // data that looks wrong, warnings first
```

```ts
interface ActivityHighlight {
  key: string; label: string; value: string; unit?: string;
  kind: 'record' | 'notable';
  text: string;        // Polish one-liner, already resolved
  rank: number; outOf: number;
}
interface SuspectValue {
  key: string; label: string; value: string;
  text: string;        // why it looks wrong
  severity: 'warn' | 'info';
}
```

## UI

A new `ActivityFlags.svelte` in the module, rendered between the verdict and the route: `Card`,
`Badge` for the record/notable/suspect marker, tokens for the lane tint. Empty → the card is not
rendered at all (no "no highlights" state). Light + dark via `--lane-*` / `--color-warning-*` tokens.

## Design / implementation notes

- History is one bounded `listActivities` read: `{ to: activityDay, sports: familyKeys, limit }`.
  Because bulk reads omit `raw`, this stays cheap; `coversAllHistory` is simply "we came back with
  fewer rows than the limit", so no second count query is needed to word a record honestly.
- The `other` family cannot be enumerated from the taxonomy (an unmapped Garmin key lands there), so
  it is read wide and filtered in memory — the same compromise `loadHistory` already makes.
- Sport ceilings live in one table (`SPEED_CEILING_KMH`) so re-tuning them is a one-line change.
- The two engines are deliberately separate: suspects need only this activity, highlights need the
  window. A page with no history still gets its data-quality flags.

## Test plan

- **Unit (`activity-highlights.test.ts`):** a longest-ever run reports `Rekord`; the same run with a
  truncated window reports the span instead; a run beaten only 14 months ago reports "od 14 miesięcy";
  a 2nd-best reports the placing; fewer than 8 comparable sessions reports nothing; later activities
  never affect the standing. Suspects: each check fires on a rigged input, and every check is silent
  when its inputs are null.
- **API integration (`activity-detail.api.test.ts`, mock adapters):** the response carries
  `highlights`/`suspects`; an activity with a single-session history has empty `highlights` but still
  gets suspects.

## Closeout

- Commits: `f27f1ca` — feat(activity): say which numbers are records and which look wrong (spec 036)
- Notes / follow-ups:
  - Ties are counted apart from wins, which the tests forced out into the open: equalling a single best
    reports "wyrównany", and a value SEVERAL earlier sessions report identically (a watch handing every
    walk the same training load) is skipped entirely rather than crowned. Without that rule the badge
    fires on constants and stops meaning anything.
  - The verdict window (spec 026) and the ranking window now share ONE store read. That removed a query
    rather than adding one, because bulk reads omit the `raw` blob.
  - `coversAllHistory` is inferred from the row count against `HIGHLIGHT_LIMIT`. An athlete with more
    than 2000 sessions in one family will read "najlepszy w ostatnich N miesięcy" instead of "rekord" —
    understated rather than wrong, which is the right way round.
  - Suspect thresholds are heuristics on ONE table each (`SPEED_CEILING_KMH`, the module constants).
    They are the first thing to re-tune against real flagged sessions.
  - Not done here: acting on a suspect value (excluding it from averages, or from the PB ranking). The
    flags are advisory only, and the ranking still uses the raw number.
