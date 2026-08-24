/**
 * Training-block CONTRACT (spec 073) — assertions every LocalStore adapter must satisfy identically.
 *
 * Written against the `LocalStore` PORT like the goal contract next door. Two behaviours are the
 * reason this symmetry is worth a file: the OVERLAP guard, which the fake enforces in JavaScript and
 * production enforces inside a conditional INSERT, and the three-valued week-target patch (absent
 * keeps, null clears, value sets), which is easy to get subtly different in SQL. A drift in either
 * would show up as an athlete's plan quietly reporting the wrong week.
 */
import { describe, it, expect } from 'vitest';
import { createMemoryStore } from './memory';
import { createPgStore } from './pg';
import { createDb, migrate } from '../db';
import { OverlappingBlockError, type LocalStore, type NewTrainingBlock } from './types';

interface Fixture {
  store: LocalStore;
  userId: string;
  otherUserId: string;
  /**
   * Prefix for block ids. `training_blocks.id` is a GLOBAL primary key, so a suite that hard-codes
   * `tb-1` collides with itself from the second test onwards once it runs against a real database
   * that keeps rows between tests. The memory fake is fresh each time and never noticed.
   */
  idPrefix: string;
}

type BlockDraft = Omit<NewTrainingBlock, 'createdAt'>;

function newBlock(id: string, overrides: Partial<BlockDraft> = {}): BlockDraft {
  return {
    id,
    goalId: null,
    name: 'Baza pod 5 km',
    startDay: '2026-08-17',
    weeks: 16,
    paces: { easy: { lowS: 370, highS: 390 }, threshold: { lowS: 255, highS: 265 } },
    constraints: ['4 biegi/tydz', 'brak roweru XII–II'],
    note: null,
    ...overrides
  };
}

