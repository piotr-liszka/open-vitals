/**
 * Training-block handler integration (spec 073) — the module's `*.api.ts` against mock adapters.
 */
import { describe, it, expect } from 'vitest';
import { createMemoryStore } from '$lib/server/store/memory';
import { fixedClock } from '$lib/server/clock';
import { sequenceRandom } from '$lib/server/random';
import type { ActivitySummary, LocalStore } from '$lib/server/store/types';
import {
  createBlock,
  listBlockSummaries,
  loadCurrentWeek,
  patchBlock,
  removeBlock,
  type BlockDeps
} from './block.api';

const USER = 'u1';
/** Wednesday of week 5 of a block starting 2026-08-17. */
const TODAY = '2026-09-16';
const clock = fixedClock(new Date(`${TODAY}T08:00:00.000Z`));

function deps(store: LocalStore = createMemoryStore()): BlockDeps {
  return { store, clock, random: sequenceRandom('tb'), timeZone: 'Europe/Warsaw' };
}

function act(id: string, day: string, distanceM: number): ActivitySummary {
  return {
    userId: USER,
    activityId: id,
    sport: 'running',
    name: null,
    startTime: `${day}T09:00:00Z`,
    startTimeLocal: `${day} 09:00:00`,
    distanceM,
    durationS: 3000,
    movingS: 3000,
    elevationGainM: null,
    avgHr: 150,
    maxHr: 170,
    avgPower: null,
    maxPower: null,
    normPower: null,
    calories: null,
    trainingLoad: 60,
    hasGps: false,
    garminWorkoutId: null,
    raw: {}
  };
}

/** A live block: 16 weeks from Monday 2026-08-17, so `TODAY` is week 5. */
async function liveBlock(d: BlockDeps, over: Record<string, unknown> = {}) {
  const result = await createBlock(d, USER, {
    name: 'Baza pod 5 km',
    startDate: '2026-08-17',
    weeks: 16,
    paces: { easy: { lowS: 370, highS: 390 } },
    constraints: ['4 biegi/tydz', 'brak roweru XII–II'],
    ...over
  });
  if (!result.ok) throw new Error(result.error);
  return result.block;
}

describe('loadCurrentWeek', () => {
  it('says there is no block rather than guessing one', async () => {
    const data = await loadCurrentWeek(deps(), USER);
    expect(data.today).toBe(TODAY);
    expect(data.block).toBeNull();
    expect(data.week).toBeNull();
  });

  it('resolves today to the right week of the block', async () => {
    const d = deps();
    await liveBlock(d);

    const data = await loadCurrentWeek(d, USER);
    expect(data.week?.weekNumber).toBe(5);
    expect(data.week?.weeks).toBe(16);
    expect(data.week?.weekStart).toBe('2026-09-14');
    expect(data.week?.weekEnd).toBe('2026-09-20');
    expect(data.week?.position).toBe('live');
    expect(data.week?.constraints).toEqual(['4 biegi/tydz', 'brak roweru XII–II']);
    expect(data.week?.paces.easy).toEqual({ lowS: 370, highS: 390 });
  });

  it('does not report a block that has ended as the current one', async () => {
    const d = deps();
    // Four weeks last spring: over long before TODAY.
    await liveBlock(d, { startDate: '2026-03-02', weeks: 4 });
    const data = await loadCurrentWeek(d, USER);
    expect(data.block).toBeNull();
  });

  it("sums the week's actual volume from synced activities, and only that week", async () => {
    const store = createMemoryStore();
    const d = deps(store);
    await liveBlock(d);
    await store.putActivities(USER, [
      act('a1', '2026-09-14', 10_000), // Monday, inside
      act('a2', '2026-09-20', 5_500), // Sunday, inside
      act('a3', '2026-09-13', 20_000), // the Sunday before — outside
      act('a4', '2026-09-21', 20_000) // the Monday after — outside
    ]);

    const data = await loadCurrentWeek(d, USER);
    expect(data.week?.volumeActualKm).toBe(15.5);
  });

  it("lists the week's authored sessions with their push state", async () => {
    const store = createMemoryStore();
    const d = deps(store);
    await liveBlock(d);
    await store.createWorkout(USER, {
      id: 'w1',
      day: '2026-09-17',
      time: null,
      sport: 'running',
      title: 'Próg 2×10 min',
      steps: [
        {
          kind: 'work',
          durationType: 'time',
          durationValue: 600,
          target: null,
          repeats: null,
          steps: null,
          note: null
        }
      ],
      note: null,
      createdAt: '2026-09-10T09:00:00.000Z'
    });
    await store.createWorkout(USER, {
      id: 'w2',
      day: '2026-09-28', // week 7 — must not appear in week 5
      time: null,
      sport: 'running',
      title: 'Interwały',
      steps: [
        {
          kind: 'work',
          durationType: 'time',
          durationValue: 600,
          target: null,
          repeats: null,
          steps: null,
          note: null
        }
      ],
      note: null,
      createdAt: '2026-09-10T09:00:00.000Z'
    });

    const data = await loadCurrentWeek(d, USER);
    expect(data.week?.sessions.map((s) => s.title)).toEqual(['Próg 2×10 min']);
    expect(data.week?.sessions[0]?.pushState).toBe('pending');
    expect(data.week?.sessions[0]?.sportLabel).toBe('Bieg');
  });

  it('returns the week target and focus once they are set', async () => {
    const d = deps();
    const block = await liveBlock(d);
    await patchBlock(d, USER, block.id, {
      weekTargets: [{ weekNumber: 5, volumeTargetKm: 34, focus: '2×10 min @ próg' }]
    });

    const data = await loadCurrentWeek(d, USER);
    expect(data.week?.volumeTargetKm).toBe(34);
    expect(data.week?.focus).toBe('2×10 min @ próg');
  });

  it('derives the phase from the goal countdown, measured to the end of the week', async () => {
    const store = createMemoryStore();
    const d = deps(store);
    const goal = await store.createGoal(USER, {
      id: 'g1',
      day: '2026-09-27', // the Sunday after this week — a race week away
      sport: 'run',
      title: 'Bieg 5 km',
      kind: 'race',
      priority: 'a',
      distanceM: 5000,
      targetTimeS: 1200,
      targetCtl: null,
      note: null,
      source: 'manual',
      garminEventId: null,
      createdAt: '2026-08-01T09:00:00.000Z'
    });
    const block = await liveBlock(d, { goalId: goal.id });

    const data = await loadCurrentWeek(d, USER);
    expect(data.week?.phaseDerived).toBe(true);
    expect(data.week?.goal?.daysOut).toBe(11);
    // A per-week override wins over the countdown, and says so.
    await patchBlock(d, USER, block.id, { weekTargets: [{ weekNumber: 5, phase: 'peak' }] });
    const after = await loadCurrentWeek(d, USER);
    expect(after.week?.phase).toBe('peak');
    expect(after.week?.phaseDerived).toBe(false);
  });
});

