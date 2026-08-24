import { describe, it, expect } from 'vitest';
import { monthlyVolume, volumeWindowStartMonth, yearOverYear, type VolumeActivity } from './volume';
import type { SportGroup } from '$lib/sport-labels';

function act(
  day: string,
  km: number,
  over: Partial<VolumeActivity> & { group?: SportGroup } = {}
): VolumeActivity {
  return {
    day,
    group: 'run',
    distanceM: km * 1000,
    durationS: km * 300,
    elevationGainM: km * 10,
    ...over
  };
}

const TODAY = '2026-08-11';

describe('monthlyVolume', () => {
  it('rolls activities into their calendar months, oldest first', () => {
    const data = monthlyVolume([act('2026-06-02', 10), act('2026-06-28', 5), act('2026-07-15', 20)], {
      today: TODAY,
      months: 3
    });
    expect(data.months).toEqual(['2026-06', '2026-07', '2026-08']);
    expect(data.totals.map((m) => m.distanceM)).toEqual([15_000, 20_000, 0]);
    expect(data.totals.map((m) => m.activities)).toEqual([2, 1, 0]);
  });

  it('keeps empty months in the lattice rather than closing the gap', () => {
    const data = monthlyVolume([act('2026-08-01', 10)], { today: TODAY, months: 4 });
    expect(data.months).toHaveLength(4);
    expect(data.totals).toHaveLength(4);
    expect(data.totals.slice(0, 3).every((m) => m.activities === 0)).toBe(true);
  });

  it('marks the month in progress as partial and no other', () => {
    const data = monthlyVolume([], { today: TODAY, months: 3 });
    expect(data.totals.map((m) => m.partial)).toEqual([false, false, true]);
  });

  it('leaves the partial month out of the average and the best month', () => {
    // August (partial) is the biggest month, but it must win neither.
    const data = monthlyVolume([act('2026-06-02', 100), act('2026-07-02', 200), act('2026-08-02', 500)], {
      today: TODAY,
      months: 3
    });
    expect(data.bestMonth?.month).toBe('2026-07');
    expect(data.avgDistanceM).toBe(150_000); // (100 + 200) / 2 complete months
  });

  it('has no average or best month when nothing has completed', () => {
    const data = monthlyVolume([act('2026-08-02', 50)], { today: TODAY, months: 1 });
    expect(data.avgDistanceM).toBeNull();
    expect(data.bestMonth).toBeNull();
  });

  it('ignores a month that never had an activity when averaging', () => {
    // June 100 km, July nothing, August partial → the average is June alone, not 50.
    const data = monthlyVolume([act('2026-06-02', 100)], { today: TODAY, months: 3 });
    expect(data.avgDistanceM).toBe(100_000);
  });

  it('splits by sport family, busiest first, and lists only families present', () => {
    const data = monthlyVolume(
      [
        act('2026-07-01', 10, { group: 'run' }),
        act('2026-07-02', 80, { group: 'ride' }),
        act('2026-06-02', 40, { group: 'ride' })
      ],
      { today: TODAY, months: 3 }
    );
    expect(data.bySport.map((s) => s.group)).toEqual(['ride', 'run']);
    expect(data.bySport.find((s) => s.group === 'ride')?.distanceM).toEqual([40_000, 80_000, 0]);
    // A family with nothing in the window gets no lane at all.
    expect(data.bySport.some((s) => s.group === 'walk')).toBe(false);
  });

  it('aligns every per-sport series to the month lattice', () => {
    const data = monthlyVolume([act('2026-07-01', 10, { group: 'walk' })], {
      today: TODAY,
      months: 5
    });
    for (const s of data.bySport) {
      expect(s.distanceM).toHaveLength(data.months.length);
      expect(s.durationS).toHaveLength(data.months.length);
      expect(s.elevationGainM).toHaveLength(data.months.length);
    }
  });

  it('restricts to one family when asked', () => {
    const data = monthlyVolume(
      [act('2026-07-01', 10, { group: 'run' }), act('2026-07-02', 80, { group: 'ride' })],
      { today: TODAY, months: 3, group: 'run' }
    );
    expect(data.totals.find((m) => m.month === '2026-07')?.distanceM).toBe(10_000);
    expect(data.bySport.map((s) => s.group)).toEqual(['run']);
  });

  it('drops activities outside the window instead of folding them into the edge month', () => {
    const data = monthlyVolume([act('2025-01-05', 999), act('2026-08-01', 10)], {
      today: TODAY,
      months: 3
    });
    expect(data.totals.reduce((s, m) => s + m.distanceM, 0)).toBe(10_000);
  });

  it('treats a missing distance / duration / climb as zero, not as a crash', () => {
    const data = monthlyVolume(
      [act('2026-07-01', 0, { distanceM: null, durationS: null, elevationGainM: null })],
      { today: TODAY, months: 2 }
    );
    const july = data.totals.find((m) => m.month === '2026-07')!;
    expect(july).toMatchObject({ activities: 1, distanceM: 0, durationS: 0, elevationGainM: 0 });
  });

  it('ignores a row whose day is not a real calendar day', () => {
    const data = monthlyVolume([act('2026-02-30', 10), act('not-a-day', 5)], {
      today: TODAY,
      months: 12
    });
    expect(data.totals.reduce((s, m) => s + m.activities, 0)).toBe(0);
  });

  it('handles a zero-month window without throwing', () => {
    const data = monthlyVolume([act('2026-07-01', 10)], { today: TODAY, months: 0 });
    expect(data.months).toEqual([]);
    expect(data.totals).toEqual([]);
  });
});

