import { describe, it, expect } from 'vitest';
import { createMemoryStore } from './memory';
import { sportKeysInGroup } from '$lib/sport-labels';
import type { ActivitySummary, WeightPoint } from './types';

const U = 'user-1';
const OTHER = 'user-2';

function activity(id: string, over: Partial<ActivitySummary> = {}): ActivitySummary {
  return {
    userId: U,
    activityId: id,
    sport: 'cycling',
    name: `Ride ${id}`,
    startTime: '2026-01-10T08:00:00Z',
    startTimeLocal: '2026-01-10 09:00:00',
    distanceM: 30000,
    durationS: 3600,
    movingS: 3500,
    elevationGainM: 200,
    avgHr: 140,
    maxHr: 170,
    avgPower: 190,
    maxPower: 600,
    normPower: 205,
    calories: 700,
    trainingLoad: 80,
    hasGps: false,
    garminWorkoutId: null,
    raw: {},
    ...over
  };
}

describe('LocalStore (memory)', () => {
  it('upserts metric days idempotently and reads a gap-filled range', async () => {
    const s = createMemoryStore();
    await s.putMetricDay(U, 'steps', '2026-01-02', { totalSteps: 100 });
    await s.putMetricDay(U, 'steps', '2026-01-02', { totalSteps: 999 }); // overwrite
    await s.putMetricDay(U, 'steps', '2026-01-04', { totalSteps: 200 });

    const range = await s.getMetricRange(U, 'steps', '2026-01-01', '2026-01-04');
    expect(range.days.map((d) => d.date)).toEqual(['2026-01-01', '2026-01-02', '2026-01-03', '2026-01-04']);
    expect(range.days[0]!.data).toBeNull(); // gap
    expect(range.days[1]!.data).toEqual({ totalSteps: 999 }); // last write wins
    expect(range.days[2]!.data).toBeNull();
    expect(range.days[3]!.data).toEqual({ totalSteps: 200 });
  });

  it('isolates one user from another', async () => {
    const s = createMemoryStore();
    await s.putMetricDay(U, 'hrv', '2026-01-01', { v: 1 });
    await s.putActivities(U, [activity('a1')]);
    expect(await s.getMetricDay(OTHER, 'hrv', '2026-01-01')).toBeNull();
    expect(await s.getActivity(OTHER, 'a1')).toBeNull();
    expect((await s.coverage(OTHER)).activities.count).toBe(0);
  });

  it('filters, searches, sorts and paginates activities', async () => {
    const s = createMemoryStore();
    await s.putActivities(U, [
      activity('a1', {
        sport: 'cycling',
        startTimeLocal: '2026-01-01 09:00:00',
        distanceM: 10000,
        name: 'Morning spin'
      }),
      activity('a2', {
        sport: 'running',
        startTimeLocal: '2026-01-05 07:00:00',
        distanceM: 8000,
        name: 'Tempo run'
      }),
      activity('a3', {
        sport: 'cycling',
        startTimeLocal: '2026-01-03 18:00:00',
        distanceM: 50000,
        name: 'Long ride'
      })
    ]);

    const cycling = await s.listActivities(U, { sport: 'cycling' });
    expect(cycling.map((a) => a.activityId).sort()).toEqual(['a1', 'a3']);

    const byDistDesc = await s.listActivities(U, { sort: 'distance', dir: 'desc' });
    expect(byDistDesc[0]!.activityId).toBe('a3');

    const search = await s.listActivities(U, { search: 'tempo' });
    expect(search.map((a) => a.activityId)).toEqual(['a2']);

    const page = await s.listActivities(U, { sort: 'date', dir: 'asc', limit: 1, offset: 1 });
    expect(page.map((a) => a.activityId)).toEqual(['a3']);

    expect(await s.countActivities(U, { sport: 'cycling' })).toBe(2);
    // Sport facets carry counts and come back most-frequent-first (spec 020).
    expect(await s.listSports(U)).toEqual([
      { sport: 'cycling', count: 2 },
      { sport: 'running', count: 1 }
    ]);
  });

  it('filters activities by a sport-family key list (spec 025)', async () => {
    const s = createMemoryStore();
    await s.putActivities(U, [
      activity('ride', { sport: 'gravel_cycling' }),
      activity('vride', { sport: 'virtual_ride' }),
      activity('run', { sport: 'trail_running' }),
      activity('walk', { sport: 'hiking' })
    ]);

    const rides = await s.listActivities(U, { sports: sportKeysInGroup('ride') });
    expect(rides.map((a) => a.activityId).sort()).toEqual(['ride', 'vride']);
    expect(await s.countActivities(U, { sports: sportKeysInGroup('walk') })).toBe(1);

    // An empty list matches nothing rather than everything — a filter must never silently widen.
    expect(await s.listActivities(U, { sports: [] })).toEqual([]);
  });

  it('stores streams and lists only GPS tracks, filtered by year/sport', async () => {
    const s = createMemoryStore();
    await s.putActivities(U, [
      activity('g1', { hasGps: true, startTimeLocal: '2026-01-01 09:00:00' }),
      activity('g2', { hasGps: true, sport: 'running', startTimeLocal: '2025-06-01 09:00:00' }),
      activity('n1', { hasGps: false })
    ]);
    await s.putStreams(U, 'g1', {
      gps: [
        [50, 8],
        [50.1, 8.1]
      ],
      power: [100, 200]
    });
    await s.putStreams(U, 'g2', { gps: [[48, 7]] });

    const all = await s.listGpsTracks(U);
    expect(all.map((t) => t.activityId).sort()).toEqual(['g1', 'g2']);

    const in2026 = await s.listGpsTracks(U, { year: 2026 });
    expect(in2026.map((t) => t.activityId)).toEqual(['g1']);

    const running = await s.listGpsTracks(U, { sport: 'running' });
    expect(running.map((t) => t.activityId)).toEqual(['g2']);

    expect((await s.getStreams(U, 'g1'))?.power).toEqual([100, 200]);
  });

  it('upserts weight and reads a range', async () => {
    const s = createMemoryStore();
    const pts: WeightPoint[] = [
      { day: '2026-01-01', weightKg: 80, source: 'withings' },
      { day: '2026-01-01', weightKg: 79.5, source: 'garmin' },
      { day: '2026-01-10', weightKg: 79, source: 'withings' }
    ];
    await s.putWeight(U, pts);
    const range = await s.getWeightRange(U, '2026-01-01', '2026-01-05');
    expect(range).toHaveLength(2); // both sources on the 1st, none on the 10th
  });

  it('reports coverage across metrics, activities and weight', async () => {
    const s = createMemoryStore();
    await s.putMetricDays(U, 'sleep', [
      { day: '2026-01-01', data: { x: 1 } },
      { day: '2026-01-03', data: null }, // present row but null payload → not counted
      { day: '2026-01-05', data: { x: 2 } }
    ]);
    await s.putActivities(U, [activity('a1', { hasGps: true }), activity('a2', { hasGps: false })]);
    await s.putWeight(U, [{ day: '2026-01-02', weightKg: 80, source: 'garmin' }]);

    const cov = await s.coverage(U);
    const sleep = cov.metrics.find((m) => m.metric === 'sleep')!;
    expect(sleep.firstDay).toBe('2026-01-01');
    expect(sleep.lastDay).toBe('2026-01-05');
    expect(sleep.presentDays).toBe(2);
    expect(cov.activities.count).toBe(2);
    expect(cov.activities.withGps).toBe(1);
    expect(cov.weight.count).toBe(1);
  });

  it('tracks sync state and sync runs', async () => {
    const s = createMemoryStore();
    await s.setSyncState(U, {
      source: 'garmin',
      cursor: { lastDay: '2026-01-05' },
      lastFullSyncAt: null,
      lastSyncAt: '2026-01-06T00:00:00Z'
    });
    expect((await s.getSyncState(U, 'garmin'))?.cursor).toEqual({ lastDay: '2026-01-05' });

    await s.startRun({ id: 'r1', userId: U, kind: 'full', total: 10, startedAt: '2026-01-06T00:00:00Z' });
    await s.updateRun('r1', { done: 5, step: 'sleep' });
    let run = await s.getRun('r1');
    expect(run?.done).toBe(5);
    expect(run?.status).toBe('running');

    await s.updateRun('r1', { done: 10, status: 'succeeded', finishedAt: '2026-01-06T00:05:00Z' });
    run = await s.getRun('r1');
    expect(run?.status).toBe('succeeded');
    expect((await s.getLatestRun(U))?.id).toBe('r1');
  });
});
