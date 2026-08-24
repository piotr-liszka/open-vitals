# Spec 061 — MCP surface parity: everything the web knows, the assistant knows

- **Status:** Draft <!-- Draft → Approved → Closed -->
- **Module:** `apps/web/src/lib/mcp/` (+ thin read-only reuse of existing `*.api.ts` handlers)
- **Owner agent:** module-dev
- **Depends on:** 013 (insights), 038–046 (the analytics this exposes), 050 (workout tools), 054 (stored best efforts), 056 (weekly summary), 057 (prediction trend), 060 (season tools)

## Context

OpenVitals computes far more than it can say. The MCP surface today is **thirteen** tools: five Garmin reads
(`get_status`, `get_health_snapshot`, `get_metric_range`, `get_readiness`, `get_insights`), four workout
writes (spec 050), and the four season tools spec 060 just added. Meanwhile `lib/analytics` and
`lib/server/analytics` hold race predictions, the power profile and rider axes, the all-time best-efforts
leaderboard, matched routes, grade-adjusted pace, the speed–duration curve, climbs, the intensity mix, load
risk, per-sport fitness, aerobic efficiency, monthly/yearly volume, the weekly sport summary and the runner
profile — **all of it web-only**. An assistant asked "what should I target at my next 10 km" cannot see the
athlete's own race predictor.

Two things landed since this was first drafted that raise the value rather than lower it: spec 054 made best
efforts a stored, ranked leaderboard rather than a per-activity derivation, and spec 057 gave every
prediction a movement against an as-of snapshot. Both are exactly the kind of thing an assistant should be
able to quote — "your 10 km prediction is 1:40 faster than 90 days ago" is a sentence no metric read can
produce.

The competitive case is sharper than the convenience one. Runalyze shipped an MCP server in June 2026:
paid-members-only, still in testing, and deliberately serving *computed outputs only* so the platform keeps
control of how its numbers are produced. OpenVitals is the inverse by construction — the athlete's own box, own
data, own numbers, and the methodology is in the repo. Not exposing what we already compute forfeits the
one advantage that is structural rather than incidental.

This spec adds **no new maths**. It is an exposure layer: the existing module handlers, called with the
same injected deps the web routes give them, projected into tool results shaped for a model rather than a
chart.

## Requirements (acceptance criteria)

- [ ] A `lib/mcp/analysis-tools.ts` exposing, each gated by `detailed_analytics` and scoped to the resolved
      user: `get_training_load` (PMC + per-sport fitness + load risk), `get_race_predictions`,
      `get_power_profile`, `get_best_efforts` (spec 054's ranked leaderboard, not a per-activity scan),
      `get_volume` (monthly + year-over-year), `get_weekly_summary` (spec 056), `list_activities`,
      `get_activity` (one activity's full detail incl. laps, climbs, best efforts, GAP).
- [ ] Every tool **reuses an existing `*.api.ts` handler** rather than reimplementing its query. A tool that
      needs data no handler returns is a signal to extend the handler, not to fork the logic.
- [ ] Results are **flattened for a model**: no nested chart-series objects, numbers pre-rounded, every
      verdict already a sentence. A model should never have to do arithmetic to read one aloud.
- [ ] Series are **capped and summarised**, not dumped: a 365-day PMC returns its shape (start, end, peak,
      current) plus a downsampled series, never 365 raw points per metric. State the cap in the description.
- [ ] Tools that can return nothing say **why** — under the history floor, outside the synced window, no
      runs at all — in the same words the web surface uses.
- [ ] `create-server.ts` registers them behind one optional deps object, like the workout and season tools,
      so a read-only server can still be built without them.
- [ ] Server `instructions` updated to describe the new surface and, critically, **when to reach for which**
      — an assistant that calls `get_metric_range` for a training question is the failure this fixes.
- [ ] MCP resources for the two stable documents an assistant benefits from re-reading: the athlete's sport
      families + settings (FTP, max HR), and the current season plan.
- [ ] Unit + API-integration tests pass (no e2e)
- [ ] No secrets logged or committed

## API contract

Every tool follows the existing `ToolResult` shape. Full argument schemas in `analysis-tools.ts`.

```
get_training_load     { sport? }                → ctl/atl/tsb/band, ramp, acwr, per-sport fitness
get_race_predictions  {}                        → per-distance Riegel + critical-speed, source best,
                                                  basis (measured vs projected) and the spec-057 trend
get_power_profile     { year? }                 → curve points, FTP, W/kg, rider axes
get_best_efforts      { sport?, distance?, limit? } → ranked leaderboard rows with day + activity id
get_volume            { unit? }                 → monthly totals + this year against last
get_weekly_summary    { sport? }                 → this week per sport against the usual week
list_activities       { sport?, from?, to?, limit? } → summaries
get_activity          { activityId }            → detail: laps, climbs, best efforts, GAP, verdict
```

## UI

N/A — backend only. No web surface changes.

## Design / implementation notes

- **Ports touched:** none new. The tools take the same `LocalStore`, `SettingsRepo`, `ConsentService` and
  `Clock` the web routes already inject; `entry.ts` passes them through as it now does for spec 060.
- The **hard design question** is response size, not correctness. Each tool has a budget; where a handler
  returns a chart-shaped payload, the tool projects a summary and offers the detail behind an explicit
  argument rather than returning both.
- Consent gating is uniform and refuses with a *message the assistant can act on* ("enable Advanced mode in
  settings"), never a bare error.

## Test plan

- **Unit:** each projection function (handler payload → tool payload), including the empty and
  under-the-floor cases.
- **MCP:** every tool invoked against a mock store; assert content shape, the consent refusal, and that no
  tool returns a series longer than its stated cap.

## Closeout

- Commits:
- Notes / follow-ups:
