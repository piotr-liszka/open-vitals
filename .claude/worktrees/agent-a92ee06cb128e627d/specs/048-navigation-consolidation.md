# Spec 048 — Navigation consolidation

- **Status:** Closed <!-- Draft → Approved → Closed -->
- **Module:** `apps/web/src/lib/nav.ts` + `lib/ui/NavLinks.svelte`, `modules/insights/`, `modules/analytics/` (removed), `modules/heatmap/`, `modules/dashboards/`
- **Owner agent:** module-dev (with ui-designer for `NavLinks`)
- **Depends on:** 014 (tiers), 015 (nav as single source of truth), 021 (settings consolidation), 025 (training section + SubNav pattern), 047 (global range switch)

## Context

The primary nav has grown to **nine flat items with no grouping** and has not been revisited since spec 025,
while specs 035–047 added thirteen features underneath it. An audit of every page against `origin/main` found
three problems that are navigation problems, not page problems:

1. **`Analityka` is a strict subset of `Wnioski`.** Both build their charts from the same `METRICS` list, and
   since spec 047 both cover the same user-chosen global range — so the two pages now render *the same charts
   over the same window*, two nav items apart. `AnalyticsMetric` is a superset of `MetricChart` (same
   `key/label/accent/unit/format/days/series` plus `min/max/avg/total/deltaPct/count/best/worst`), so the only
   thing Analityka adds is a statistics row.
2. **`Mapa ciepła` is a lens on `Aktywności`, not a peer.** It filters the same activity set by sport and year.
   Spec 025 already established the section + `SubNav` pattern for exactly this shape and `/training` uses it.
3. **`Panel` sits at nav position 2 — the most valuable slot — for a page that is empty by default** and whose
   six widgets each duplicate a page that does the same job better: `weekly-volume` ≈ Trening's "Objętość
   treningu", `activity-types` ≈ Trening's "Podział na sporty", `recent-activities` ≈ Aktywności,
   `coverage` ≈ Dane, `metric-trend` ≈ Wnioski. Only `streak` is unique. It is also unspecced — the code cites
   "spec 016", but `specs/016` is *chart-readout*.

The outcome: **9 items → 7, in three labelled groups**, no analysis surface lost. Two related findings are
deliberately **out of scope** and written up as follow-ups (see Design notes): the Rower page's missing
volume/zones parity, and de-duplicating the readiness/radar/weekly-volume components.

## Requirements (acceptance criteria)

**Grouped nav**

- [x] `NavItem` gains an optional `group?: string`; `NAV_ITEMS` stays the single source of truth (spec 015).
- [x] `NavLinks` renders a group heading above each run of items sharing a `group`, and no heading for
      ungrouped items. Headings are non-interactive and not focusable.
- [x] Group headings are announced to assistive tech: each group is a `<nav>`-internal list labelled by its
      own heading (`aria-labelledby`), so a screen reader hears "Trening — 2 items", not nine flat links.
- [x] The final nav, in order: **Start** (ungrouped) · **TRENING**: `Trening`, `Aktywności` · **ZDROWIE**:
      `Wnioski` · **SYSTEM**: `Dane`, `Ustawienia`, `Panel`. Seven items.
- [x] Group headings only render when the group has at least one visible item, so a Base-tier user (who sees
      only `Start`, `Dane`, `Ustawienia`) never sees an empty `TRENING` heading.
- [x] The mobile drawer (spec 034) renders groups without widening the drawer or breaking the tap-to-close
      handler in `AppShell` (it delegates on `a[href], button`, which the new `<li><a>` markup still matches).

**Analityka folded into Wnioski**

- [x] `/analytics` responds `308` to `/insights`, preserving `?range=` — matching the existing `/power` and
      `/running` redirect precedent from spec 025.
- [x] `Wnioski`'s per-metric chart cards gain the statistics Analityka contributed — `min`, `max`, `avg`,
      `total` (only where a sum is meaningful), best day and worst day — rendered under each chart.
- [x] `InsightsData.charts` is typed by the superset shape (the fields `AnalyticsMetric` had), so no statistic
      that Analityka displayed is lost.
- [x] `modules/analytics/` is deleted; no import of it remains anywhere (including `styleguide`).
- [x] `Wnioski` still shows readiness, trend tiles, anomalies and correlations, in that order, above the charts.

**Mapa ciepła under Aktywności**

