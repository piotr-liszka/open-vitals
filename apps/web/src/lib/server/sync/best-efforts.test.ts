import { describe, it, expect } from 'vitest';
import { backfillBestEfforts, deriveBestEfforts, EFFORT_SPORT_KEYS } from './best-efforts';
import { createMemoryStore } from '../store/memory';
import {
  BEST_EFFORTS_VERSION,
  type ActivityStreams,
  type ActivitySummary,
  type LocalStore
} from '../store/types';

/** A 1 Hz run: `seconds` samples at `mps`, with an optional faster block spliced in. */
function runStreams(
  seconds: number,
  mps: number,
  surge?: { fromS: number; lengthS: number; mps: number }
): ActivityStreams {
  const speed: number[] = [];
  const time: number[] = [];
  for (let i = 0; i < seconds; i++) {
    time.push(i);
    const inSurge = surge !== undefined && i >= surge.fromS && i < surge.fromS + surge.lengthS;
    speed.push(inSurge ? surge.mps : mps);
  }
  return { speed, time };
}

function act(id: string, over: Partial<ActivitySummary> = {}): ActivitySummary {
  return {
    userId: 'u',
    activityId: id,
    sport: 'running',
    name: id,
    startTime: '2026-05-01T05:00:00Z',
    startTimeLocal: '2026-05-01 07:00:00',
    distanceM: 12_000,
    durationS: 3600,
    movingS: 3600,
    elevationGainM: 0,
    avgHr: 150,
    maxHr: 170,
    avgPower: null,
    maxPower: null,
    normPower: null,
    calories: 0,
    trainingLoad: null,
    hasGps: true,
    garminWorkoutId: null,
    raw: {},
    ...over
  };
}

async function seed(
  store: LocalStore,
  entries: Array<{ id: string; streams?: ActivityStreams; over?: Partial<ActivitySummary> }>
): Promise<void> {
  await store.putActivities(
    'u',
    entries.map((e) => act(e.id, e.over))
  );
  for (const e of entries) if (e.streams) await store.putStreams('u', e.id, e.streams);
}

describe('deriveBestEfforts', () => {
  it('finds the fastest window, not the first one — a surge buried mid-run wins', () => {
    // 40 min at 3 m/s (7200 m) with a 4 m/s kilometre starting at 10:00.
    const efforts = deriveBestEfforts(runStreams(2400, 3, { fromS: 600, lengthS: 250, mps: 4 }));
    const oneK = efforts.find((e) => e.key === '1k');
    expect(oneK).toBeDefined();
    // 1000 m at 4 m/s = 250 s, against 333 s at the steady pace.
    expect(oneK!.durationS).toBeLessThan(260);
    // It starts where the surge does, not at the beginning of the run. (The integration credits a
    // sample's speed to the interval ENDING at it, so the window may open one sample early.)
    expect(oneK!.startS).toBeGreaterThanOrEqual(599);
    expect(oneK!.startS).toBeLessThan(700);
  });

  it('never extrapolates a distance the session did not cover', () => {
    const efforts = deriveBestEfforts(runStreams(600, 3)); // 1800 m
    expect(efforts.map((e) => e.key)).toEqual(['400m', '1k', 'mile']);
  });

  it('yields nothing without a distance axis — a treadmill run is not an estimate', () => {
    expect(deriveBestEfforts({ heartRate: [140, 145, 150], time: [0, 1, 2] })).toEqual([]);
    expect(deriveBestEfforts({})).toEqual([]);
    expect(deriveBestEfforts({ speed: [3], time: [0] })).toEqual([]);
  });

  it('stores the storage shape — no display label is frozen into the row', () => {
    const [first] = deriveBestEfforts(runStreams(600, 3));
    expect(Object.keys(first!).sort()).toEqual(
      ['actualM', 'durationS', 'key', 'metres', 'paceSecPerKm', 'samples', 'startS'].sort()
    );
  });
});

