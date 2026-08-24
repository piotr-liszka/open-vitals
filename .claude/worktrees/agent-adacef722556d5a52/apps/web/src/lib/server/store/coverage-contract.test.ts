/**
 * Coverage CONTRACT (spec 019) — assertions every LocalStore adapter must satisfy identically.
 *
 * Why this file exists: the pg adapter computed `first_day` as `min(day)` over ALL
 * `synced_metric_days` rows while counting `present_days` only where `data IS NOT NULL`. The sync
 * engine writes a row for every day it *checked* — data or not — so "Dane od" on /dane named a day
 * that holds nothing. The in-memory fake filtered nulls, so the fake and production disagreed and
 * every test passed while prod lied.
 *
 * The suite below is written against the `LocalStore` PORT rather than one adapter, and runs here for
 * the in-memory fake. Point `TEST_DATABASE_URL` at a scratch Postgres and the identical assertions
 * run against the pg adapter too (skipped otherwise, so the suite stays offline by default).
 */
import { describe, it, expect } from 'vitest';
import { createMemoryStore } from './memory';
import { createPgStore } from './pg';
import { createDb, migrate } from '../db';
import type { LocalStore } from './types';

interface Fixture {
  store: LocalStore;
  userId: string;
  /** A second, unrelated user — isolation must hold between them. */
  otherUserId: string;
}

