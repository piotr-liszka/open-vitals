# Spec 057 — Prediction trend + the Performance Predictions card

- **Status:** Draft <!-- Draft → Approved → Closed -->
- **Module:** `apps/web/src/modules/running/` (+ `lib/analytics/race-predictor.ts`, `lib/ui/DeltaBadge.svelte`, `lib/server/store/*`)
- **Owner agent:** module-dev
- **Depends on:** 018 (running page), 042 (critical speed), 043 (race predictor), 047 (global range), 054 (stored best efforts)

## Context

`/training/bieg` predicts race times in a dense five-column table, and it answers only half the
question an athlete asks. The number itself ("42:10 for 10 km") is useless without the second number:
**is that better or worse than I was?** Spec 043 deferred exactly that trend, noting it "needs the
bests recomputed as of each past date" — which was expensive when the only source was `personalBests()`
projections over whole activities.

Spec 054 changed that. Every measured effort is now stored per activity **with its local day**, so
"my fastest 5 km as of 90 days ago" is one indexed query. This spec (a) feeds the predictor those
**measured** efforts instead of even-pace projections, (b) recomputes the same prediction against an
as-of cutoff to get a signed delta, and (c) replaces the table with a card: one row per race distance,
the projected time as the headline, the pace under it, and a delta badge trailing.

## Requirements (acceptance criteria)

