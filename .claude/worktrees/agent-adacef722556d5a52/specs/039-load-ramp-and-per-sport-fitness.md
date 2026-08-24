# Spec 039 — How fast load is rising, and per-sport fitness

- **Status:** Closed <!-- Draft → Approved → Closed -->
- **Module:** `apps/web/src/lib/server/analytics/load-risk.ts` + `modules/training/`
- **Owner agent:** module-dev
- **Depends on:** 025 (training overview + PMC), 020 (sport taxonomy), 037 (shared sport lanes)

## Context

The training page has CTL, ATL and TSB. Those say where the athlete **is**. Two derived numbers say
where they are **headed**, which is where overuse injuries come from — and both fall straight out of
the PMC series already computed:

1. **Acute:chronic workload ratio** — the last week's load against the six-week base. Outside roughly
   0.8–1.3 the athlete is either detraining or doing markedly more than they are trained for.
2. **Ramp rate** — CTL points gained per week. A ratio can look perfectly calm while fitness is being
   forced up ten points a week, which is a different mistake with the same ending.

Separately, a **multisport** athlete's single whole-athlete CTL hides the case that matters most to
them: run fitness sliding while bike fitness climbs. The same engine run per sport family answers it,
and this repo's whole premise (spec 025, the walk/run/bike athlete) makes that the more important half
of this spec.

## Requirements (acceptance criteria)

- [x] A pure `lib/server/analytics/load-risk.ts` exports `loadRisk` and `bandFor` — a PMC series in, a
      ratio + ramp + band + advice out. No store, no clock, no Garmin.
- [x] The ratio reuses the PMC's **own** ATL/CTL rather than a second pair of rolling sums, so it can
      never disagree with the chart it sits under.
- [x] Both numbers are `null` — not a reassuring 1.0 — until `MIN_HISTORY_DAYS` of continuous series
      exist, or while CTL is still zero. The card renders the reason instead.
- [x] The ramp rate is measured over a fortnight (`RAMP_WINDOW_DAYS`) so one big weekend cannot pass
      for a trend, and is divided by the span that actually exists rather than by an assumed one.
- [x] `bandFor` lets the ratio decide the band and lets the ramp rate only ever make the verdict
      **worse**: a calm ratio with fitness climbing hard still reads as overreaching.
- [x] A low ratio alone is not detraining — the ramp rate has to be falling too, otherwise an easy week
      would be reported as losing fitness.
- [x] Every band carries a Polish sentence saying what to do about it, and the card states that the
      ratio is a population finding rather than a personal law.
- [x] The training overview reports per-family CTL/ATL/TSB/band plus that family's own ratio, fittest
      first, using the shared lane colour and label. A family that produced no load is omitted, and a
      single-sport athlete gets no breakdown at all (it would repeat the total).
- [x] Unit + API-integration tests pass (no e2e)
- [x] Built only from `lib/ui` components + design tokens
- [x] No secrets logged or committed

## API contract

No new endpoint. `TrainingOverviewData` gains:

```ts
readonly risk: LoadRisk;          // { acwr, rampRatePerWeek, band, advice, historyDays }
readonly perSport: SportFitness[]; // per family: ctl/atl/tsb/band + its own LoadRisk, fittest first
```

## UI

`LoadRiskCard.svelte` under the PMC chart, from `Card` + `Badge` + tokens: the band as a header badge,
the two numbers with what each one means, the advice sentence, then the per-family rows. Under the
history floor: one paragraph explaining the floor and how many days exist, no numbers and no badge.

## Design / implementation notes

- Per-family PMCs run the same `buildTrainingLoad` with the same options over that family's activities,
  so a family's numbers are directly comparable to the whole-athlete pair. It costs no extra store read
  — the activities are already in memory.
- `loadRisk`'s history floor does double duty: a family with three sessions gets a `null` ratio rather
  than a frightening number, without the caller needing its own guard.
- Only families whose band is genuinely worth attention get a badge in the breakdown; badging "steady"
  on every row would make the one that matters invisible.

## Test plan

- **Unit (`load-risk.test.ts`):** the history floor, an empty series and a zero CTL all withhold;
  the ratio matches ATL÷CTL; each band boundary; the ramp measured in points per week and smoothed over
  the fortnight; forced fitness caught behind a calm ratio; detraining distinguished from an easy week.
- **API integration (`training.api.test.ts`):** the ratio appears once enough history exists and is
  withheld when it does not; families are scored on their own history and ordered fittest first with
  shared labels/lanes; a family with no load is omitted; an athlete with no load gets an empty
  breakdown rather than a crash.
- **Unit (`LoadRiskCard.svelte.test.ts`):** the explained-absence path, both numbers, the signed ramp,
  the band and advice, the population-not-law caveat, the single-sport case, and selective flagging.

## Closeout

- Commits: `364520b` — feat(training): load ramp rate, ACWR and per-sport fitness (spec 039)
- Notes / follow-ups:
  - ACWR here is EWMA-based (the PMC's own 7/42-day constants), not the rolling-average form some of the
    literature uses. That was a deliberate consistency choice over fidelity to any one paper; the
    numbers differ slightly from a rolling-sum ACWR and the same trend shows in both.
  - The per-family loop builds one PMC per family. With six families that is six passes over the same
    in-memory array — cheap today, and the place to look first if the page ever slows down.
  - Not done here: charting per-family CTL over time. The engine already returns each family's full
    series; only a view is missing.
  - A "what will this session do to my form" preview (Strava's impact estimate) is the natural next
    step and needs nothing new — `activityLoad` plus one more EWMA step.
