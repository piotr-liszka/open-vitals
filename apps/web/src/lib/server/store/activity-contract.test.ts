/**
 * Activity CONTRACT (spec 081) — assertions every LocalStore adapter must satisfy identically.
 *
 * Written against the `LocalStore` PORT, like the coverage and workout contracts next door: it runs
 * for the in-memory fake by default and, with `TEST_DATABASE_URL` pointed at a scratch Postgres,
 * against the pg adapter too. **A green run WITHOUT that variable has not exercised the pg adapter
 * or the migration at all** — which is exactly how a column can exist in the fake and nowhere else.
 *
 * The subject is `garminWorkoutId`: the id Garmin stamps on an activity that was started from a
 * scheduled workout, and the only hard link between a plan and what was done.
 */
import { describe, it, expect } from 'vitest';
import { createMemoryStore } from './memory';
import { createPgStore } from './pg';
import { createDb, migrate } from '../db';
import type { ActivitySummary, LocalStore } from './types';

interface Fixture {
  store: LocalStore;
  userId: string;
  otherUserId: string;
}

function activity(id: string, over: Partial<ActivitySummary> = {}): ActivitySummary {
  return {
    userId: 'u1',
    activityId: id,
    sport: 'running',
    name: 'Bieg',
    startTime: '2026-08-18T06:00:00.000Z',
    startTimeLocal: '2026-08-18 08:00:00',
    distanceM: 10_000,
    durationS: 3000,
    movingS: 2950,
    elevationGainM: 40,
    avgHr: 150,
    maxHr: 172,
    avgPower: null,
    maxPower: null,
    normPower: null,
    calories: 600,
    trainingLoad: 120,
    hasGps: true,
    garminWorkoutId: null,
    raw: { activityId: id },
    ...over
  };
}

export function activityContract(name: string, make: () => Promise<Fixture>): void {
  describe(`${name} — activity contract (spec 081)`, () => {
    it('round-trips garminWorkoutId through a single read', async () => {
      const { store, userId } = await make();
      await store.putActivities(userId, [
        { ...activity('a1', { garminWorkoutId: '1668504046' }), userId },
        { ...activity('a2'), userId }
      ]);

      expect((await store.getActivity(userId, 'a1'))?.garminWorkoutId).toBe('1668504046');
      // Absent is null, not the empty string: "not started from a plan" is the normal case.
      expect((await store.getActivity(userId, 'a2'))?.garminWorkoutId).toBeNull();
    });

    it('returns garminWorkoutId on the LITE list read too', async () => {
      // `listActivities` omits the heavy `raw` blob on purpose, which is precisely why the id has to
      // be its own column: the matcher runs off a list read and would otherwise never see it.
      const { store, userId } = await make();
      await store.putActivities(userId, [{ ...activity('a1', { garminWorkoutId: '77' }), userId }]);

      const listed = await store.listActivities(userId, { from: '2026-08-01', to: '2026-08-31' });

      expect(listed).toHaveLength(1);
      expect(listed[0]?.garminWorkoutId).toBe('77');
      expect(listed[0]?.raw ?? null).toBeNull(); // still lite
    });

    it('keeps the id (and the raw payload) when a lite row is written back', async () => {
      /*
       * The streams phase re-puts an activity read from `listActivities` just to flip hasGps. That
       * row carries no `raw` — the list read never selected it — and therefore no workout id. An
       * upsert that took those nulls at face value would erase the link on the first sync after it
       * was made.
       */
      const { store, userId } = await make();
      await store.putActivities(userId, [{ ...activity('a1', { garminWorkoutId: '1668504046' }), userId }]);

      const lite = (await store.listActivities(userId, {}))[0]!;
      await store.putActivities(userId, [{ ...lite, hasGps: true }]);

      const after = await store.getActivity(userId, 'a1');
      expect(after?.garminWorkoutId).toBe('1668504046');
      expect(after?.raw).not.toBeNull();
    });

    it('updates the id when a re-sync brings a real one', async () => {
      const { store, userId } = await make();
      await store.putActivities(userId, [{ ...activity('a1'), userId }]);
      await store.putActivities(userId, [{ ...activity('a1', { garminWorkoutId: '999' }), userId }]);
      expect((await store.getActivity(userId, 'a1'))?.garminWorkoutId).toBe('999');
    });

    it('counts the linked activities in the coverage snapshot', async () => {
      // The /dane diagnostic (spec 081): the only way to see whether Garmin sends the id at all.
      const { store, userId } = await make();
      await store.putActivities(userId, [
        { ...activity('a1', { garminWorkoutId: '1' }), userId },
        { ...activity('a2', { garminWorkoutId: '2' }), userId },
        { ...activity('a3'), userId }
      ]);

      const cov = await store.coverage(userId);

      expect(cov.activities.count).toBe(3);
      expect(cov.activities.withWorkoutId).toBe(2);
    });

    it('never leaks one user’s link to another', async () => {
      const { store, userId, otherUserId } = await make();
      await store.putActivities(userId, [{ ...activity('shared-id', { garminWorkoutId: 'mine' }), userId }]);
      await store.putActivities(otherUserId, [
        { ...activity('shared-id', { garminWorkoutId: 'theirs' }), userId: otherUserId }
      ]);

      expect((await store.getActivity(userId, 'shared-id'))?.garminWorkoutId).toBe('mine');
      expect((await store.getActivity(otherUserId, 'shared-id'))?.garminWorkoutId).toBe('theirs');
      expect((await store.coverage(userId)).activities.withWorkoutId).toBe(1);
    });
  });
}

