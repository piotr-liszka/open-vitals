# Spec 016 — Chart hover/tap read-out + fluid numeric type

- **Status:** Approved <!-- Draft → Approved → Closed -->
- **Module:** `apps/web/src/lib/ui/` (design system) + the chart-owning modules
- **Owner agent:** ui-designer
- **Depends on:** 001 (design system), 010 (metrics dashboard), 013 (insights), 015 (local store)

## Context

Every chart in the app is currently read-only: the trend and bar charts show min/max markers but there is
no way to ask "what was the value on *that* day". The bar chart's only affordance was a native SVG
`<title>`, which never fires on touch. On phones the hero readouts are also fixed at their desktop step
(`--text-4xl`/`--text-5xl`), so a five-digit step count or a `12h 05m` sleep duration crowds or overflows
its tile. This spec adds one shared hover/tap read-out to every real chart and makes numeric readouts
scale with the viewport.

## Requirements (acceptance criteria)

- [x] Hovering a chart (mouse) highlights the nearest data point and shows its value + x-axis label
- [x] The same read-out works on touch: tap or drag along the chart; vertical page scroll still works
- [x] Charts are keyboard reachable: focus + `←`/`→`/`Home`/`End` move the read-out, `Esc` clears it
- [x] The active value is announced to screen readers via a polite live region
- [x] Read-out never leaves the chart frame at either edge
- [x] Covered charts: `TrendChart`, `BarChart`, the PMC chart (training), the yearly power curve (power),
      the power-zone donut (activity detail)
- [x] Numeric readouts use fluid `--readout-*` tokens so they shrink on phones and keep their desktop size
- [x] Unit tests pass (no e2e); interaction geometry is covered by pure unit tests
- [x] Built only from `lib/ui` components + design tokens
- [x] No secrets logged or committed

## API contract

N/A — presentational only. No endpoint or MCP tool changes; `labels` are derived in the views from data
already present in `AnalyticsMetric.days` / `MetricChart.days`.

## UI

- New `lib/ui/ChartTooltip.svelte` — the floating read-out (title + one row per series), token-styled,
  edge-aware, `pointer-events: none`.
- New `lib/ui/chart-interaction.ts` — DOM-free geometry shared by all charts (pointer → index, keyboard
  stepping, tooltip alignment).
- `TrendChart` gains `labels?: string[]` (aligned with `values`, gaps allowed) plus a crosshair + active dot.
- `BarChart` highlights the active bar and dims the rest; its native `<title>` is replaced by the tooltip.
- States: no-data charts stay non-interactive and non-focusable. Light + dark come from tokens.
- Micro-charts (`Sparkline`, dashboard widget sparks) stay decorative — their value is printed next to them.

## Design / implementation notes

- Pointer handling uses a transparent hit `<rect>` over the plot with `touch-action: pan-y`, so a vertical
  swipe still scrolls the page while a horizontal drag scrubs the chart.
- `TrendChart` filters non-finite values, so the active index is carried alongside the original index and
  labels are looked up by original index (a gap day never shifts its label).
- Fluid type: `--readout-sm|md|lg|xl|2xl` + `--readout-unit` in `tokens.css`. Each is
  `clamp(phone floor, fluid, previous fixed step)` — desktop is pixel-identical to before, phones shrink.

## Test plan

- **Unit:** `chart-interaction.test.ts` — pointer→index mapping (lattice + band), clamping, empty series,
  keyboard stepping, tooltip alignment at both edges.
- **Component:** `TrendChart` / `BarChart` — pointer move shows the tooltip with the right label+value,
  keyboard steps it, `Esc` clears, empty charts stay non-interactive.
- **API integration:** N/A (no handler touched).

## Closeout

- Commits: <pending>
- Notes / follow-ups: axis tick labels on `TrendChart`/`BarChart` are still absent — worth a follow-up
  now that the read-out carries the dates.
