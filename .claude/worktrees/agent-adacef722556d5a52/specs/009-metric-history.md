# Spec 009 — Metric history / date range

- **Status:** Closed <!-- Draft → Approved → Closed -->
- **Module:** `services/garmin/app/`, `apps/web/src/lib/server/`, `apps/web/src/lib/mcp/`, `routes/api/garmin/metrics/[name]/range/`
- **Owner agent:** garmin-integrator + module-dev
- **Depends on:** 002 (sidecar), 003 (GarminService), 007 (MCP tools)

## Context

Single-day metric reads answer "how did I sleep last night" but not "how is my resting HR trending this week".
This feature adds a multi-day range fetch end-to-end so callers can request one metric across a date window. It
is the data source for the dashboard's trend sparklines (spec 010) and for "detailed analytics" — which, when
surfaced in the UI, is gated by the consent feature in spec 011. The range endpoint itself is read-only and not
gated at the transport level; gating is applied where trends are presented.

## Requirements (acceptance criteria)

- [x] Sidecar `GET /metrics/{name}/range?start=YYYY-MM-DD&end=YYYY-MM-DD` returns `{metric, start, end, days:[{date, data}]}`
- [x] `start`/`end` validated as `YYYY-MM-DD`; `start <= end`; malformed or reversed range → 400
- [x] Range capped at 31 days inclusive; exceeding the cap → 400 with a clear `detail`
- [x] Unknown metric → 404; not authenticated → 409 (same errors as single-day reads)
- [x] `days` is ordered ascending by date; a day with no data yields `{date, data:null}` (not an error)
- [x] `GarminService` interface gains `getMetricRange(name, start, end): Promise<MetricRange>`; the http-adapter implements it
- [x] MCP tool `get_metric_range` (args: `metric`, `start`, `end`) registered in `tools.ts`, reusing the friendly not-connected/unavailable error mapping
- [x] Web API route `GET /api/garmin/metrics/[name]/range?start=&end=` wires the container's `garmin.getMetricRange`; maps 400/404/409/503
- [x] Unit + API-integration tests pass (no e2e)
- [x] No secrets logged or committed (day payloads never logged)

## API contract

```
# sidecar
GET /metrics/{name}/range?start=YYYY-MM-DD&end=YYYY-MM-DD
    res: {metric, start, end, days:[{date, data}]}          200
    res: {detail:"invalid range"|"range too large"}         400
    res: {detail:"unknown metric"}                          404
    res: {detail:"not authenticated"}                       409

# web API (thin route → GarminService.getMetricRange)
GET /api/garmin/metrics/[name]/range?start=&end=
    res: {metric, start, end, days:[{date, data}]}          200
    res: {error}   400 (bad params) | 404 | 409 | 503 (sidecar down)
```
Types: `apps/web/src/lib/server/interfaces.ts` (add `MetricRange`, `MetricDay`).

## UI

N/A — backend + MCP only. Consumed by the dashboard (spec 010), whose multi-day view is consent-gated (spec 011).

## Design / implementation notes

- **Ports & adapters:** add `getMetricRange` to `GarminService`; the mock adapter gets a deterministic
  implementation for tests. The http-adapter builds the query string and reuses the existing 409→
  `GarminNotAuthenticatedError` / non-ok→`GarminUnavailableError` mapping.
- **Sidecar:** `MetricsService.get_metric_range(name, start, end)` validates the window, iterates dates, and
  reuses the existing per-metric fetchers day by day; keep the 31-day cap as a module constant. Validate params
  with pydantic before touching garmy.
- **MCP:** `get_metric_range` validates `start`/`end` with the same `YYYY-MM-DD` regex used by `dateArg`.
- **Edge cases:** partial history (some `days` `null`); single-day range (`start == end`) allowed; sidecar down → 503.

## Test plan

- **Unit:** `tools.test.ts` — `get_metric_range` forwards metric/start/end and maps not-connected → `isError`.
- **API integration (mock adapters):** range route returns the `{metric,start,end,days}` shape; 400 on bad/reversed/oversized range; 409 when not connected; 503 when adapter throws `GarminUnavailableError`.
- **Sidecar (pytest, garmy mocked):** range shape + ascending order; cap enforcement (400); invalid dates (400); 409 when unauthenticated.

## Closeout

- Commits: <pending>
- Notes / follow-ups: confirm whether any metric (e.g. `activities`) is better served by a native range call in garmy rather than per-day iteration.