describe('backfillBestEfforts', () => {
  it('derives and stores efforts for pace-sport activities that have streams', async () => {
    const store = createMemoryStore();
    await seed(store, [{ id: 'r1', streams: runStreams(1200, 3.5) }]);

    const result = await backfillBestEfforts(store, 'u', 10);
    expect(result).toEqual({ computed: 1, pending: 0 });

    const rows = await store.listTopBestEfforts('u', { limit: 3, sports: EFFORT_SPORT_KEYS });
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((r) => r.activityId === 'r1')).toBe(true);
    // The activity's LOCAL day, not a UTC instant — this is what the leaderboard prints.
    expect(rows[0]?.day).toBe('2026-05-01');
  });

  it('ignores sports a best effort means nothing for', async () => {
    const store = createMemoryStore();
    await seed(store, [
      { id: 'ride', streams: runStreams(1200, 9), over: { sport: 'cycling' } },
      { id: 'gym', streams: runStreams(1200, 1), over: { sport: 'strength_training' } }
    ]);

    expect(await backfillBestEfforts(store, 'u', 10)).toEqual({ computed: 0, pending: 0 });
    expect(await store.listTopBestEfforts('u', { limit: 3 })).toEqual([]);
  });

  it('covers walking as well as running — both are pace sports', async () => {
    const store = createMemoryStore();
    await seed(store, [{ id: 'w1', streams: runStreams(1800, 1.6), over: { sport: 'walking' } }]);

    expect((await backfillBestEfforts(store, 'u', 10)).computed).toBe(1);
    expect(await store.listTopBestEfforts('u', { limit: 3, sports: ['walking'] })).not.toHaveLength(0);
  });

  it('skips activities with no streams instead of retrying them every tick', async () => {
    const store = createMemoryStore();
    await seed(store, [{ id: 'no-streams' }]);

    // Nothing to derive from, and — crucially — nothing left "pending" to burn the next budget on.
    expect(await backfillBestEfforts(store, 'u', 10)).toEqual({ computed: 0, pending: 0 });
  });

  it('marks an activity too short for any distance as done, so it is never recomputed', async () => {
    const store = createMemoryStore();
    await seed(store, [{ id: 'short', streams: runStreams(30, 2) }]); // 60 m

    expect(await backfillBestEfforts(store, 'u', 10)).toEqual({ computed: 1, pending: 0 });
    expect(await store.listTopBestEfforts('u', { limit: 3 })).toEqual([]);
    // Second pass: the version stamp survives an empty effort set.
    expect(await backfillBestEfforts(store, 'u', 10)).toEqual({ computed: 0, pending: 0 });
  });

  it('is bounded by its budget and resumes where it stopped', async () => {
    const store = createMemoryStore();
    await seed(
      store,
      ['a', 'b', 'c', 'd', 'e'].map((id, i) => ({
        id,
        streams: runStreams(1200, 3),
        over: { startTimeLocal: `2026-05-0${i + 1} 07:00:00` }
      }))
    );

    const first = await backfillBestEfforts(store, 'u', 2);
    expect(first).toEqual({ computed: 2, pending: 3 });
    const second = await backfillBestEfforts(store, 'u', 2);
    expect(second).toEqual({ computed: 2, pending: 1 });
    const third = await backfillBestEfforts(store, 'u', 2);
    expect(third).toEqual({ computed: 1, pending: 0 });
    // And once everything is stamped, a further pass costs nothing.
    expect(await backfillBestEfforts(store, 'u', 2)).toEqual({ computed: 0, pending: 0 });
  });

  it('derives the newest activities first, so a fresh run appears mid-backfill', async () => {
    const store = createMemoryStore();
    await seed(store, [
      { id: 'old', streams: runStreams(1200, 3), over: { startTimeLocal: '2020-01-01 07:00:00' } },
      { id: 'new', streams: runStreams(1200, 3), over: { startTimeLocal: '2026-05-01 07:00:00' } }
    ]);

    await backfillBestEfforts(store, 'u', 1);
    const rows = await store.listTopBestEfforts('u', { limit: 3 });
    expect(new Set(rows.map((r) => r.activityId))).toEqual(new Set(['new']));
  });

  it('is idempotent: running it twice leaves exactly the same rows', async () => {
    const store = createMemoryStore();
    await seed(store, [{ id: 'r1', streams: runStreams(2400, 3.4) }]);

    await backfillBestEfforts(store, 'u', 10);
    const after1 = await store.listTopBestEfforts('u', { limit: 3 });
    // Force a re-derivation of the very same streams (the version guard would skip it otherwise).
    await store.putActivityBestEfforts('u', {
      activityId: 'r1',
      sport: 'running',
      day: '2026-05-01',
      version: 0,
      efforts: []
    });
    await backfillBestEfforts(store, 'u', 10);
    const after2 = await store.listTopBestEfforts('u', { limit: 3 });

    expect(after2).toEqual(after1);
  });

  it('re-derives after the streams are refetched — repaired samples must not keep old windows', async () => {
    const store = createMemoryStore();
    await seed(store, [{ id: 'r1', streams: runStreams(1200, 3) }]);
    await backfillBestEfforts(store, 'u', 10);
    const slow = (await store.listTopBestEfforts('u', { limit: 1 }))[0]!.durationS;

    // A stream repair (spec 023) rewrites the samples: the stored efforts are now stale by definition.
    await store.putStreams('u', 'r1', runStreams(1200, 4));
    expect((await backfillBestEfforts(store, 'u', 10)).computed).toBe(1);

    const fast = (await store.listTopBestEfforts('u', { limit: 1 }))[0]!.durationS;
    expect(fast).toBeLessThan(slow);
  });

  it('replaces an activity’s set rather than accumulating rows', async () => {
    const store = createMemoryStore();
    await seed(store, [{ id: 'r1', streams: runStreams(2400, 3) }]);
    await backfillBestEfforts(store, 'u', 10);
    const before = await store.listTopBestEfforts('u', { limit: 10 });

    // Same activity, a stream that only reaches 400 m: the longer distances must DISAPPEAR.
    await store.putStreams('u', 'r1', runStreams(200, 2.5));
    await backfillBestEfforts(store, 'u', 10);
    const after = await store.listTopBestEfforts('u', { limit: 10 });

    expect(before.length).toBeGreaterThan(after.length);
    expect(after.map((r) => r.key)).toEqual(['400m']);
  });

  it('keeps one user’s derivation out of another’s (AGENTS.md §2 rule 2)', async () => {
    const store = createMemoryStore();
    await seed(store, [{ id: 'mine', streams: runStreams(1200, 3) }]);
    await store.putActivities('other', [{ ...act('theirs'), userId: 'other' }]);
    await store.putStreams('other', 'theirs', runStreams(1200, 5));

    expect((await backfillBestEfforts(store, 'u', 10)).computed).toBe(1);
    // The other user's activity is untouched: still unstamped, no rows.
    expect(await store.listTopBestEfforts('other', { limit: 3 })).toEqual([]);
    expect((await store.listBestEffortVersions('other')).get('theirs')).toBe(0);
    expect((await store.listBestEffortVersions('u')).get('mine')).toBe(BEST_EFFORTS_VERSION);
  });

  it('writes nothing on a zero budget but still reports the backlog honestly', async () => {
    const store = createMemoryStore();
    await seed(store, [{ id: 'r1', streams: runStreams(1200, 3) }]);
    // "0 done, 0 left" and "0 done, 1 left" mean different things to whoever reads the sync detail.
    expect(await backfillBestEfforts(store, 'u', 0)).toEqual({ computed: 0, pending: 1 });
    expect(await store.listTopBestEfforts('u', { limit: 3 })).toEqual([]);
  });
});
