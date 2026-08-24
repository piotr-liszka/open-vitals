# Spec 008 — Extended Garmin metrics

- **Status:** Closed <!-- Draft → Approved → Closed -->
- **Module:** `services/garmin/app/`, `apps/web/src/lib/server/`, `apps/web/src/lib/mcp/`
- **Owner agent:** garmin-integrator + module-dev
- **Depends on:** 002 (sidecar), 003 (GarminService), 007 (MCP tools)

## Context

The sidecar and MCP surface currently expose seven read-only metrics. Users want a few more of the daily
metrics Garmin already tracks: blood oxygen (`spo2`), `respiration`, `calories`, and `body_composition`
(weight / body-fat). These are read-only and fit the existing single-date `GET /metrics/{name}` shape, so the
work is purely additive: extend the name unions on both sides, add sidecar mapping + fetchers, and let the
existing `metricTool` factory pick up the new MCP tools. No new endpoints or contracts.

## Requirements (acceptance criteria)

- [x] `GarminMetricName` union and `GARMIN_METRICS` in `interfaces.ts` gain `spo2`, `respiration`, `calories`, `body_composition`
- [x] Sidecar `_METRIC_MAP` gains the four names, each with a garmy accessor marked `# ASSUMPTION:` (as the existing entries are)
- [x] Sidecar has a per-metric wrapper (`_get_spo2`, `_get_respiration`, `_get_calories`, `_get_body_composition`) mirroring the existing seams
- [x] `SUPPORTED_METRICS` therefore includes the four new names; `GET /metrics/{name}` serves them with the unchanged `{metric, date, data}` shape
- [x] MCP tools `get_spo2`, `get_respiration`, `get_calories`, `get_body_composition` are auto-registered via the `metricTool` factory in `tools.ts` with clear descriptions
- [x] Unknown-metric handling unchanged (404 sidecar-side); not-authenticated still 409 → `GarminNotAuthenticatedError`
- [x] Unit + API-integration tests pass (no e2e)
- [x] No secrets logged or committed (metric payloads never logged, as today)

## API contract

No new endpoints. Existing contract, new names only:

```
GET /metrics/{name}?date=YYYY-MM-DD   name ∈ …, spo2, respiration, calories, body_composition
                                      res: {metric, date, data}   200
                                      res: {detail:"not authenticated"}  409
                                      res: {detail:"unknown metric"}     404
MCP tools: get_spo2 · get_respiration · get_calories · get_body_composition
           inputShape { date?: YYYY-MM-DD }  → text(ToolResult) | friendly isError
```
Types: `apps/web/src/lib/server/interfaces.ts` (`GarminMetricName`, `GARMIN_METRICS`).

## UI

N/A — backend + MCP only. (The dashboard surfacing of metrics lives in spec 010.)

## Design / implementation notes

- **Ports & adapters:** the web http-adapter's `getMetric(name, date)` is already generic over `GarminMetricName`,
  so no adapter change is needed beyond the union widening.
- **Sidecar:** keep every garmy touchpoint in `app/metrics.py` behind `_METRIC_MAP`; mark accessor guesses with
  `# ASSUMPTION:` so real-API drift is a one-line fix. `body_composition` may return weight-log style data rather
  than a single-day snapshot — note the assumption and adjust the fetcher if so.
- **MCP:** append four `metricTool(...)` entries to `GARMIN_TOOLS`; no factory changes.
- **Edge cases:** a metric the account has never recorded may return an empty/`null` `data` — pass it through
  unchanged (not an error).

## Test plan

- **Unit:** `tools.test.ts` asserts the four new tool names exist and forward `date` to `getMetric`.
- **Sidecar (pytest, garmy mocked at the client boundary):** `/metrics/spo2|respiration|calories|body_composition`
  return `{metric,date,data}` when authed and 409 when not; `SUPPORTED_METRICS` contains the new names.
- **API integration:** existing metric-adapter test extended to cover a new name end-to-end with a mock fetch.

## Closeout

- Commits: <pending>
- Notes / follow-ups: verify the four `# ASSUMPTION:` garmy accessor names against the installed garmy registry.
