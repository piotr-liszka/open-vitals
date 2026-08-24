# Spec 046 — Climbs with VAM, and the consistency year grid

- **Status:** Closed <!-- Draft → Approved → Closed -->
- **Module:** `apps/web/src/lib/analytics/climbs.ts` + `lib/ui/YearGrid.svelte` + `modules/activity-detail/` + `modules/volume/`
- **Owner agent:** module-dev
- **Depends on:** 026 (stream helpers), 037 (volume page), 042 (`lib/analytics/` boundary)

## Context

Two last gaps, both about a shape the app reduces to a single number.

**1. Climbs.** The activity page reports total elevation gain, which answers "how hilly was it" and not
"what did I climb". 600 m spread over rolling terrain and 600 m in one 8 km ascent are the same number and
nothing alike. **VAM** (metres of ascent per hour) is what makes climbs comparable to each other and to
past efforts — it is to climbing what pace is to the flat.

**2. Consistency.** Weekly bars say how much; they cannot show streaks, gaps or seasonality. A year drawn
as one grid of days shows all three at once, which is why that shape is the one people recognise.

## Requirements (acceptance criteria)

- [x] A pure `lib/analytics/climbs.ts` exports `findClimbs`, `categoryFor` and `climbedMetres`. No store,
      no clock, no Garmin.
- [x] A climb is a continuous ascent that clears **both** a minimum gain and a minimum average gradient.
      The gain gate alone would accept a 20 km drag at 0.5%; the gradient gate alone would accept a 30 m
      hump.
- [x] A climb survives a **dip** smaller than `MAX_DROP_M` — real roads have false flats, and splitting on
      every metre lost would turn one mountain pass into thirty climbs.
- [x] Gain is measured to the climb's **peak**, not to where it ended.
- [x] VAM is computed over the climb's own elapsed time, **pauses included** — a long stop mid-climb
      genuinely lowered the rate of ascent.
- [x] Categories come from one table of gain × gradient scores, re-tunable in a line, and the card says
      they are a rough guide because barometric elevation drifts.
- [x] A flat or descent-only activity, a missing axis, or too few samples all yield no climbs.
- [x] A shared `lib/ui/YearGrid.svelte` draws a calendar year as seven rows by ISO week, with the first
      column padded so 1 January lands on its real weekday, and 366 cells in a leap year.
- [x] Shading is by **quantile**, not by a linear share of the maximum: one 40 km long run must not push
      every ordinary day into the palest band and make a consistent year look empty.
- [x] A day with no activity is a visibly **empty** cell, not the lightest shade — a rest day and a very
      short session are different things, and spotting gaps is the point.
- [x] The grid names its active-day count for assistive tech, carries a per-day tooltip, ignores days
      outside the year and days that are not real dates, and scrolls inside its own box.
- [x] The activity page shows the climbs with VAM and what share of the day's gain was actual climbing; the
      volume page shows the current year's grid.
- [x] Unit + API-integration tests pass (no e2e)
- [x] Built only from `lib/ui` components + design tokens
- [x] No secrets logged or committed

## API contract

No new endpoints.

```ts
// ActivityDetailData
readonly climbs: readonly Climb[];
// { index, gainM, distanceM, durationS, gradePct, vam, startS, score, categoryKey, categoryLabel }

// VolumeData
readonly gridDays: VolumeDay[];  // { day, km, title } — the current year only
readonly gridYear: number;
```

## UI

`ActivityClimbs.svelte` (`Card` + `Badge` + a scrolling table) on the activity page. `YearGrid.svelte` is a
new shared primitive — 366 spans, no SVG, native `title` tooltips, quantile shading mixed from a caller
lane token towards the surface so it works in both themes — used by the volume page.

## Design / implementation notes

- Climb detection is one forward pass with an open-climb state and a peak tracker; the dip tolerance is the
  only non-obvious part and is commented at its branch.
- The grid is deliberately DOM-cheap and interaction-free. It is a picture, not a chart: no axes, no
  read-out, nothing to hover except the native tooltip.
- The grid's data is built from rows already in memory on the volume page, so it costs no extra store read.
  Only the current year is drawn — a grid per year would be a scrolling wall.

## Test plan

- **Unit (`climbs.test.ts`):** a steady ascent's gain/distance/gradient; VAM against a known figure; gain
  measured to the peak; a dip absorbed and a real descent splitting; both floors rejecting their respective
  false positives; an open climb closed at the end of the activity; flat and descent-only courses; missing
  axes; non-finite samples; the reported start offset; a pause lowering VAM; and the category table.
- **Unit (`YearGrid.svelte.test.ts`):** 365 vs 366 cells, weekday padding, empty rest cells, quantile
  shading spreading ordinary days across the palette, the darkest band, the accessible name, tooltips and
  their fallback, out-of-year and invalid days ignored, the legend, and an empty year.
- **API integration:** climbs found with VAM on an ascent, none on the flat, none without an elevation
  stream, none with no streams at all; and the grid's per-day sums, tooltip inflection, ordering and its
  empty case.

## Closeout

- Commits: `cd7af9c` — feat: climbs with VAM, and the consistency year grid (spec 046)
- Notes / follow-ups:
  - Climbs are detected on the raw elevation stream. A smoothing pass would cut spurious short climbs from a
    noisy barometer; the dip tolerance already absorbs most of it, and the card is explicit that categories
    are approximate.
  - The natural next step is ranking a climb against past ascents of the SAME climb — which is
    segment matching, and spec 041's closeout already names the cell primitives it would build on.
  - `YearGrid` takes any day/value list, so a grid of intensity minutes, sleep or steps is a view change
    only. The volume page picked kilometres because that is what its page is about.
  - The grid draws the current year only. A year picker is a small addition once there is a reason to look
    back.
