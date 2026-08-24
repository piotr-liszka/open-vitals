import { describe, it, expect } from 'vitest';
import { loadVolume, WINDOW_MONTHS, YEAR_SLOTS } from './volume.api';
import { createMemoryStore } from '$lib/server/store/memory';
import type { Clock } from '$lib/server/clock';
import type { ActivitySummary, LocalStore } from '$lib/server/store/types';

/** Fixed clock — "today" is 11 August 2026, day 223 of the year. */
const FIXED = new Date('2026-08-11T09:00:00Z');
const clock: Clock = { now: () => FIXED, nowSeconds: () => Math.floor(FIXED.getTime() / 1000) };

function act(over: Partial<ActivitySummary> & { startTimeLocal: string }): ActivitySummary {
  return {
    userId: 'u',
    activityId: over.startTimeLocal,
    sport: 'running',
    name: null,
    startTime: `${over.startTimeLocal.slice(0, 10)}T07:00:00Z`,
    distanceM: 10_000,
    durationS: 3600,
    movingS: 3000,
    elevationGainM: 100,
    avgHr: null,
    maxHr: null,
    avgPower: null,
    maxPower: null,
    normPower: null,
    calories: null,
    trainingLoad: null,
    hasGps: false,
    garminWorkoutId: null,
    raw: null,
    ...over
  };
}

async function seeded(activities: ActivitySummary[]): Promise<LocalStore> {
  const store = createMemoryStore();
  await store.putActivities('u', activities);
  return store;
}

