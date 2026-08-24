/**
 * Authored-workout CONTRACT (spec 050) — assertions every LocalStore adapter must satisfy identically.
 *
 * Written against the `LocalStore` PORT, like the coverage contract next door: it runs for the
 * in-memory fake by default and, with `TEST_DATABASE_URL` pointed at a scratch Postgres, against the
 * pg adapter too. That symmetry is the point — these rows are the SOURCE OF TRUTH for what gets
 * pushed to the athlete's watch, so the fake drifting from production would be invisible and costly.
 */
import { describe, it, expect } from 'vitest';
import { createMemoryStore } from './memory';
import { createPgStore } from './pg';
import { createDb, migrate } from '../db';
import type { LocalStore, NewAuthoredWorkout, PlannedEvent } from './types';
import type { WorkoutStep } from '$lib/workouts';

interface Fixture {
  store: LocalStore;
  userId: string;
  otherUserId: string;
  /**
   * Prefix for workout ids. `authored_workouts.id` is a GLOBAL primary key, so a suite that
   * hard-codes `w-1` collides with itself from the second test onwards once it runs against a real
   * database, which keeps rows between tests where the in-memory fake does not.
   */
  idPrefix: string;
}

const STEPS: WorkoutStep[] = [
  {
    kind: 'warmup',
    durationType: 'time',
    durationValue: 600,
    target: null,
    repeats: null,
    steps: null,
    note: null
  },
  {
    kind: 'repeat',
    durationType: null,
    durationValue: null,
    target: null,
    repeats: 4,
    steps: [
      {
        kind: 'work',
        durationType: 'time',
        durationValue: 480,
        target: { type: 'power', low: 250, high: 265 },
        repeats: null,
        steps: null,
        note: 'trzymaj kadencję'
      },
      {
        kind: 'recovery',
        durationType: 'time',
        durationValue: 240,
        target: null,
        repeats: null,
        steps: null,
        note: null
      }
    ],
    note: null
  }
];

function newWorkout(id: string, overrides: Partial<NewAuthoredWorkout> = {}): NewAuthoredWorkout {
  return {
    id,
    day: '2026-08-20',
    time: '18:00',
    sport: 'cycling',
    title: '4x8 FTP',
    steps: STEPS,
    note: null,
    createdAt: '2026-08-13T09:00:00.000Z',
    ...overrides
  };
}