describe('createBlock', () => {
  it('rejects an overlapping block and names the one in the way', async () => {
    const d = deps();
    await liveBlock(d);
    const result = await createBlock(d, USER, {
      name: 'Drugi',
      startDate: '2026-10-05',
      weeks: 4
    });
    expect(result).toMatchObject({ ok: false, status: 400 });
    if (result.ok) return;
    expect(result.error).toContain('Baza pod 5 km');
  });

  it("rejects a goal id that is not this user's", async () => {
    const d = deps();
    const result = await createBlock(d, USER, {
      name: 'Blok',
      startDate: '2026-08-17',
      weeks: 4,
      goalId: 'nie-ma-takiego'
    });
    expect(result).toMatchObject({ ok: false, status: 400 });
  });

  it('surfaces the validator message unchanged', async () => {
    const d = deps();
    const result = await createBlock(d, USER, { name: '', startDate: '2026-08-17', weeks: 4 });
    expect(result).toMatchObject({ ok: false, status: 400 });
    if (result.ok) return;
    expect(result.error).toBe('nazwa bloku jest wymagana');
  });
});

describe('patchBlock', () => {
  it("404s on a block that is not this user's", async () => {
    const d = deps();
    await liveBlock(d);
    const result = await patchBlock(d, 'someone-else', 'tb_aaa', { name: 'x' });
    expect(result).toMatchObject({ ok: false, status: 404 });
  });

  it('updates fields and week targets in one call', async () => {
    const d = deps();
    const block = await liveBlock(d);
    const result = await patchBlock(d, USER, block.id, {
      paces: { threshold: { lowS: 255, highS: 265 } },
      weekTargets: [{ weekNumber: 1, volumeTargetKm: 28 }]
    });

    expect(result).toMatchObject({ ok: true });
    if (!result.ok) return;
    expect(result.block.paces.threshold).toEqual({ lowS: 255, highS: 265 });
    expect(result.weekTargets).toHaveLength(1);
    expect(result.weekTargets[0]?.volumeTargetKm).toBe(28);
  });

  it('refuses a move that would collide with another block', async () => {
    const d = deps();
    const first = await liveBlock(d);
    await createBlock(d, USER, { name: 'Build', startDate: '2026-12-07', weeks: 8 });

    const result = await patchBlock(d, USER, first.id, { weeks: 20 });
    expect(result).toMatchObject({ ok: false, status: 400 });
    if (result.ok) return;
    expect(result.error).toContain('Build');
  });
});

describe('listBlockSummaries', () => {
  it('reports the span and which week today falls in', async () => {
    const d = deps();
    await liveBlock(d);
    await createBlock(d, USER, { name: 'Build', startDate: '2026-12-07', weeks: 8 });

    const data = await listBlockSummaries(d, USER);
    expect(data.blocks.map((b) => b.block.name)).toEqual(['Baza pod 5 km', 'Build']);
    expect(data.blocks[0]).toMatchObject({ endDay: '2026-12-06', position: 'live', currentWeek: 5 });
    expect(data.blocks[1]).toMatchObject({ position: 'before', currentWeek: null });
  });
});

describe('removeBlock', () => {
  it('deletes the block and frees its days', async () => {
    const d = deps();
    const block = await liveBlock(d);
    expect(await removeBlock(d, USER, block.id)).toMatchObject({ ok: true });
    expect((await loadCurrentWeek(d, USER)).block).toBeNull();
    expect(await removeBlock(d, USER, block.id)).toMatchObject({ ok: false, status: 404 });
  });
});
