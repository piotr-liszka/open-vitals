import { describe, it, expect } from 'vitest';
import { loadWeeklySummary, type WeeklySummaryDeps } from './weekly-summary.api';
import { WEEKLY_SUMMARY_WEEKS } from './weekly-summary.types';
import { createMemoryStore } from '$lib/server/store/memory';
import { fixedClock } from '$lib/server/clock';
import type { ActivitySummary, LocalStore } from '$lib/server/store/types';

/** Wednesday 12 August 2026, 09:00 in Warsaw. Its ISO week starts Monday 2026-08-10. */
const NOW = new Date('2026-08-12T07:00:00Z');
const THIS_MONDAY = '2026-08-10';
const TZ = 'Europe/Warsaw';

function deps(store: LocalStore, at: Date = NOW, timeZone: string = TZ): WeeklySummaryDeps {
  return { store, clock: fixedClock(at), timeZone };
}

function act(over: Partial<ActivitySummary> & { startTimeLocal: string }): ActivitySummary {
  return {
    userId: 'u',
    activityId: `${over.sport ?? 'running'}-${over.startTimeLocal}`,
    sport: 'running',
    name: null,
    startTime: `${over.startTimeLocal.slice(0, 10)}T05:00:00Z`,
    distanceM: 10_000,
    durationS: 3_600,
    movingS: 3_000,
    elevationGainM: 100,
    avgHr: null,
    maxHr: null,
    avgPower: null,
    maxPower: null,
    normPower: null,
    calories: null,
    trainingLoad: null,
    hasGps: false,
    raw: null,
    ...over
  };
}

async function seeded(activities: ActivitySummary[], userId = 'u'): Promise<LocalStore> {
  const store = createMemoryStore();
  await store.putActivities(userId, activities);
  return store;
}

