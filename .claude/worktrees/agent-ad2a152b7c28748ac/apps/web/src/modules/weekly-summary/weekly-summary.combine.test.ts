/** Unit tests for the "Wszystko" fold (spec 089) — pure, no store, no clock. */
import { describe, it, expect } from 'vitest';
import { addTotals, combineSports, emptyTotals } from './weekly-summary.combine';
import type { WeeklySummarySport, WeeklySummaryTotals, WeeklySummaryWeek } from './weekly-summary.types';

const WEEK_STARTS = ['2026-07-27', '2026-08-03', '2026-08-10'];

/** A family whose weeks carry the given per-week facts, last week in progress. */
function sport(
  group: WeeklySummarySport['group'],
  weeks: ReadonlyArray<Partial<WeeklySummaryWeek>>
): WeeklySummarySport {
  const weekly: WeeklySummaryWeek[] = WEEK_STARTS.map((week, i) => ({
    week,
    activities: 0,
    distanceM: 0,
    durationS: 0,
    elevationGainM: 0,
    partial: i === WEEK_STARTS.length - 1,
    ...weeks[i]
  }));
  const window = weekly.reduce<WeeklySummaryTotals>((acc, w) => addTotals(acc, w), emptyTotals());
  return {
    group,
    label: group,
    color: 'var(--lane-orange)',
    thisWeek: weekly[weekly.length - 1] ?? emptyTotals(),
    window,
    weekly
  };
}

const run = sport('run', [
  { activities: 3, distanceM: 40_000, durationS: 12_000, elevationGainM: 300 },
  { activities: 2, distanceM: 25_000, durationS: 8_000, elevationGainM: 150 },
  { activities: 1, distanceM: 10_000, durationS: 3_000, elevationGainM: 50 }
]);

const ride = sport('ride', [
  { activities: 1, distanceM: 60_000, durationS: 7_200, elevationGainM: 700 },
  { activities: 0 },
  { activities: 2, distanceM: 90_000, durationS: 10_800, elevationGainM: 1_100 }
]);

describe('combineSports', () => {
  it('sums time, climb, sessions (and distance) per week index', () => {
    const combined = combineSports([run, ride]);

    expect(combined?.weekly).toHaveLength(WEEK_STARTS.length);
    expect(combined?.weekly[0]).toEqual({
      week: '2026-07-27',
      activities: 4,
      distanceM: 100_000,
      durationS: 19_200,
      elevationGainM: 1_000,
      partial: false
    });
    expect(combined?.weekly[1]).toMatchObject({ week: '2026-08-03', activities: 2, durationS: 8_000 });
    expect(combined?.weekly[2]).toMatchObject({
      week: '2026-08-10',
      activities: 3,
      durationS: 13_800,
      elevationGainM: 1_150
    });
  });

  it('keeps the week keys of the shared lattice, one entry per index', () => {
    const combined = combineSports([run, ride]);
    expect(combined?.weekly.map((w) => w.week)).toEqual(WEEK_STARTS);
  });

  it('ORs `partial`: a week in progress is in progress for every sport in it', () => {
    // A family that (impossibly) reported the current week as finished must not un-flag it.
    const stale = sport('walk', [{}, {}, { partial: false }]);
    const combined = combineSports([run, stale]);
    expect(combined?.weekly.map((w) => w.partial)).toEqual([false, false, true]);

    // And a finished week stays finished when nobody claims otherwise.
    const allFinished = combineSports([
      sport('run', [{ partial: false }, { partial: false }, { partial: false }]),
      sport('ride', [{ partial: false }, { partial: false }, { partial: false }])
    ]);
    expect(allFinished?.weekly.every((w) => w.partial)).toBe(false);
  });

  it('sums the window from the families, not from a second pass', () => {
    const combined = combineSports([run, ride]);
    expect(combined?.window).toEqual(addTotals(run.window, ride.window));
    expect(combined?.window.durationS).toBe(run.window.durationS + ride.window.durationS);
  });

  it('sums this week from the same totals the sport tiles show', () => {
    const combined = combineSports([run, ride]);
    expect(combined?.thisWeek).toEqual(addTotals(run.thisWeek, ride.thisWeek));
  });

  it('carries the summed distance in the contract, for the card to decline to render', () => {
    const combined = combineSports([run, ride]);
    expect(combined?.window.distanceM).toBe(run.window.distanceM + ride.window.distanceM);
  });

  it('is null for a single-family athlete — "Wszystko" would name the only tab there is', () => {
    expect(combineSports([run])).toBeNull();
    expect(combineSports([])).toBeNull();
  });

  it('adds a third family without shifting anything', () => {
    const walk = sport('walk', [{ activities: 1, durationS: 3_600, elevationGainM: 20 }, {}, {}]);
    const two = combineSports([run, ride]);
    const three = combineSports([run, ride, walk]);

    expect(three?.weekly).toHaveLength(WEEK_STARTS.length);
    expect(three?.weekly[0]?.durationS).toBe((two?.weekly[0]?.durationS ?? 0) + 3_600);
    expect(three?.weekly[2]).toMatchObject({ week: '2026-08-10', activities: two?.weekly[2]?.activities });
  });

  it('treats a family shorter than the lattice as zeroes rather than sliding its weeks', () => {
    const short: WeeklySummarySport = { ...ride, weekly: ride.weekly.slice(0, 1) };
    const combined = combineSports([run, short]);

    expect(combined?.weekly.map((w) => w.week)).toEqual(WEEK_STARTS);
    expect(combined?.weekly[1]?.durationS).toBe(run.weekly[1]?.durationS);
    expect(combined?.weekly[2]?.durationS).toBe(run.weekly[2]?.durationS);
  });
});

describe('addTotals', () => {
  it('is field-wise and leaves its inputs alone', () => {
    const a = { activities: 1, distanceM: 10, durationS: 100, elevationGainM: 5 };
    const b = { activities: 2, distanceM: 20, durationS: 200, elevationGainM: 7 };
    expect(addTotals(a, b)).toEqual({ activities: 3, distanceM: 30, durationS: 300, elevationGainM: 12 });
    expect(a.activities).toBe(1);
    expect(addTotals(a, emptyTotals())).toEqual(a);
  });
});
