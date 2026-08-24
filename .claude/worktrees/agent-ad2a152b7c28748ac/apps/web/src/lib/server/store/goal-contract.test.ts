/**
 * Season-goal CONTRACT (spec 060) — assertions every LocalStore adapter must satisfy identically.
 *
 * Written against the `LocalStore` PORT like the workout contract next door: it runs for the
 * in-memory fake by default and, with `TEST_DATABASE_URL` pointed at a scratch Postgres, against the
 * pg adapter too. The duplicate-import guard is the reason this symmetry matters — the fake enforces
 * it in JavaScript and production enforces it with a partial unique index, and a drift between the
 * two would only ever show up as a doubled race on somebody's season.
 */
import { describe, it, expect } from 'vitest';
import { createMemoryStore } from './memory';
import { createPgStore } from './pg';
import { createDb, migrate } from '../db';
import { DuplicateGoalError, type LocalStore, type NewSeasonGoal, type PlannedEvent } from './types';

interface Fixture {
  store: LocalStore;
  userId: string;
  otherUserId: string;
  /**
   * Prefix for goal ids AND for the synced-event ids they adopt. Both are unique across the whole
   * table, so a suite that hard-codes `g-1` collides with itself from the second test onwards once
   * it runs against a real database, which keeps rows between tests where the fake does not.
   */
  idPrefix: string;
}

type GoalDraft = Omit<NewSeasonGoal, 'createdAt'>;

/** Every field but `createdAt`, which each test stamps so the timestamps stay explicit. */
function newGoal(id: string, overrides: Partial<GoalDraft> = {}): GoalDraft {
  return {
    id,
    day: '2026-10-11',
    sport: 'run',
    title: 'Półmaraton Warszawski',
    kind: 'race',
    priority: 'a',
    distanceM: 21_097.5,
    targetTimeS: 5400,
    targetCtl: 70,
    note: null,
    source: 'manual',
    garminEventId: null,
    ...overrides
  };
}

