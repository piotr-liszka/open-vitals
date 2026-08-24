/** Spec 070 — the one period filter that governs the bars, the grid and the month table. */
import { describe, it, expect } from 'vitest';
import {
  LAST_12,
  avgCompleteDistanceM,
  bestCompleteMonth,
  periodOptions,
  slicePeriod
} from './volume.period';
import type { MonthVolume } from './volume.types';

function month(key: string, km: number, partial = false, activities = 4): MonthVolume {
  return {
    month: key,
    activities,
    distanceM: km * 1000,
    durationS: km * 300,
    elevationGainM: km * 10,
    partial
  };
}

/**
 * 24 consecutive months ending with August 2026 — the lattice the loader ships, in miniature. It
 * always ENDS on the current month, which is what makes the trailing slice a rolling window.
 */
function lattice(): string[] {
  const out: string[] = [];
  for (let i = 23; i >= 0; i--) {
    const total = 2026 * 12 + 7 - i; // 7 = August, zero-based
    out.push(`${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, '0')}`);
  }
  return out;
}

describe('periodOptions', () => {
  it('leads with the rolling window, then years newest first', () => {
    expect(periodOptions([2024, 2026, 2025]).map((o) => o.value)).toEqual([LAST_12, '2026', '2025', '2024']);
  });

  it('gives every option a compact label, because five segments do not fit a phone', () => {
    expect(periodOptions([2026]).map((o) => o.short)).toEqual(['12 mies.', '2026']);
  });

  it('de-duplicates a repeated year rather than rendering it twice', () => {
    expect(periodOptions([2026, 2026]).map((o) => o.value)).toEqual([LAST_12, '2026']);
  });
});

describe('slicePeriod', () => {
  const months = lattice();

  it('takes the trailing twelve months for the rolling window', () => {
    const slice = slicePeriod(months, LAST_12, '2026-08-11');
    expect(slice.months).toHaveLength(12);
    expect(slice.months[0]).toBe('2025-09');
    expect(slice.months.at(-1)).toBe('2026-08');
    expect(slice.from).toBe('2025-09-01');
    // The grid stops at today; a rolling window has no future to draw.
    expect(slice.to).toBe('2026-08-11');
    expect(slice.label).toBe('ostatnie 12 miesięcy');
  });

  it('takes exactly one calendar year when a year is chosen', () => {
    const slice = slicePeriod(months, '2025', '2026-08-11');
    expect(slice.months).toHaveLength(12);
    expect(slice.months[0]).toBe('2025-01');
    expect(slice.from).toBe('2025-01-01');
    // A finished year runs to its own last day, not to today.
    expect(slice.to).toBe('2025-12-31');
    expect(slice.label).toBe('2025');
  });

  it('stops the year in progress at today rather than drawing an empty tail', () => {
    expect(slicePeriod(months, '2026', '2026-08-11').to).toBe('2026-08-11');
  });

  it('returns indices that slice every parallel series identically', () => {
    const slice = slicePeriod(months, '2026', '2026-08-11');
    expect(slice.indices.map((i) => months[i])).toEqual(slice.months);
  });

  it('falls back to the rolling window for a year that is no longer in the data', () => {
    // A remembered "2019" after the window has moved on must not blank the page.
    expect(slicePeriod(months, '2019', '2026-08-11').label).toBe('ostatnie 12 miesięcy');
    expect(slicePeriod(months, 'nonsense', '2026-08-11').label).toBe('ostatnie 12 miesięcy');
  });

  it('handles a lattice shorter than the rolling window', () => {
    const slice = slicePeriod(['2026-07', '2026-08'], LAST_12, '2026-08-11');
    expect(slice.months).toEqual(['2026-07', '2026-08']);
    expect(slice.from).toBe('2026-07-01');
  });
});

describe('avgCompleteDistanceM / bestCompleteMonth', () => {
  const totals = [month('2026-06', 100), month('2026-07', 200), month('2026-08', 30, true)];

  it('ignores the month in progress, which would otherwise drag both down every 1st', () => {
    expect(avgCompleteDistanceM(totals)).toBe(150_000);
    expect(bestCompleteMonth(totals)?.month).toBe('2026-07');
  });

  it('ignores a completed month with no activity, so a break does not halve the average', () => {
    expect(avgCompleteDistanceM([...totals, month('2026-05', 0, false, 0)])).toBe(150_000);
  });

  it('answers null rather than zero when nothing in the period completed', () => {
    expect(avgCompleteDistanceM([month('2026-08', 30, true)])).toBeNull();
    expect(bestCompleteMonth([month('2026-08', 30, true)])).toBeNull();
    expect(avgCompleteDistanceM([])).toBeNull();
  });
});
