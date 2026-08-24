/**
 * Axis geometry + series resolution shared by the chart primitives (spec 017).
 *
 * Deliberately DOM-free so every rule an axis obeys — where the ticks land, how many x labels fit,
 * which side a label hangs off — is unit-tested once instead of eyeballed per chart.
 *
 * Sibling of `chart-interaction.ts`, which owns pointer/keyboard → index mapping.
 */

/** One plotted line/bar series. `color` defaults to the shared series palette. */
export interface ChartSeries {
  /** Legend + read-out name, e.g. "CTL". */
  name: string;
  /** Values indexed 1:1 with the chart's `labels`; non-finite entries are gaps. */
  values: number[];
  /** Any CSS color, normally a token, e.g. `var(--lane-cyan)`. */
  color?: string;
}

/** A `ChartSeries` after defaults are filled in — what the charts actually draw. */
export interface ResolvedSeries {
  name: string;
  values: number[];
  color: string;
}

/**
 * Gap between the plot band and the tick labels that annotate it, in chart units (px, because the
 * charts render 1:1 against their measured width).
 */
export const AXIS_GAP = 6;

/** Minimum breathing room between two neighbouring x-axis tick labels. */
export const TICK_GAP = 12;

/**
 * Mean advance width of a glyph as a fraction of the font size. Inter's digits/letters at the
 * `--text-xs` step sit around 0.62; it only has to be good enough to keep labels from touching.
 */
const CHAR_RATIO = 0.62;

/**
 * Default multi-series palette. Token names, so light/dark and any future re-hue stay in
 * `tokens.css`; the order is picked for hue separation, not for metric meaning.
 */
export const SERIES_COLORS: readonly string[] = [
  'var(--chart-series-1)',
  'var(--chart-series-2)',
  'var(--chart-series-3)',
  'var(--chart-series-4)',
  'var(--chart-series-5)',
  'var(--chart-series-6)'
];

/** Palette colour for the nth series, wrapping around for long series lists. */
export function seriesColor(index: number): string {
  const n = SERIES_COLORS.length;
  const i = ((Math.trunc(index) % n) + n) % n;
  return SERIES_COLORS[i]!;
}

/**
 * Normalises the two ways a chart can be fed data: an explicit `series` list, or the legacy
 * single-series `values` + `color` + `label` props. Always returns at least one series so the
 * drawing code never branches on "which prop did the caller use".
 */
export function resolveSeries(
  series: ChartSeries[] | undefined,
  fallback: { values: number[]; name?: string; color?: string }
): ResolvedSeries[] {
  if (series && series.length > 0) {
    return series.map((s, i) => ({
      name: s.name,
      values: s.values,
      color: s.color ?? seriesColor(i)
    }));
  }
  return [
    {
      name: fallback.name ?? '',
      values: fallback.values,
      color: fallback.color ?? seriesColor(0)
    }
  ];
}

/** Longest `values` array across the series — the width of the shared index lattice. */
export function seriesLength(series: readonly { values: number[] }[]): number {
  return series.reduce((max, s) => Math.max(max, s.values.length), 0);
}

/** `true` at every index where at least one of the given series has a finite value. */
export function definedMask(series: readonly { values: number[] }[], n: number): boolean[] {
  const mask = new Array<boolean>(Math.max(0, n)).fill(false);
  for (const s of series) {
    for (let i = 0; i < mask.length; i++) {
      if (Number.isFinite(s.values[i])) mask[i] = true;
    }
  }
  return mask;
}

/** Rounds away float noise from repeated `+= step` accumulation. */
function tidy(v: number): number {
  return Number(v.toPrecision(12));
}

/**
 * The "nice" step at or above `raw`: 1, 2, 2.5 or 5 times a power of ten. These are the intervals
 * people read without effort — 250, not 237.
 */
export function niceStep(raw: number): number {
  if (!Number.isFinite(raw) || raw <= 0) return 1;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const norm = raw / mag;
  const m = norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 2.5 ? 2.5 : norm <= 5 ? 5 : 10;
  return tidy(m * mag);
}

/**
 * Round tick values inside `[lo, hi]`, roughly `target` of them.
 *
 * The ticks sit *inside* the caller's domain rather than expanding it to nice bounds: the charts
 * pad their domain so peaks never touch the frame, and re-rounding the bounds would visibly flatten
 * a narrow series (a 49–56 bpm line squashed into a 40–60 scale).
 */
export function niceTicks(lo: number, hi: number, target = 4): number[] {
  if (!Number.isFinite(lo) || !Number.isFinite(hi) || hi < lo) return [];
  if (hi === lo) return [tidy(lo)];
  const step = niceStep((hi - lo) / Math.max(1, target));
  const first = Math.ceil(lo / step) * step;
  const out: number[] = [];
  // Guard the loop: a pathological domain must never spin.
  for (let k = 0; k < 64; k++) {
    const v = tidy(first + k * step);
    if (v > hi + step * 1e-9) break;
    out.push(v);
  }
  return out;
}

/** How many decimals a tick needs so a `step` of 2.5 reads "2.5" and a step of 1000 reads "1000". */
export function decimalsFor(step: number): number {
  if (!Number.isFinite(step) || step <= 0) return 0;
  const s = String(tidy(step));
  if (s.includes('e')) return 0;
  const dot = s.indexOf('.');
  return dot < 0 ? 0 : Math.min(6, s.length - dot - 1);
}

function trimZeros(v: number, decimals: number): string {
  const s = v.toFixed(decimals);
  return decimals > 0 ? s.replace(/\.?0+$/, '') : s;
}