export function goalContract(name: string, make: () => Promise<Fixture>): void {
  describe(`${name} — season goal contract`, () => {
    it('round-trips every target field', async () => {
      const { store, userId, idPrefix } = await make();
      const id = (n: string | number): string => `${idPrefix}${n}`;

      const created = await store.createGoal(userId, {
        ...newGoal(id(1)),
        createdAt: '2026-08-15T09:00:00.000Z'
      });

      expect(created.id).toBe(id(1));
      expect(created.userId).toBe(userId);
      expect(created.updatedAt).toBe(created.createdAt);

      const read = await store.getGoal(userId, id(1));
      expect(read?.title).toBe('Półmaraton Warszawski');
      expect(read?.sport).toBe('run');
      expect(read?.kind).toBe('race');
      expect(read?.priority).toBe('a');
      expect(read?.distanceM).toBeCloseTo(21_097.5, 1);
      expect(read?.targetTimeS).toBe(5400);
      expect(read?.targetCtl).toBe(70);
      expect(read?.source).toBe('manual');
      expect(read?.garminEventId).toBeNull();
    });

    it('stores a fitness goal that has no distance and no wanted time', async () => {
      const { store, userId, idPrefix } = await make();
      const id = (n: string | number): string => `${idPrefix}${n}`;

      const created = await store.createGoal(userId, {
        ...newGoal(id(1), {
          kind: 'fitness',
          title: 'Forma na sezon',
          distanceM: null,
          targetTimeS: null,
          targetCtl: 85
        }),
        createdAt: '2026-08-15T09:00:00.000Z'
      });

      expect(created.kind).toBe('fitness');
      expect(created.distanceM).toBeNull();
      expect(created.targetTimeS).toBeNull();
      expect(created.targetCtl).toBe(85);
    });

    it('lists by day ascending, filtered by window and sport', async () => {
      const { store, userId, idPrefix } = await make();
      const id = (n: string | number): string => `${idPrefix}${n}`;
      const at = '2026-08-15T09:00:00.000Z';
      // Ids sort alphabetically within a day, so they stay a/b/c under the prefix.
      await store.createGoal(userId, { ...newGoal(id('b'), { day: '2026-10-11' }), createdAt: at });
      await store.createGoal(userId, { ...newGoal(id('a'), { day: '2026-06-01' }), createdAt: at });
      await store.createGoal(userId, {
        ...newGoal(id('c'), { day: '2027-04-01', sport: 'ride' }),
        createdAt: at
      });

      expect((await store.listGoals(userId)).map((g) => g.id)).toEqual([id('a'), id('b'), id('c')]);
      expect(
        (await store.listGoals(userId, { from: '2026-07-01', to: '2026-12-31' })).map((g) => g.id)
      ).toEqual([id('b')]);
      expect((await store.listGoals(userId, { sport: 'ride' })).map((g) => g.id)).toEqual([id('c')]);
      expect((await store.listGoals(userId, { limit: 2 })).map((g) => g.id)).toEqual([id('a'), id('b')]);
    });

    it('patches only the keys present, and can clear a target back to null', async () => {
      const { store, userId, idPrefix } = await make();
      const id = (n: string | number): string => `${idPrefix}${n}`;
      await store.createGoal(userId, { ...newGoal(id(1)), createdAt: '2026-08-15T09:00:00.000Z' });

      const moved = await store.updateGoal(userId, id(1), {
        day: '2026-10-18',
        updatedAt: '2026-08-16T09:00:00.000Z'
      });
      // Moving the date must not touch the targets.
      expect(moved?.day).toBe('2026-10-18');
      expect(moved?.title).toBe('Półmaraton Warszawski');
      expect(moved?.targetCtl).toBe(70);
      expect(moved?.updatedAt).not.toBe(moved?.createdAt);

      const cleared = await store.updateGoal(userId, id(1), {
        targetTimeS: null,
        targetCtl: null,
        updatedAt: '2026-08-17T09:00:00.000Z'
      });
      expect(cleared?.targetTimeS).toBeNull();
      expect(cleared?.targetCtl).toBeNull();
      expect(cleared?.distanceM).toBeCloseTo(21_097.5, 1);
    });

    it('returns the deleted row, and deleting twice is not an error', async () => {
      const { store, userId, idPrefix } = await make();
      const id = (n: string | number): string => `${idPrefix}${n}`;
      await store.createGoal(userId, { ...newGoal(id(1)), createdAt: '2026-08-15T09:00:00.000Z' });

      const deleted = await store.deleteGoal(userId, id(1));

      expect(deleted?.title).toBe('Półmaraton Warszawski');
      expect(await store.getGoal(userId, id(1))).toBeNull();
      expect(await store.deleteGoal(userId, id(1))).toBeNull();
    });

    it('refuses to adopt the same synced race twice', async () => {
      const { store, userId, idPrefix } = await make();
      const id = (n: string | number): string => `${idPrefix}${n}`;
      const at = '2026-08-15T09:00:00.000Z';
      await store.createGoal(userId, {
        ...newGoal(id(1), { source: 'garmin', garminEventId: id('ev9') }),
        createdAt: at
      });

      await expect(
        store.createGoal(userId, {
          ...newGoal(id(2), { source: 'garmin', garminEventId: id('ev9') }),
          createdAt: at
        })
      ).rejects.toBeInstanceOf(DuplicateGoalError);

      expect((await store.listGoals(userId)).map((g) => g.id)).toEqual([id(1)]);
    });

    it('lets two users adopt the same planned-event id independently', async () => {
      const { store, userId, otherUserId, idPrefix } = await make();
      const id = (n: string | number): string => `${idPrefix}${n}`;
      const at = '2026-08-15T09:00:00.000Z';
      const imported = newGoal(id(1), { source: 'garmin', garminEventId: id('ev9') });

      await store.createGoal(userId, { ...imported, createdAt: at });
      await store.createGoal(otherUserId, { ...imported, id: id(2), createdAt: at });

      expect(await store.getGoal(userId, id(1))).not.toBeNull();
      expect(await store.getGoal(otherUserId, id(2))).not.toBeNull();
    });

    it('lets the same race be re-adopted after the goal is deleted', async () => {
      const { store, userId, idPrefix } = await make();
      const id = (n: string | number): string => `${idPrefix}${n}`;
      const at = '2026-08-15T09:00:00.000Z';
      const imported = newGoal(id(1), { source: 'garmin', garminEventId: id('ev9') });

      await store.createGoal(userId, { ...imported, createdAt: at });
      await store.deleteGoal(userId, id(1));
      const again = await store.createGoal(userId, { ...imported, id: id(2), createdAt: at });

      expect(again.garminEventId).toBe(id('ev9'));
    });

    it('never leaks across users', async () => {
      const { store, userId, otherUserId, idPrefix } = await make();
      const id = (n: string | number): string => `${idPrefix}${n}`;
      await store.createGoal(userId, { ...newGoal(id(1)), createdAt: '2026-08-15T09:00:00.000Z' });

      expect(await store.getGoal(otherUserId, id(1))).toBeNull();
      expect(await store.listGoals(otherUserId)).toEqual([]);
      expect(
        await store.updateGoal(otherUserId, id(1), { updatedAt: '2026-08-16T09:00:00.000Z' })
      ).toBeNull();
      expect(await store.deleteGoal(otherUserId, id(1))).toBeNull();
      // …and the owner's row is untouched by all of that.
      expect(await store.getGoal(userId, id(1))).not.toBeNull();
    });

    it('survives the spec-024 planned-event window replace', async () => {
      const { store, userId, idPrefix } = await make();
      const id = (n: string | number): string => `${idPrefix}${n}`;
      await store.createGoal(userId, {
        ...newGoal(id(1), { source: 'garmin', garminEventId: id('ev9') }),
        createdAt: '2026-08-15T09:00:00.000Z'
      });
      const race: PlannedEvent = {
        id: id('ev9'),
        day: '2026-10-11',
        time: null,
        kind: 'race',
        title: 'Półmaraton Warszawski',
        sport: 'running',
        description: null,
        estimatedDurationS: null,
        estimatedDistanceM: null,
        targetLoad: null,
        source: 'garmin'
      };

      // Once imported the goal is OURS: the sync replacing (and here emptying) the Garmin-owned
      // window must not take the athlete's season with it.
      await store.replacePlannedEvents(userId, '2026-10-01', '2026-10-31', [race]);
      await store.replacePlannedEvents(userId, '2026-10-01', '2026-10-31', []);

      expect(await store.getGoal(userId, id(1))).not.toBeNull();
    });
  });
}