export function workoutContract(name: string, make: () => Promise<Fixture>): void {
  describe(`${name} — authored workout contract`, () => {
    it('round-trips a nested step tree and starts out pending', async () => {
      const { store, userId, idPrefix } = await make();
      const id = (n: string | number): string => `${idPrefix}${n}`;

      const created = await store.createWorkout(userId, newWorkout(id(1)));

      expect(created.pushState).toBe('pending');
      expect(created.garminWorkoutId).toBeNull();
      expect(created.matchedActivityId).toBeNull();
      const read = await store.getWorkout(userId, id(1));
      expect(read?.title).toBe('4x8 FTP');
      expect(read?.sport).toBe('cycling');
      expect(read?.time).toBe('18:00');
      // The whole tree survives storage — repeats, targets and per-step notes included.
      expect(read?.steps).toEqual(STEPS);
    });

    it('lists day then time ascending, filtered by window and push state', async () => {
      const { store, userId, idPrefix } = await make();
      const id = (n: string | number): string => `${idPrefix}${n}`;
      await store.createWorkout(userId, newWorkout(id('b'), { day: '2026-08-21', time: '07:00' }));
      await store.createWorkout(userId, newWorkout(id('a'), { day: '2026-08-20', time: '18:00' }));
      await store.createWorkout(userId, newWorkout(id('c'), { day: '2026-09-01', time: null }));
      await store.updateWorkout(userId, id('b'), {
        pushState: 'pushed',
        updatedAt: '2026-08-13T10:00:00.000Z'
      });

      const all = await store.listWorkouts(userId);
      expect(all.map((w) => w.id)).toEqual([id('a'), id('b'), id('c')]);

      const window = await store.listWorkouts(userId, { from: '2026-08-20', to: '2026-08-31' });
      expect(window.map((w) => w.id)).toEqual([id('a'), id('b')]);

      const pending = await store.listWorkouts(userId, { pushState: 'pending' });
      expect(pending.map((w) => w.id)).toEqual([id('a'), id('c')]);
    });

    it('patches only the keys present, and can clear a nullable column', async () => {
      const { store, userId, idPrefix } = await make();
      const id = (n: string | number): string => `${idPrefix}${n}`;
      await store.createWorkout(userId, newWorkout(id(1)));
      await store.updateWorkout(userId, id(1), {
        pushState: 'failed',
        pushError: 'sidecar unavailable',
        updatedAt: '2026-08-13T10:00:00.000Z'
      });

      const failed = await store.getWorkout(userId, id(1));
      // A push-state update must not touch the workout's own content.
      expect(failed?.title).toBe('4x8 FTP');
      expect(failed?.steps).toEqual(STEPS);
      expect(failed?.pushError).toBe('sidecar unavailable');
      expect(failed?.updatedAt).not.toBe(failed?.createdAt);

      const cleared = await store.updateWorkout(userId, id(1), {
        pushState: 'pushed',
        pushError: null,
        garminWorkoutId: '424242',
        garminScheduleId: '777',
        updatedAt: '2026-08-13T11:00:00.000Z'
      });
      expect(cleared?.pushError).toBeNull();
      expect(cleared?.garminWorkoutId).toBe('424242');
    });

    it('returns the deleted row so the caller can still clean it up upstream', async () => {
      const { store, userId, idPrefix } = await make();
      const id = (n: string | number): string => `${idPrefix}${n}`;
      await store.createWorkout(userId, newWorkout(id(1)));
      await store.updateWorkout(userId, id(1), {
        garminWorkoutId: '424242',
        pushState: 'pushed',
        updatedAt: '2026-08-13T11:00:00.000Z'
      });

      const deleted = await store.deleteWorkout(userId, id(1));

      expect(deleted?.garminWorkoutId).toBe('424242');
      expect(await store.getWorkout(userId, id(1))).toBeNull();
      expect(await store.deleteWorkout(userId, id(1))).toBeNull();
    });

    it('defaults contentPushed to false and round-trips it through a patch (spec 092)', async () => {
      const { store, userId, idPrefix } = await make();
      const id = (n: string | number): string => `${idPrefix}${n}`;
      const created = await store.createWorkout(userId, newWorkout(id(1)));
      expect(created.contentPushed).toBe(false);

      const pushed = await store.updateWorkout(userId, id(1), {
        pushState: 'pushed',
        garminWorkoutId: '424242',
        garminScheduleId: '777',
        contentPushed: true,
        updatedAt: '2026-08-13T10:00:00.000Z'
      });
      expect(pushed?.contentPushed).toBe(true);
      // Round-trips on a plain read too, not just the value handed back by the write itself.
      expect((await store.getWorkout(userId, id(1)))?.contentPushed).toBe(true);

      // A patch that also changes content alongside contentPushed: false persists BOTH — the exact
      // shape `updateWorkout` writes on an edit of an already-pushed row.
      const edited = await store.updateWorkout(userId, id(1), {
        title: 'edytowany tytuł',
        contentPushed: false,
        pushState: 'pending',
        updatedAt: '2026-08-13T11:00:00.000Z'
      });
      expect(edited?.title).toBe('edytowany tytuł');
      expect(edited?.contentPushed).toBe(false);
      // The Garmin ids from the earlier push are untouched by this patch — only content + the flag.
      expect(edited?.garminWorkoutId).toBe('424242');
    });

    it('never leaks across users', async () => {
      const { store, userId, otherUserId, idPrefix } = await make();
      const id = (n: string | number): string => `${idPrefix}${n}`;
      await store.createWorkout(userId, newWorkout(id(1)));

      expect(await store.getWorkout(otherUserId, id(1))).toBeNull();
      expect(await store.listWorkouts(otherUserId)).toEqual([]);
      expect(
        await store.updateWorkout(otherUserId, id(1), { updatedAt: '2026-08-13T11:00:00.000Z' })
      ).toBeNull();
      expect(await store.deleteWorkout(otherUserId, id(1))).toBeNull();
      // …and the owner's row is untouched by all of that.
      expect(await store.getWorkout(userId, id(1))).not.toBeNull();
    });

    it('survives the spec-024 planned-event window replace', async () => {
      const { store, userId, idPrefix } = await make();
      const id = (n: string | number): string => `${idPrefix}${n}`;
      await store.createWorkout(userId, newWorkout(id(1)));
      const garminPlan: PlannedEvent = {
        id: 'g-1',
        day: '2026-08-20',
        time: null,
        kind: 'workout',
        title: 'z Garmina',
        sport: 'running',
        description: null,
        estimatedDurationS: null,
        estimatedDistanceM: null,
        targetLoad: null,
        source: 'garmin'
      };

      // The sync REPLACES the Garmin-owned window wholesale (spec 024). If authored workouts lived in
      // that table, every sync would delete the athlete's own sessions — hence the separate table.
      await store.replacePlannedEvents(userId, '2026-08-01', '2026-08-31', [garminPlan]);
      await store.replacePlannedEvents(userId, '2026-08-01', '2026-08-31', []);

      expect(await store.getWorkout(userId, id(1))).not.toBeNull();
    });
  });
}

workoutContract('memory store', async () => ({
  store: createMemoryStore(),
  userId: 'u1',
  otherUserId: 'u2',
  idPrefix: 'w-'
}));

/** Same suite against Postgres: `TEST_DATABASE_URL=postgres://… pnpm run test`. */
const dsn = process.env.TEST_DATABASE_URL;
if (dsn) {
  const sql = createDb(dsn);
  // Once per worker — see the coverage contract for why re-migrating before every test is a cost.
  const schema = migrate(sql);
  workoutContract('pg store', async () => {
    await schema;
    const suffix = Math.random().toString(36).slice(2);
    const userId = `workout-${suffix}-a`;
    const otherUserId = `workout-${suffix}-b`;
    for (const id of [userId, otherUserId]) {
      await sql`INSERT INTO users (id, google_sub) VALUES (${id}, ${id}) ON CONFLICT DO NOTHING`;
    }
    // Fresh users AND fresh workout ids: `id` is a global primary key, so reusing `w-1` across
    // tests would collide in a database that, unlike the fake, keeps rows between them.
    return { store: createPgStore(sql), userId, otherUserId, idPrefix: `w-${suffix}-` };
  });
} else {
  describe.skip('pg store — authored workout contract (set TEST_DATABASE_URL to run)', () => {
    it('is skipped without a scratch database', () => undefined);
  });
}
