/**
 * Journal CONTRACT (spec 062) — assertions every LocalStore adapter must satisfy identically.
 *
 * The behaviour that earns this file is the UPSERT KEY. `(day, activityId)` identifies an entry with
 * NULL treated as a value, which Postgres only does under `NULLS NOT DISTINCT` — under the default,
 * every day-level check-in would insert another row instead of correcting the one already there, and
 * the fake would never notice because it compares in JavaScript. Run against a real database.
 */
import { describe, it, expect } from 'vitest';
import { createMemoryStore } from './memory';
import { createPgStore } from './pg';
import { createDb, migrate } from '../db';
import type { LocalStore } from './types';

interface Fixture {
  store: LocalStore;
  userId: string;
  otherUserId: string;
  /** `journal_entries.id` is a global primary key — see the block contract for why this matters. */
  idPrefix: string;
}

export function journalContract(name: string, make: () => Promise<Fixture>): void {
  describe(`${name} — journal contract`, () => {
    it('round-trips every field of a day entry', async () => {
      const { store, userId, idPrefix } = await make();

      const entry = await store.putJournalEntry(userId, {
        id: `${idPrefix}1`,
        day: '2026-08-16',
        activityId: null,
        soreness: 6,
        location: 'lewe kolano',
        mood: 4,
        note: 'ciężka noc',
        illness: false,
        injury: true,
        at: '2026-08-16T19:00:00.000Z'
      });

      expect(entry.day).toBe('2026-08-16');
      expect(entry.activityId).toBeNull();
      expect(entry.soreness).toBe(6);
      expect(entry.location).toBe('lewe kolano');
      expect(entry.mood).toBe(4);
      expect(entry.note).toBe('ciężka noc');
      expect(entry.injury).toBe(true);
      expect(entry.illness).toBe(false);
      expect(entry.rpe).toBeNull();

      expect(await store.getJournalEntry(userId, entry.id)).toEqual(entry);
    });

    it('CORRECTS the day entry instead of adding a second one', async () => {
      const { store, userId, idPrefix } = await make();
      const first = await store.putJournalEntry(userId, {
        id: `${idPrefix}1`,
        day: '2026-08-16',
        activityId: null,
        soreness: 6,
        at: '2026-08-16T19:00:00.000Z'
      });
      const second = await store.putJournalEntry(userId, {
        id: `${idPrefix}2`, // a fresh id, which must be IGNORED — the day already has its row
        day: '2026-08-16',
        activityId: null,
        soreness: 3,
        at: '2026-08-16T21:00:00.000Z'
      });

      expect(second.id).toBe(first.id);
      expect(second.soreness).toBe(3);
      expect(await store.listJournalEntries(userId)).toHaveLength(1);
    });

    it('keeps absent fields, clears explicit nulls', async () => {
      const { store, userId, idPrefix } = await make();
      await store.putJournalEntry(userId, {
        id: `${idPrefix}1`,
        day: '2026-08-16',
        activityId: null,
        soreness: 6,
        location: 'lewe kolano',
        note: 'ciężka noc',
        at: '2026-08-16T19:00:00.000Z'
      });

      // Absent `location` and `note` survive a write that only touches soreness.
      const kept = await store.putJournalEntry(userId, {
        id: `${idPrefix}9`,
        day: '2026-08-16',
        activityId: null,
        soreness: 4,
        at: '2026-08-16T21:00:00.000Z'
      });
      expect(kept.soreness).toBe(4);
      expect(kept.location).toBe('lewe kolano');
      expect(kept.note).toBe('ciężka noc');

      // An explicit null is a real clear.
      const cleared = await store.putJournalEntry(userId, {
        id: `${idPrefix}9`,
        day: '2026-08-16',
        activityId: null,
        location: null,
        at: '2026-08-17T07:00:00.000Z'
      });
      expect(cleared.location).toBeNull();
      expect(cleared.soreness).toBe(4);
    });

    it('holds a day entry and a session entry for the same day side by side', async () => {
      const { store, userId, idPrefix } = await make();
      await store.putJournalEntry(userId, {
        id: `${idPrefix}day`,
        day: '2026-08-13',
        activityId: null,
        soreness: 5,
        at: '2026-08-13T20:00:00.000Z'
      });
      await store.putJournalEntry(userId, {
        id: `${idPrefix}s1`,
        day: '2026-08-13',
        activityId: 'act-1',
        rpe: 9,
        at: '2026-08-13T20:01:00.000Z'
      });
      await store.putJournalEntry(userId, {
        id: `${idPrefix}s2`,
        day: '2026-08-13',
        activityId: 'act-2',
        rpe: 4,
        at: '2026-08-13T20:02:00.000Z'
      });

      const entries = await store.listJournalEntries(userId);
      expect(entries).toHaveLength(3);
      // The day-level row sorts first, then the sessions by activity id.
      expect(entries.map((e) => e.activityId)).toEqual([null, 'act-1', 'act-2']);
      expect(entries[1]?.rpe).toBe(9);
    });

    it('reads a range, inclusive at both ends', async () => {
      const { store, userId, idPrefix } = await make();
      for (const day of ['2026-08-10', '2026-08-13', '2026-08-16']) {
        await store.putJournalEntry(userId, {
          id: `${idPrefix}${day}`,
          day,
          activityId: null,
          soreness: 3,
          at: `${day}T20:00:00.000Z`
        });
      }

      const range = await store.listJournalEntries(userId, { from: '2026-08-10', to: '2026-08-13' });
      expect(range.map((e) => e.day)).toEqual(['2026-08-10', '2026-08-13']);
    });

    it('finds the worst recent soreness, ties going to the more recent day', async () => {
      const { store, userId, idPrefix } = await make();
      const days: Array<[string, number]> = [
        ['2026-08-10', 3],
        ['2026-08-12', 7],
        ['2026-08-14', 7],
        ['2026-08-15', 5]
      ];
      for (const [day, soreness] of days) {
        await store.putJournalEntry(userId, {
          id: `${idPrefix}${day}`,
          day,
          activityId: null,
          soreness,
          location: day,
          at: `${day}T20:00:00.000Z`
        });
      }

      const worst = await store.worstSoreness(userId, '2026-08-10', '2026-08-16', 4);
      expect(worst?.soreness).toBe(7);
      expect(worst?.day).toBe('2026-08-14'); // the later of the two sevens
      expect(worst?.location).toBe('2026-08-14');

      // Nothing at or above the threshold is null, not a zero.
      expect(await store.worstSoreness(userId, '2026-08-10', '2026-08-11', 4)).toBeNull();
      // The threshold is inclusive.
      expect((await store.worstSoreness(userId, '2026-08-15', '2026-08-15', 5))?.soreness).toBe(5);
      expect(await store.worstSoreness(userId, '2026-08-15', '2026-08-15', 6)).toBeNull();
    });

    it("keeps one user out of another user's journal entirely", async () => {
      const { store, userId, otherUserId, idPrefix } = await make();
      const mine = await store.putJournalEntry(userId, {
        id: `${idPrefix}1`,
        day: '2026-08-16',
        activityId: null,
        soreness: 8,
        at: '2026-08-16T19:00:00.000Z'
      });

      expect(await store.getJournalEntry(otherUserId, mine.id)).toBeNull();
      expect(await store.listJournalEntries(otherUserId)).toEqual([]);
      expect(await store.worstSoreness(otherUserId, '2026-08-01', '2026-08-31', 4)).toBeNull();
      expect(await store.deleteJournalEntry(otherUserId, mine.id)).toBeNull();
      // …and mine survived all of that.
      expect(await store.getJournalEntry(userId, mine.id)).not.toBeNull();
    });

    it('deletes an entry and reports it, then reports nothing', async () => {
      const { store, userId, idPrefix } = await make();
      const entry = await store.putJournalEntry(userId, {
        id: `${idPrefix}1`,
        day: '2026-08-16',
        activityId: null,
        soreness: 8,
        at: '2026-08-16T19:00:00.000Z'
      });

      expect((await store.deleteJournalEntry(userId, entry.id))?.id).toBe(entry.id);
      expect(await store.deleteJournalEntry(userId, entry.id)).toBeNull();
      expect(await store.listJournalEntries(userId)).toEqual([]);
    });
  });
}

journalContract('memory store', async () => ({
  store: createMemoryStore(),
  userId: 'u1',
  otherUserId: 'u2',
  idPrefix: 'j-'
}));

/** Same suite against Postgres: `TEST_DATABASE_URL=postgres://… pnpm run test`. */
const dsn = process.env.TEST_DATABASE_URL;
if (dsn) {
  const sql = createDb(dsn);
  journalContract('pg store', async () => {
    await migrate(sql);
    const suffix = Math.random().toString(36).slice(2);
    const userId = `journal-${suffix}-a`;
    const otherUserId = `journal-${suffix}-b`;
    for (const id of [userId, otherUserId]) {
      await sql`INSERT INTO users (id, google_sub) VALUES (${id}, ${id}) ON CONFLICT DO NOTHING`;
    }
    return { store: createPgStore(sql), userId, otherUserId, idPrefix: `j-${suffix}-` };
  });
} else {
  describe.skip('pg store — journal contract (set TEST_DATABASE_URL to run)', () => {
    it('is skipped without a scratch database', () => undefined);
  });
}
