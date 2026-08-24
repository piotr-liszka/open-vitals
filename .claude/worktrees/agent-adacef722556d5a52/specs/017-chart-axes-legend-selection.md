# Spec 017 — Chart axes, legend + click-to-select

- **Status:** Approved <!-- Draft → Approved → Closed -->
- **Module:** `apps/web/src/lib/ui/` (design system)
- **Owner agent:** ui-designer
- **Depends on:** 001 (design system), 016 (chart read-out)

## Context

Spec 016 gave every chart a hover/tap/keyboard read-out, but the charts themselves are still
decorative: `TrendChart` draws four unlabelled hairlines and `BarChart` none, neither has axis tick
labels, and `labels` (usually dates) are only ever seen inside the tooltip. There is no way to tell
what a line's height *means*, no key for a chart with more than one colour, and the read-out
evaporates the moment the pointer leaves. The user's feedback was direct: *"all charts — needs
legend (on hover), needs x-axis, y-axis so i know what it is, needs dates if applicable, should be
interactive"*, and specifically that clicking a trend chart should move a headline number to the
clicked date. This spec turns the two chart primitives into real charts: labelled scales, thinned
date ticks, multiple series with a toggleable legend, and a pinnable selection.

## Requirements (acceptance criteria)

- [x] X axis: tick labels drawn from `labels`, with automatic stride thinning so labels can never
      collide at any width (measured, not guessed); the newest reading is always labelled
- [x] X ticks are never rotated or truncated — thinning alone is enough at every width
- [x] `xAxis?: boolean` escape hatch, defaulting to on whenever `labels` are supplied
- [x] Y axis: "nice" round tick values, value labels in a reserved left gutter sized to the widest
      tick (the old symmetric `padX` is gone), hairline gridlines at each tick
- [x] Tick text is compact by default (`12480` → `12k`) so the gutter stays thin; `formatTick` overrides
- [x] `unit?: string` printed once above the scale, never repeated on every tick
- [x] `yAxis?: boolean` escape hatch (falls back to the pre-017 plain grid); `BarChart` gains gridlines
- [x] Both charts accept `series?: { name, values, color? }[]`; the single-series `values`/`color`
      props keep working unchanged (back-compat)
- [x] New `lib/ui/ChartLegend.svelte`: swatch + name, plus the active value while a read-out is open
      ("legend on hover"); items are real `<button aria-pressed>` toggles, keyboard reachable
- [x] Toggling a legend item hides/shows its series; the last visible series cannot be switched off
- [x] `selectedIndex?: number` (bindable) + `onSelect?: (index) => void`; a click/tap/`Enter` pins the
      read-out, which then survives `pointerleave`; `Esc` clears the pin
- [x] Everything from spec 016 still works: touch scrubbing with `touch-action: pan-y`, `←/→/Home/End/Esc`,
      the polite live region, the edge-aware tooltip, reduced-motion
- [x] Gap days keep their slot on the axis: the line breaks, and hover/keyboard hop over the gap
- [x] Unit tests pass (no e2e); axis + selection geometry covered by pure unit tests
- [x] Built only from `lib/ui` components + design tokens — no raw hex, no magic px in styles
- [x] Light + dark both correct; `pnpm run check` clean; no `any`
- [x] No secrets logged or committed

## API contract

N/A — presentational only. No endpoint or MCP tool changes.

Component signatures (the contract for call sites):

```ts
// lib/ui/chart-axis.ts
interface ChartSeries { name: string; values: number[]; color?: string }

// TrendChart / BarChart — shared props
values?: number[]                    // single series (ignored when `series` is given)
series?: ChartSeries[]               // multi-series
labels?: string[]                    // x labels, index-for-index with values
color?: string                       // single-series colour
height?: number                      // total, axes included (Trend 200, Bar 140)
formatValue?: (n: number) => string  // read-out + aria
formatTick?: (n: number, step: number) => string
label?: string                       // metric name for the aria summary
unit?: string                        // printed once above the y axis
xAxis?: boolean                      // default: on when `labels` given
yAxis?: boolean                      // default: on
legend?: boolean                     // default: on for multi-series
selectedIndex?: number | null        // bindable pinned index
onSelect?: (index: number) => void
// TrendChart only: showArea?, showAvg?    BarChart only: baseline?

// ChartLegend
items: { name: string; color: string; value?: string; hidden?: boolean }[]
onToggle?: (index: number) => void   // omit for an inert key
ariaLabel?: string
```

