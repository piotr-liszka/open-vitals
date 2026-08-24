# Spec 013 — Insights engine & life-time charts

- **Status:** Closed <!-- Draft → Approved → Closed -->
- **Module:** `apps/web/src/modules/insights/` (+ `lib/server/garmin/`, `lib/mcp/`, small `lib/ui/` addition)
- **Owner agent:** module-dev (engine + API + MCP), ui-designer (SegmentedControl), qa-closer
- **Depends on:** 009 (metric range), 010 (metrics dashboard), 011 (consent), 012 (multi-user)

## Context

The app shows raw numbers and trends but never tells the user what they *mean*. This feature adds a
**deterministic insights engine** — no external LLM — that turns per-user metric ranges into plain-language
insights: a **readiness snapshot**, **per-metric trends**, **anomaly flags**, and **notable correlations**.
It also adds **life-time (long-range) charts** via a selectable window (7 / 30 / 90 / 365 days). Insights land
on both surfaces: a **Readiness card** + a dedicated **Insights page** in the web app, and **`get_insights` /
`get_readiness` MCP tools + an `interpret_health` prompt** so a connected AI client can narrate them. Engine
math is pure and fully unit-tested; the connected model does the prose.

## Requirements (acceptance criteria)

- [x] Pure `insights.engine.ts` computes, from injected metric series (no I/O, no `Date`/random):
  - [x] **Readiness** 0–100 score + band (`low|moderate|high|peak`) from body-battery, sleep, HRV, resting-HR
        vs each metric's in-window baseline (z-score, oriented by `goodWhen`, weighted mean); lists per-driver
        contributions; returns `insufficient_data` when fewer than `MIN_BASELINE_DAYS` are present.
  - [x] **Trends** per metric: `improving|declining|stable` (oriented by `goodWhen`) from recent-vs-earlier
        window means, with signed magnitude %; `|Δ| < STABLE_PCT` ⇒ stable.
  - [x] **Anomalies**: days where `|z| ≥ ANOMALY_Z` vs in-window baseline, with direction + severity, capped at
        top `MAX_ANOMALIES` by `|z|` (newest-first tiebreak).
  - [x] **Correlations**: predefined metric pairs (aligned with lag) via Pearson `r`; reported only when
        `n ≥ MIN_CORR_N` and `|r| ≥ MIN_CORR_R`, with a strength label + human-readable phrasing.
- [x] `insights.api.ts` orchestrates: fetch each needed metric across the window (chunked, see notes), extract
      series, run the engine, return `InsightsData`. Gated by `detailed_analytics` consent; degrades to
      `{ connected, enabled:false, … }` (no throw) when not connected / not consented / sidecar down.
- [x] **Window selector** 7 / 30 / 90 / **365** ("1Y") drives both the engine window and the life-time chart;
      long windows are fetched by chunking into ≤31-day sidecar range calls (bounded concurrency).
- [x] Web: `/insights` page renders Readiness, Trends, Anomalies, Correlations, and a per-metric life-time
      `TrendChart`, with honest loading / empty / not-connected / consent-off states. A compact **ReadinessCard**
      also appears on the dashboard (consent-gated, same as existing analytics series).
- [x] MCP: `get_readiness` (compact score + drivers) and `get_insights` (full payload for a window, default 30)
      tools, plus an `interpret_health` **prompt** instructing the client to call them and narrate. Registered in
      `create-server.ts`; server `instructions` updated.
- [x] Built only from `lib/ui` components + design tokens (new `SegmentedControl` added to `lib/ui`).
- [x] Unit + API-integration tests pass (no e2e); sidecar unchanged (no pytest impact).
- [x] No secrets logged or committed; per-user isolation preserved (insights use `garminFor(userId)` only).

## API contract

Contracts in `insights.types.ts`; MCP shapes in `lib/mcp/tools.ts`.

```
GET  /api/insights?window=7|30|90|365   (route +server.ts → loadInsights)
  res 200: InsightsData {
    connected: boolean; enabled: boolean;             // enabled = detailed_analytics consent
    window: number; start: string; end: string;
    readiness: Readiness | null;                       // null when insufficient/gated
    trends: Trend[]; anomalies: Anomaly[]; correlations: Correlation[];
    charts: MetricChart[];                             // per-metric { key,label,accent,unit,format,days[],series[] }
  }
  errors: never 5xx for connected/consent/sidecar issues (degrade to flags); 400 on bad window.

MCP get_readiness { window?:number=30 } -> text(Readiness | {status:'insufficient_data'|'not_connected'})
MCP get_insights  { window?:number=30 } -> text(InsightsData without page-only chart arrays trimmed)
MCP prompt interpret_health { window?:string } -> messages guiding the client to call the tools & summarise
```

