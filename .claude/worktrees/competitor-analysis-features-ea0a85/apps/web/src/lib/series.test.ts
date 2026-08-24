import { describe, expect, it } from 'vitest';
import { dayRange } from './date';
import { bucketNoun, bucketSeries } from './series';

describe('bucketSeries — day', () => {
  it('passes a daily series through untouched', () => {
    const days = ['2026-08-09', '2026-08-10', '2026-08-11'];
    const result = bucketSeries(days, [1, null, 3], 'day');
    expect(result.days).toEqual(days);
    expect(result.values).toEqual([1, null, 3]);
  });

  it('normalises non-finite values to gaps', () => {
    const result = bucketSeries(['2026-08-10', '2026-08-11'], [Number.NaN, Number.POSITIVE_INFINITY], 'day');
    expect(result.values).toEqual([null, null]);
  });

  it('reads a short values array as trailing gaps', () => {
    const result = bucketSeries(['2026-08-09', '2026-08-10', '2026-08-11'], [5], 'day');
    expect(result.values).toEqual([5, null, null]);
  });
});

describe('bucketSeries — week', () => {
  // 2026-08-03 is a Monday; 2026-08-10 is the next one.
  const days = dayRange('2026-08-03', '2026-08-16'); // exactly two ISO weeks

  it('keys each bucket by its Monday and keeps input order', () => {
    const result = bucketSeries(
      days,
      days.map(() => 1),
      'week'
    );
    expect(result.days).toEqual(['2026-08-03', '2026-08-10']);
  });

  it('averages a level metric across the days that had a reading', () => {
    // First week: 10 on two days, nothing on the rest → mean 10, not 20/7.
    const values = days.map((d) => (d === '2026-08-03' || d === '2026-08-05' ? 10 : null));
    const result = bucketSeries(days, values, 'week', 'mean');
    expect(result.values).toEqual([10, null]);
  });

  it('sums a count metric', () => {
    const values = days.map((d, i) => (i < 7 ? 1000 : 2000));
    const result = bucketSeries(days, values, 'week', 'sum');
    expect(result.values).toEqual([7000, 14000]);
  });

  it('leaves an entirely empty week as a gap, never a zero', () => {
    const values = days.map((_, i) => (i < 7 ? 5 : null));
    expect(bucketSeries(days, values, 'week', 'mean').values).toEqual([5, null]);
    expect(bucketSeries(days, values, 'week', 'sum').values).toEqual([35, null]);
  });

  it('keeps a partial trailing bucket rather than dropping it', () => {
    const partial = dayRange('2026-08-03', '2026-08-12'); // second week is only 3 days long
    const result = bucketSeries(
      partial,
      partial.map(() => 2),
      'week',
      'sum'
    );
    expect(result.days).toEqual(['2026-08-03', '2026-08-10']);
    expect(result.values).toEqual([14, 6]);
  });

  it('assigns a mid-week start to the week it belongs to', () => {
    // Wednesday → still the 2026-08-03 week, not a bucket of its own.
    const result = bucketSeries(['2026-08-05', '2026-08-06'], [1, 3], 'week', 'mean');
    expect(result.days).toEqual(['2026-08-03']);
    expect(result.values).toEqual([2]);
  });
});

describe('bucketSeries — month', () => {
  const days = dayRange('2026-06-28', '2026-08-02'); // spans three calendar months

  it('keys each bucket by the first of its month', () => {
    const result = bucketSeries(
      days,
      days.map(() => 1),
      'month'
    );
    expect(result.days).toEqual(['2026-06-01', '2026-07-01', '2026-08-01']);
  });

  it('aggregates within the calendar month', () => {
    const result = bucketSeries(
      days,
      days.map(() => 3),
      'month',
      'sum'
    );
    // June 28–30 = 3 days, all of July = 31, August 1–2 = 2.
    expect(result.values).toEqual([9, 93, 6]);
  });

  it('pads a single-digit month to two digits', () => {
    const result = bucketSeries(['2026-01-15'], [1], 'month');
    expect(result.days).toEqual(['2026-01-01']);
  });
});

describe('bucketSeries — edges', () => {
  it('returns nothing for an empty series', () => {
    expect(bucketSeries([], [], 'week')).toEqual({ days: [], values: [] });
  });

  it('handles a one-day window', () => {
    expect(bucketSeries(['2026-08-11'], [42], 'month', 'mean')).toEqual({
      days: ['2026-08-01'],
      values: [42]
    });
  });
});

describe('bucketNoun', () => {
  it('names what one point means', () => {
    expect(bucketNoun('day')).toBe('dzień');
    expect(bucketNoun('week')).toBe('tydzień');
    expect(bucketNoun('month')).toBe('miesiąc');
  });
});
