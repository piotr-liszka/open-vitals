# Spec 035 — One crosshair across the whole stream stack

- **Status:** Closed <!-- Draft → Approved → Closed -->
- **Module:** `apps/web/src/lib/ui/` (TrendChart) + `apps/web/src/modules/activity-detail/`
- **Owner agent:** ui-designer
- **Depends on:** 016 (chart read-out), 017 (axes/legend/selection), 026 (activity stream charts)

## Context

The activity page's **Przebieg** panel stacks up to eight charts on ONE shared sample lattice, so
index `k` is the same moment in every one of them. Clicking already exploits that: `pinned` is lifted
into the panel and bound into every chart, so a click pins the same instant everywhere.

**Hover does not.** `hoverI` is private state inside `TrendChart`, so passing the pointer over the
pace chart lights up the pace chart alone — the reader has to move down the stack and re-find the
same moment by eye in each frame. Garmin, TrainingPeaks and Strava all draw one vertical rule
through the whole stack instead.

Two things stand between us and that. The obvious one is the private hover state. The second only
shows up once the first is fixed: each chart sizes its own left gutter to its own widest y-axis tick
(spec 017), so `xOf(k)` lands on a slightly different screen x in every chart. A shared crosshair on
unaligned plots is a set of near-miss vertical lines, which reads worse than no crosshair at all.
This spec fixes both, and the plot alignment is an improvement in its own right.

## Requirements (acceptance criteria)

- [x] `TrendChart` exposes `hoverIndex` as a **bindable** prop. Hover, drag and keyboard stepping
      write to it; `pointerleave` / `pointercancel` / blur clear it. Unbound callers behave exactly
      as before (the prop's default is local state).
- [x] `TrendChart` accepts `tooltip` (default `true`). With `tooltip={false}` the crosshair, the
      series dots, the legend read-out and the aria live region all still work — only the floating
      `ChartTooltip` box is suppressed.
- [x] `TrendChart` accepts `gutterLeft` (a minimum left plot inset in px) and reports the inset its
      own ticks need through `onGutter`. The plot uses `max(natural, gutterLeft)`, so a caller can
      align several charts on one left edge. Reported value is the **natural** inset, never the
      forced one, so feeding it back cannot oscillate.
- [x] `ActivityStreamsPanel` owns one shared `hovered` index bound into every chart: passing the
      pointer over any chart draws the dashed rule at that same moment in **all** of them.
- [x] The panel's charts share one left gutter, so those rules line up vertically down the stack.
- [x] The read-out strip above the stack follows the live hover (`hovered ?? pinned`), showing the
      time, the distance and every metric's value at that moment; the per-chart floating tooltips are
      off in this panel because the strip already says more than they can.
- [x] A pin still survives `pointerleave` and still wins when nothing is hovered (spec 017 behaviour
      unchanged), and remains a solid rule against the hover rule's dashes.
- [x] Unit + API-integration tests pass (no e2e)
- [x] Built only from `lib/ui` components + design tokens
- [x] No secrets logged or committed

## API contract

No endpoint changes — this is presentation only. The `lib/ui` contract gains:

```ts
interface Props {
  // …existing…
  /** Live hover index — bindable, so several charts can share one crosshair. */
  hoverIndex?: number | null;
  /** Floating read-out box. Off when a caller renders its own shared read-out. */
  tooltip?: boolean;
  /** Minimum left plot inset in px, for aligning a stack of charts. */
  gutterLeft?: number;
  /** Reports the inset this chart's own y ticks need. */
  onGutter?: (px: number) => void;
}
```

## UI

`TrendChart` (crosshair, dots), `ChartTooltip` (suppressed in the stream panel), `SegmentedControl`
(unchanged axis switch). States: nothing hovered → the existing hint line; hovering → shared rule +
strip; pinned → solid rule + strip persists. Both themes come from `--color-border-strong` /
`--color-accent-line`, unchanged.

## Design / implementation notes

- `hoverI` becomes the bindable `hoverIndex` prop. Svelte 5 `$bindable(null)` is writable whether or
  not the parent binds, so the ~15 existing `TrendChart` callers need no change.
- Each chart keeps snapping the shared index to its own nearest **defined** sample
  (`nearestDefinedIndex`), so a chart with a sensor gap at that instant still reads its closest real
  value rather than blanking.
- Gutter negotiation is one pass and cannot loop: the child reports `naturalPlotL` (a function of its
  own tick texts and the axis font only, never of `gutterLeft`), the panel takes the max, the child
  clamps up to it.
- Charts are keyed by `chart.key`; the panel drops its collected gutters when the axis switch
  re-lattices the set, so a chart that disappears cannot keep inflating the shared inset.

## Test plan

- **Unit (`TrendChart.svelte.test.ts`):** an externally supplied `hoverIndex` opens the read-out with
  no pointer at all; hovering writes the index back out through the binding; `tooltip={false}` keeps
  `line.cursor` and drops `.tip`; `gutterLeft` pushes the plot right (first x tick moves) and
  `onGutter` reports a positive natural inset.
- **Unit (`ActivityStreamsPanel.svelte.test.ts`):** hovering one chart draws a `line.cursor` in every
  chart of the stack, all at the same `x1`; the strip shows the hovered moment's values; no `.tip`
  renders in the panel.
- **API integration:** none — no handler touched.

## Closeout

- Commits: `b369649` — feat(ui): one crosshair across the whole stream stack (spec 035)
- Notes / follow-ups:
  - `gutterLeft` is a floor, not a fixed inset: a chart whose own ticks are wider than the shared
    maximum keeps its own room rather than clipping them. In a stack that means the widest chart sets
    the edge for everyone, which is exactly the alignment we want.
  - The strip is now the panel's only read-out. If a future caller wants a stack WITH tooltips, it
    only has to leave `tooltip` at its default and skip the strip.
  - Hover clears when the pointer crosses the gap between two charts. Garmin does the same; making the
    whole stack one hit area would mean one shared SVG, which is a much larger change.
