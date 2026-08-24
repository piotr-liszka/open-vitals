/**
 * Journal handler integration (spec 062) — the module's `*.api.ts` against mock adapters.
 */
import { describe, it, expect } from 'vitest';
import { createMemoryStore } from '$lib/server/store/memory';
import { fixedClock } from '$lib/server/clock';
import { sequenceRandom } from '$lib/server/random';
import type { ActivitySummary, LocalStore } from '$lib/server/store/types';
import { loadJournal, logEntry, recentSoreness, removeEntry, type JournalDeps } from './journal.api';

const USER = 'u1';
const TODAY = '2026-08-16';
const clock = fixedClock(new Date(`${TODAY}T18:00:00.000Z`));

function deps(store: LocalStore = createMemoryStore()): JournalDeps {
  return { store, clock, random: sequenceRandom('j'), timeZone: 'Europe/Warsaw' };
}

function act(id: string, day: string): ActivitySummary {
  return {
    userId: USER,
    activityId: id,
    sport: 'running',
    name: 'VO2 Max',
    startTime: `${day}T09:00:00Z`,
    startTimeLocal: `${day} 09:00:00`,
    distanceM: 7270,
    durationS: 2480,
    movingS: 2480,
    elevationGainM: null,
    avgHr: 144,
    maxHr: 170,
    avgPower: null,
    maxPower: null,
    normPower: null,
    calories: null,
    trainingLoad: 60,
    hasGps: false,
    raw: {}
  };
}

describe('logEntry', () => {
  it('records a day entry and says which fields it touched', async () => {
    const d = deps();
    const result = await logEntry(d, USER, { date: TODAY, soreness: 6, location: 'lewe kolano' });

    expect(result).toMatchObject({ ok: true });
    if (!result.ok) return;
    expect(result.entry.soreness).toBe(6);
    expect(result.entry.activityId).toBeNull();
    expect(result.fields).toEqual(['soreness', 'location']);
  });

  it('records a session RPE against a real activity of that day', async () => {
    const store = createMemoryStore();
    await store.putActivities(USER, [act('a1', TODAY)]);
    const d = deps(store);

    const result = await logEntry(d, USER, { date: TODAY, rpe: 9, activityId: 'a1' });
    expect(result).toMatchObject({ ok: true });
    if (!result.ok) return;
    expect(result.entry.rpe).toBe(9);
    expect(result.entry.activityId).toBe('a1');
  });

  it("refuses an activity that is not this athlete's", async () => {
    const d = deps();
    const result = await logEntry(d, USER, { date: TODAY, rpe: 9, activityId: 'nie-ma' });
    expect(result).toMatchObject({ ok: false, status: 400 });
  });

  it('refuses an activity from a different day, and says which day it is from', async () => {
    const store = createMemoryStore();
    await store.putActivities(USER, [act('a1', '2026-08-13')]);
    const d = deps(store);

    const result = await logEntry(d, USER, { date: TODAY, rpe: 9, activityId: 'a1' });
    expect(result).toMatchObject({ ok: false, status: 400 });
    if (result.ok) return;
    expect(result.error).toContain('2026-08-13');
  });

  it('corrects a day rather than adding a second entry', async () => {
    const d = deps();
    await logEntry(d, USER, { date: TODAY, soreness: 6, note: 'ciężka noc' });
    await logEntry(d, USER, { date: TODAY, soreness: 3 });

    const data = await loadJournal(d, USER);
    expect(data.entries).toHaveLength(1);
    expect(data.entries[0]?.soreness).toBe(3);
    // The untouched note survived.
    expect(data.entries[0]?.note).toBe('ciężka noc');
  });

  it('surfaces the validator message unchanged', async () => {
    const d = deps();
    const result = await logEntry(d, USER, { date: TODAY, rpe: 11 });
    expect(result).toMatchObject({ ok: false, status: 400 });
    if (result.ok) return;
    expect(result.error).toContain('1–10');
  });
});

describe('loadJournal', () => {
  it('defaults to the last four weeks and reports the range it used', async () => {
    const d = deps();
    const data = await loadJournal(d, USER);
    expect(data.today).toBe(TODAY);
    expect(data.to).toBe(TODAY);
    expect(data.from).toBe('2026-07-20');
    expect(data.entries).toEqual([]);
    expect(data.soreness).toBeNull();
  });

  it('honours an explicit range', async () => {
    const d = deps();
    await logEntry(d, USER, { date: '2026-08-10', soreness: 5 });
    await logEntry(d, USER, { date: '2026-08-14', soreness: 5 });

    const data = await loadJournal(d, USER, { from: '2026-08-12', to: '2026-08-16' });
    expect(data.entries.map((e) => e.day)).toEqual(['2026-08-14']);
  });
});

describe('recentSoreness', () => {
  it('reports nothing when nothing is at the threshold', async () => {
    const d = deps();
    await logEntry(d, USER, { date: TODAY, soreness: 3 });
    expect(await recentSoreness(d, USER)).toBeNull();
  });

  it('reports the worst score at or above the threshold, with where and when', async () => {
    const d = deps();
    await logEntry(d, USER, { date: '2026-08-14', soreness: 7, location: 'lewe kolano' });
    await logEntry(d, USER, { date: TODAY, soreness: 4 });

    const signal = await recentSoreness(d, USER);
    expect(signal).toEqual({ day: '2026-08-14', soreness: 7, location: 'lewe kolano' });
  });

  it('looks back exactly seven days, today included', async () => {
    const d = deps();
    // 2026-08-10 is the seventh day back from the 16th; the 9th is the eighth and out of range.
    await logEntry(d, USER, { date: '2026-08-09', soreness: 9 });
    expect(await recentSoreness(d, USER)).toBeNull();

    await logEntry(d, USER, { date: '2026-08-10', soreness: 8 });
    expect((await recentSoreness(d, USER))?.day).toBe('2026-08-10');
  });
});

describe('removeEntry', () => {
  it('deletes an entry, then 404s', async () => {
    const d = deps();
    const created = await logEntry(d, USER, { date: TODAY, soreness: 6 });
    if (!created.ok) throw new Error('setup failed');

    expect(await removeEntry(d, USER, created.entry.id)).toMatchObject({ ok: true });
    expect(await removeEntry(d, USER, created.entry.id)).toMatchObject({ ok: false, status: 404 });
  });
});
