import { describe, it, expect } from 'vitest';
import { createMemoryStore } from '$lib/server/store/memory';
import { fixedClock } from '$lib/server/clock';
import type { ActivitySummary } from '$lib/server/store/types';
import { resolveRange } from '$lib/range';
import { loadWalking, type WalkingDeps } from './walking.api';

const USER = 'u1';
// A Monday, so the last lattice week starts on "today".
const clock = fixedClock(new Date('2026-02-09T08:00:00.000Z'));
const TODAY = '2026-02-09';
/*
 * The page window is the global range now (spec 047). `30 dni` ends on the "today" Monday and starts
 * 2026-01-11, whose ISO week begins 2026-01-05 — six weekly buckets.
 */
const RANGE = resolveRange('30', TODAY);
const WEEKS = 6;

function act(id: string, over: Partial<ActivitySummary>): ActivitySummary {
  return {
    userId: USER,
    activityId: id,
    sport: 'walking',
    name: null,
    startTime: '2026-02-03T09:00:00Z',
    startTimeLocal: '2026-02-03 09:00:00',
    distanceM: 5000,
    durationS: 3600,
    movingS: 3600,
    elevationGainM: 40,
    avgHr: 100,
    maxHr: 120,
    avgPower: null,
    maxPower: null,
    normPower: null,
    calories: 250,
    trainingLoad: null,
    hasGps: false,
    raw: {},
    ...over
  };
}

function deps(): WalkingDeps {
  return { store: createMemoryStore(), clock };
}