export function blockContract(name: string, make: () => Promise<Fixture>): void {
  describe(`${name} — training block contract`, () => {
    it('round-trips every field, including the jsonb ones', async () => {
      const { store, userId, idPrefix } = await make();
      const id = (n: string | number): string => `${idPrefix}${n}`;

      const created = await store.createBlock(userId, {
        ...newBlock(id(1)),
        createdAt: '2026-08-16T09:00:00.000Z'
      });

      expect(created.id).toBe(id(1));
      expect(created.userId).toBe(userId);
      expect(created.name).toBe('Baza pod 5 km');
      expect(created.startDay).toBe('2026-08-17');
      expect(created.weeks).toBe(16);
      expect(created.paces).toEqual({
        easy: { lowS: 370, highS: 390 },
        threshold: { lowS: 255, highS: 265 }
      });
      expect(created.constraints).toEqual(['4 biegi/tydz', 'brak roweru XII–II']);
      expect(created.goalId).toBeNull();

      expect(await store.getBlock(userId, id(1))).toEqual(created);
    });

    it('refuses a block that overlaps an existing one, and names it', async () => {
      const { store, userId, idPrefix } = await make();
      const id = (n: string | number): string => `${idPrefix}${n}`;
      await store.createBlock(userId, { ...newBlock(id(1)), createdAt: '2026-08-16T09:00:00.000Z' });

      // Starts inside the 16 weeks already covered.
      await expect(
        store.createBlock(userId, {
          ...newBlock(id(2), { startDay: '2026-10-05' }),
          createdAt: '2026-08-16T09:00:00.000Z'
        })
      ).rejects.toBeInstanceOf(OverlappingBlockError);

      // The Monday AFTER it ends is fine — adjacency is not overlap.
      const next = await store.createBlock(userId, {
        ...newBlock(id(3), { name: 'Build', startDay: '2026-12-07', weeks: 8 }),
        createdAt: '2026-08-16T09:00:00.000Z'
      });
      expect(next.id).toBe(id(3));
    });

    it('lets two users hold blocks over the same days', async () => {
      const { store, userId, otherUserId, idPrefix } = await make();
      const id = (n: string | number): string => `${idPrefix}${n}`;
      await store.createBlock(userId, { ...newBlock(id(1)), createdAt: '2026-08-16T09:00:00.000Z' });
      const theirs = await store.createBlock(otherUserId, {
        ...newBlock(id('other')),
        createdAt: '2026-08-16T09:00:00.000Z'
      });
      expect(theirs.id).toBe(id('other'));
    });

    it('finds the block covering a day, and nothing outside the span', async () => {
      const { store, userId, idPrefix } = await make();
      const id = (n: string | number): string => `${idPrefix}${n}`;
      await store.createBlock(userId, { ...newBlock(id(1)), createdAt: '2026-08-16T09:00:00.000Z' });

      expect((await store.findBlockForDay(userId, '2026-08-17'))?.id).toBe(id(1));
      expect((await store.findBlockForDay(userId, '2026-09-28'))?.id).toBe(id(1));
      expect((await store.findBlockForDay(userId, '2026-12-06'))?.id).toBe(id(1));
      expect(await store.findBlockForDay(userId, '2026-08-16')).toBeNull();
      expect(await store.findBlockForDay(userId, '2026-12-07')).toBeNull();
    });

    it("keeps one user out of another user's blocks entirely", async () => {
      const { store, userId, otherUserId, idPrefix } = await make();
      const id = (n: string | number): string => `${idPrefix}${n}`;
      await store.createBlock(userId, { ...newBlock(id(1)), createdAt: '2026-08-16T09:00:00.000Z' });

      expect(await store.getBlock(otherUserId, id(1))).toBeNull();
      expect(await store.findBlockForDay(otherUserId, '2026-09-28')).toBeNull();
      expect(await store.listBlocks(otherUserId)).toEqual([]);
      expect(
        await store.updateBlock(otherUserId, id(1), {
          name: 'porwany',
          updatedAt: '2026-09-01T09:00:00.000Z'
        })
      ).toBeNull();
      expect(await store.deleteBlock(otherUserId, id(1))).toBeNull();
      expect(await store.putBlockWeeks(otherUserId, id(1), [{ weekNumber: 1 }])).toBeNull();
      expect(await store.listBlockWeeks(otherUserId, id(1))).toEqual([]);
      // …and the owner's block came through all of that untouched.
      expect((await store.getBlock(userId, id(1)))?.name).toBe('Baza pod 5 km');
    });

    it('applies only the keys present in a patch', async () => {
      const { store, userId, idPrefix } = await make();
      const id = (n: string | number): string => `${idPrefix}${n}`;
      await store.createBlock(userId, { ...newBlock(id(1)), createdAt: '2026-08-16T09:00:00.000Z' });

      const updated = await store.updateBlock(userId, id(1), {
        paces: { easy: { lowS: 360, highS: 380 } },
        updatedAt: '2026-09-01T09:00:00.000Z'
      });

      expect(updated?.paces).toEqual({ easy: { lowS: 360, highS: 380 } });
      // Untouched keys survive.
      expect(updated?.name).toBe('Baza pod 5 km');
      expect(updated?.constraints).toEqual(['4 biegi/tydz', 'brak roweru XII–II']);
      expect(updated?.updatedAt).toBe('2026-09-01T09:00:00.000Z');
    });

    it('rejects a patch that would move a block onto another one', async () => {
      const { store, userId, idPrefix } = await make();
      const id = (n: string | number): string => `${idPrefix}${n}`;
      await store.createBlock(userId, { ...newBlock(id(1)), createdAt: '2026-08-16T09:00:00.000Z' });
      await store.createBlock(userId, {
        ...newBlock(id(2), { name: 'Build', startDay: '2026-12-07', weeks: 8 }),
        createdAt: '2026-08-16T09:00:00.000Z'
      });

      // Lengthening the first block would swallow the Monday the second one starts on.
      await expect(
        store.updateBlock(userId, id(1), { weeks: 20, updatedAt: '2026-09-01T09:00:00.000Z' })
      ).rejects.toBeInstanceOf(OverlappingBlockError);
    });

    it('upserts week targets three-valued: absent keeps, null clears, value sets', async () => {
      const { store, userId, idPrefix } = await make();
      const id = (n: string | number): string => `${idPrefix}${n}`;
      await store.createBlock(userId, { ...newBlock(id(1)), createdAt: '2026-08-16T09:00:00.000Z' });

      await store.putBlockWeeks(userId, id(1), [
        { weekNumber: 7, volumeTargetKm: 34, focus: '2×10 min @ próg' },
        { weekNumber: 8, volumeTargetKm: 28 }
      ]);

      // Absent `focus` must not blank what week 7 already had.
      const afterPartial = await store.putBlockWeeks(userId, id(1), [{ weekNumber: 7, volumeTargetKm: 36 }]);
      const week7 = afterPartial?.find((w) => w.weekNumber === 7);
      expect(week7?.volumeTargetKm).toBe(36);
      expect(week7?.focus).toBe('2×10 min @ próg');

      // An explicit null is a real clear.
      const afterClear = await store.putBlockWeeks(userId, id(1), [{ weekNumber: 7, focus: null }]);
      expect(afterClear?.find((w) => w.weekNumber === 7)?.focus).toBeNull();
      expect(afterClear?.find((w) => w.weekNumber === 7)?.volumeTargetKm).toBe(36);

      // And the list comes back in week order, week 8 untouched throughout.
      const weeks = await store.listBlockWeeks(userId, id(1));
      expect(weeks.map((w) => w.weekNumber)).toEqual([7, 8]);
      expect(weeks[1]?.volumeTargetKm).toBe(28);
    });

    it('ignores week targets outside the block', async () => {
      const { store, userId, idPrefix } = await make();
      const id = (n: string | number): string => `${idPrefix}${n}`;
      await store.createBlock(userId, {
        ...newBlock(id(1), { weeks: 4 }),
        createdAt: '2026-08-16T09:00:00.000Z'
      });

      const written = await store.putBlockWeeks(userId, id(1), [
        { weekNumber: 4, volumeTargetKm: 30 },
        { weekNumber: 9, volumeTargetKm: 99 }
      ]);
      expect(written?.map((w) => w.weekNumber)).toEqual([4]);
    });

    it('drops the week targets a shrink removes', async () => {
      const { store, userId, idPrefix } = await make();
      const id = (n: string | number): string => `${idPrefix}${n}`;
      await store.createBlock(userId, { ...newBlock(id(1)), createdAt: '2026-08-16T09:00:00.000Z' });
      await store.putBlockWeeks(userId, id(1), [
        { weekNumber: 3, volumeTargetKm: 30 },
        { weekNumber: 12, volumeTargetKm: 40 }
      ]);

      await store.updateBlock(userId, id(1), { weeks: 8, updatedAt: '2026-09-01T09:00:00.000Z' });

      // Week 12 is gone rather than lying in wait for the block to be lengthened again.
      expect((await store.listBlockWeeks(userId, id(1))).map((w) => w.weekNumber)).toEqual([3]);
    });

    it('deletes the block and its week targets together', async () => {
      const { store, userId, idPrefix } = await make();
      const id = (n: string | number): string => `${idPrefix}${n}`;
      await store.createBlock(userId, { ...newBlock(id(1)), createdAt: '2026-08-16T09:00:00.000Z' });
      await store.putBlockWeeks(userId, id(1), [{ weekNumber: 1, volumeTargetKm: 25 }]);

      const deleted = await store.deleteBlock(userId, id(1));
      expect(deleted?.id).toBe(id(1));
      expect(await store.getBlock(userId, id(1))).toBeNull();
      expect(await store.listBlockWeeks(userId, id(1))).toEqual([]);
      // The span is free again.
      expect(await store.findBlockForDay(userId, '2026-09-28')).toBeNull();
    });

    it('lists blocks by start day and filters by goal', async () => {
      const { store, userId, idPrefix } = await make();
      const id = (n: string | number): string => `${idPrefix}${n}`;
      await store.createBlock(userId, {
        ...newBlock(id('later'), { startDay: '2026-12-07', weeks: 8 }),
        createdAt: '2026-08-16T09:00:00.000Z'
      });
      await store.createBlock(userId, { ...newBlock(id(1)), createdAt: '2026-08-16T09:00:00.000Z' });

      expect((await store.listBlocks(userId)).map((b) => b.id)).toEqual([id(1), id('later')]);
      expect(await store.listBlocks(userId, { goalId: 'nope' })).toEqual([]);
    });
  });
}