describe('loadVolume', () => {
  it('reports no data for an athlete with nothing synced', async () => {
    const store = createMemoryStore();
    const data = await loadVolume({ store, clock }, { userId: 'u', locale: 'pl' });
    expect(data.hasData).toBe(false);
    expect(data.monthly.every((m) => m.activities === 0)).toBe(true);
    expect(data.years).toEqual([]);
  });

  it('covers a fixed window of months ending with the current one', async () => {
    const store = await seeded([act({ startTimeLocal: '2026-07-01 09:00:00' })]);
    const data = await loadVolume({ store, clock }, { userId: 'u', locale: 'pl' });
    expect(data.windowMonths).toBe(WINDOW_MONTHS);
    expect(data.months).toHaveLength(WINDOW_MONTHS);
    expect(data.months.at(-1)).toBe('2026-08');
    expect(data.monthly).toHaveLength(WINDOW_MONTHS);
  });

  it('marks the current month partial', async () => {
    const store = await seeded([
      act({ startTimeLocal: '2026-06-05 09:00:00', distanceM: 100_000 }),
      act({ startTimeLocal: '2026-08-02 09:00:00', distanceM: 500_000 })
    ]);
    const data = await loadVolume({ store, clock }, { userId: 'u', locale: 'pl' });
    expect(data.monthly.at(-1)).toMatchObject({ month: '2026-08', partial: true });
    // The average and best month are period-scoped now and live in `volume.period.ts` (spec 070),
    // because the period switch changes which months they are computed over.
  });

  it('uses moving time, not elapsed, as the measure of training time', async () => {
    const store = await seeded([
      act({ startTimeLocal: '2026-07-01 09:00:00', durationS: 7200, movingS: 3000 })
    ]);
    const data = await loadVolume({ store, clock }, { userId: 'u', locale: 'pl' });
    expect(data.monthly.find((m) => m.month === '2026-07')?.durationS).toBe(3000);
  });

  it('falls back to elapsed time when the watch reports no moving time', async () => {
    const store = await seeded([
      act({ startTimeLocal: '2026-07-01 09:00:00', durationS: 7200, movingS: null })
    ]);
    const data = await loadVolume({ store, clock }, { userId: 'u', locale: 'pl' });
    expect(data.monthly.find((m) => m.month === '2026-07')?.durationS).toBe(7200);
  });

  it('splits months by sport family with the shared label and lane colour', async () => {
    const store = await seeded([
      act({ startTimeLocal: '2026-07-01 09:00:00', sport: 'running', distanceM: 10_000 }),
      act({ startTimeLocal: '2026-07-02 09:00:00', sport: 'cycling', distanceM: 80_000 })
    ]);
    const data = await loadVolume({ store, clock }, { userId: 'u', locale: 'pl' });
    expect(data.bySport.map((s) => s.label)).toEqual(['Rower', 'Bieg']);
    expect(data.bySport[0]?.color).toBe('var(--lane-cyan)');
    // Every series is aligned to the month lattice so a chart can plot them together.
    for (const s of data.bySport) expect(s.distanceM).toHaveLength(data.months.length);
  });

  it('compares years at the same day of the season, not part-year against full-year', async () => {
    const store = await seeded([
      act({ startTimeLocal: '2026-03-01 09:00:00', distanceM: 100_000 }),
      act({ startTimeLocal: '2025-03-01 09:00:00', distanceM: 60_000 }),
      // Last November is after this year's cut and must not count against 2026.
      act({ startTimeLocal: '2025-11-01 09:00:00', distanceM: 400_000 })
    ]);
    const data = await loadVolume({ store, clock }, { userId: 'u', locale: 'pl' });
    const now = data.years.find((y) => y.year === 2026)!;
    const prev = data.years.find((y) => y.year === 2025)!;
    expect(now.toDateKm).toBe(100);
    expect(prev.toDateKm).toBe(60);
    expect(prev.totalKm).toBe(460);
    expect(data.vsLastYearKm).toBe(40);
  });

  it('pads every year curve to one shared lattice and stops the running year after today', async () => {
    const store = await seeded([
      act({ startTimeLocal: '2026-03-01 09:00:00' }),
      act({ startTimeLocal: '2024-03-01 09:00:00' }) // a leap year
    ]);
    const data = await loadVolume({ store, clock }, { userId: 'u', locale: 'pl' });
    for (const y of data.years) expect(y.cumulativeKm).toHaveLength(YEAR_SLOTS);

    const now = data.years.find((y) => y.year === 2026)!;
    expect(now.partial).toBe(true);
    expect(now.cumulativeKm[data.throughDayOfYear - 1]).toBe(10);
    expect(now.cumulativeKm[data.throughDayOfYear]).toBeNull();
  });

  it('labels the year axis with a month name on each 1st and nothing in between', async () => {
    const store = await seeded([act({ startTimeLocal: '2026-03-01 09:00:00' })]);
    const data = await loadVolume({ store, clock }, { userId: 'u', locale: 'pl' });
    expect(data.dayOfYearLabels).toHaveLength(YEAR_SLOTS);
    expect(data.dayOfYearLabels[0]).toBe('sty');
    expect(data.dayOfYearLabels[31]).toBe('lut');
    expect(data.dayOfYearLabels[1]).toBe('');
    expect(data.dayOfYearLabels.filter((l) => l !== '')).toHaveLength(12);
  });

  it('has no year-on-year delta when last year is missing', async () => {
    const store = await seeded([act({ startTimeLocal: '2026-03-01 09:00:00' })]);
    const data = await loadVolume({ store, clock }, { userId: 'u', locale: 'pl' });
    expect(data.vsLastYearKm).toBeNull();
    expect(data.years.map((y) => y.year)).toEqual([2026]);
  });

  it('counts every sport in the totals — a walker is not invisible here', async () => {
    const store = await seeded([
      act({ startTimeLocal: '2026-07-01 09:00:00', sport: 'walking', distanceM: 12_000 }),
      act({ startTimeLocal: '2026-07-02 09:00:00', sport: 'hiking', distanceM: 8000 })
    ]);
    const data = await loadVolume({ store, clock }, { userId: 'u', locale: 'pl' });
    expect(data.monthly.find((m) => m.month === '2026-07')?.distanceM).toBe(20_000);
    expect(data.bySport.map((s) => s.group)).toEqual(['walk']);
  });

  it('ignores activities from before the read window', async () => {
    const store = await seeded([
      act({ startTimeLocal: '2019-05-05 09:00:00', distanceM: 900_000 }),
      act({ startTimeLocal: '2026-07-01 09:00:00', distanceM: 10_000 })
    ]);
    const data = await loadVolume({ store, clock }, { userId: 'u', locale: 'pl' });
    expect(data.years.some((y) => y.year === 2019)).toBe(false);
    expect(data.monthly.reduce((s, m) => s + m.distanceM, 0)).toBe(10_000);
  });

  it('never reads another user‘s activities', async () => {
    const store = createMemoryStore();
    await store.putActivities('other', [act({ startTimeLocal: '2026-07-01 09:00:00' })]);
    const data = await loadVolume({ store, clock }, { userId: 'u', locale: 'pl' });
    expect(data.hasData).toBe(false);
  });

  describe('consistency grid (specs 046, 070)', () => {
    it('builds per-day totals across the WHOLE window, so any period can be drawn', async () => {
      const store = await seeded([
        act({ startTimeLocal: '2026-03-01 09:00:00', distanceM: 12_400 }),
        act({ startTimeLocal: '2026-03-01 18:00:00', activityId: 'second', distanceM: 5000 }),
        act({ startTimeLocal: '2025-03-01 09:00:00', distanceM: 20_000 })
      ]);

      const data = await loadVolume({ store, clock }, { userId: 'u', locale: 'pl' });
      expect(data.today).toBe('2026-08-11');
      // Earlier years ride along: the period switch points the grid at them without a round trip.
      expect(data.gridDays.map((d) => d.day)).toEqual(['2025-03-01', '2026-03-01']);
      // Two activities on the day are summed.
      expect(data.gridDays[1]!.km).toBeCloseTo(17.4, 1);
      expect(data.gridDays[1]!.title).toContain('2 aktywności');
    });

    it('inflects a single activity in the tooltip', async () => {
      const store = await seeded([act({ startTimeLocal: '2026-03-01 09:00:00' })]);
      const data = await loadVolume({ store, clock }, { userId: 'u', locale: 'pl' });
      expect(data.gridDays[0]!.title).toContain('1 aktywność');
    });

    it('lists the days oldest first, so the grid fills left to right', async () => {
      const store = await seeded([
        act({ startTimeLocal: '2026-05-01 09:00:00' }),
        act({ startTimeLocal: '2026-02-01 09:00:00', activityId: 'earlier' })
      ]);
      const data = await loadVolume({ store, clock }, { userId: 'u', locale: 'pl' });
      expect(data.gridDays.map((d) => d.day)).toEqual(['2026-02-01', '2026-05-01']);
    });

    it('is empty for an athlete with nothing in the whole window', async () => {
      const store = await seeded([act({ startTimeLocal: '2019-03-01 09:00:00' })]);
      const data = await loadVolume({ store, clock }, { userId: 'u', locale: 'pl' });
      expect(data.gridDays).toEqual([]);
    });
  });

  describe('year over year per sport (spec 070)', () => {
    it('offers every family the athlete has, combined view first', async () => {
      const store = await seeded([
        act({ startTimeLocal: '2026-03-01 09:00:00', sport: 'running' }),
        act({ startTimeLocal: '2026-04-01 09:00:00', activityId: 'ride', sport: 'cycling' })
      ]);
      const data = await loadVolume({ store, clock }, { userId: 'u', locale: 'pl' });
      expect(data.sportOptions[0]).toEqual({ value: 'all', label: 'Wszystko' });
      expect(data.sportOptions.map((o) => o.value).sort()).toEqual(['all', 'ride', 'run']);
    });

    it('scopes each curve to its family, and `all` stays the combined one', async () => {
      const store = await seeded([
        act({ startTimeLocal: '2026-03-01 09:00:00', sport: 'running', distanceM: 10_000 }),
        act({
          startTimeLocal: '2026-04-01 09:00:00',
          activityId: 'ride',
          sport: 'cycling',
          distanceM: 40_000
        })
      ]);
      const data = await loadVolume({ store, clock }, { userId: 'u', locale: 'pl' });

      const yearOf = (key: string): number =>
        data.yearsBySport[key]!.years.find((y) => y.year === 2026)!.toDateKm;
      expect(yearOf('run')).toBeCloseTo(10, 1);
      expect(yearOf('ride')).toBeCloseTo(40, 1);
      expect(yearOf('all')).toBeCloseTo(50, 1);
      // `all` is the same object the flat `years` field carries, so nothing can drift between them.
      expect(data.yearsBySport.all!.years).toBe(data.years);
      expect(data.yearsBySport.all!.vsLastYearKm).toBe(data.vsLastYearKm);
    });

    it('offers no sport split for a single-sport athlete — it would be the same curve twice', async () => {
      const store = await seeded([act({ startTimeLocal: '2026-03-01 09:00:00', sport: 'running' })]);
      const data = await loadVolume({ store, clock }, { userId: 'u', locale: 'pl' });
      expect(data.sportOptions).toEqual([{ value: 'all', label: 'Wszystko' }]);
      expect(Object.keys(data.yearsBySport)).toEqual(['all']);
    });
  });
});
