import { describe, it, expect } from 'vitest';
import {
  SERIES_COLORS,
  axisLabelIndices,
  decimalsFor,
  definedMask,
  estimateTextWidth,
  formatTickValue,
  markerLabelY,
  maxTextWidth,
  niceStep,
  niceTicks,
  resolveSeries,
  seriesColor,
  seriesLength,
  textAnchorAt
} from './chart-axis';

describe('niceStep', () => {
  it('snaps to a 1/2/2.5/5 × 10ⁿ interval', () => {
    expect(niceStep(1)).toBe(1);
    expect(niceStep(1.7)).toBe(2);
    expect(niceStep(2.3)).toBe(2.5);
    expect(niceStep(4)).toBe(5);
    expect(niceStep(7)).toBe(10);
    expect(niceStep(2810)).toBe(5000);
    expect(niceStep(0.03)).toBe(0.05);
  });

  it('falls back to 1 for a degenerate step', () => {
    expect(niceStep(0)).toBe(1);
    expect(niceStep(-5)).toBe(1);
    expect(niceStep(NaN)).toBe(1);
  });
});

describe('niceTicks', () => {
  it('lands on round values inside the domain', () => {
    expect(niceTicks(0, 100, 4)).toEqual([0, 25, 50, 75, 100]);
    expect(niceTicks(0, 12480, 4)).toEqual([0, 5000, 10000]);
  });

  it('never widens the caller domain (a narrow series keeps its shape)', () => {
    const ticks = niceTicks(48, 57, 4);
    expect(ticks[0]).toBeGreaterThanOrEqual(48);
    expect(ticks[ticks.length - 1]).toBeLessThanOrEqual(57);
    expect(ticks).toEqual([50, 52.5, 55]);
  });

  it('handles fractional and negative domains without float noise', () => {
    expect(niceTicks(-1.2, 1.2, 4)).toEqual([-1, 0, 1]);
    expect(niceTicks(-40, 40, 4)).toEqual([-40, -20, 0, 20, 40]);
  });

  it('never overshoots the tick target — small charts must not turn into a ladder', () => {
    const domains: [number, number][] = [
      [0, 12480],
      [48, 57],
      [0, 1],
      [-40, 40],
      [0, 3_600_000],
      [0.02, 0.09]
    ];
    for (const [lo, hi] of domains) {
      expect(niceTicks(lo, hi, 4).length).toBeLessThanOrEqual(5);
    }
  });

  it('degrades gracefully for flat or invalid domains', () => {
    expect(niceTicks(50, 50)).toEqual([50]);
    expect(niceTicks(10, 5)).toEqual([]);
    expect(niceTicks(NaN, 5)).toEqual([]);
  });
});

describe('decimalsFor / formatTickValue', () => {
  it('shows exactly the decimals the step needs', () => {
    expect(decimalsFor(1)).toBe(0);
    expect(decimalsFor(2.5)).toBe(1);
    expect(decimalsFor(0.25)).toBe(2);
    expect(decimalsFor(0)).toBe(0);
  });

  it('keeps axis text short with k/M suffixes', () => {
    expect(formatTickValue(0, 5000)).toBe('0');
    expect(formatTickValue(12000, 2000)).toBe('12k');
    expect(formatTickValue(1500, 500)).toBe('1.5k');
    expect(formatTickValue(2_500_000, 500_000)).toBe('2.5M');
    expect(formatTickValue(-4000, 2000)).toBe('-4k');
  });

  it('leaves small numbers alone', () => {
    expect(formatTickValue(52, 2)).toBe('52');
    expect(formatTickValue(52.5, 2.5)).toBe('52.5');
    expect(formatTickValue(NaN)).toBe('');
  });
});

describe('estimateTextWidth / maxTextWidth', () => {
  it('scales with characters and font size', () => {
    expect(estimateTextWidth('12k', 12)).toBeCloseTo(3 * 12 * 0.62, 5);
    expect(estimateTextWidth('12k', 0)).toBe(0);
  });

  it('reports the widest label', () => {
    expect(maxTextWidth(['1', '1000', '12'], 10)).toBeCloseTo(4 * 10 * 0.62, 5);
    expect(maxTextWidth([], 10)).toBe(0);
  });
});

