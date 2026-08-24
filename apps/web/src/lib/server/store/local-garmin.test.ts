/**
 * Activity reads through the local GarminService facade.
 *
 * Why this file exists: the sync engine normalizes activities into `synced_activities` and EXCLUDES
 * `activities` from the daily-metric walk, but the facade resolved every metric — activities
 * included — via `getMetricDay`, which only ever reads `synced_metric_days`. So a fully synced
 * account with years of training returned `data: null` for `get_activities` and for every day of an
 * `activities` range read, while health metrics looked perfect. The MCP surface was blind to the
 * training feed and nothing failed loudly.
 */
import { describe, it, expect } from 'vitest';
import { createMemoryStore } from './memory';
import { createLocalGarminService } from './local-garmin';
import { createGarminMock } from '../garmin/mock-adapter';
import type { ActivitySummary, LocalStore } from './types';
import type { GarminService } from '../interfaces';

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
    avgHr: 150,
    maxHr: 170,
    avgPower: null,
    maxPower: null,
    normPower: null,
    calories: 700,
    trainingLoad: 120,
    hasGps: true,
    garminWorkoutId: null,
    raw: { shouldNotLeak: true },
    ...over
  };
}

async function facade(activities: ActivitySummary[]): Promise<{ garmin: GarminService; store: LocalStore }> {
  const store = createMemoryStore();
  await store.putActivities('u', activities);
  const sidecar = createGarminMock({ status: { authenticated: true } });
  return { garmin: createLocalGarminService({ store, sidecar, userId: 'u' }), store };
}

/** Days of a range read that carry at least one activity. */
function daysWithActivities(days: Array<{ date: string; data: unknown }>): string[] {
  return days.filter((d) => Array.isArray(d.data) && d.data.length > 0).map((d) => d.date);
}

describe('local GarminService — activities', () => {
  it('returns the day’s activities for a single-day read', async () => {
    const { garmin } = await facade([
      act({ startTimeLocal: '2026-08-11 06:30:00', sport: 'running', distanceM: 12_000 })
    ]);
    const read = (await garmin.getMetric('activities', '2026-08-11')) as {
      metric: string;
      date: string;
      data: Array<Record<string, unknown>>;
    };
    expect(read.metric).toBe('activities');
    expect(read.date).toBe('2026-08-11');
    expect(read.data).toHaveLength(1);
    expect(read.data[0]).toMatchObject({ sport: 'running', distanceM: 12_000, durationS: 3600 });
  });

  it('returns every session on a two-a-day, oldest first', async () => {
    const { garmin } = await facade([
      act({ activityId: 'pm', startTimeLocal: '2026-08-11 18:00:00', sport: 'cycling' }),
      act({ activityId: 'am', startTimeLocal: '2026-08-11 06:30:00', sport: 'running' })
    ]);
    const read = (await garmin.getMetric('activities', '2026-08-11')) as {
      data: Array<{ sport: string }>;
    };
    expect(read.data.map((a) => a.sport)).toEqual(['running', 'cycling']);
  });

  it('does not leak the raw blob or the user id into the payload', async () => {
    const { garmin } = await facade([act({ startTimeLocal: '2026-08-11 06:30:00' })]);
    const read = (await garmin.getMetric('activities', '2026-08-11')) as {
      data: Array<Record<string, unknown>>;
    };
    expect(read.data[0]).not.toHaveProperty('raw');
    expect(read.data[0]).not.toHaveProperty('userId');
  });

  it('reads a multi-day range — the regression: every day came back null', async () => {
    const { garmin } = await facade([
      act({ startTimeLocal: '2026-08-05 06:30:00' }),
      act({ startTimeLocal: '2026-08-08 09:00:00', sport: 'walking' }),
      act({ startTimeLocal: '2026-08-11 06:30:00' })
    ]);
    const range = await garmin.getMetricRange('activities', '2026-08-04', '2026-08-12');
    expect(range.days).toHaveLength(9);
    expect(daysWithActivities(range.days)).toEqual(['2026-08-05', '2026-08-08', '2026-08-11']);
  });

  it('distinguishes a rest day inside the history from a day outside it', async () => {
    const { garmin } = await facade([
      act({ startTimeLocal: '2026-08-05 06:30:00' }),
      act({ startTimeLocal: '2026-08-08 09:00:00' })
    ]);
    const range = await garmin.getMetricRange('activities', '2026-08-03', '2026-08-10');
    const byDay = new Map(range.days.map((d) => [d.date, d.data]));
    // Before the first synced activity / after the last: unknown.
    expect(byDay.get('2026-08-03')).toBeNull();
    expect(byDay.get('2026-08-10')).toBeNull();
    // Between them with nothing recorded: a real rest day, not a gap in the data.
    expect(byDay.get('2026-08-06')).toEqual([]);
    expect(byDay.get('2026-08-07')).toEqual([]);
  });

  it('resolves the newest training day when no date is given', async () => {
    const { garmin } = await facade([
      act({ startTimeLocal: '2026-07-01 06:30:00' }),
      act({ startTimeLocal: '2026-08-11 06:30:00', sport: 'cycling' })
    ]);
    const read = (await garmin.getMetric('activities')) as {
      date: string;
      data: Array<{ sport: string }>;
    };
    expect(read.date).toBe('2026-08-11');
    expect(read.data.map((a) => a.sport)).toEqual(['cycling']);
  });

  it('reports null — not a throw — for an account with no activities at all', async () => {
    const { garmin } = await facade([]);
    expect(await garmin.getMetric('activities')).toEqual({
      metric: 'activities',
      date: null,
      data: null
    });
    expect(await garmin.getMetric('activities', '2026-08-11')).toEqual({
      metric: 'activities',
      date: '2026-08-11',
      data: null
    });
    const range = await garmin.getMetricRange('activities', '2026-08-10', '2026-08-11');
    expect(range.days.map((d) => d.data)).toEqual([null, null]);
  });

  it('never consults the sidecar for an activity read', async () => {
    const store = createMemoryStore();
    await store.putActivities('u', [act({ startTimeLocal: '2026-08-11 06:30:00' })]);
    const sidecar = createGarminMock({ status: { authenticated: true } });
    const garmin = createLocalGarminService({ store, sidecar, userId: 'u' });
    await garmin.getMetric('activities', '2026-08-11');
    await garmin.getMetricRange('activities', '2026-08-04', '2026-08-11');
    expect(sidecar.calls.getMetric).toEqual([]);
    expect(sidecar.calls.getMetricRange).toEqual([]);
  });

  it('keeps another user’s activities out of the read', async () => {
    const { garmin, store } = await facade([act({ startTimeLocal: '2026-08-11 06:30:00' })]);
    await store.putActivities('other', [
      act({ userId: 'other', activityId: 'x', startTimeLocal: '2026-08-11 12:00:00', sport: 'swimming' })
    ]);
    const read = (await garmin.getMetric('activities', '2026-08-11')) as {
      data: Array<{ sport: string }>;
    };
    expect(read.data.map((a) => a.sport)).toEqual(['running']);
  });

  it('leaves non-activity metrics on the metric-day path untouched', async () => {
    const { garmin, store } = await facade([]);
    await store.putMetricDay('u', 'steps', '2026-08-11', { totalSteps: 9500 });
    const read = (await garmin.getMetric('steps', '2026-08-11')) as { data: { totalSteps: number } };
    expect(read.data.totalSteps).toBe(9500);
  });
});
