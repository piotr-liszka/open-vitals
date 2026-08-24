# Spec 047 — Global range switch

- **Status:** Closed <!-- Draft → Approved → Closed -->
- **Module:** `apps/web/src/lib/` (range primitives + `lib/ui`) and every range-aware module
- **Owner agent:** module-dev
- **Depends on:** 015 (local store), 018 (local dates), 028 (start-page trend charts), 034 (mobile layout)
- **Also windows:** 037 (monthly/yearly volume), 039 (per-sport fitness), 044 (intensity mix),
  045 (intensity minutes) — these landed while this spec was in flight; the window they analyse is now
  the global range, and their charts share its bucket lattice.

## Context

The app grew two unrelated range selectors: the start page offers **7 / 14 / 30 dni** (`?trend=`, spec 028,
drives the StatTile sparklines) and Wnioski offers **7 / 30 / 90 / 365** (`?window=`). Every other surface has
a window hardcoded in its loader — Trening 12 weeks, Marsz 12 weeks, Analityka 30 days, Panel widgets 8 weeks
/ 30 days — so "show me the last year" is impossible on most of the app and the two switches that do exist
disagree about what a range even is.

This replaces both with **one global range**, chosen once in the topbar and honoured by every card that can
honour it, extended with **1 rok** and **cały czas**. Cards that follow the range say so with a small
indicator, so it is never ambiguous whether a number is "today" or "the whole window".

## Requirements (acceptance criteria)