- [x] `/activities` becomes a section with a `SubNav`: **Lista** (`/activities`) · **Mapa** (`/activities/mapa`),
      built from the shared `lib/ui/SubNav.svelte`, same as `/training`.
- [x] `/heatmap` responds `308` to `/activities/mapa`, preserving `?sport=` and `?year=`.
- [x] The map tab keeps its own sport/year `FilterChips` and its full-bleed layout; the SubNav does not force
      the map into the standard content column.
- [x] The section title in the topbar reads `Aktywności` on the list tab and `Aktywności · Mapa` on the map tab,
      following `trainingTitle()`'s precedent.

**Panel demoted**

- [x] `Panel` moves out of nav position 2 into the `SYSTEM` group, after `Ustawienia`, and is no longer the
      second thing an Advanced-tier user sees. It is **not** deleted and persisted layouts in
      `/api/dashboards` keep working unchanged.
- [x] Each widget whose content is better served elsewhere carries a one-line link to that page
      (`weekly-volume` → `/training`, `activity-types` → `/training`, `recent-activities` → `/activities`,
      `coverage` → `/dane`, `metric-trend` → `/insights`), so the duplication is signposted rather than hidden.
- [x] `streak` — the one widget with no other home — is additionally rendered on `/training` overview, so
      demoting Panel does not hide it.

**Always**

- [x] Unit + API-integration tests pass (no e2e)
- [x] Built only from `lib/ui` components + design tokens (if UI)
- [x] No secrets logged or committed

## API contract

No new endpoints. Two permanent redirects and one route move:

```
GET /analytics?range=…       → 308 /insights?range=…
GET /heatmap?sport=&year=    → 308 /activities/mapa?sport=&year=
GET /activities/mapa         → the heatmap page (loader unchanged, moved)

GET /insights?range=…        → unchanged shape, except:
                               charts[]: MetricChart gains min, max, avg, total,
                               deltaPct, count, best, worst, goodWhen
                               (the fields AnalyticsMetric already carried)
POST /api/dashboards         → unchanged
```

`modules/insights/insights.types.ts` — `MetricChart` absorbs the extra fields.
`modules/analytics/analytics.types.ts` is deleted, and the three types it shared across module boundaries
(`MetricFormat`, `DayPoint`, `DatedValue`) move to **`lib/metric-series.ts`** — `metric-specs` and the insights
slice were importing them out of a feature folder, which AGENTS.md §5 forbids; deleting the module forced the
fix. `activeWeekStreak` moves to `lib/server/analytics/streak.ts` for the same reason, re-exported from
`dashboard-data.ts` so the widget's existing import path is untouched.

## UI

`lib/ui` components used: `NavLinks` (extended), `SubNav`, `Card`, `RangeBadge`, `StatTile`, `TrendChart`,
`BarChart`, `FilterChips`, `LeafletMap`, `Banner`.

- **Nav group heading:** a new small-caps label above each group — `--text-xs`, `--font-semibold`,
  `--tracking-widest`, `--color-text-subtle`, `--space-4` of top margin except on the first group, matching the
  `.section-title` treatment already used inside pages. No new token.
- **Insights chart card:** the statistics row reuses Analityka's `<dl>` treatment (label above value, best day
  toned `good`), moved into `InsightsView`'s existing `.chart-panel`.
- **States:** nav has no loading/error state. The map tab keeps heatmap's existing empty state ("Brak tras GPS
  dla tego filtra") and its `/data` link, which did not move. A metric with no readings in the range shows
  "Brak danych w tym zakresie" instead of a chart plus a row of em-dashes.
- **Light + dark** via tokens only; the group heading reads at both `--color-text-subtle` values.
- **Map height:** `HeatmapView` sizes itself against the viewport, so stacking a tab row above it would have
  overflowed by exactly the tab row's height. It now subtracts `--heatmap-offset` (default `0px`), which the
  map page sets.

## Design / implementation notes

- **Ports & adapters:** nothing new is injected. This spec moves routes and merges two view models; every
  loader keeps taking `store`/`clock`/`garmin` from the container as it does today.
