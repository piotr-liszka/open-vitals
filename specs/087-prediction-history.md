# Spec 087 — Przewidywane czasy dzień po dniu

- **Status:** Closed <!-- Draft → Approved → Closed -->
- **Module:** `apps/web/src/modules/running/`
- **Owner agent:** module-dev
- **Depends on:** 043 (predictions), 054 (stored best efforts), 057 (prediction trend + card)

## Context

"Przewidywane czasy" prints four numbers and a delta badge, and spec 057's own closeout names the
gap it left: *"The trend is blind between the cutoff and today. It compares two endpoints."* The
athlete wants the shape between them — how the prediction moved day by day.

The number itself is already a pure recomputation: `predictRaces` over the fastest effort per
distance as it stood on a given day. So a history needs no stored predictions and no new Garmin
call. What it needs is the **record progression** — for each distance key, the efforts that were a
personal best at the moment they were set — because the fastest-effort-so-far is a step function
that only moves on those days. Everything between two records is a flat line, and computing it is
arithmetic on data already in the table.

Today there is no way to ask for that progression. `listTopBestEfforts` answers "the fastest N of all
time" and, with `until`, "as it stood on one day". Asking it once per day would be 365 indexed
queries for one chart. One query that returns only the record-setters is a handful of rows.

## Requirements (acceptance criteria)

### Store: the record progression (new port method)

- [x] `listBestEffortProgression(userId, { sports? }): Promise<RankedBestEffort[]>` is added to the
      store port, returning ONLY efforts that were a personal best for their distance key at the
      moment they were set, ordered by distance then day ascending.
- [x] The pg adapter does it in ONE query with a running-minimum window function
      (`min(duration_s) OVER (PARTITION BY distance_key ORDER BY day, activity_id ROWS BETWEEN
      UNBOUNDED PRECEDING AND 1 PRECEDING)`, keeping rows that beat it or are first). Ties resolve the
      same way `listTopBestEfforts` already resolves them: earlier day wins, activity id breaks the
      rest. An equal time is NOT a new record.
- [x] The memory adapter produces byte-identical output for the same input, and the store contract
      test covers both — including the tie case and a distance with exactly one effort.

### The series (pure, `race-history.ts`)

- [x] `predictionHistory(...)` returns, per race target (5 km, 10 km, półmaraton, maraton), one value
      per day across the requested window: the prediction as it stood on that day.
- [x] Each day's value is a REAL recomputation through the existing `predictRaces` — the same engine
      the card uses — over the bests standing on that day. No interpolation between records, no
      separate formula. A day with no basis is `null`, and the chart leaves a gap rather than
      drawing through it.
- [x] The measured-effort progression and the even-pace projection fallback are combined exactly as
      `knownBestsFrom` already combines them, so a day in the history and the same day computed by
      the card agree.
- [x] Computed incrementally across the window (running bests carried forward), not by re-scanning
      the whole history once per day.
- [x] **No critical speed in the history**, for the reason spec 057 already gave for the as-of half:
      the past speed–duration curve would need up to `SPEED_STREAM_CAP` streams re-read per day. The
      UI says the line is the measured-bests (Riegel) model, so it is never mistaken for the card's
      blended figure.

### The card

- [x] A "Historia przewidywań" section on `/training/run`, directly under "Przewidywane czasy".
- [x] One distance on screen at a time, chosen with `FilterChips` — four race times on one axis would
      flatten the 5 km line under the marathon's. Default is the distance with the most history.
- [x] `TrendChart` with time-formatted ticks and tooltip (mm:ss, or h:mm:ss past an hour), plus the
      window's net change stated in words next to the chart.
- [x] Follows the page's global `?range=`, like the rest of `/training/run`.
- [x] Absent when the athlete has no measured efforts at all — an empty chart explains nothing.
- [x] Copy in `pl.ts` + `en.ts`; no hardcoded strings in the component.
- [x] Unit + API-integration tests pass (no e2e)
- [x] Built only from `lib/ui` components + design tokens
- [x] No secrets logged or committed

## API contract

No new endpoint. `RunningData` (see `running.types.ts`) grows:

```
predictionHistory: {
  days: string[];                                   // YYYY-MM-DD, one per day in range
  distances: { key, label, metres, values: (number|null)[], netChangeS: number|null }[]
} | null
```

## UI

`Card`, `FilterChips`, `TrendChart`, `DeltaBadge` from `lib/ui`. States: no efforts (section absent),
one distance with a flat line (a record that has not moved — say so rather than drawing an
explanation-free flat line), full history. Light + dark via tokens.

## Design / implementation notes

- `race-history.ts` is pure and client-safe; the store read stays in `running.api.ts`.
- The progression query is unbounded in time on purpose: it is a handful of rows per distance, and
  bounding it would mean losing the standing record that a window starts from.
- Reuse `RACE_TARGETS`, `predictRaces`, `knownBestsFrom`, `personalBests`. Nothing about the
  prediction model changes in this spec — only when it is evaluated.

## Test plan

- **Unit:** progression → per-day bests (a record mid-window steps the line, days before the first
  effort are `null`, a flat stretch stays flat); a day in `predictionHistory` equals `predictRaces`
  called directly with the bests standing that day; net change sign for an improving and a
  stagnant distance.
- **Store contract:** `listBestEffortProgression` on both adapters — records only, tie handling,
  sport filter, single-effort distance, empty table.
- **API integration (mock adapters):** `/training/run` payload carries `predictionHistory` with one
  value per day in range; `null` when the athlete has no efforts.
- **Component:** chips switch the series; the section renders nothing when `predictionHistory` is null.

## Closeout

- Commits: this change.
- The pg half of the store contract SKIPS without `TEST_DATABASE_URL`, so a green `pnpm run verify`
  would NOT have proved the new window function works. It was run for real against a throwaway
  `postgres:16-alpine` on port 55432 (port 5433 is vagus-karta's and was left alone): 32 cases in
  `best-efforts-contract.test.ts`, 138 across all eight contract files, all green. Container removed.
- A distance with no defined value on any day is dropped from `distances`, and the history is `null`
  when that leaves nothing — a marathon chip that draws an empty chart for a 5 km-only runner is the
  "an empty chart explains nothing" case this spec already rules out, one level down.
- `netChangeS` is `null`, not `0`, when the window holds fewer than two defined values. One point is
  not a change; `0` is reserved for a record that genuinely did not move, which the card says in words.
- The memory adapter's `listTopBestEfforts` and `listBestEffortProgression` now share one
  `rankedEfforts()` helper (sport filter, `until` bound, the join equivalent), so the two reads
  cannot drift apart in the fake while staying in step in pg.
- Follow-ups:
  - **Payload size.** One value per day per distance means `?range=all` (`MAX_RANGE_DAYS = 5480`) can
    carry ~22k numbers, about 130 KB. CPU is negligible. Bucketing long ranges the way
    `mileageBuckets` already does is the fix if it ever matters; it was not done here because this
    spec is explicit about one value per day.
  - The history is the measured-bests (Riegel) line only — no critical speed, for the reason spec 057
    gave. The card's headline figure blends both, so the chart and the number above it answer
    slightly different questions. Storing CS per sync run (spec 057's own follow-up) would close it.
  - Sport filtering is what keeps a walk out of a run's progression: unfiltered, both share a
    distance-key partition. The running page always passes `sportKeysInGroup('run')`. Documented in
    the contract test rather than partitioning by sport, to stay the same shape as `listTopBestEfforts`.
