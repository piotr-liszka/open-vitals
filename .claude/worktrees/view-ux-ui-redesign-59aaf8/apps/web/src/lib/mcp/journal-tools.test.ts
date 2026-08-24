/**
 * Journal MCP tools (spec 062) — invoked with a mock store, asserting the shape a model reads.
 */
import { describe, it, expect } from 'vitest';
import { createMemoryStore } from '$lib/server/store/memory';
import { fixedClock } from '$lib/server/clock';
import { sequenceRandom } from '$lib/server/random';
import type { ActivitySummary, LocalStore } from '$lib/server/store/types';
import { JOURNAL_TOOLS, type JournalTool, type JournalToolDeps } from './journal-tools';

const USER = 'u1';
const TODAY = '2026-08-16';
const clock = fixedClock(new Date(`${TODAY}T18:00:00.000Z`));

function deps(store: LocalStore = createMemoryStore()): JournalToolDeps {
  return { store, userId: USER, clock, random: sequenceRandom('j'), timeZone: 'Europe/Warsaw' };
}

const tool = (name: string): JournalTool => {
  const found = JOURNAL_TOOLS.find((t) => t.name === name);
  if (!found) throw new Error(`no tool ${name}`);
  return found;
};

function payload(result: { content: Array<{ text: string }> }): Record<string, unknown> {
  return JSON.parse(result.content[0]!.text);
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

describe('the tool surface', () => {
  it('exposes the two tools the coach asked for', () => {
    expect(JOURNAL_TOOLS.map((t) => t.name)).toEqual(['log_note', 'get_notes']);
  });
});

describe('log_note', () => {
  it('records a day entry and names the fields it wrote', async () => {
    const body = payload(
      await tool('log_note').handler(deps(), { date: TODAY, soreness: 6, location: 'lewe kolano' })
    );
    expect(body.written).toMatchObject({ day: TODAY, scope: 'day', soreness: 6, location: 'lewe kolano' });
    expect(body.fieldsTouched).toEqual(['soreness', 'location']);
  });

  it('records a session RPE as a session-scoped entry', async () => {
    const store = createMemoryStore();
    await store.putActivities(USER, [act('a1', TODAY)]);

    const body = payload(
      await tool('log_note').handler(deps(store), { date: TODAY, rpe: 9, activityId: 'a1' })
    );
    expect(body.written).toMatchObject({ scope: 'session', activityId: 'a1', rpe: 9 });
  });

  it('omits empty fields rather than reporting them as null', async () => {
    // A model reading `mood: null` treats it as a measured zero often enough to matter.
    const body = payload(await tool('log_note').handler(deps(), { date: TODAY, soreness: 6 }));
    expect(Object.keys(body.written as object)).not.toContain('mood');
    expect(Object.keys(body.written as object)).not.toContain('rpe');
  });

  it('rejects a score outside the scale, with the scale in the message', async () => {
    const result = await tool('log_note').handler(deps(), { date: TODAY, rpe: 11 });
    expect(result.isError).toBe(true);
    expect(result.content[0]!.text).toContain('1–10');
  });

  it('rejects a future day', async () => {
    const result = await tool('log_note').handler(deps(), { date: '2026-08-20', soreness: 5 });
    expect(result.isError).toBe(true);
  });
});

describe('get_notes', () => {
  it('says plainly that nothing was logged instead of implying it was fine', async () => {
    const body = payload(await tool('get_notes').handler(deps(), {}));
    expect(body.count).toBe(0);
    expect(String(body.message)).toContain('Nothing logged');
  });

  it('returns entries and flags soreness worth acting on', async () => {
    const d = deps();
    await tool('log_note').handler(d, { date: '2026-08-14', soreness: 7, location: 'lewe kolano' });
    await tool('log_note').handler(d, { date: TODAY, mood: 8 });

    const body = payload(await tool('get_notes').handler(d, {}));
    expect(body.count).toBe(2);
    expect(body.soreness).toEqual({ day: '2026-08-14', soreness: 7, location: 'lewe kolano' });
  });

  it('leaves the soreness flag out when nothing reaches the threshold', async () => {
    const d = deps();
    await tool('log_note').handler(d, { date: TODAY, soreness: 3 });
    const body = payload(await tool('get_notes').handler(d, {}));
    expect('soreness' in body).toBe(false);
  });

  it('honours an explicit span', async () => {
    const d = deps();
    await tool('log_note').handler(d, { date: '2026-08-10', mood: 5 });
    await tool('log_note').handler(d, { date: '2026-08-15', mood: 5 });

    const body = payload(await tool('get_notes').handler(d, { start: '2026-08-12', end: '2026-08-16' }));
    expect(body.count).toBe(1);
  });
});