goalContract('memory store', async () => ({
  store: createMemoryStore(),
  userId: 'u1',
  otherUserId: 'u2',
  idPrefix: 'g-'
}));

/** Same suite against Postgres: `TEST_DATABASE_URL=postgres://… pnpm run test`. */
const dsn = process.env.TEST_DATABASE_URL;
if (dsn) {
  const sql = createDb(dsn);
  // Once per worker — see the coverage contract for why re-migrating before every test is a cost.
  const schema = migrate(sql);
  goalContract('pg store', async () => {
    await schema;
    const suffix = Math.random().toString(36).slice(2);
    const userId = `goal-${suffix}-a`;
    const otherUserId = `goal-${suffix}-b`;
    for (const id of [userId, otherUserId]) {
      await sql`INSERT INTO users (id, google_sub) VALUES (${id}, ${id}) ON CONFLICT DO NOTHING`;
    }
    // Fresh users AND fresh goal ids: `id` is a global primary key, so reusing `g-1` across tests
    // would collide in a database that, unlike the fake, keeps rows between them.
    return { store: createPgStore(sql), userId, otherUserId, idPrefix: `g-${suffix}-` };
  });
} else {
  describe.skip('pg store — season goal contract (set TEST_DATABASE_URL to run)', () => {
    it('is skipped without a scratch database', () => undefined);
  });
}