activityContract('memory store', async () => ({
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
  // Once per worker, not once per test — see coverage-contract.test.ts.
  const schema = migrate(sql);
  activityContract('pg store', async () => {
    await schema;
    const suffix = Math.random().toString(36).slice(2);
    const userId = `act-${suffix}-a`;
    const otherUserId = `act-${suffix}-b`;
    for (const id of [userId, otherUserId]) {
      await sql`INSERT INTO users (id, google_sub) VALUES (${id}, ${id}) ON CONFLICT DO NOTHING`;
    }
    return { store: createPgStore(sql), userId, otherUserId };
  });

  describe('pg store — spec 081 migration', () => {
    it('backfills garmin_workout_id from the raw payload already stored', async () => {
      /*
       * The upgrade path, exercised end to end: a row written BEFORE the column existed (simulated
       * by clearing it) must link up from `raw` alone, with no re-sync from Garmin — and the
       * statement must be safe to run again, because it runs on every boot.
       */
      await schema;
      const suffix = Math.random().toString(36).slice(2);
      const userId = `mig-${suffix}`;
      await sql`INSERT INTO users (id, google_sub) VALUES (${userId}, ${userId}) ON CONFLICT DO NOTHING`;
      const store = createPgStore(sql);

      await store.putActivities(userId, [
        // Numeric id in the payload, as Garmin sends it.
        { ...activity('old-1', { raw: { activityId: 'old-1', workoutId: 1668504046 } }), userId },
        // No id at all: must stay null rather than becoming the string "null".
        { ...activity('old-2', { raw: { activityId: 'old-2' } }), userId },
        // A payload shape the probe must refuse rather than serialise.
        { ...activity('old-3', { raw: { activityId: 'old-3', workoutId: { id: 7 } } }), userId }
      ]);
      await sql`UPDATE synced_activities SET garmin_workout_id = NULL WHERE user_id = ${userId}`;

      await migrate(sql);

      expect((await store.getActivity(userId, 'old-1'))?.garminWorkoutId).toBe('1668504046');
      expect((await store.getActivity(userId, 'old-2'))?.garminWorkoutId).toBeNull();
      expect((await store.getActivity(userId, 'old-3'))?.garminWorkoutId).toBeNull();

      // Idempotent: a second boot changes nothing and, in particular, does not undo a later write.
      await store.putActivities(userId, [
        { ...activity('old-2', { garminWorkoutId: '42', raw: { activityId: 'old-2' } }), userId }
      ]);
      await migrate(sql);
      expect((await store.getActivity(userId, 'old-1'))?.garminWorkoutId).toBe('1668504046');
      expect((await store.getActivity(userId, 'old-2'))?.garminWorkoutId).toBe('42');
    });

    it('indexes the lookup the matcher does', async () => {
      await schema;
      const rows = await sql<{ indexdef: string }[]>`
        SELECT indexdef FROM pg_indexes
        WHERE tablename = 'synced_activities' AND indexname = 'synced_activities_user_workout_idx'`;
      expect(rows).toHaveLength(1);
      expect(rows[0]?.indexdef).toContain('garmin_workout_id IS NOT NULL');
    });
  });
} else {
  describe.skip('pg store — activity contract (set TEST_DATABASE_URL to run)', () => {
    it('is skipped without a scratch database', () => undefined);
  });
}