describe('axisLabelIndices', () => {
  /** Evenly spaced lattice, 0…n-1 mapped onto `plotW`. */
  const lattice = (n: number, plotW: number) => (i: number) => (i / (n - 1)) * plotW;
  const dates = (n: number): string[] => Array.from({ length: n }, (_, i) => `d${i}`);

  it('labels every tick when they all fit', () => {
    expect(axisLabelIndices(dates(4), 4, lattice(4, 400), 50)).toEqual([0, 1, 2, 3]);
  });

  it('always labels the newest reading and walks back from it', () => {
    // 14 points across 130px, 30px apart minimum: every third, anchored on the last.
    expect(axisLabelIndices(dates(14), 14, lattice(14, 130), 30)).toEqual([1, 4, 7, 10, 13]);
  });

  it('thins a year of dates so labels can never collide', () => {
    const kept = axisLabelIndices(dates(365), 365, lattice(365, 600), 50);
    expect(kept).toContain(364);
    expect(kept.length).toBeLessThanOrEqual(13);
    const xs = kept.map(lattice(365, 600));
    for (let i = 1; i < xs.length; i++) expect(xs[i]! - xs[i - 1]!).toBeGreaterThanOrEqual(50);
  });

  it('keeps every label a sparse axis actually carries', () => {
    // The volume chart's day-of-year axis: 366 slots, a month name on the 1st of each month.
    const starts = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
    const labels = Array.from({ length: 366 }, (_, i) => (starts.includes(i) ? 'sty' : ''));
    expect(axisLabelIndices(labels, 366, lattice(366, 900), 30)).toEqual(starts);
  });

  it('handles empty, single-point and all-blank axes', () => {
    expect(axisLabelIndices([], 0, lattice(1, 100), 30)).toEqual([]);
    expect(axisLabelIndices(['only'], 1, () => 50, 30)).toEqual([0]);
    expect(axisLabelIndices(['', '', ''], 3, lattice(3, 300), 30)).toEqual([]);
  });

  it('ignores labels past the plotted lattice', () => {
    expect(axisLabelIndices(dates(6), 3, lattice(6, 600), 30)).toEqual([0, 1, 2]);
  });

  it('accounts for the newest label hanging off the right edge as "end"-anchored', () => {
    // The newest tick sits at the frame's right edge, so `textAnchorAt` draws it entirely to ITS
    // left rather than centred — a wider footprint than the symmetric assumption below counts.
    // Mirrors the activity-detail streams bug: an elapsed-time axis whose last label ("1:15:07")
    // is also its widest.
    const width = 100;
    const textW = 40;
    const xOf = (i: number) => [40, 100][i]!;
    // Without a frame width, the legacy symmetric assumption keeps both — and they would collide.
    expect(axisLabelIndices(['A', 'WIDE'], 2, xOf, textW + 12)).toEqual([0, 1]);
    // With the frame width, the last tick's true (leftward) footprint is counted and the
    // would-collide neighbour is dropped instead.
    expect(axisLabelIndices(['A', 'WIDE'], 2, xOf, textW + 12, width)).toEqual([1]);
  });
});

describe('textAnchorAt', () => {
  it('pins the first and last label inside the frame', () => {
    expect(textAnchorAt(4, 400, 40)).toBe('start');
    expect(textAnchorAt(200, 400, 40)).toBe('middle');
    expect(textAnchorAt(396, 400, 40)).toBe('end');
  });

  it('degrades to centred without a measured width', () => {
    expect(textAnchorAt(10, 0, 40)).toBe('middle');
  });
});

describe('resolveSeries', () => {
  it('wraps the legacy single-series props into one series', () => {
    expect(resolveSeries(undefined, { values: [1, 2], name: 'steps', color: 'var(--lane-orange)' })).toEqual([
      { name: 'steps', values: [1, 2], color: 'var(--lane-orange)' }
    ]);
  });

  it('fills missing colours from the shared palette, in order', () => {
    const out = resolveSeries(
      [
        { name: 'CTL', values: [1] },
        { name: 'ATL', values: [2], color: 'var(--lane-red)' },
        { name: 'TSB', values: [3] }
      ],
      { values: [] }
    );
    expect(out.map((s) => s.color)).toEqual([SERIES_COLORS[0], 'var(--lane-red)', SERIES_COLORS[2]]);
  });

  it('falls back to the single-series shape for an empty series list', () => {
    expect(resolveSeries([], { values: [7] })).toEqual([{ name: '', values: [7], color: SERIES_COLORS[0] }]);
  });

  it('wraps the palette for long series lists', () => {
    expect(seriesColor(SERIES_COLORS.length)).toBe(SERIES_COLORS[0]);
    expect(seriesColor(-1)).toBe(SERIES_COLORS[SERIES_COLORS.length - 1]);
  });
});

describe('seriesLength / definedMask', () => {
  it('spans the longest series', () => {
    expect(seriesLength([{ values: [1, 2] }, { values: [1, 2, 3] }])).toBe(3);
    expect(seriesLength([])).toBe(0);
  });

  it('marks every index where at least one series has data', () => {
    const mask = definedMask([{ values: [1, NaN, NaN] }, { values: [NaN, NaN, 3] }], 3);
    expect(mask).toEqual([true, false, true]);
  });

  it('pads short series with gaps', () => {
    expect(definedMask([{ values: [1] }], 3)).toEqual([true, false, false]);
    expect(definedMask([], 2)).toEqual([false, false]);
  });
});

describe('markerLabelY', () => {
  /*
    The dashboard's 96px trend chart (spec 028): 12px axis type, plot band 18 → 72, and the domain's 15%
    padding leaves the min ~6px above the axis line while the max sits ~6px below the top of the band.
  */
  const font = 12;
  const band = { top: 0, bottom: 72 };
  const loY = 65.8;
  const hiY = 24.2;

  it('keeps a peak label above its point', () => {
    expect(markerLabelY(hiY, 'above', band, font)).toBeCloseTo(hiY - 9, 5);
  });

  it('flips a near-axis min label above its point instead of onto the date row', () => {
    const y = markerLabelY(loY, 'below', band, font);
    expect(y).toBeCloseTo(loY - 9, 5);
    // The whole label, descender included, stays clear of the axis line and the ticks under it.
    expect(y + font * 0.2).toBeLessThanOrEqual(band.bottom);
  });

  it('leaves a min label below its point when there is room', () => {
    // Same chart with the x axis off: the band reaches further down, so nothing has to move.
    expect(markerLabelY(40, 'below', { top: 0, bottom: 85 }, font)).toBeCloseTo(40 + 15.6, 5);
  });

  it('flips a max label below its point when the top is too tight', () => {
    expect(markerLabelY(5, 'above', band, font)).toBeCloseTo(5 + 15.6, 5);
  });

  it('keeps the preferred side when neither side fits', () => {
    const cramped = { top: 20, bottom: 30 };
    expect(markerLabelY(25, 'below', cramped, font)).toBeCloseTo(25 + 15.6, 5);
    expect(markerLabelY(25, 'above', cramped, font)).toBeCloseTo(25 - 9, 5);
  });
});
