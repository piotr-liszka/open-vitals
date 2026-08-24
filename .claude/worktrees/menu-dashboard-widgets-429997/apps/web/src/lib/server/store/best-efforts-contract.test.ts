/**
 * Best-efforts CONTRACT (spec 054) — assertions every LocalStore adapter must satisfy identically.
 *
 * Written against the `LocalStore` PORT, like the coverage and authored-workout contracts next door:
 * it runs for the in-memory fake by default and, with `TEST_DATABASE_URL` pointed at a scratch
 * Postgres, against the pg adapter too. The symmetry matters more here than usual, because the two
 * implementations are genuinely different code: pg keeps the derivation version in a COLUMN on the
 * stream row and ranks with a window function, the fake keeps it on an entry and ranks in memory.
 * Only a shared contract can catch them drifting.
 */
import { describe, it, expect } from 'vitest';
import { createMemoryStore } from './memory';
import { createPgStore } from './pg';
import { createDb, migrate } from '../db';
import { sportKeysInGroup } from '$lib/sport-labels';
import { BEST_EFFORTS_VERSION, type ActivitySummary, type LocalStore, type StoredBestEffort } from './types';

interface Fixture {
  store: LocalStore;
  userId: string;
  otherUserId: string;
}

function activity(userId: string, id: string, over: Partial<ActivitySummary> = {}): ActivitySummary {
  return {
    userId,
    activityId: id,
    sport: 'running',
    name: `Bieg ${id}`,
    startTime: '2026-01-10T08:00:00Z',
    startTimeLocal: '2026-01-10 09:00:00',
    distanceM: 10_000,
    durationS: 2700,
    movingS: 2700,
    elevationGainM: 50,
    avgHr: 150,
    maxHr: 172,
    avgPower: null,
    maxPower: null,
    normPower: null,
    calories: 600,
    trainingLoad: 60,
    hasGps: true,
    raw: {},
    ...over
  };
}

function effort(over: Partial<StoredBestEffort> = {}): StoredBestEffort {
  return {
    key: '5k',
    metres: 5000,
    durationS: 1500,
    actualM: 5004,
    paceSecPerKm: 299.8,
    startS: 0,
    samples: 300,
    ...over
  };
}

