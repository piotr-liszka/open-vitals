# Spec 031 — Readouts that fit their tile, marker labels that stay off the axis

- **Status:** Closed <!-- Draft → Approved → Closed -->
- **Module:** `apps/web/src/lib/ui/` (StatTile, TrendChart, readout-fit, chart-axis)
- **Owner agent:** ui-designer
- **Depends on:** 001 (design system), 028 (start-page trend charts), 029 (StatTile readout fit)

## Context

Two visual defects, both from a size chosen against the **viewport** instead of against the **box the
type actually lives in**:

1. **Activity detail hero tiles overflow.** `--readout-xl` is `clamp(…, 1.15rem + 3.6vw, 48px)`, so on a
   desktop it resolves to 48 px — while `.tiles` is `repeat(auto-fit, minmax(150px, 1fr))`, which spends
   extra width on *more columns* rather than wider ones. At `--container-max` each tile is ~158 px, so
   ~118 px of usable width has to carry `6,11` + `km` at 48 px (~135 px). The value's flex box shrinks
   (`min-width: 0`), the text spills out of it, and the unit is painted on top of the digits: `6,11km`
   overlapping, `34:5` clipped mid-glyph, `5:44min/km` unreadable. Spec 029's length-based step-down
   cannot see this — `6,11` + `km` is 5 weighted characters, i.e. legitimately `xl` in a 250 px tile and
   far too big in a 118 px one. The label has the same problem one line up: `PRZEWYŻSZENIE` is one
   unbreakable 13-character word at `--text-xs` + `--tracking-widest` (~119 px) and runs past the border.
2. **Trend marker labels collide with the x-axis dates.** In `TrendChart` the min label is drawn at a
   fixed `y + 16`. With the 96 px-high dashboard charts (spec 028) the domain's 15 % bottom padding puts
   the min point ~6 px above the axis line, so its label lands on the date row: `1638` over `07.08`,
   `39` over `11.08`, `23` under the axis on Body Battery.

## Requirements (acceptance criteria)

- [x] A hero readout **fits the tile it is in** at every column width, with no overlap between value and
      unit and no glyph clipped — verified at the activity-detail hero's ~118 px of usable tile width.
- [x] Wide tiles are unchanged: the dashboard's 3-column tiles keep the full `--readout-xl` hero size.
- [x] The unit stays proportional to whatever size the value ends up at, so the pairing stays balanced.
- [x] A long single-word label (`PRZEWYŻSZENIE`) stays inside the tile; multi-word labels keep wrapping
      as they do today, at today's size.
- [x] A min/max marker label never overlaps the x-axis tick labels: it flips to the other side of its
      point when the preferred side has no room inside the chart.
- [x] Both fits are deterministic pure functions (SSR-stable, no measurement, no hydration mismatch)
      and unit-tested, not eyeballed per page.
- [x] Unit tests pass (no e2e)
- [x] Tokens only — no new raw px/hex
- [x] No secrets logged or committed

## API contract

N/A (shared UI components). New pure helpers:

```
lib/ui/readout-fit.ts
  readoutFitScale(value: string | number, unit?: string): number   // 1 / width-in-em of value+unit
  labelFitScale(label: string): number                             // 1 / width-in-em of longest word

lib/ui/chart-axis.ts
  markerLabelY(pointY, prefer: 'above' | 'below', band: {top, bottom}, font): number
```

## UI

- `StatTile` becomes an **inline-size container** (`container-type: inline-size`), so the readout and the
  label can be sized against the tile's own content box in `cqw` instead of against `vw`:
  - `.value` → `min(<spec-029 step token>, (100cqw − gap) × --readout-scale)`. The token still caps the
    size, so nothing grows; the container term only ever shrinks a readout that would not fit.
  - `.unit` → `min(--tile-readout-unit, value size × 0.45)`.
  - `.label` → `min(--text-xs, (100cqw − marker/icon reserve) × --label-scale)`, floored at 0.85 ×
    `--text-xs` so micro-caps stay legible, with `overflow-wrap: anywhere` as the last-resort guard.
- `TrendChart` min/max labels use `markerLabelY` with the band `{ top: 0, bottom: plotBottom }`: above by
  default for the max, below for the min, flipped when that side has no room.
- No colour, spacing or layout change; light + dark are token-driven and unaffected.
- Styleguide gains a narrow-column tile row (the activity-hero case) so the behaviour is visible where
  the system is documented.

## Design / implementation notes

- **Why container queries and not JS measurement:** the tile's width comes from grids that differ per
  page, so length alone (spec 029) can never be right for every page. `cqw` gives the component the one
  number it was missing — its own width — while staying pure CSS: no `ResizeObserver`, no layout thrash,
  identical on the server and the client. `container-type: inline-size` is safe here because the tile's
  inline size never depends on its content (it is a grid/flex item).
- The scale factors are `1 / (width in em)` so the CSS can **multiply** (`calc(100cqw * var(--scale))`)
  rather than divide by a variable — the widest-supported form.
- Character advances are approximations of the shipped stack (Inter/system-ui, tabular digits,
  `--tracking-tight` for readouts, `--tracking-widest` caps for labels). They only need to be
  conservative: `overflow: hidden` on `.readout` stays as the hard boundary.
- Spec 029's `readoutStep` stays exactly as it is — it keeps a long value from starting at hero size at
  all, and the container fit handles narrow columns. The two compose via `min()`.
- `markerLabelY`'s band top is the SVG's own top edge (not `plotTop`), because a max label has always
  been allowed to sit in the top padding; only the bottom, where the date row lives, is a hard limit.

## Test plan

- **Unit:** `readoutFitScale` (short value keeps a scale that leaves the token in charge, a unit costs
  width, empty string is safe); `labelFitScale` (longest word decides, multi-word label is not punished);
  `markerLabelY` (prefers the requested side, flips a near-axis min above its point, keeps a near-top max
  above, never flips when neither side fits — deterministic numbers).
- **Component:** `StatTile` exposes `--readout-scale` / `--label-scale` on the tile; existing StatTile and
  TrendChart tests stay green.

## Closeout

- Commits: (uncommitted at close — working tree on `main`)
- Notes / follow-ups:
  - The advance constants in `readout-fit.ts` were **measured in a browser**, not guessed: the shipped
    stack renders `--font-black` digits at ~0.65em (the first pass assumed 0.6 and still overlapped
    `135 bpm`), unit letters at 0.68em (`W` at 0.95em, alone), and micro-caps at ~0.82em including
    `--tracking-widest`. Punctuation and grouping spaces are charged at 0.3em, which is what keeps
    `6,11` and `1:34:50` from being over-shrunk. Verified across tile widths of 111/117/136/261px in
    light + dark and at 375px: no readout overflows, worst-case slack 3.6px, dashboard tiles still at
    the full 48px hero size.
  - Under `@supports (container-type: inline-size)` on purpose — an unknown unit inside a custom
    property computes to `inherit`, so an ungated `--readout-size` would render the hero readout at body
    size on a pre-2022 browser instead of falling back to the token.
  - `readoutStep`'s own thresholds (spec 029) were left untouched: they now only decide the *ceiling*, so
    the two rules compose through `min()` rather than competing.
  - Not addressed here: `app.html` still declares `lang="en"` while the UI is Polish, so `hyphens: auto`
    is not usable for the label (it would hyphenate Polish by English rules). Worth its own small fix.