## UI

- New `lib/ui/ChartLegend.svelte` — the series key; interactive only when `onToggle` is passed.
- New `lib/ui/chart-axis.ts` — DOM-free axis maths (nice ticks, tick thinning, label widths,
  series resolution) shared by both charts, sibling to `chart-interaction.ts`.
- `TrendChart` / `BarChart` gain the axes, multi-series drawing (grouped bars for `BarChart`) and the
  pinned selection. Both keep their empty/single/flat states: a no-data chart stays non-interactive
  and non-focusable.
- Tokens: new `--chart-series-1…6` palette (lane hues, ordered for separation) used when a series
  brings no colour of its own. Axis text uses `--color-text-subtle`, gridlines `--color-grid`, the
  pinned cursor/band `--color-accent-line` / `--color-accent-soft` — all already theme-aware.
- Hover cursor is a dashed rule ("passing through"), a pin is a solid accent rule / tinted band
  ("this stays"), so the two states are distinguishable without colour alone.

## Design / implementation notes

- **Nice ticks land *inside* the caller's domain** instead of rounding the domain outward. The charts
  pad their domain so peaks never touch the frame; re-rounding the bounds would visibly flatten a
  narrow series (a 49–56 bpm line squashed into a 40–60 scale). The step ladder is 1/2/2.5/5 × 10ⁿ
  taken as a *ceiling*, so a compact 140px chart never grows more ticks than it asked for.
- **Tick thinning is measured, not guessed:** label widths are estimated from the axis font size
  (read back from `--text-xs` via `getComputedStyle`, so the geometry stays token-driven) times a
  glyph-width ratio; the stride is whatever makes them fit. Thinning is anchored on the last index —
  the newest reading is the one people look for.
- **Gaps keep their index.** Charts now plot on the full label lattice (previously `TrendChart`
  compressed gaps out), so a missing day is a break in the line rather than a straight lie.
  `nearestDefinedIndex` / `stepDefinedIndex` / `edgeDefinedIndex` keep pointers and arrow keys off
  empty days.
- **Hover beats pin.** `activeIndex(hover, selected, n)` is the single rule; it also ignores a
  `selectedIndex` left over from a longer series, so a caller can shrink the range safely.
- Pinning fires on `pointerup`, not `pointerdown`, so a touch scrub can end anywhere without the
  first touch pinning the wrong day.
- Left as follow-up: migrating call sites (`AnalyticsView`, `InsightsView`, the module-level inline
  charts in `TrainingView` / `PowerView`) onto the shared primitives — a separate workstream.

## Test plan

- **Unit:** `chart-axis.test.ts` — nice step/tick generation (incl. narrow, negative, fractional and
  flat domains, and a "never overshoots the target" property), compact tick formatting, label width
  estimation, stride thinning, tick index anchoring, edge-aware text anchors, series resolution and
  the defined-mask. `chart-interaction.test.ts` — gap-aware nearest/step/edge indices and the
  hover-beats-pin rule.
- **Component:** `TrendChart` / `BarChart` — labelled y ticks, x ticks drawn and thinned (120 and 90
  labels), unit printed once, `xAxis`/`yAxis` escape hatches, multi-series lines/grouped bars, legend
  toggling (including the refusal to hide the last series), legend values on hover, click/`Enter`
  pinning surviving `pointerleave`, `Esc` clearing, caller-supplied `selectedIndex`, gap handling.
  `ChartLegend` — labelled list, inert vs button mode, `aria-pressed`, value slot.
- **API integration:** N/A (no handler touched).

## Closeout

- Commits: <pending>
- Notes / follow-ups: call-site migration (above). `pnpm run lint` is red repo-wide at baseline —
  `.prettierrc` sets `printWidth: 110` while the codebase is written at ~100, so 403 files including
  untouched ones fail `prettier --check`; fixing that is a repo-wide reformat, out of scope here.