- **Range handling:** `/insights` already consumes the global range via `loadRange` (spec 047). The merged
  statistics are computed from the **daily** series, not the bucketed chart points — Analityka's existing
  contract note ("every statistic is still computed from the daily data, so `min`/`max`/`best`/`avg` remain
  real days even when the chart is bucketed") must survive the merge. This is the one correctness trap here.
- **Redirects, not deletions, for URLs:** three specs' worth of links, bookmarks and MCP-client references
  point at `/analytics` and `/heatmap`. Follow spec 025's precedent: a `+server.ts` throwing `redirect(308, …)`.
- **Panel:** demoted rather than deleted on purpose. It is a user-configurable surface with persisted state;
  deleting it would discard layouts users saved. If the intent is to remove the feature, that is a separate
  decision and a separate spec — say so at approval and this spec's Panel requirements change to a removal
  plus a migration for `/api/dashboards`.
- **Consent gating** is unchanged: every moved page keeps its existing tier/consent guard, and the nav's
  `advanced` flag still hides the whole `TRENING` and `ZDROWIE` groups from Base-tier users.

**Deliberately out of scope — follow-up specs:**

- **053 — Rower page parity.** `/training/rower` renders *only* a power profile and bails with "Brak danych o
  mocy" (`PowerView.svelte:104`), so a cyclist without a power meter gets a tab (their rides created it) and
  then a dead page. Meanwhile `Bieg` gained race predictor, pace curve and aerobic capacity (specs 042/043/038)
  and `Marsz` has volume, elevation and steps. `Rower` is also the **only** sport subpage whose loader ignores
  the global range — `bieg` and `marsz` both call `loadRange`, `rower` does not, despite spec 047 ticking
  "Trening overview + sport subpages". Needs: rename `modules/power` → `modules/ride`, add totals + volume +
  HR zones, make it range-aware, and degrade the power section gracefully.
- **054 — Chart component de-duplication.** Three overlapping pairs: `ConditionCard` (Start) vs `ReadinessCard`
  (Wnioski) render the same readiness concept differently; `RadarChart` is used raw in `PowerView` but wrapped
  in `RunnerProfileCard` for `RunningView`; and "Kilometraż / Objętość" weekly-bucket bar charts are written
  three times across `RunningView`, `WalkingView` and `TrainingOverview` with duplicated label/format code.

## Test plan

- **Unit:**
  - `lib/nav.test.ts` — group ordering; every `NAV_ITEMS` entry with `advanced` is filtered for Base tier;
    exactly seven items for Advanced, three for Base; groups stay contiguous so no heading renders twice.
  - `NavLinks.svelte.test.ts` — a heading renders per non-empty group and none for ungrouped or empty groups;
    headings are not links; `aria-labelledby` wires each group to its heading; active-route detection still
    matches `/training/bieg` to the `Trening` item.
  - `activities-nav.test.ts` — tab list, labels and `trailing` title for `/activities` and `/activities/mapa`,
    mirroring `training-nav.test.ts`.
  - `insights.api.test.ts` — the merged statistics are computed from daily values while `days[]` is bucketed:
    given a 365-day range that buckets to months, `min`/`max`/`best`/`worst` still name real days.
- **API integration (mock adapters):**
  - `consolidated-redirects.test.ts` — `GET /analytics` → 308 `/insights`, carrying `?range=` (encoded);
    `GET /heatmap?sport=cycling&year=2025` → 308 with both params preserved.
  - `insights.api.test.ts` — every chart carries the statistic fields, oriented by `goodWhen` (the lowest
    resting HR is the *best* day, the highest step count is); a metric with no readings reports `null`
    statistics rather than zeroes.
  - `tier-gating.test.ts` — the Base-user guard now covers `/activities` and `/activities/mapa` separately,
    since this section is two sibling pages rather than one layout.
- **Sidecar (pytest):** N/A — no sidecar surface changes.

## Closeout

- Commits: see the `feat: one nav, seven items (spec 048)` commit on this branch.
- Verification: `pnpm run verify` green — 1494 tests (125 files), `svelte-check` 0 errors, Prettier clean,
  production build + MCP bundle OK.
- The "statistics from daily data, not the bucketed series" test was mutation-checked: inverting the ordering
  in `insights.api.ts` makes it fail, so it is guarding the trap it was written for rather than passing by
  construction.
- Notes / follow-ups: specs 053 (Rower parity) and 054 (chart component de-duplication), described above.
  053 is the more urgent of the two — `/training/rower` silently ignores the global range switch today.
  (Numbered 053/054 rather than 049/050: specs 049–052 landed on `main` while this one was in flight.)
