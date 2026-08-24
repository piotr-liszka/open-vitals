# Spec 049 — Half-drawn chart lines, sparse x axes, tile height, primary contrast

- **Status:** Closed <!-- Draft → Approved → Closed -->
- **Module:** `apps/web/src/lib/ui/` (+ `modules/timeline/`)
- **Owner agent:** ui-designer
- **Depends on:** 016, 017, 029, 031, 032, 037, 047

## Context

A round of feedback on the running app, all of it visual and none of it caught by the test suite:

1. **Every line chart lost its tail.** On the dashboard tiles, the volume year-over-year card and the
   PMC stack, each line stopped roughly halfway across the plot while the read-out and crosshair
   proved the data continued past it. Cause: the draw-in animation revealed the line with
   `pathLength="1"` + `stroke-dasharray: 1`, which measures along the stroke, while
   `vector-effect="non-scaling-stroke"` moves that measurement into device space. `pathLength` keeps
   normalising *user* space, so on a 2× display the dash ran out at 50% of every path and the
   animation's final state — `stroke-dashoffset: 0`, held by `forwards` — left it there for good.
   The exact 50% is `1 / devicePixelRatio`; a 1× display never showed it, which is why it shipped.
2. **A sparse x axis showed almost no labels.** "Rok do roku" carries a 366-slot day-of-year lattice
   with a month name on 12 of the slots; the tick thinning strided the *lattice* and then dropped
   the blanks, so only labels that happened to land on a stride multiple survived — one, "paź".
3. **A wrapped tile label changed the tile.** Two-line labels made their own tile taller than its
   neighbours and pushed the readout off the row's baseline.
4. **The primary button read as low contrast.** The light theme pushes `--color-accent` down to
   magenta-600 so accent *text* passes AA on white; the button inherited that as its *fill*, leaving
   the ink label at 4.68:1 — technically AA, visibly muddy.
5. **The timeline's "Pokaż wszystkie zdarzenia" reset on every reload**, unlike the orientation
   next to it, which is already remembered per device.

## Requirements (acceptance criteria)

- [x] Line charts draw their whole line, at any device pixel ratio, in Chromium and WebKit alike:
      the reveal carries no length arithmetic that a stroke-space rule can contradict
- [x] The reveal is fail-safe — a browser that never runs the animation shows the complete line,
      not a fraction of it — and `prefers-reduced-motion` still skips it
- [x] Two charts on one page cannot share a reveal clip path
- [x] `TrendChart` and `BarChart` label every x tick a sparse axis carries, and still thin a dense
      date axis so labels cannot collide, keeping the newest reading always labelled
- [x] A `StatTile`'s height and readout position do not depend on whether its label wraps; a label
      too long for two lines is clamped rather than growing the tile
- [x] Filled accent controls carry a label at ≥ 4.5:1 in both themes (ink on magenta-500 = 5.81:1,
      on the magenta-400 hover = 7.78:1) without darkening accent *text*, which still needs
      magenta-600 on light
- [x] The timeline remembers the expanded/collapsed stream per device, applied on mount so hydration
      cannot mismatch, and survives a storage that throws (Safari private mode)
- [x] Unit + API-integration tests pass (no e2e)
- [x] Built only from `lib/ui` components + design tokens
- [x] No secrets logged or committed

## API contract

N/A — no endpoint or MCP tool changes.

## UI

`TrendChart`, `Sparkline`, `BarChart`, `StatTile`, `Button`, `FilterChips`, `Toast`, `TimelineView`.

- **Chart reveal.** A `<clipPath>` holding a full-plot rect that animates `scaleX(0) → scaleX(1)`
  from `transform-origin: 0 0`; the lines are drawn inside a `<g>` clipped by it. The rect's resting
  state is fully open, so no animation means a whole line rather than half of one. `transform-origin`
  is a length pair, not the `left` keyword, so x=0 lands on the left edge under either
  `transform-box`. `pathLength` and the dash CSS are gone from both components.
- **Axis labels.** `axisLabelIndices()` replaces `labelStride()` + `axisTickIndices()` (both removed):
  it walks the labels that exist, newest first, and keeps one once it clears the widest label's width
  from the last one kept. On an evenly spaced, fully labelled axis this reduces to the old constant
  stride.
- **Tile label.** The label block reserves two lines (`min-height`, measured against `--text-xs`
  rather than `1em`, so the container-query fit cannot reintroduce a mismatch between neighbours) and
  the text is clamped to those two lines. The accent dot and the trailing icon ride the first line.
- **Accent fill.** New `--color-accent-fill` / `--color-accent-fill-hover` (magenta-500 / magenta-400
  in both themes) for accent surfaces that carry a label. `--color-accent` keeps its per-theme text
  grade. Accent *dots* and rules are untouched.
- **Timeline.** `readBoolPref` / `writeBoolPref` in `lib/ui/pref.ts` store `'1'`/`'0'` under
  `TIMELINE_EXPANDED_KEY` — strings, so junk falls back instead of coercing (`Boolean('false')`).

Light + dark both come from tokens; no per-component theming was added.

## Design / implementation notes

- No ports/adapters touched; nothing new is injected. `localStorage` access stays behind `pref.ts`,
  which already wraps every call for private mode and quota failures.
- The chart fix was diagnosed from the geometry rather than guessed: all series in a stack stopped at
  the same *fraction of their own path* — a partial series stopped proportionally earlier in x — which
  points at a length-normalised dash and not at missing data. A Chromium probe drew the same markup
  in full, isolating it to stroke-space measurement under a device scale.

## Test plan

- **Unit:** `chart-axis.test.ts` — `axisLabelIndices` over a dense date axis, a sparse month axis, an
  all-blank axis, a single point, and labels past the lattice; a spacing assertion proving kept labels
  never come closer than the minimum gap. `pref.test.ts` — bool pref round-trip, junk fallback,
  missing and throwing stores.
- **Component:** `TrendChart.svelte.test.ts` — the line carries no `pathLength`/`stroke-dasharray`,
  the reveal clip exists, two instances get distinct ids referenced by their own `<g>`, and a sparse
  366-slot axis renders all 13 of its labels. `TimelineView.svelte.test.ts` — expanding writes the
  pref and a fresh mount opens expanded; collapsing writes it back.
- **API integration:** unchanged; the full suite runs green (1481 tests).

## Closeout

- Implementing commit: `dc013f5`
