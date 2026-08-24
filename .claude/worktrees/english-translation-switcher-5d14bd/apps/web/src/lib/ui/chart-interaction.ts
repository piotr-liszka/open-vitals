/**
 * Geometry for the charts' hover / tap read-out (spec 016).
 *
 * Deliberately DOM-free: every chart — the `lib/ui` primitives and the module-level inline-SVG
 * charts — maps a pointer or a key press to a data index through these helpers, so the maths is
 * unit-tested once instead of re-derived per chart.
 */

/** Which side of its anchor the floating read-out hangs off, so it never leaves the frame. */
export type TooltipAlign = 'start' | 'middle' | 'end';

/** An evenly spaced point lattice — line charts (`TrendChart`, PMC). */
export interface PointAxis {
  /** Number of plotted points. */
  n: number;
  /** Inset before the first point. */
  padX: number;
  /** Width spanned from the first to the last point. */
  plotW: number;
}

/** Equal-width bands — bar charts, where every value owns a slot rather than sitting on a lattice. */
export interface BandAxis {
  /** Number of bands. */
  n: number;
  /** Total width the bands share. */
  width: number;
}

/** Clamps an index into `0…n-1`; `-1` when there is nothing to point at. */
export function clampIndex(i: number, n: number): number {
  if (n <= 0) return -1;
  if (!Number.isFinite(i)) return 0;
  return Math.max(0, Math.min(n - 1, Math.trunc(i)));
}

/**
 * Maps a pointer's viewport x onto a chart's own coordinate system (its viewBox width).
 * `rect` is the rendered box of the chart — a `DOMRect` satisfies it.
 */
export function localX(clientX: number, rect: { left: number; width: number }, viewWidth: number): number {
  if (!(rect.width > 0)) return 0;
  return ((clientX - rect.left) / rect.width) * viewWidth;
}

/** Index of the lattice point nearest `x`. `-1` for an empty series. */
export function nearestPointIndex(x: number, axis: PointAxis): number {
  const { n, padX, plotW } = axis;
  if (n <= 0) return -1;
  if (n === 1 || !(plotW > 0) || !Number.isFinite(x)) return 0;
  return clampIndex(Math.round(((x - padX) / plotW) * (n - 1)), n);
}

/** Index of the band containing `x`. `-1` for an empty series. */
export function bandIndex(x: number, axis: BandAxis): number {
  const { n, width } = axis;
  if (n <= 0) return -1;
  if (!(width > 0) || !Number.isFinite(x)) return 0;
  return clampIndex(Math.floor((x / width) * n), n);
}

/**
 * Keyboard stepping over the active index. With nothing active yet a step lands on the newest
 * point (the last one) so the first key press reads the value people care about most.
 */
export function stepIndex(current: number | null, delta: number, n: number): number {
  if (n <= 0) return -1;
  if (current === null) return n - 1;
  return clampIndex(current + delta, n);
}

/**
 * Index of the value nearest `i` that actually has data, searching outward (earlier index wins a
 * tie). Charts plot on the full label lattice, so a gap day must not swallow a hover or a key press.
 * `-1` when nothing in the series is defined.
 */
export function nearestDefinedIndex(i: number, defined: readonly boolean[]): number {
  const n = defined.length;
  if (n <= 0) return -1;
  const start = clampIndex(i, n);
  if (defined[start]) return start;
  for (let d = 1; d < n; d++) {
    const left = start - d;
    if (left >= 0 && defined[left]) return left;
    const right = start + d;
    if (right < n && defined[right]) return right;
  }
  return -1;
}

/**
 * Keyboard stepping that hops over gaps. Like `stepIndex`, the first press with nothing active
 * lands on the newest defined value; at either end the index stays put rather than wrapping.
 */
export function stepDefinedIndex(current: number | null, delta: number, defined: readonly boolean[]): number {
  const n = defined.length;
  if (n <= 0) return -1;
  if (current === null) return edgeDefinedIndex(defined, 'last');
  const dir = delta >= 0 ? 1 : -1;
  let remaining = Math.max(1, Math.abs(Math.trunc(delta)));
  let i = clampIndex(current, n);
  while (remaining > 0) {
    let j = i + dir;
    while (j >= 0 && j < n && !defined[j]) j += dir;
    if (j < 0 || j >= n) break;
    i = j;
    remaining--;
  }
  return i;
}

/** First / last index carrying data — what `Home` and `End` should reach. `-1` when empty. */
export function edgeDefinedIndex(defined: readonly boolean[], edge: 'first' | 'last'): number {
  const n = defined.length;
  if (edge === 'last') {
    for (let i = n - 1; i >= 0; i--) if (defined[i]) return i;
    return -1;
  }
  for (let i = 0; i < n; i++) if (defined[i]) return i;
  return -1;
}

/**
 * The index the read-out should display. A live hover always wins; otherwise the pinned selection
 * persists (that is what survives `pointerleave`). Out-of-range values are ignored so a caller can
 * hand back a stale `selectedIndex` after the series shrinks.
 */
export function activeIndex(
  hover: number | null,
  selected: number | null | undefined,
  n: number
): number | null {
  if (hover !== null && hover >= 0 && hover < n) return Math.trunc(hover);
  if (selected !== null && selected !== undefined && selected >= 0 && selected < n) {
    return Math.trunc(selected);
  }
  return null;
}

/**
 * Where to hang the read-out for an anchor at `x` in a frame `width` wide: centred in the middle
 * band, pinned inside the frame near either edge.
 */
export function tooltipAlign(x: number, width: number): TooltipAlign {
  if (!(width > 0)) return 'middle';
  const t = x / width;
  if (t < 0.2) return 'start';
  if (t > 0.8) return 'end';
  return 'middle';
}