/** Every assertion both adapters must satisfy. */
export function coverageContract(name: string, make: () => Promise<Fixture>): void {
  describe(`${name} — coverage contract`, () => {
    it('never reports a day that holds no data as the first/last day', async () => {
      const { store, userId } = await make();
      // Exactly what a backfill writes: probed days with nothing on them around real data.
      await store.putMetricDays(userId, 'steps', [
        { day: '2019-07-16', data: null },
        { day: '2019-07-17', data: null },
        { day: '2021-03-04', data: { totalSteps: 8000 } },
        { day: '2021-03-05', data: { totalSteps: 9000 } },
        { day: '2026-08-08', data: null }
      ]);

      const cov = await store.coverage(userId);
      const steps = cov.metrics.find((m) => m.metric === 'steps')!;

      expect(steps.firstDay).toBe('2021-03-04');
      expect(steps.lastDay).toBe('2021-03-05');
      expect(steps.presentDays).toBe(2);
      // "Dane od" must agree with the metric it came from.
      expect(cov.earliest).toBe('2021-03-04');
    });

    it('reports null-only metrics as empty rather than as a phantom range', async () => {
      const { store, userId } = await make();
      await store.putMetricDays(userId, 'hrv', [
        { day: '2020-01-01', data: null },
        { day: '2020-01-02', data: null }
      ]);

      const hrv = (await store.coverage(userId)).metrics.find((m) => m.metric === 'hrv')!;

      expect(hrv).toMatchObject({ firstDay: null, lastDay: null, presentDays: 0 });
    });

    it('counts stored rows (including probed-empty days) as the storage footprint', async () => {
      const { store, userId } = await make();
      await store.putMetricDays(userId, 'steps', [
        { day: '2026-08-01', data: { totalSteps: 1 } },
        { day: '2026-08-02', data: null }
      ]);

      const cov = await store.coverage(userId);

      // Footprint counts what is on disk; coverage counts what is usable. They differ on purpose.
      expect(cov.storage.rows.metricDays).toBe(2);
      expect(cov.metrics.find((m) => m.metric === 'steps')!.presentDays).toBe(1);
    });

    it('does not count a present-but-hollow day as data (spec 072)', async () => {
      const { store, userId } = await make();
      // Exactly what Garmin returns for a day it has no wellness data for: the object is THERE,
      // every field inside it is null. `data IS NOT NULL` calls that a day with data; it is not.
      const hollow = { calendarDate: '2026-08-16', totalSteps: null, includesWellnessData: false };
      await store.putMetricDays(userId, 'steps', [
        { day: '2026-08-14', data: { totalSteps: 9000 }, hasValue: true },
        { day: '2026-08-15', data: hollow, hasValue: false },
        { day: '2026-08-16', data: hollow, hasValue: false }
      ]);

      const steps = (await store.coverage(userId)).metrics.find((m) => m.metric === 'steps')!;

      expect(steps.presentDays).toBe(1);
      // The whole point: the newest day we can honestly claim is the 14th, not the 16th.
      expect(steps.lastDay).toBe('2026-08-14');
    });

    it('reports the newest watch-borne day as freshness, ignoring the scale (spec 072)', async () => {
      const { store, userId } = await make();
      await store.putMetricDays(userId, 'hrv', [
        { day: '2026-08-14', data: { hrvSummary: { lastNightAvg: 88 } }, hasValue: true },
        { day: '2026-08-16', data: {}, hasValue: false }
      ]);
      await store.putMetricDays(userId, 'sleep', [
        { day: '2026-08-13', data: { dailySleepDTO: { sleepTimeSeconds: 26_000 } }, hasValue: true }
      ]);
      // A weigh-in synced today says nothing about whether the WATCH uploaded.
      await store.putMetricDays(userId, 'body_composition', [
        { day: '2026-08-16', data: { weight: 71_000 }, hasValue: true }
      ]);

      const cov = await store.coverage(userId);

      expect(cov.freshness.lastDataDay).toBe('2026-08-14');
      // The store has no clock, so it never guesses the distance from today.
      expect(cov.freshness.staleDays).toBeNull();
    });

    it('reports no freshness at all for an empty store (spec 072)', async () => {
      const { store, userId } = await make();
      const cov = await store.coverage(userId);
      expect(cov.freshness).toEqual({ lastDataDay: null, staleDays: null });
    });

    it("keeps one user out of another user's coverage", async () => {
      const { store, userId, otherUserId } = await make();
      await store.putMetricDays(userId, 'steps', [{ day: '2026-08-01', data: { totalSteps: 1 } }]);
      await store.putMetricDays(otherUserId, 'steps', [{ day: '2019-01-01', data: { totalSteps: 1 } }]);

      const cov = await store.coverage(userId);

      expect(cov.earliest).toBe('2026-08-01');
    });

    it('round-trips planned events and replaces a whole window (spec 024)', async () => {
      const { store, userId } = await make();
      const base = {
        day: '2026-08-10',
        time: '18:00',
        kind: 'workout' as const,
        title: 'Interwały',
        sport: 'running',
        description: null,
        estimatedDurationS: 3600,
        estimatedDistanceM: 12000,
        targetLoad: null,
        source: 'garmin' as const
      };
      await store.replacePlannedEvents(userId, '2026-08-01', '2026-08-31', [{ ...base, id: 'w1' }]);
      expect(await store.listPlannedEvents(userId, '2026-08-01', '2026-08-31')).toHaveLength(1);

      // A plan deleted upstream must vanish here; an upsert-only write would strand it forever.
      await store.replacePlannedEvents(userId, '2026-08-01', '2026-08-31', []);
      expect(await store.listPlannedEvents(userId, '2026-08-01', '2026-08-31')).toEqual([]);
    });
  });
}

coverageContract('memory store', async () => ({
  store: createMemoryStore(),
  userId: 'u1',
  otherUserId: 'u2'
}));

/**
 * The pg adapter runs the identical suite when a scratch database is available:
 *   TEST_DATABASE_URL=postgres://… pnpm run test
 */
const dsn = process.env.TEST_DATABASE_URL;
if (dsn) {
  const sql = createDb(dsn);
  // Once per worker, not once per test: the schema does not change between tests, and re-running the
  // DDL before each one only buys lock contention with the other contract files running alongside.
  const schema = migrate(sql);
  coverageContract('pg store', async () => {
    await schema;
    const suffix = Math.random().toString(36).slice(2);
    const userId = `contract-${suffix}-a`;
    const otherUserId = `contract-${suffix}-b`;
    for (const id of [userId, otherUserId]) {
      await sql`INSERT INTO users (id, google_sub) VALUES (${id}, ${id}) ON CONFLICT DO NOTHING`;
    }
    return { store: createPgStore(sql), userId, otherUserId };
  });
} else {
  describe.skip('pg store — coverage contract (set TEST_DATABASE_URL to run)', () => {
    it('is skipped without a scratch database', () => undefined);
  });
}