describe('loadWalking', () => {
  it('is empty but well-formed for a user with no walks and no steps', async () => {
    const data = await loadWalking(deps(), { userId: USER, locale: 'pl', range: RANGE });

    expect(data.hasData).toBe(false);
    expect(data.hasSteps).toBe(false);
    expect(data.totals.sessions).toBe(0);
    expect(data.totals.avgPaceSecPerKm).toBeNull();
    expect(data.avgSteps).toBeNull();
    expect(data.highlights).toEqual([]);
    expect(data.weekly).toHaveLength(WEEKS);
    expect(data.range.key).toBe('30');
  });

  it('counts every walk-family sport and excludes rides and runs', async () => {
    const d = deps();
    await d.store.putActivities(USER, [
      act('w1', {
        sport: 'walking',
        startTimeLocal: '2026-02-03 09:00:00',
        distanceM: 4000,
        movingS: 3000,
        elevationGainM: 20
      }),
      act('w2', {
        sport: 'hiking',
        startTimeLocal: '2026-02-05 09:00:00',
        distanceM: 12000,
        movingS: 10800,
        elevationGainM: 600
      }),
      act('w3', {
        sport: 'casual_walking',
        startTimeLocal: '2026-02-06 09:00:00',
        distanceM: 2000,
        movingS: 1800,
        elevationGainM: 5
      }),
      act('r1', { sport: 'running', startTimeLocal: '2026-02-04 09:00:00', distanceM: 10000 }),
      act('c1', { sport: 'cycling', startTimeLocal: '2026-02-04 17:00:00', distanceM: 40000 })
    ]);

    const data = await loadWalking(d, { userId: USER, locale: 'pl', range: RANGE });

    expect(data.hasData).toBe(true);
    expect(data.totals.sessions).toBe(3);
    expect(data.totals.totalKm).toBe(18);
    expect(data.totals.longestKm).toBe(12);
    expect(data.totals.totalTimeS).toBe(15600);
    expect(data.totals.totalElevationM).toBe(625);
    // 15600 s over 18 km.
    expect(data.totals.avgPaceSecPerKm).toBe(Math.round(15600 / 18));
  });

  it('buckets weekly distance, hours and elevation onto the week lattice', async () => {
    const d = deps();
    await d.store.putActivities(USER, [
      act('a', { startTimeLocal: '2026-02-03 09:00:00', distanceM: 4000, movingS: 3600, elevationGainM: 30 }),
      act('b', { startTimeLocal: '2026-02-05 09:00:00', distanceM: 6000, movingS: 5400, elevationGainM: 70 }),
      act('c', { startTimeLocal: '2026-02-09 09:00:00', distanceM: 3000, movingS: 1800, elevationGainM: 10 })
    ]);

    const data = await loadWalking(d, { userId: USER, locale: 'pl', range: RANGE });

    const last = data.weekly[WEEKS - 1]!;
    const prev = data.weekly[WEEKS - 2]!;
    expect(prev.week).toBe('2026-02-02');
    expect(prev.km).toBe(10);
    expect(prev.hours).toBe(2.5);
    expect(prev.sessions).toBe(2);
    expect(prev.elevationM).toBe(100);
    expect(last.week).toBe('2026-02-09');
    expect(last.km).toBe(3);
  });

  it('narrows to the global range and buckets long ranges by month (spec 047)', async () => {
    const d = deps();
    await d.store.putActivities(USER, [
      // Inside 30 days, outside 7.
      act('older', { startTimeLocal: '2026-01-20 09:00:00', distanceM: 8000 }),
      // Inside both.
      act('recent', { startTimeLocal: '2026-02-09 09:00:00', distanceM: 3000 })
    ]);

    const week = await loadWalking(d, { userId: USER, locale: 'pl', range: resolveRange('7', TODAY) });
    expect(week.totals.sessions).toBe(1);
    expect(week.totals.totalKm).toBe(3);

    const month = await loadWalking(d, { userId: USER, locale: 'pl', range: resolveRange('30', TODAY) });
    expect(month.totals.sessions).toBe(2);
    expect(month.totals.totalKm).toBe(11);

    const all = await loadWalking(d, {
      userId: USER,
      locale: 'pl',
      range: resolveRange('all', TODAY, '2025-01-01')
    });
    // Monthly buckets keep a multi-year window to ~14 columns per year rather than ~52.
    expect(all.weekly.every((w) => w.week.endsWith('-01'))).toBe(true);
    expect(all.weekly.at(-1)!.week).toBe('2026-02-01');
    // January's walk and February's land in different monthly buckets.
    expect(all.weekly.find((w) => w.week === '2026-01-01')!.km).toBe(8);
    expect(all.weekly.find((w) => w.week === '2026-02-01')!.km).toBe(3);
  });

  it('lists the longest routes as highlights, longest first', async () => {
    const d = deps();
    await d.store.putActivities(USER, [
      act('short', { startTimeLocal: '2026-02-03 09:00:00', distanceM: 2000 }),
      act('long', {
        sport: 'hiking',
        name: 'Tatry',
        startTimeLocal: '2026-02-05 09:00:00',
        distanceM: 18000,
        elevationGainM: 900
      }),
      act('mid', { startTimeLocal: '2026-02-06 09:00:00', distanceM: 7000 })
    ]);

    const data = await loadWalking(d, { userId: USER, locale: 'pl', range: RANGE });

    expect(data.highlights.map((h) => h.activityId)).toEqual(['long', 'mid', 'short']);
    expect(data.highlights[0]).toMatchObject({
      activityId: 'long',
      day: '2026-02-05',
      name: 'Tatry',
      sportLabel: 'Wędrówka',
      km: 18,
      elevationM: 900
    });
  });

  it('reads daily steps from the synced metric and averages only the days that have one', async () => {
    const d = deps();
    await d.store.putMetricDay(USER, 'steps', '2026-02-05', { totalSteps: 12000 });
    await d.store.putMetricDay(USER, 'steps', '2026-02-06', { totalSteps: 8000 });

    const data = await loadWalking(d, { userId: USER, locale: 'pl', range: RANGE });

    expect(data.hasSteps).toBe(true);
    expect(data.avgSteps).toBe(10000);
    // Days without a payload stay in the series as explicit nulls, so the chart shows a gap
    // instead of pretending the user took zero steps.
    expect(data.steps.find((s) => s.day === '2026-02-05')!.steps).toBe(12000);
    expect(data.steps.find((s) => s.day === '2026-02-04')!.steps).toBeNull();
  });
});