Readiness `{ score, band, drivers:[{ key,label,accent, z, direction:'up'|'down', contribution }], basisDays }`.
Trend `{ key,label,accent,unit,format, direction, magnitudePct, recentAvg, earlierAvg }`.
Anomaly `{ key,label,accent, date, value, z, direction, severity:'moderate'|'strong' }`.
Correlation `{ a,b, aLabel,bLabel, lag, r, n, strength:'weak'|'moderate'|'strong', phrasing }`.

## UI

- `lib/ui`: **SegmentedControl** (new — accessible radiogroup segmented control, tokens only) for the window
  selector; reuse `Card`, `StatTile`, `Badge`, `Banner`, `TrendChart`, `Sparkline`, `Skeleton`, `Table`.
- `/insights`: header + SegmentedControl; **ReadinessCard** (big score, band, driver chips); **Trends** grid of
  StatTiles w/ direction; **Anomalies** as Banner/Table list (empty state = "nothing unusual"); **Correlations**
  as phrased Cards; **Life-time charts** = one `TrendChart` per metric across the window.
- Dashboard: ReadinessCard slots into the existing grid; consent-off → gentle "enable analytics" state.
- States: loading (Skeleton), not-connected, consent-off, insufficient-data, populated. Light + dark via tokens.

## Design / implementation notes

- **Ports & adapters:** engine is a pure function of data + config; `insights.api.ts` depends on injected
  `GarminService`, `ConsentService`, `Clock`. Reuse/extract the metric spec table + payload extraction into a
  shared `lib/server/garmin/metric-specs.ts` (moved out of `analytics.api.ts`, which is refactored to import it —
  one source of truth). New `lib/server/garmin/range.ts` `fetchMetricRangeChunked(garmin,name,start,end)` splits a
  window into ≤31-day (`_MAX_RANGE_DAYS`) chunks, calls `getMetricRange` per chunk (bounded concurrency), merges
  days oldest→newest, preserving null gaps. Sidecar is **not** changed.
- **Cost / follow-up:** a 365-day window = ~12 sidecar range calls/metric = many per-day Garmin fetches. Instant
  under `GARMIN_ADAPTER=mock` (dev/tests). Against real Garmin it is heavy → the known **per-user metric cache**
  follow-up is the production fix; documented, not built here. Longest option capped at 365 (true "all-time"
  needs account-start discovery — noted as a follow-up).
- Engine constants (tunable, documented): `MIN_BASELINE_DAYS`, `STABLE_PCT`, `ANOMALY_Z`, `MAX_ANOMALIES`,
  `MIN_CORR_N`, `MIN_CORR_R`, readiness weights. Correlation pairs (lag): sleep↔hrv(0), sleep↔resting_hr(0),
  stress↔body_battery(0), steps↔sleep(0).
- MCP: insights tools need only `getMetricRange` (already per-user); not web-consent-gated (consistent with
  existing metric tools, which the user opted into by sharing their token).

## Test plan

- **Unit (`insights.engine.test.ts`):** deterministic fixtures — known series → exact readiness score/band &
  drivers; trend direction/magnitude incl. `goodWhen=down`; anomaly detection at the z threshold + cap ordering;
  correlation `r` on a known-correlated pair and rejection below `MIN_CORR_N`/`MIN_CORR_R`; insufficient-data path.
- **Unit (`range.test.ts`):** chunking of 7/30/90/365 into ≤31-day windows; day merge order; gap preservation.
- **API integration (`insights.api.test.ts`, mock adapters):** consent on/off, not-connected, sidecar-down all
  return the right flags without throwing; populated payload has readiness+trends+anomalies+correlations+charts;
  `window` param honored; assert JSON contract shape.
- **MCP (`tools.test.ts`):** `get_readiness` / `get_insights` return expected content with a mock GarminService;
  insufficient/not-connected paths; `interpret_health` prompt returns guiding messages.
- Re-run analytics + dashboard tests after the shared metric-specs refactor (qa-closer).

## Closeout

- **Status: Closed 2026-08-07.** Implemented via `module-dev`; verified green (`check`: 606 files / 0 errors,
  `vitest`: 205 tests) including `insights.engine.test.ts` (14), `insights.api.test.ts` (8), `range.test.ts` (7),
  and insights MCP tools + `interpret_health` prompt in `tools.test.ts`.
- Delivered: pure `insights.engine.ts` (readiness/trends/anomalies/correlations, `DEFAULT_INSIGHTS_CONFIG`),
  shared `lib/server/garmin/metric-specs.ts` + `range.ts` (≤31-day chunked fetch), `/insights` page +
  `ReadinessCard` on the dashboard, `SegmentedControl` (7/30/90/365), MCP `get_readiness`/`get_insights`.
- Follow-ups: per-user metric cache (makes 365-day live-fetch cheap); true all-time via account-start date;
  correlation `phrasing` is now Polish (spec 014 localization); consider MCP resources for anomalies.
