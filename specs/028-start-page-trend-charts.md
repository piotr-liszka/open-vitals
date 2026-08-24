# Spec 028 — Start-page trend charts: real lines, x axis, 7 / 14 / 30-day switcher

- **Status:** Closed <!-- Draft → Approved → Closed -->
- **Module:** `apps/web/src/modules/metrics-dashboard/`
- **Owner agent:** module-dev
- **Depends on:** 010 (metrics dashboard), 017 (chart axes), 018 (local dates)

## Context

The "Dziś" tiles on the start page carry a `Sparkline` that is presented as a 7-day trend but is not a
truthful one: `dashboard.api.ts` **filters missing days out** of the series, so a week with two gaps is
drawn as a continuous 5-point line whose x positions belong to no particular day, and the `%` delta is
computed across whatever survived the filter. There is no x axis, so a reader cannot tell which day a
peak belongs to, and the window is hardcoded to 7 days with no way to zoom out.

This spec makes those charts honest: one slot per calendar day (gaps stay gaps), an x axis with dates,
and a 7 / 14 / 30-day switcher. Data is a local-store read (spec 015), so a wider window is cheap.

## Requirements (acceptance criteria)

- [x] Each tile's chart plots **one slot per calendar day** in the window; a day with no data is a
      **gap**, never a point silently pulled forward.
- [x] Charts show an **x axis with dates** (thinned to fit) and a hoverable/tappable read-out.
- [x] A **7 / 14 / 30-day switcher** sits in the "Dziś" header (`SegmentedControl`); the choice is
      carried in the URL (`?trend=14`) so it survives reload, is shareable and SSR-correct.
- [x] The `%` delta compares the **first and last day that actually have data** in the window.
- [x] Values are formatted per metric in the chart read-out too (sleep as `7h 05m`, steps as `11 238`),
      not raw seconds.
- [x] An invalid/absent `?trend` falls back to 7 days (no 500).
- [x] Unit + API-integration tests pass (no e2e)
- [x] Built only from `lib/ui` components + design tokens
- [x] No secrets logged or committed

## API contract

`apps/web/src/modules/metrics-dashboard/dashboard.types.ts`

```
MetricTile {
  key, label, accent, value, unit, delta, goodWhen,
  format: 'int' | 'duration' | 'decimal' | 'plain',   // NEW — shared by API + UI formatting
  series: (number | null)[]                            // CHANGED — one entry per day, null = gap
}

DashboardData {
  connected, analyticsEnabled, date, trendDays,
  days: string[]        // NEW — YYYY-MM-DD, index-aligned with every tile's `series`
  tiles: MetricTile[]
}

loadDashboard(deps, { trendDays }: DashboardOptions = {})   // trendDays ∈ {7, 14, 30}, default 7
GET /  (page load)  ?trend=7|14|30
```

## UI

- `MetricsDashboard.svelte`: header gains `SegmentedControl` (`7 dni` / `14 dni` / `30 dni`, `size="sm"`);
  the page owns navigation (`goto('?trend=…', { replaceState, noScroll, keepFocus })`).
- Tile charts switch from `Sparkline` to `TrendChart` with `xAxis`, `yAxis={false}`, `legend={false}`,
  `height≈92` — the same primitive the rest of the app uses, so gaps, ticks, tooltip and keyboard
  interaction come for free.
- States: analytics consent off → unchanged upsell card, no charts; window with no data at all → tile
  keeps its `—` readout and renders no chart; busy → existing in-place dimming.
- Light + dark via lane tokens; no new colours.

## Design / implementation notes

- New `dashboard.format.ts` (pure, tested): `formatMetricValue(n, format)` — the single formatter used
  by the API for the headline value and by the UI for chart read-outs, so the two can never drift.
- `dashboard.api.ts`: build `days = dayRange(start, today)` from `$lib/date` and map the metric range
  onto it by day key (never by array position — the sidecar may return fewer days than requested).
  `deltaPct` walks to the first/last **defined** entries.
- `series` carries `null` (not `NaN`) for gaps: `NaN` does not survive `JSON.stringify` on the API path.
  The component converts `null → NaN` when handing values to `TrendChart`, whose gap contract is
  non-finite values.
- The page load reads `?trend` and validates it against the allowed set; SvelteKit's dependency tracking
  re-runs the load on change.

## Test plan

- **Unit:** `formatMetricValue` per format (int/duration/decimal/plain, zero, null);
  `parseTrendDays` accepts 7/14/30 and falls back on junk (`'0'`, `'abc'`, `undefined`, `'400'`).
- **API integration (mock adapters):** `loadDashboard` with `trendDays: 14` returns 14 `days` and
  14-entry series; a mock range missing a middle day yields `null` at that index and the value/delta come
  from the defined ends; consent off ⇒ empty series, no delta; default is 7 days.
- **Component:** `MetricsDashboard` renders the switcher, marks the active window, calls
  `onTrendDaysChange` on select, and renders a chart only when analytics is on and ≥2 defined points.

## Closeout

- Commits: `e2fecf8` — feat: sync freshness in the sidebar, honest start-page trends, tile-safe readouts (specs 027-029)
- Notes / follow-ups: The chart lives in `StatTile`'s `sparkline` slot, so tiles are ~90px taller than before.
  `Sparkline` is still used elsewhere (styleguide, other views) and was left untouched.