describe('loadWeeklySummary', () => {
  it('returns the documented contract for the fixed 12-week window', async () => {
    const store = await seeded([
      act({ startTimeLocal: '2026-08-11 07:00:00', distanceM: 12_000, movingS: 3_300 }),
      act({ startTimeLocal: '2026-08-04 07:00:00', distanceM: 8_000, movingS: 2_400 })
    ]);

    const data = await loadWeeklySummary(deps(store), { userId: 'u' });

    expect(data.weeks).toBe(WEEKLY_SUMMARY_WEEKS);
    expect(data.weekStarts).toHaveLength(WEEKLY_SUMMARY_WEEKS);
    expect(data.weekStarts[WEEKLY_SUMMARY_WEEKS - 1]).toBe(THIS_MONDAY);
    expect(data.currentWeekStart).toBe(THIS_MONDAY);
    expect(data.currentWeekDays).toBe(3); // Mon, Tue, Wed
    expect(data.hasData).toBe(true);
    expect(data.defaultGroup).toBe('run');

    const run = data.sports[0];
    expect(run).toMatchObject({ group: 'run', label: 'Bieg', color: 'var(--lane-orange)' });
    // Week-to-date only — last week's 8 km must NOT be in it.
    expect(run?.thisWeek).toEqual({
      activities: 1,
      distanceM: 12_000,
      durationS: 3_300,
      elevationGainM: 100
    });
    expect(run?.window).toEqual({
      activities: 2,
      distanceM: 20_000,
      durationS: 5_700,
      elevationGainM: 200
    });
    expect(run?.weekly).toHaveLength(WEEKLY_SUMMARY_WEEKS);
    expect(run?.weekly.filter((w) => w.partial).map((w) => w.week)).toEqual([THIS_MONDAY]);
    expect(run?.weekly.at(-1)).toEqual({
      week: THIS_MONDAY,
      activities: 1,
      distanceM: 12_000,
      durationS: 3_300,
      elevationGainM: 100,
      partial: true
    });
    // JSON-serialisable contract (this crosses the SvelteKit load boundary).
    expect(JSON.parse(JSON.stringify(data)).sports[0].group).toBe('run');
  });

  it('labels the x axis where the month changes and leaves the rest blank', async () => {
    const data = await loadWeeklySummary(deps(await seeded([])), { userId: 'u' });
    expect(data.monthLabels).toHaveLength(WEEKLY_SUMMARY_WEEKS);
    // Window is 25 May → 10 Aug 2026: the first bucket names its month, then each month change does.
    expect(data.monthLabels.filter((l) => l !== '')).toEqual(['maj', 'cze', 'lip', 'sie']);
    expect(data.monthLabels[0]).toBe('maj');
  });

  it('orders families by training time in the window and defaults to the busiest', async () => {
    const store = await seeded([
      // Cycling covers far more ground but the walk owns more of the athlete's actual time.
      act({ sport: 'cycling', startTimeLocal: '2026-08-11 17:00:00', distanceM: 60_000, movingS: 5_400 }),
      act({ sport: 'walking', startTimeLocal: '2026-08-11 08:00:00', distanceM: 6_000, movingS: 4_000 }),
      act({ sport: 'walking', startTimeLocal: '2026-07-20 08:00:00', distanceM: 6_000, movingS: 5_000 }),
      act({ sport: 'running', startTimeLocal: '2026-08-11 19:00:00', distanceM: 10_000, movingS: 3_000 })
    ]);

    const data = await loadWeeklySummary(deps(store), { userId: 'u' });

    expect(data.sports.map((s) => s.group)).toEqual(['walk', 'ride', 'run']);
    expect(data.defaultGroup).toBe('walk');
    expect(data.sports.map((s) => s.label)).toEqual(['Marsz', 'Rower', 'Bieg']);
    // Every family gets the same 12-slot lattice, so a chip switch cannot reshape the chart.
    expect(new Set(data.sports.map((s) => s.weekly.length))).toEqual(new Set([WEEKLY_SUMMARY_WEEKS]));
  });

  it('resolves the week boundary in the configured timezone, not UTC', async () => {
    // 00:30 Monday in Warsaw is still 22:30 Sunday in UTC. The week must NOT roll back a week.
    const mondayNight = new Date('2026-08-09T22:30:00Z');
    const store = await seeded([act({ startTimeLocal: '2026-08-10 07:00:00' })]);

    const warsaw = await loadWeeklySummary(deps(store, mondayNight, 'Europe/Warsaw'), { userId: 'u' });
    expect(warsaw.currentWeekStart).toBe(THIS_MONDAY);
    expect(warsaw.currentWeekDays).toBe(1);

    const utc = await loadWeeklySummary(deps(store, mondayNight, 'UTC'), { userId: 'u' });
    expect(utc.currentWeekStart).toBe('2026-08-03');
    expect(utc.currentWeekDays).toBe(7);
  });

  it('excludes activities older than the window', async () => {
    const store = await seeded([
      act({ startTimeLocal: '2026-05-24 07:00:00' }), // Sunday before the window's first Monday
      act({ startTimeLocal: '2026-05-25 07:00:00' }) // the window's first Monday
    ]);

    const data = await loadWeeklySummary(deps(store), { userId: 'u' });
    expect(data.weekStarts[0]).toBe('2026-05-25');
    expect(data.sports[0]?.window.activities).toBe(1);
    expect(data.sports[0]?.weekly[0]?.distanceM).toBe(10_000);
  });

  it('reports an empty window rather than inventing a sport', async () => {
    const data = await loadWeeklySummary(deps(await seeded([])), { userId: 'u' });
    expect(data.sports).toEqual([]);
    expect(data.defaultGroup).toBeNull();
    expect(data.hasData).toBe(false);
    // The lattice still exists, so the card can say what window found nothing.
    expect(data.weekStarts).toHaveLength(WEEKLY_SUMMARY_WEEKS);
  });

  it('never leaks another user’s training (AGENTS.md §2 rule 2)', async () => {
    const store = createMemoryStore();
    await store.putActivities('a', [
      act({ userId: 'a', activityId: 'mine', startTimeLocal: '2026-08-11 07:00:00', distanceM: 5_000 })
    ]);
    await store.putActivities('b', [
      act({
        userId: 'b',
        activityId: 'theirs',
        sport: 'cycling',
        startTimeLocal: '2026-08-11 07:00:00',
        distanceM: 90_000
      })
    ]);

    const mine = await loadWeeklySummary(deps(store), { userId: 'a' });
    expect(mine.sports.map((s) => s.group)).toEqual(['run']);
    expect(mine.sports[0]?.thisWeek.distanceM).toBe(5_000);

    const theirs = await loadWeeklySummary(deps(store), { userId: 'b' });
    expect(theirs.sports.map((s) => s.group)).toEqual(['ride']);
    expect(theirs.sports[0]?.thisWeek.distanceM).toBe(90_000);
  });

  it('scopes the store read to the window and to the user', async () => {
    const calls: Array<{ userId: string; query: unknown }> = [];
    const store = {
      listActivities: async (userId: string, query?: unknown) => {
        calls.push({ userId, query });
        return [];
      }
    };

    await loadWeeklySummary(deps(store as unknown as LocalStore), { userId: 'u-42' });

    expect(calls).toHaveLength(1);
    expect(calls[0]?.userId).toBe('u-42');
    expect(calls[0]?.query).toMatchObject({ from: '2026-05-25', to: '2026-08-12' });
  });

  it('prefers moving time over elapsed time, the way the rest of the app measures training', async () => {
    const store = await seeded([
      act({ startTimeLocal: '2026-08-11 07:00:00', durationS: 5_000, movingS: 3_000 }),
      act({ startTimeLocal: '2026-08-12 07:00:00', durationS: 1_800, movingS: null })
    ]);

    const data = await loadWeeklySummary(deps(store), { userId: 'u' });
    expect(data.sports[0]?.thisWeek.durationS).toBe(4_800);
  });
});
