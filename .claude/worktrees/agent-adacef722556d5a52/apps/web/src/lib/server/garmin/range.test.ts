import { describe, it, expect } from 'vitest';
import { chunkRange, fetchMetricRangeChunked, MAX_RANGE_DAYS } from './range';
import type {
  GarminMetricDay,
  GarminMetricName,
  GarminMetricRange,
  GarminService
} from '$lib/server/interfaces';

/** Inclusive day count between two YYYY-MM-DD strings (UTC). */
function span(start: string, end: string): number {
  const s = Date.parse(`${start}T00:00:00Z`);
  const e = Date.parse(`${end}T00:00:00Z`);
  return Math.round((e - s) / 86_400_000) + 1;
}

/** end = start + (days - 1). */
function endFor(start: string, days: number): string {
  const d = new Date(`${start}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days - 1);
  return d.toISOString().slice(0, 10);
}

function eachDate(start: string, end: string): string[] {
  const out: string[] = [];
  const d = new Date(`${start}T00:00:00Z`);
  const e = new Date(`${end}T00:00:00Z`);
  while (d.getTime() <= e.getTime()) {
    out.push(d.toISOString().slice(0, 10));
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return out;
}

/**
 * Minimal recording GarminService: returns one day per date, value derived from the date so the
 * merge order is verifiable, and injects null-`data` gaps for a set of dates.
 */
function recordingGarmin(gaps: Set<string> = new Set()): GarminService & {
  calls: Array<{ start: string; end: string }>;
} {
  const calls: Array<{ start: string; end: string }> = [];
  return {
    calls,
    async getMetricRange(name: GarminMetricName, start: string, end: string): Promise<GarminMetricRange> {
      calls.push({ start, end });
      const days: GarminMetricDay[] = eachDate(start, end).map((date) => ({
        date,
        data: gaps.has(date) ? null : { value: Number(date.replaceAll('-', '')) }
      }));
      return { metric: name, start, end, days };
    },
    login: async () => ({ outcome: 'success', status: { authenticated: true } }),
    getStatus: async () => ({ authenticated: true }),
    getMetric: async () => ({}),
    disconnect: async () => {}
  };
}

const START = '2026-01-01';

describe('chunkRange', () => {
  it('keeps a 7-day span as one chunk', () => {
    const chunks = chunkRange(START, endFor(START, 7));
    expect(chunks).toEqual([{ start: START, end: '2026-01-07' }]);
  });

  it('keeps a 30-day span as one chunk', () => {
    const chunks = chunkRange(START, endFor(START, 30));
    expect(chunks).toEqual([{ start: START, end: '2026-01-30' }]);
  });

  it('splits a 90-day span into 31 + 31 + 28', () => {
    const chunks = chunkRange(START, endFor(START, 90));
    expect(chunks).toEqual([
      { start: '2026-01-01', end: '2026-01-31' },
      { start: '2026-02-01', end: '2026-03-03' },
      { start: '2026-03-04', end: '2026-03-31' }
    ]);
    expect(chunks.every((c) => span(c.start, c.end) <= MAX_RANGE_DAYS)).toBe(true);
  });

  it('splits a 365-day span into 12 chunks, none over 31 days, contiguous, covering the span', () => {
    const end = endFor(START, 365);
    const chunks = chunkRange(START, end);
    expect(chunks.length).toBe(12);
    expect(chunks.every((c) => span(c.start, c.end) <= MAX_RANGE_DAYS)).toBe(true);
    expect(chunks[0]!.start).toBe(START);
    expect(chunks.at(-1)!.end).toBe(end);
    // contiguous: each chunk starts the day after the previous one ends
    for (let i = 1; i < chunks.length; i++) {
      expect(span(chunks[i - 1]!.end, chunks[i]!.start)).toBe(2);
    }
    // total days covered = 365
    expect(chunks.reduce((sum, c) => sum + span(c.start, c.end), 0)).toBe(365);
  });
});

describe('fetchMetricRangeChunked', () => {
  it('merges chunk days oldest→newest with no duplicates', async () => {
    const g = recordingGarmin();
    const end = endFor(START, 90);
    const days = await fetchMetricRangeChunked(g, 'steps', START, end);

    expect(days.length).toBe(90);
    expect(days[0]!.date).toBe(START);
    expect(days.at(-1)!.date).toBe(end);
    const dates = days.map((d) => d.date);
    expect(dates).toEqual([...dates].sort()); // ascending
    expect(new Set(dates).size).toBe(dates.length); // deduped
    expect(g.calls.length).toBe(3);
  });

  it('preserves null gaps', async () => {
    const gaps = new Set(['2026-01-05', '2026-02-10']);
    const g = recordingGarmin(gaps);
    const days = await fetchMetricRangeChunked(g, 'hrv', START, endFor(START, 90));
    expect(days.find((d) => d.date === '2026-01-05')!.data).toBeNull();
    expect(days.find((d) => d.date === '2026-02-10')!.data).toBeNull();
    expect(days.find((d) => d.date === '2026-01-06')!.data).not.toBeNull();
  });

  it('handles a single-chunk 7-day span', async () => {
    const g = recordingGarmin();
    const days = await fetchMetricRangeChunked(g, 'sleep', START, endFor(START, 7));
    expect(days.length).toBe(7);
    expect(g.calls.length).toBe(1);
  });
});
