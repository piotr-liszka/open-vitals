# Spec 010 — Metrics dashboard (detailed analytics)

- **Status:** Closed <!-- Draft → Approved → Closed -->
- **Module:** `apps/web/src/modules/metrics-dashboard/`, `apps/web/src/lib/ui/Sparkline.svelte`, `routes/+page.server.ts`
- **Owner agent:** module-dev + ui-designer
- **Depends on:** 006 (dashboard shell), 009 (metric range), 011 (consent gating), 001 (UI)

## Context

The dashboard currently shows only the health-check and MCP-URL cards; the body is empty. This feature fills it
with real data: a today-snapshot row of `StatTile`s (steps, resting HR, body battery, sleep, HRV, stress) plus a
7-day sparkline trend per metric. The single-day snapshot is ungated. The multi-day trends are the "detailed
analytics" feature and render only when the `detailed_analytics` feature is enabled per spec 011 (otherwise the
consent module's terms/Accept panel shows instead). All widgets come from `lib/ui`; trends need a new shared
`Sparkline` component.

## Requirements (acceptance criteria)

- [x] New module `apps/web/src/modules/metrics-dashboard/` with `metrics.types.ts`, `metrics.api.ts` handler, component(s), and tests
- [x] `metrics.api.ts` composes `GarminService` calls: today snapshot (per-metric `getMetric`) + 7-day `getMetricRange` per trended metric
- [x] Snapshot row renders `StatTile`s for steps, resting HR, body battery, sleep, HRV, stress (ungated)
- [x] 7-day trends render a `Sparkline` per metric, shown only when `detailed_analytics` is enabled (spec 011); otherwise the consent panel is shown in that region
- [x] New shared `lib/ui/Sparkline.svelte`: tokens only, accessible (role/label + text alternative), works in light + dark
- [x] `routes/+page.server.ts` loader supplies snapshot data always and trend data only when analytics is enabled
- [x] Graceful states: loading, empty (no data for a metric), error (sidecar/range failure), and not-connected (prompts Garmin setup)
- [x] Built only from `lib/ui` components + design tokens
- [x] Unit + API-integration tests pass (no e2e)
- [x] No secrets logged or committed (metric payloads never logged)

## API contract

No new public endpoint; data flows through the page server loader and the module handler. The handler shape:

```
metrics.api.ts  loadDashboard(deps, { analyticsEnabled }) ->
  {
    connected: boolean,
    snapshot: { steps, restingHeartRate, bodyBattery, sleep, hrv, stress }   // each: normalized value | null
    trends?: { [metric]: { days: [{date, value|null}] } }                     // present only when analyticsEnabled
    errors?: string[]                                                          // per-section soft failures
  }
```
Types: `apps/web/src/modules/metrics-dashboard/metrics.types.ts`. Consumes `GarminService.getMetric` /
`getMetricRange` (spec 009) and the consent status (spec 011).

## UI

`AppShell` (existing) hosts: `StatTile` snapshot grid + a trends section of `Sparkline`s. When
`detailed_analytics` is not enabled, the trends section renders the consent module's terms/Accept panel (spec 011)
instead of sparklines. States: `Spinner` while loading; empty tiles show a muted placeholder; section-level error
uses a `Badge`/inline notice; not-connected reuses the existing `SetupForm` prompt path. Light + dark via tokens.

## Design / implementation notes

- **Ports & adapters:** the handler takes `GarminService` and the consent decision as injected inputs; no direct
  fetch/env/date in the handler. Snapshot and trend fetches are independent so one failing metric degrades to a
  placeholder rather than failing the page.
- **Sparkline:** presentational; accepts an array of `{date, value}` and renders an inline SVG polyline sized via
  tokens, with an accessible label summarizing range/latest value. No business logic in markup.
- **Consent seam:** the loader asks the consent service (spec 011) whether `detailed_analytics` is enabled and
  passes only a boolean into the module; the module never reads consent storage directly.
- **Edge cases:** not-connected → show setup prompt, skip fetches; partial history → sparkline renders gaps;
  analytics disabled → trends replaced by consent panel.

## Test plan

- **Unit:** `Sparkline` component test — renders points, accessible label, empty-data placeholder, light/dark tokens.
- **API integration (mock adapters):** `metrics.api.test.ts` — snapshot assembled from mock `getMetric`;
  trends present when `analyticsEnabled=true` and absent when `false`; not-connected path; a single failing metric
  becomes a placeholder + soft error rather than a thrown page error.

## Closeout

- Commits: <pending>
- Notes / follow-ups: normalization of raw garmy metric payloads into display values may need per-metric mapping once real shapes are confirmed (spec 008/009).