- [x] One range set, defined once: **7 dni / 14 dni / 30 dni / 1 rok / cały czas** (`RangeKey = '7' | '14' | '30' | '365' | 'all'`).
- [x] The switch lives in the **AppShell topbar**, so it renders on every range-aware page with no per-page markup.
- [x] On phones the segments fall back to short labels (`7d 14d 30d 1r ∞`) and the control never widens the topbar.
- [x] The choice travels in the URL as `?range=` — shareable, SSR-correct, survives reload, back button works.
- [x] The last choice is remembered per device (`localStorage`) and re-applied when landing on a range-aware page without `?range=`.
- [x] `cały czas` resolves to the **earliest synced day** (`store.coverage().earliest`), not an unbounded query; with no data it degrades to the 7-day default.
- [x] Long ranges bucket their chart series (day → week → month) so a 5-year window is readable and does not ship thousands of points.
- [x] The old `?trend=` (start page) and `?window=` (Wnioski) selectors are **removed**; old links redirect/degrade to the global param rather than 404 or 500.
- [x] Every card whose content follows the range shows a **RangeBadge** — a small chip with the active range label and a `title` tooltip explaining it.
- [x] Cards that deliberately ignore the range (today's snapshot, condition/readiness, coverage, activity detail, heatmap year grid) show **no** badge.
- [x] Range-aware surfaces: Start (metric tiles + timeline), Wnioski, Panel (dynamic widgets), Trening overview + sport subpages, Analityka, Aktywności.
- [x] Panel widgets are range-aware **through the registry**, so a user-added widget inherits the behaviour without touching the grid.
- [x] A hand-typed `?range=` value outside the set falls back to the default instead of 400/500-ing or widening the query.
- [x] Unit + API-integration tests pass (no e2e)
- [x] Built only from `lib/ui` components + design tokens (if UI)
- [x] No secrets logged or committed

## API contract

No new endpoints. The range is a **query parameter on existing page loads** and a new option on existing
module loaders.

```
GET /?range=30                  → start page: metric tiles + timeline over the range
GET /insights?range=all         → Wnioski over the full synced history
GET /dashboard?range=365        → Panel: every range-aware widget over 1 year
GET /training?range=30          → Trening overview window
GET /training/{bieg|rower|marsz}?range=…
GET /analytics?range=…
GET /activities?range=…         → list filtered to the range (combines with sport/search/sort)

range ∈ {7,14,30,365,all}; anything else → the default (7). Never 4xx: the loader sanitizes.
```

Shared contract (`$lib/range.ts`):

```ts
type RangeKey = '7' | '14' | '30' | '365' | 'all';
interface ResolvedRange {
  key: RangeKey;
  start: DayKey;          // inclusive
  end: DayKey;            // today in the user's zone
  days: number;           // inclusive day count
  label: string;          // "30 dni" / "cały czas"
  bucket: 'day' | 'week' | 'month';
  /** true when `all` was clamped to the earliest synced day */
  clamped: boolean;
}
```

## UI

- **`lib/ui/RangeSwitch.svelte`** — the global control. Wraps `SegmentedControl` (extended with an
  optional `short` label per option), owns the `?range=` navigation (`goto` + `replaceState` +
  `keepFocus` + `noScroll` + `invalidateAll`) and the `localStorage` write. Rendered by `AppShell` as a
  direct child of `.topbar`, immediately before `.topbar-actions` — NOT nested inside it: a slot inside
  the action cluster can only be as wide as those buttons, which clipped the last segment off the switch
  on a phone.
- **`lib/ui/RangeBadge.svelte`** — the indicator: `Icon` (`clock`) + the active range label in a
  hairline chip, `title` tooltip _"Ten kafelek pokazuje dane z wybranego zakresu (30 dni). Zmień zakres
  na górze strony."_ Exposed on `Card` via a `range?: string` prop so a ranged card is one prop away,
  and used directly in section headers that are not `Card`s (the metric-tile grid).
- **States:** unchanged per surface. Empty ranges (a 7-day window with no synced days) keep each card's
  existing empty copy; the badge still shows so the emptiness is attributable to the range.
- **Light + dark** via tokens only (`--color-surface-2`, `--color-border`, `--color-text-muted`).
- **A11y:** the switch stays an ARIA radiogroup (`aria-label="Zakres danych"`); the badge is not
  interactive and carries its explanation in `title` + visible text, not colour alone.
- **Mobile:** below 768px the switch uses short labels and takes a **full-width row of its own** under
  the title and buttons (the bar wraps; its height becomes a floor rather than a fixed value). Five
  segments cannot share a 375px row with a title and two buttons, and a half-collapsed range switch is
  worse than a taller bar. The track scrolls rather than clips if it ever still overflows.

## Design / implementation notes

- **`lib/range.ts`** (client-safe, pure — no `Date.now()`, no `$lib/server` import): the key set, the
  option list with long+short labels, `parseRange`, `resolveRange(key, today, earliest)`, `bucketFor(days)`,
  and `routeSupportsRange(pathname)` so `AppShell` can decide visibility without every page opting in.
- **`lib/server/range-context.ts`**: `resolveRangeForUser({ store, clock, timeZone }, userId, key)` —
  reads `coverage().earliest` **only** when `key === 'all'`, so the common path adds zero queries.
- **`lib/series.ts`**: `bucketSeries(days, values, bucket)` — collapses a daily series into weekly or
  monthly means/sums, preserving `null` gaps as gaps (a bucket with no data stays a gap, it does not
  become 0). Pure and unit-tested; used by the dashboard tiles, analytics and the metric-trend widget.
- Data reads stay **local** (`createLocalGarminService`, spec 015), so a 1-year or all-time window is one
  store query per metric with no 31-day chunking and no sidecar traffic.
- `AppShell` gains `range?: 'auto' | 'off'` (default `'auto'`). `'off'` is passed by the Base-tier start
  page, which displays no processed data at all.
- Timeline's `pastDays` clamp rises from 60 to 400 and the event `limit` scales with the window, so a
  1-year timeline is dense-but-bounded rather than silently truncated to 60 days.
- `TREND_WINDOWS` / `parseTrendDays` (spec 028) are removed; their callers move to `parseRange`.
  `INSIGHT_WINDOWS` / `isInsightWindow` **survive** — no longer as a selector, but as the validator for
  the two callers that name a fixed baseline: the start page's condition block and the long-standing
  `GET /api/insights?window=` contract (widened to include `14`, and keeping `90` for callers that
  still ask for it). `loadInsights` therefore takes either a `ResolvedRange` (the page) or an explicit
  day count (a fixed baseline), so the start page can pin condition/readiness at
  `CONDITION_WINDOW_DAYS` regardless of the global range — "how am I right now" must not become
  "how was I over five years".
- `withRange(href, url)` hangs the active range on nav/sub-nav links to range-aware destinations, so
  changing page keeps the chosen window instead of rendering the default and then correcting itself.
  `SubNav` compares tab paths rather than whole hrefs so a query string cannot break its active state.
- Edge cases: no synced data (`earliest === null`) → `all` degrades to the default window and the badge
  reads the degraded label; a range whose start precedes `earliest` is clamped to `earliest`; a
  single-day range is still valid (charts render a single point, not a crash).

## Test plan

- **Unit:** `parseRange` (valid / junk / absent / out-of-set); `resolveRange` for each key incl. `all`
  with and without `earliest`, and clamping; `bucketFor` thresholds; `bucketSeries` (gap preservation,
  week/month boundaries, partial trailing bucket); `routeSupportsRange`.
- **Component (jsdom):** `RangeSwitch` renders all five options, marks the active one from the URL, calls
  `goto` with the updated param, writes the pref; `RangeBadge` renders label + tooltip; `Card` shows the
  badge only when `range` is set; `SegmentedControl` keeps working without `short`.
- **API integration (mock adapters):** each range-aware loader (`loadDashboard`, `loadInsights`,
  `loadTimeline`, `loadWidgetData`, `loadTrainingOverview`, `loadWalking`, `loadRunning`, `loadAnalytics`,
  `loadActivities`) called with a 7-day and an all-time `ResolvedRange` — assert the returned window
  bounds, the series length/bucketing, and that an out-of-set key never reaches the store.
- **Sidecar (pytest):** N/A — no sidecar change (reads are local).

## Closeout

- Commits: `c1b1c8c` — feat: one global data range switch, 7d → all time (spec 047).
- `pnpm run verify`: **1020 tests pass** (1 skipped), 0 svelte-check errors, Prettier clean, build OK.
- Verified in the running app (dev stack, mock adapters) at desktop and 375&nbsp;px:
  - The switch renders in the topbar on every range-aware route and is absent on Base-tier Start.
  - Picking `1 rok` rewrote the URL to `?range=365`, re-ran the loaders, and moved the start-page
    timeline to "Ostatnie 365 dni"; the badge followed to "1 rok".
  - The sidebar link to Wnioski carried `?range=365`; Ustawienia and Mapa ciepła did **not** get the
    parameter, as intended.
  - On the Panel, `Seria` and `Zebrane dane` carried **no** badge while `Objętość treningu`,
    `Typy aktywności`, `Ostatnie aktywności` and `Trend metryki` all carried "1 rok" — the registry
    flag driving the indicator, as designed.
  - `?range=9999` degraded to `7 dni` with no error; a bare `/insights` was restored to the
    remembered `?range=365` from `localStorage`.

### Notes / follow-ups

- **Deliberately NOT range-driven**, each because a window would change the claim rather than narrow
  it. None of these carry an indicator: the PMC form chart (42-day-constant model), running personal
  bests and the runner archetype, the Panel's coverage + active-week-streak widgets, the start page's
  condition/readiness block (pinned to `CONDITION_WINDOW_DAYS`), and `/training/rower`'s all-time
  mean-max power curve — which is also excluded from `RANGE_AWARE_ROUTES`, so no switch appears there.
- **Statistics stay daily; only charts bucket.** Analytics min/max/avg/best and the insights engine's
  anomalies and correlations are computed before bucketing, so they still describe real days.
- The volume widget caps at 14 bars and says so ("Pokazano 14 ostatnich z 53 w zakresie") rather than
  cropping silently.
- `GET /api/insights?window=` still accepts `90` for backwards compatibility even though the UI no
  longer offers it; `/insights?window=…` links 308-redirect to `?range=…` (90 → 30, the nearest
  offered window).
- Follow-up worth considering: a per-user default range in Postgres, so the choice survives across
  devices instead of only per browser (this spec chose `localStorage` deliberately — no migration,
  no per-request read).