export function bestEffortsContract(name: string, make: () => Promise<Fixture>): void {
  describe(`${name} — best-efforts contract`, () => {
    /** An activity with a stream row: the state the derivation actually starts from. */
    async function withRun(
      store: LocalStore,
      userId: string,
      id: string,
      over: Partial<ActivitySummary> = {}
    ): Promise<void> {
      await store.putActivities(userId, [activity(userId, id, over)]);
      await store.putStreams(userId, id, { speed: [3, 3], time: [0, 1] });
    }

    it('stores a set and reads it back joined to its activity', async () => {
      const { store, userId } = await make();
      await withRun(store, userId, 'a1', { name: 'Bieg A' });
      await store.putActivityBestEfforts(userId, {
        activityId: 'a1',
        sport: 'running',
        day: '2026-01-10',
        version: BEST_EFFORTS_VERSION,
        efforts: [effort(), effort({ key: '1k', metres: 1000, durationS: 250, actualM: 1002 })]
      });

      const rows = await store.listTopBestEfforts(userId, { limit: 3 });
      // Distance ascending — the order the card renders its sections in.
      expect(rows.map((r) => r.key)).toEqual(['1k', '5k']);
      expect(rows[1]).toMatchObject({
        key: '5k',
        metres: 5000,
        durationS: 1500,
        actualM: 5004,
        samples: 300,
        activityId: 'a1',
        activityName: 'Bieg A',
        sport: 'running',
        day: '2026-01-10'
      });
    });

    it('replaces an activity’s whole set rather than merging into it', async () => {
      const { store, userId } = await make();
      await withRun(store, userId, 'a1');
      const put = (efforts: StoredBestEffort[]): Promise<void> =>
        store.putActivityBestEfforts(userId, {
          activityId: 'a1',
          sport: 'running',
          day: '2026-01-10',
          version: BEST_EFFORTS_VERSION,
          efforts
        });

      await put([effort(), effort({ key: '1k', metres: 1000, durationS: 250 })]);
      await put([effort({ key: '1k', metres: 1000, durationS: 240 })]);

      const rows = await store.listTopBestEfforts(userId, { limit: 3 });
      expect(rows.map((r) => r.key)).toEqual(['1k']);
      expect(rows[0]?.durationS).toBe(240);
    });

    it('stamps the derivation version, and clears it when the streams are rewritten', async () => {
      const { store, userId } = await make();
      await withRun(store, userId, 'a1');
      // Stream stored, efforts never derived.
      expect((await store.listBestEffortVersions(userId)).get('a1')).toBe(0);

      await store.putActivityBestEfforts(userId, {
        activityId: 'a1',
        sport: 'running',
        day: '2026-01-10',
        version: BEST_EFFORTS_VERSION,
        efforts: [effort()]
      });
      expect((await store.listBestEffortVersions(userId)).get('a1')).toBe(BEST_EFFORTS_VERSION);

      await store.putStreams(userId, 'a1', { speed: [4, 4], time: [0, 1] });
      expect((await store.listBestEffortVersions(userId)).get('a1')).toBe(0);
      // …and the stale rows went with it, rather than outliving the samples they came from.
      expect(await store.listTopBestEfforts(userId, { limit: 3 })).toEqual([]);
    });

    it('omits activities with no stream row, so a backfill cannot loop on them', async () => {
      const { store, userId } = await make();
      await withRun(store, userId, 'a1');
      await store.putActivities(userId, [activity(userId, 'no-streams')]);

      const versions = await store.listBestEffortVersions(userId);
      expect(versions.has('a1')).toBe(true);
      expect(versions.has('no-streams')).toBe(false);
    });

    it('keeps only the fastest `limit` per distance, with ties going to the earlier day', async () => {
      const { store, userId } = await make();
      const seeds: Array<[string, string, number]> = [
        ['r0', '2026-03-01', 1500],
        ['r1', '2024-06-06', 1500],
        ['r2', '2025-01-01', 1400]
      ];
      for (const [id, day, durationS] of seeds) {
        await withRun(store, userId, id);
        await store.putActivityBestEfforts(userId, {
          activityId: id,
          sport: 'running',
          day,
          version: BEST_EFFORTS_VERSION,
          efforts: [effort({ durationS })]
        });
      }

      const rows = await store.listTopBestEfforts(userId, { limit: 2 });
      expect(rows).toHaveLength(2);
      // Fastest first; then the OLDER of the two identical times — the record belongs to whoever set
      // it first, so being older must not demote it.
      expect(rows.map((r) => r.activityId)).toEqual(['r2', 'r1']);
    });

    it('bounds the board to an as-of day, ranking the SUBSET (spec 055)', async () => {
      const { store, userId } = await make();
      const seeds: Array<[string, string, number]> = [
        ['old', '2026-01-01', 1600],
        ['mid', '2026-04-01', 1500],
        ['new', '2026-07-01', 1400]
      ];
      for (const [id, day, durationS] of seeds) {
        await withRun(store, userId, id);
        await store.putActivityBestEfforts(userId, {
          activityId: id,
          sport: 'running',
          day,
          version: BEST_EFFORTS_VERSION,
          efforts: [effort({ durationS })]
        });
      }

      // Inclusive bound: the effort set exactly ON the cutoff day still counts.
      const asOf = await store.listTopBestEfforts(userId, { limit: 1, until: '2026-04-01' });
      expect(asOf.map((r) => r.activityId)).toEqual(['mid']);
      // The cap applies AFTER the filter — otherwise "top 1 as of April" would be an empty slice of
      // the all-time top 1 rather than April's own record.
      expect(await store.listTopBestEfforts(userId, { limit: 1 })).toMatchObject([{ activityId: 'new' }]);
      expect(await store.listTopBestEfforts(userId, { limit: 5, until: '2025-12-31' })).toEqual([]);
    });

    it('filters by sport family', async () => {
      const { store, userId } = await make();
      await withRun(store, userId, 'run1');
      await withRun(store, userId, 'walk1', { sport: 'walking' });
      await store.putActivityBestEfforts(userId, {
        activityId: 'run1',
        sport: 'running',
        day: '2026-01-10',
        version: BEST_EFFORTS_VERSION,
        efforts: [effort({ durationS: 1500 })]
      });
      await store.putActivityBestEfforts(userId, {
        activityId: 'walk1',
        sport: 'walking',
        day: '2026-01-11',
        version: BEST_EFFORTS_VERSION,
        efforts: [effort({ durationS: 3000 })]
      });

      const runs = await store.listTopBestEfforts(userId, {
        limit: 3,
        sports: sportKeysInGroup('run')
      });
      expect(runs.map((r) => r.activityId)).toEqual(['run1']);
      // Unfiltered, both families are on the board.
      expect(await store.listTopBestEfforts(userId, { limit: 3 })).toHaveLength(2);
    });

    it('never lets one user see another’s records (AGENTS.md §2 rule 2)', async () => {
      const { store, userId, otherUserId } = await make();
      await withRun(store, userId, 'mine');
      await withRun(store, otherUserId, 'theirs');
      await store.putActivityBestEfforts(userId, {
        activityId: 'mine',
        sport: 'running',
        day: '2026-01-10',
        version: BEST_EFFORTS_VERSION,
        efforts: [effort({ durationS: 1800 })]
      });
      // The other account is dramatically faster — and must be invisible anyway.
      await store.putActivityBestEfforts(otherUserId, {
        activityId: 'theirs',
        sport: 'running',
        day: '2026-01-10',
        version: BEST_EFFORTS_VERSION,
        efforts: [effort({ durationS: 900 })]
      });

      const mine = await store.listTopBestEfforts(userId, { limit: 5 });
      expect(mine.map((r) => r.activityId)).toEqual(['mine']);
      expect((await store.listBestEffortVersions(userId)).has('theirs')).toBe(false);
      expect((await store.listTopBestEfforts(otherUserId, { limit: 5 })).map((r) => r.activityId)).toEqual([
        'theirs'
      ]);
    });
  });
}

bestEffortsContract('memory store', async () => ({
  store: createMemoryStore(),
  userId: 'u1',
  otherUserId: 'u2'
}));

/** Same suite against Postgres: `TEST_DATABASE_URL=postgres://… pnpm run test`. */
const dsn = process.env.TEST_DATABASE_URL;
if (dsn) {
  const sql = createDb(dsn);
  bestEffortsContract('pg store', async () => {
    await migrate(sql);
    const suffix = Math.random().toString(36).slice(2);
    const userId = `efforts-${suffix}-a`;
    const otherUserId = `efforts-${suffix}-b`;
    for (const id of [userId, otherUserId]) {
      await sql`INSERT INTO users (id, google_sub) VALUES (${id}, ${id}) ON CONFLICT DO NOTHING`;
    }
    return { store: createPgStore(sql), userId, otherUserId };
  });
} else {
  describe.skip('pg store — best-efforts contract (set TEST_DATABASE_URL to run)', () => {
    it('is skipped without a scratch database', () => undefined);
  });
}