/**
 * Compact tick text: axis labels must stay short so the gutter stays thin.
 * `12480` → `12k`, `1500` (step 500) → `1.5k`, `52.5` → `52.5`.
 */
export function formatTickValue(v: number, step = 1): string {
  if (!Number.isFinite(v)) return '';
  const abs = Math.abs(v);
  if (abs >= 1_000_000) return `${trimZeros(v / 1_000_000, step >= 1_000_000 ? 0 : 1)}M`;
  if (abs >= 1000) return `${trimZeros(v / 1000, step >= 1000 ? 0 : 1)}k`;
  return trimZeros(v, decimalsFor(step));
}

/** Rough rendered width of `text` at `fontPx`. Good enough to decide whether labels collide. */
export function estimateTextWidth(text: string, fontPx: number): number {
  if (!Number.isFinite(fontPx) || fontPx <= 0) return 0;
  return text.length * fontPx * CHAR_RATIO;
}

/** Widest of `texts` at `fontPx`; `0` for an empty list. */
export function maxTextWidth(texts: readonly string[], fontPx: number): number {
  return texts.reduce((max, t) => Math.max(max, estimateTextWidth(t, fontPx)), 0);
}

/**
 * Which x ticks actually get drawn, thinned so no two labels can touch.
 *
 * Works on the labels that EXIST rather than on the index lattice, which is the difference that
 * matters: a caller may label only a few slots and leave the rest empty (the volume chart's
 * day-of-year axis is 366 slots carrying 12 month names). Striding the lattice and then dropping the
 * blanks kept only the labels that happened to land on a stride multiple — one, in that chart.
 *
 * Thinning is by rendered position, walking back from the newest label (the one people look for, so
 * it is always kept) and keeping a candidate only once its footprint clears `minGap` from the last
 * one kept. On an evenly spaced axis with every slot labelled this reduces to a constant index
 * stride, i.e. exactly what a dense date axis did before.
 *
 * Pass `width` (the frame's own width, matching what `textAnchorAt` will use to anchor these same
 * ticks) so the newest label — almost always hanging off the right edge as `end`-anchored, its glyphs
 * drawn entirely to ITS left rather than centred — gets its true footprint counted. Without it, the
 * gap check assumes every tick is centre-anchored, which understates how far the newest label's own
 * text reaches back over its neighbour and let the two touch (spec fix: mobile activity-detail
 * streams, where the last x tick is often the widest — an elapsed time like "1:15:07").
 */
export function axisLabelIndices(
  labels: readonly (string | undefined)[],
  n: number,
  xOf: (i: number) => number,
  minGap: number,
  width?: number
): number[] {
  const textW = Math.max(0, minGap - TICK_GAP);
  const hasWidth = width !== undefined && width > 0;

  // Anchor-aware edges: a tick's rendered footprint depends on which way `textAnchorAt` hangs it.
  // Without a known frame width we fall back to the old symmetric (always "middle") assumption.
  function rightEdge(x: number): number {
    if (!hasWidth) return x + textW / 2;
    const anchor = textAnchorAt(x, width, textW);
    return anchor === 'start' ? x + textW : anchor === 'end' ? x : x + textW / 2;
  }
  function leftEdge(x: number): number {
    if (!hasWidth) return x - textW / 2;
    const anchor = textAnchorAt(x, width, textW);
    return anchor === 'end' ? x - textW : anchor === 'start' ? x : x - textW / 2;
  }

  const out: number[] = [];
  let lastLeft = Infinity;
  for (let i = Math.min(n, labels.length) - 1; i >= 0; i--) {
    const text = labels[i];
    if (text === undefined || text === '') continue;
    const x = xOf(i);
    if (out.length > 0 && !(rightEdge(x) + TICK_GAP <= lastLeft)) continue;
    out.push(i);
    lastLeft = leftEdge(x);
  }
  return out.reverse();
}

/**
 * Keeps an axis label inside the frame: the first/last tick hang off their anchor instead of
 * overflowing the card.
 */
export function textAnchorAt(x: number, width: number, textW: number): 'start' | 'middle' | 'end' {
  const half = textW / 2;
  if (!(width > 0)) return 'middle';
  if (x - half < 0) return 'start';
  if (x + half > width) return 'end';
  return 'middle';
}

/** Baseline offset of a marker label from its point, in multiples of the font size. */
const MARKER_ABOVE_EM = 0.75;
const MARKER_BELOW_EM = 1.3;
/** How far a label reaches past its own baseline, up (cap height) and down (descender). */
const CAP_EM = 0.8;
const DESCENDER_EM = 0.2;

/**
 * Baseline y for a min/max marker label, flipped to the other side of its point when the preferred side
 * has no room inside `band` (spec 031).
 *
 * The dashboard's 96px trend charts are the case this exists for: the domain's bottom padding leaves the
 * min point ~6px above the axis line, so a label fixed below it landed on the x-axis date row. Pass the
 * band the label must stay inside — for a chart with dates, `{ top: 0, bottom: plotBottom }`, since a max
 * label may live in the top padding but nothing may reach into the tick labels under the axis.
 */
export function markerLabelY(
  pointY: number,
  prefer: 'above' | 'below',
  band: { top: number; bottom: number },
  font: number
): number {
  const above = pointY - font * MARKER_ABOVE_EM;
  const below = pointY + font * MARKER_BELOW_EM;
  const fitsAbove = above - font * CAP_EM >= band.top;
  const fitsBelow = below + font * DESCENDER_EM <= band.bottom;
  // Neither side fits (a chart shorter than its own labels): keep the preferred side rather than
  // trading one overlap for another.
  if (prefer === 'above') return fitsAbove || !fitsBelow ? above : below;
  return fitsBelow || !fitsAbove ? below : above;
}