blockContract('memory store', async () => ({
  store: createMemoryStore(),
  userId: 'u1',
  otherUserId: 'u2',
  idPrefix: 'tb-'
}));

/** Same suite against Postgres: `TEST_DATABASE_URL=postgres://… pnpm run test`. */
const dsn = process.env.TEST_DATABASE_URL;
if (dsn) {
  const sql = createDb(dsn);
  // Once per worker — see the coverage contract for why re-migrating before every test is a cost.
  const schema = migrate(sql);
  blockContract('pg store', async () => {
    await schema;
    const suffix = Math.random().toString(36).slice(2);
    const userId = `block-${suffix}-a`;
    const otherUserId = `block-${suffix}-b`;
    for (const id of [userId, otherUserId]) {
      await sql`INSERT INTO users (id, google_sub) VALUES (${id}, ${id}) ON CONFLICT DO NOTHING`;
    }
    // Fresh users AND fresh block ids: the id is a global primary key, so reusing `tb-1` across
    // tests would collide in a database that, unlike the fake, keeps rows between them.
    return { store: createPgStore(sql), userId, otherUserId, idPrefix: `tb-${suffix}-` };
  });
} else {
  describe.skip('pg store — training block contract (set TEST_DATABASE_URL to run)', () => {
    it('is skipped without a scratch database', () => undefined);
  });
}