- [x] Predictions are built from **measured best efforts** (spec 054's stored table) when the athlete
      has one for a distance, and fall back **per distance** to the even-pace `personalBests()`
      projection when they do not. The card never goes blank because of the switchover.
- [x] Each prediction says which basis its source came from (`fromBasis: 'measured' | 'projected'`),
      and the card shows it in the row's provenance line.
- [x] A second, **as-of** prediction is computed from only the efforts/activities dated on or before
      `today − TREND_WINDOW_DAYS` (90 days), using the same engine and the same fallback rules.
- [x] `deltaS = previousS − currentS` (positive = faster now) is exposed on the prediction contract as
      an **optional** `trend` object; it is **absent**, not zero, when either side has no prediction
      for that distance.
- [x] The cutoff day derives from the **injected clock** (`todayKey(deps.clock)` + `addDays`), never
      from `Date.now()`, so tests are deterministic.
- [x] The store's best-effort leaderboard query gains an `until` (local day, inclusive) bound,
      implemented with identical semantics in the pg adapter and the in-memory fake, and covered by
      the shared store-contract suite.
- [x] Every effort/activity read is scoped to the authenticated `userId`; a test asserts one user's
      efforts never reach another user's predictions.
- [x] `/training/bieg` renders a **Performance Predictions card** instead of the table: one row per
      race distance with the projected time as the headline number, the pace as the secondary line,
      and the delta badge trailing.
- [x] The delta badge is a shared `lib/ui` component (`DeltaBadge`), not bespoke markup, listed in
      `lib/ui/index.ts` and shown in the styleguide.
- [x] Meaning is never carried by colour alone: an arrow glyph plus a visually-hidden Polish sentence
      ("szybciej o 1:40 niż 90 dni temu") state the direction and the size of the change.
- [x] Low-confidence rows (far extrapolations) stay visible but dimmed, exactly as the table did.
- [x] No information the table showed is lost: the critical-speed estimate, the source best, its local
      day and the extrapolation factor all survive in the row's secondary lines.
- [x] Polish copy; dates via `$lib/date` helpers (never a raw `Date` in the view or the handler).
- [x] `runner-profile.ts` (spec 033) and every other `personalBests()` caller are untouched.
- [x] Unit + API-integration tests pass (no e2e)
- [x] Built only from `lib/ui` components + design tokens
- [x] No secrets logged or committed

## API contract

No new HTTP endpoint — `/training/bieg`'s loader already calls `loadRunning`. The contract changes are
additive, in `lib/analytics/race-predictor.ts` (re-exported through `modules/running/running.types.ts`):

```ts
type PredictionBasis = 'measured' | 'projected';

interface KnownBest {
  metres; timeS; label; day?;
  basis?: PredictionBasis;            // NEW — where this source came from
}

interface RaceTrend {
  deltaS: number;      // previousS − currentS. Positive = faster now.
  previousS: number;   // the as-of prediction, seconds
  sinceDay: string;    // the cutoff, local YYYY-MM-DD
}

interface RacePrediction {
  key; label; metres; riegelS; criticalSpeedS; paceSecPerKm;
  fromLabel; fromDay; extrapolation; confident;
  fromBasis: PredictionBasis | null;  // NEW
  trend?: RaceTrend;                  // NEW — ABSENT when not comparable
}

withPredictionTrend(
  current: readonly RacePrediction[],
  previous: readonly RacePrediction[],
  sinceDay: string
): RacePrediction[]
```

Store port (`lib/server/store/types.ts`):

```ts
interface TopBestEffortsQuery {
  limit: number;
  sports?: readonly string[];
  until?: string;   // NEW — only efforts whose activity day is <= this local day
}
```

Module-local pure helpers (`modules/running/race-trend.ts`):

```ts
TREND_WINDOW_DAYS = 90
trendCutoff(today: DayKey): DayKey
knownBestsFrom(efforts: readonly MeasuredEffort[], projections: readonly ProjectedBest[]): KnownBest[]
```

## UI

`modules/running/RacePredictionsCard.svelte`, built from `Card` + the new `lib/ui/DeltaBadge` + tokens
and rendered by `RunningView` where the table used to sit.

One row per race distance:

| slot | content |
|------|---------|
| lead | distance label (`10 km`) |
| headline | projected time, large, tabular figures |
| secondary | pace `/km`, the critical-speed estimate, and `Na podstawie: <best> · <local day> · zmierzony odcinek / projekcja z całego biegu`, plus `×N` and `daleka ekstrapolacja` when the extrapolation is far |
| trailing | `DeltaBadge` — green + ↓ when faster, danger + ↑ when slower, quiet "bez zmian" when the delta is exactly zero, nothing at all when there is no comparable earlier prediction |

`DeltaBadge` props: `direction: 'better' | 'worse' | 'same'`, `arrow: 'up' | 'down' | 'none'`,
`value` (the formatted magnitude, e.g. `1:40`) and `label` (the full Polish sentence, visually hidden).
Direction and arrow are separate on purpose: for a time metric "better" points **down**, for a distance
metric it would point up, and a shared component must not assume which.

States: no predictions at all → the card is absent (unchanged from spec 043 — a distance nobody can
speak to is never guessed). A row with no trend simply has no badge. Light and dark both come from
tokens (`--color-success*`, `--color-danger*`, `--color-surface-2`).

## Design / implementation notes

### Why 90 days

A training block is 8–12 weeks. Ninety days is the shortest window that reliably sits **outside** the
current block, so the comparison reads as "versus the form I brought into this block" rather than
"versus last week", which would mostly measure taper and weather. It is also long enough that a single
rest week cannot flip the sign, and short enough that the card still answers "am I improving *now*"
rather than staging a career retrospective. It is one constant (`TREND_WINDOW_DAYS`) applied to the
injected clock, so changing it is a one-line decision, not a migration.

### Why the delta is not monotone (i.e. why "slower" is reachable)

Both sides use all-time bests, so it is tempting to assume the newer side can only be faster. It
cannot be assumed, because `closestBest()` may pick a **different source distance**: an athlete whose
10 km prediction was extrapolated from a sharp 5 km, and who has since run an actual (steadier) 10 km
effort, now has a source at ratio 1 that the predictor rightly prefers — and a slower, more honest
predicted time. The switch from projections to measured efforts can move a number either way for the
same reason. So both badge directions are real, and both are unit-tested.

### Why the trend is on the Riegel estimate only

The delta must be the delta of the number the card shows as the headline, and that is the bests-based
(Riegel) estimate. The critical-speed estimate has no cheap as-of counterpart: it would need the speed
curve rebuilt from the streams of the runs that existed at the cutoff — a second batched read of up to
`SPEED_STREAM_CAP` speed streams, doubling the heaviest read on the page for a secondary number. The
as-of prediction is therefore computed **without** a critical speed, and the row keeps showing today's
CS estimate unchanged and untrended.

### Ports & adapters

`loadRunning` already takes `store`, `settings` and `clock`. It gains two extra indexed store reads
(`listTopBestEfforts` with `limit: 1`, once all-time and once with `until: cutoff`) — no new
dependency, no stream reads, no `fetch`, no `Date.now()`. `until` is an inclusive local-day bound; the
pg adapter adds one `AND e.day <= $until` inside the existing window-function query, and the in-memory
fake filters the same way before ranking, so both adapters answer identically.

### Fallback

`knownBestsFrom()` merges by distance key, measured first: a key present among the stored efforts wins,
otherwise the `personalBests()` projection for that key is used, otherwise the distance simply has no
source. The two sets are keyed compatibly (`1k`/`5k`/`10k`/`half`/`marathon` overlap; `400m`, `mile`,
`15k` exist only among measured efforts) so a partly-backfilled account gets measured sources where it
has them and projections everywhere else — never a blank card. The same merge runs on the as-of side
with the as-of inputs, so an account mid-backfill compares like with like.

## Test plan

- **Unit (`race-predictor.test.ts`):** `withPredictionTrend` — improvement (positive `deltaS`),
  regression (negative), a distance missing from the earlier snapshot gets **no** `trend` key, a
  distance missing from the current snapshot is untouched, an unchanged prediction yields `deltaS: 0`,
  and `fromBasis` propagates from the chosen `KnownBest`.
- **Unit (`race-trend.test.ts`):** `trendCutoff` is 90 days back from the given day; `knownBestsFrom`
  prefers a measured effort over a projection for the same distance, keeps the projection for a
  distance with no effort, keeps measured-only distances, uses `actualM`/`durationS` for the measured
  pair, drops effort keys not in `EFFORT_DISTANCES`, and tags every result with its basis.
- **API integration (`running.api.test.ts`, memory store + fixed clock):** predictions come from stored
  efforts when present (asserted via `fromBasis: 'measured'` and the value); fall back to projections
  when the efforts table is empty; a `trend` appears with the right sign when the athlete improved
  across the cutoff; no `trend` when there is no history before the cutoff; **per-user isolation** —
  user B's efforts never influence user A's predictions.
- **Store contract (`best-efforts-contract.test.ts`):** `until` excludes efforts after the cutoff in
  both adapters and still ranks/caps correctly.
- **UI (`DeltaBadge.svelte.test.ts`):** tone class per direction, arrow glyph per `arrow`, the
  accessible sentence is rendered, no glyph for `'none'`.
- **UI (`RacePredictionsCard.svelte.test.ts`):** a row per prediction with the headline time and pace;
  a green/down badge for an improvement and a danger/up badge for a regression; no badge without a
  trend; the dimmed class on a low-confidence row; the provenance line carries the source, its date,
  the basis and the critical-speed estimate.

## Closeout

- Commits: <hashes/links>
- Verify: `pnpm run verify` green (138 test files / 1669 tests, `svelte-check` 0 errors, prettier clean,
  production build + MCP bundle OK).
- Notes / follow-ups:
  - **The pg `until` clause is contract-tested but not executed here.** The new case runs against both
    adapters, but the Postgres half only runs with `TEST_DATABASE_URL` set and no Postgres was available
    — same caveat spec 054 left open for the same query.
  - **The critical-speed estimate is untrended.** Only the Riegel headline carries a delta; giving the
    CS number one would mean rebuilding the past speed curve from streams (see the design notes). If it
    is ever wanted, the cheap version is to store the CS estimate per sync run rather than recompute it.
  - **The trend is blind between the cutoff and today.** It compares two endpoints, so an athlete who
    peaked 45 days ago and has since faded shows the peak, not the fade. A rolling form window (best
    efforts *within* the last 90 days rather than all-time as of then) would show that instead — a
    different claim, and a different spec.
  - **`personalBests()` is now a fallback rather than the primary source for predictions.** It is still
    the primary source for the runner archetype (spec 033), which was deliberately left alone: feeding
    it measured efforts changes spec 033's numbers and belongs in its own change.