describe('volumeWindowStartMonth', () => {
  it('is the first month of the window, so a store read can be bounded', () => {
    expect(volumeWindowStartMonth(TODAY, 12)).toBe('2025-09');
    expect(volumeWindowStartMonth(TODAY, 1)).toBe('2026-08');
  });
});

describe('yearOverYear', () => {
  it('accumulates kilometres along the year, newest year first', () => {
    const data = yearOverYear([act('2026-01-01', 10), act('2026-01-03', 5), act('2025-01-01', 40)], {
      today: TODAY,
      years: 2
    });
    expect(data.years.map((y) => y.year)).toEqual([2026, 2025]);
    const cur = data.years[0]!;
    expect(cur.cumulativeKm[0]).toBe(10); // 1 Jan
    expect(cur.cumulativeKm[1]).toBe(10); // 2 Jan, nothing added
    expect(cur.cumulativeKm[2]).toBe(15); // 3 Jan
  });

  it('compares years at the SAME day of the season, not full year against part year', () => {
    const data = yearOverYear(
      [
        act('2026-03-01', 100), // this year, before the cut
        act('2025-03-01', 60), // last year, before the cut
        act('2025-11-01', 500) // last year, AFTER the cut — must not count against this year
      ],
      { today: TODAY, years: 2 }
    );
    const now = data.years.find((y) => y.year === 2026)!;
    const prev = data.years.find((y) => y.year === 2025)!;
    expect(now.toDateKm).toBe(100);
    expect(prev.toDateKm).toBe(60);
    expect(prev.totalKm).toBe(560);
    expect(data.vsLastYearKm).toBe(40); // 100 − 60, not 100 − 560
  });

  it('stops the running year‘s line after today instead of flat-lining to December', () => {
    const data = yearOverYear([act('2026-03-01', 100)], { today: TODAY, years: 1 });
    const cur = data.years[0]!;
    const cut = data.throughDayOfYear;
    expect(cur.cumulativeKm[cut - 1]).toBe(100);
    expect(cur.cumulativeKm[cut]).toBeNull();
    expect(cur.cumulativeKm.at(-1)).toBeNull();
    expect(cur.partial).toBe(true);
  });

  it('fills a finished year to its last day', () => {
    const data = yearOverYear([act('2025-03-01', 100)], { today: TODAY, years: 2 });
    const prev = data.years.find((y) => y.year === 2025)!;
    expect(prev.partial).toBe(false);
    expect(prev.cumulativeKm).toHaveLength(365);
    expect(prev.cumulativeKm.at(-1)).toBe(100);
    expect(prev.cumulativeKm.every((v) => v !== null)).toBe(true);
  });

  it('gives a leap year 366 slots and a common year 365', () => {
    const data = yearOverYear([act('2024-03-01', 10), act('2025-03-01', 10)], {
      today: TODAY,
      years: 3
    });
    expect(data.years.find((y) => y.year === 2024)?.cumulativeKm).toHaveLength(366);
    expect(data.years.find((y) => y.year === 2025)?.cumulativeKm).toHaveLength(365);
  });

  it('has no year-on-year delta when last year has no data at all', () => {
    const data = yearOverYear([act('2026-03-01', 100)], { today: TODAY, years: 3 });
    expect(data.vsLastYearKm).toBeNull();
  });

  it('reports a negative delta when behind last year', () => {
    const data = yearOverYear([act('2026-03-01', 10), act('2025-03-01', 90)], {
      today: TODAY,
      years: 2
    });
    expect(data.vsLastYearKm).toBe(-80);
  });

  it('drops years outside the requested span', () => {
    const data = yearOverYear([act('2020-03-01', 10), act('2026-03-01', 10)], {
      today: TODAY,
      years: 2
    });
    expect(data.years.map((y) => y.year)).toEqual([2026]);
  });

  it('never counts a future year as this year‘s progress', () => {
    const data = yearOverYear([act('2027-01-01', 500), act('2026-03-01', 10)], {
      today: TODAY,
      years: 2
    });
    expect(data.years.map((y) => y.year)).toEqual([2026]);
    expect(data.years[0]?.toDateKm).toBe(10);
  });

  it('restricts to one family when asked', () => {
    const data = yearOverYear(
      [act('2026-03-01', 10, { group: 'run' }), act('2026-03-02', 90, { group: 'ride' })],
      { today: TODAY, years: 1, group: 'run' }
    );
    expect(data.years[0]?.toDateKm).toBe(10);
  });

  it('carries climb, time and count alongside the distance curve', () => {
    const data = yearOverYear([act('2026-03-01', 10), act('2026-04-01', 10)], {
      today: TODAY,
      years: 1
    });
    expect(data.years[0]).toMatchObject({
      activities: 2,
      elevationGainM: 200, // 10 km × 10 m, twice
      durationS: 6000
    });
  });

  it('returns no years at all for an athlete with no activities', () => {
    const data = yearOverYear([], { today: TODAY, years: 3 });
    expect(data.years).toEqual([]);
    expect(data.vsLastYearKm).toBeNull();
    expect(data.throughDayOfYear).toBeGreaterThan(0);
  });
});
