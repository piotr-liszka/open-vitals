import { describe, it, expect } from 'vitest';
import { loadBestEfforts } from './best-efforts.api';
import { BEST_EFFORTS_TOP_N } from './best-efforts.types';
import { createMemoryStore } from '$lib/server/store/memory';
import { BEST_EFFORTS_VERSION, type ActivitySummary, type LocalStore } from '$lib/server/store/types';

function act(id: string, over: Partial<ActivitySummary> = {}): ActivitySummary {
  return {
    userId: 'u',
    activityId: id,
    sport: 'running',
    name: `Bieg ${id}`,
    startTime: '2026-05-01T05:00:00Z',
    startTimeLocal: '2026-05-01 07:00:00',
    distanceM: 10_000,
    durationS: 2700,
    movingS: 2700,
    elevationGainM: 40,
    avgHr: 150,
    maxHr: 172,
    avgPower: null,
    maxPower: null,
    normPower: null,
    calories: 600,
    trainingLoad: 70,
    hasGps: true,
    raw: {},
    ...over
  };
}

/** Store one 5 km effort of `durationS` for `activityId` (the streams row is what marks it derived). */
async function seedEffort(
  store: LocalStore,
  userId: string,
  activityId: string,
  durationS: number,
  over: { day?: string; sport?: string; key?: string; metres?: number } = {}
): Promise<void> {
  await store.putStreams(userId, activityId, { speed: [3, 3], time: [0, 1] });
  await store.putActivityBestEfforts(userId, {
    activityId,
    sport: over.sport ?? 'running',
    day: over.day ?? '2026-05-01',
    version: BEST_EFFORTS_VERSION,
    efforts: [
      {
        key: over.key ?? '5k',
        metres: over.metres ?? 5000,
        durationS,
        actualM: (over.metres ?? 5000) + 4,
        paceSecPerKm: durationS / 5,
        startS: 0,
        samples: 300
      }
    ]
  });
}

describe('loadBestEfforts', () => {
  it('returns the documented contract: ranked entries per distance, shortest distance first', async () => {
    const store = createMemoryStore();
    await store.putActivities('u', [act('a1'), act('a2'), act('a3')]);
    await seedEffort(store, 'u', 'a1', 1500, { day: '2026-01-05' });
    await seedEffort(store, 'u', 'a2', 1380, { day: '2026-03-11' });
    await seedEffort(store, 'u', 'a3', 1600, { day: '2026-04-20' });
    await store.putStreams('u', 'a1', { speed: [3, 3], time: [0, 1] });
    await store.putActivityBestEfforts('u', {
      activityId: 'a1',
      sport: 'running',
      day: '2026-01-05',
      version: BEST_EFFORTS_VERSION,
      efforts: [
        {
          key: '1k',
          metres: 1000,
          durationS: 250,
          actualM: 1002,
          paceSecPerKm: 249.5,
          startS: 60,
          samples: 60
        },
        {
          key: '5k',
          metres: 5000,
          durationS: 1500,
          actualM: 5003,
          paceSecPerKm: 299.8,
          startS: 0,
          samples: 300
        }
      ]
    });

    const data = await loadBestEfforts({ store }, { userId: 'u' });

    expect(data.topN).toBe(BEST_EFFORTS_TOP_N);
    expect(data.hasData).toBe(true);
    expect(data.distances.map((d) => d.key)).toEqual(['1k', '5k']);

    const fiveK = data.distances.find((d) => d.key === '5k');
    expect(fiveK?.label).toBe('5 km');
    expect(fiveK?.entries.map((e) => ({ rank: e.rank, id: e.activityId, t: e.durationS }))).toEqual([
      { rank: 1, id: 'a2', t: 1380 },
      { rank: 2, id: 'a1', t: 1500 },
      { rank: 3, id: 'a3', t: 1600 }
    ]);
    // Everything a row needs to render and link.
    const pr = fiveK?.entries[0];
    expect(pr?.activityName).toBe('Bieg a2');
    expect(pr?.day).toBe('2026-03-11');
    expect(pr?.sport).toBe('running');
    expect(typeof pr?.paceSecPerKm).toBe('number');
  });

  it('keeps only the top N per distance, however long the history', async () => {
    const store = createMemoryStore();
    const times = [1700, 1650, 1600, 1550, 1500];
    await store.putActivities(
      'u',
      times.map((_, i) => act(`a${i}`))
    );
    for (const [i, t] of times.entries()) await seedEffort(store, 'u', `a${i}`, t);

    const data = await loadBestEfforts({ store }, { userId: 'u' });
    expect(data.distances[0]?.entries).toHaveLength(3);
    expect(data.distances[0]?.entries.map((e) => e.durationS)).toEqual([1500, 1550, 1600]);
  });

  it('ranks within the requested sport family only — a ride is not a running record', async () => {
    const store = createMemoryStore();
    await store.putActivities('u', [act('run1'), act('walk1', { sport: 'walking' })]);
    await seedEffort(store, 'u', 'run1', 1400);
    await seedEffort(store, 'u', 'walk1', 900, { sport: 'walking' });

    const runs = await loadBestEfforts({ store }, { userId: 'u', group: 'run' });
    expect(runs.distances[0]?.entries.map((e) => e.activityId)).toEqual(['run1']);

    const walks = await loadBestEfforts({ store }, { userId: 'u', group: 'walk' });
    expect(walks.distances[0]?.entries.map((e) => e.activityId)).toEqual(['walk1']);
  });

  it('reports an empty leaderboard rather than inventing one', async () => {
    const store = createMemoryStore();
    const data = await loadBestEfforts({ store }, { userId: 'u' });
    expect(data).toEqual({ distances: [], topN: BEST_EFFORTS_TOP_N, hasData: false });
  });

  it('clamps an out-of-range topN instead of trusting the caller', async () => {
    const store = createMemoryStore();
    await store.putActivities('u', [act('a1')]);
    await seedEffort(store, 'u', 'a1', 1400);

    expect((await loadBestEfforts({ store }, { userId: 'u', topN: 999 })).topN).toBe(10);
    expect((await loadBestEfforts({ store }, { userId: 'u', topN: 0 })).topN).toBe(BEST_EFFORTS_TOP_N);
    expect((await loadBestEfforts({ store }, { userId: 'u', topN: -3 })).topN).toBe(BEST_EFFORTS_TOP_N);
  });

  it('never leaks another user’s records (AGENTS.md §2 rule 2)', async () => {
    const store = createMemoryStore();
    await store.putActivities('a', [act('mine', { userId: 'a', name: 'Mój bieg' })]);
    await store.putActivities('b', [act('theirs', { userId: 'b', name: 'Cudzy bieg' })]);
    // User B is dramatically faster. Nothing of theirs may appear for A.
    await seedEffort(store, 'a', 'mine', 1800);
    await seedEffort(store, 'b', 'theirs', 900);

    const mine = await loadBestEfforts({ store }, { userId: 'a' });
    expect(mine.distances[0]?.entries).toHaveLength(1);
    expect(mine.distances[0]?.entries[0]?.activityId).toBe('mine');
    expect(JSON.stringify(mine)).not.toContain('theirs');

    const theirs = await loadBestEfforts({ store }, { userId: 'b' });
    expect(theirs.distances[0]?.entries[0]?.activityId).toBe('theirs');
  });
});
