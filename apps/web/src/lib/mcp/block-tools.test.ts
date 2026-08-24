/**
 * Training-block MCP tools (spec 073) — invoked with a mock store, asserting the flattened shape a
 * model reads. The rule the payload is held to is spec 061's: no arithmetic should be needed to say
 * one of these numbers out loud.
 */
import { describe, it, expect } from 'vitest';
import { createMemoryStore } from '$lib/server/store/memory';
import { fixedClock } from '$lib/server/clock';
import { sequenceRandom } from '$lib/server/random';
import type { LocalStore } from '$lib/server/store/types';
import { BLOCK_TOOLS, type BlockTool, type BlockToolDeps } from './block-tools';

const USER = 'u1';
const TODAY = '2026-09-16'; // Wednesday of week 5 of a block starting 2026-08-17
const clock = fixedClock(new Date(`${TODAY}T08:00:00.000Z`));

function deps(store: LocalStore = createMemoryStore()): BlockToolDeps {
  return {
    store,
    userId: USER,
    clock,
    random: sequenceRandom('tb'),
    timeZone: 'Europe/Warsaw'
  };
}

const tool = (name: string): BlockTool => {
  const found = BLOCK_TOOLS.find((t) => t.name === name);
  if (!found) throw new Error(`no tool ${name}`);
  return found;
};

/** Tool results are text; every one of these tools returns JSON in it. */
function payload(result: { content: Array<{ text: string }>; isError?: boolean }): Record<string, unknown> {
  return JSON.parse(result.content[0]!.text);
}

async function seedBlock(d: BlockToolDeps): Promise<string> {
  const created = await tool('create_training_block').handler(d, {
    name: 'Baza pod 5 km',
    startDate: '2026-08-17',
    weeks: 16,
    paces: { easy: { lowS: 370, highS: 390 }, threshold: { lowS: 255, highS: 265 } },
    constraints: ['4 biegi/tydz', 'brak roweru XII–II']
  });
  return (payload(created).created as { id: string }).id;
}

describe('the tool surface', () => {
  it('exposes the block tools and the week review', () => {
    expect(BLOCK_TOOLS.map((t) => t.name)).toEqual([
      'get_current_week',
      'create_training_block',
      'update_training_block',
      'list_training_blocks',
      'delete_training_block',
      'get_week_review'
    ]);
  });

  it('lets get_current_week be called with no arguments at all', () => {
    // The coach's requirement: today resolves the week, nothing to pass and nothing to get wrong.
    expect(tool('get_current_week').inputShape).toEqual({});
  });
});

describe('get_current_week', () => {
  it('says plainly that there is no block instead of inferring one', async () => {
    const result = await tool('get_current_week').handler(deps(), {});
    const body = payload(result);
    expect(body.block).toBeNull();
    expect(String(body.message)).toContain('No training block covers today');
    expect(result.isError).toBeUndefined();
  });

  it('returns the week with the comparison already made', async () => {
    const store = createMemoryStore();
    const d = deps(store);
    const blockId = await seedBlock(d);
    await tool('update_training_block').handler(d, {
      blockId,
      weekTargets: [{ weekNumber: 5, volumeTargetKm: 34, focus: '2×10 min @ próg' }]
    });
    await store.putActivities(USER, [
      {
        userId: USER,
        activityId: 'a1',
        sport: 'running',
        name: null,
        startTime: '2026-09-14T09:00:00Z',
        startTimeLocal: '2026-09-14 09:00:00',
        distanceM: 12_400,
        durationS: 3600,
        movingS: 3600,
        elevationGainM: null,
        avgHr: 144,
        maxHr: 165,
        avgPower: null,
        maxPower: null,
        normPower: null,
        calories: null,
        trainingLoad: 60,
        hasGps: false,
        garminWorkoutId: null,
        raw: {}
      }
    ]);

    const body = payload(await tool('get_current_week').handler(d, {}));
    expect(body.today).toBe(TODAY);
    expect(body.weekNumber).toBe(5);
    expect(body.weeks).toBe(16);
    expect(body.focus).toBe('2×10 min @ próg');
    expect(body.volumeTargetKm).toBe(34);
    expect(body.volumeActualKm).toBe(12.4);
    // The subtraction is done here so the model never has to do it.
    expect(body.volumeRemainingKm).toBe(21.6);
    expect(body.constraints).toEqual(['4 biegi/tydz', 'brak roweru XII–II']);
  });

  it('gives every pace band a spoken label beside its seconds', async () => {
    const d = deps();
    await seedBlock(d);
    const body = payload(await tool('get_current_week').handler(d, {}));
    const paces = body.paces as Record<string, { lowS: number; label: string }>;
    expect(paces.easy).toEqual({ lowS: 370, highS: 390, label: '6:10–6:30/km' });
    expect(paces.threshold?.label).toBe('4:15–4:25/km');
  });

  it('leaves the remaining volume null when no target was set', async () => {
    const d = deps();
    await seedBlock(d);
    const body = payload(await tool('get_current_week').handler(d, {}));
    expect(body.volumeTargetKm).toBeNull();
    expect(body.volumeRemainingKm).toBeNull();
  });

  it('reports whether each session has reached the watch', async () => {
    const store = createMemoryStore();
    const d = deps(store);
    await seedBlock(d);
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

    const body = payload(await tool('get_current_week').handler(d, {}));
    const sessions = body.sessions as Array<{ title: string; onWatch: boolean; pushState: string }>;
    expect(sessions).toHaveLength(1);
    expect(sessions[0]).toMatchObject({ title: 'Próg 2×10 min', onWatch: false, pushState: 'pending' });
  });
});

describe('get_current_week — the soreness signal (spec 062)', () => {
  it('carries recent soreness into the week, with advice attached', async () => {
    const store = createMemoryStore();
    const d = deps(store);
    await seedBlock(d);
    await store.putJournalEntry(USER, {
      id: 'j1',
      day: '2026-09-14',
      activityId: null,
      soreness: 7,
      location: 'lewe kolano',
      at: '2026-09-14T20:00:00.000Z'
    });

    const body = payload(await tool('get_current_week').handler(d, {}));
    const soreness = body.soreness as { day: string; soreness: number; location: string; advice: string };
    expect(soreness).toMatchObject({ day: '2026-09-14', soreness: 7, location: 'lewe kolano' });
    expect(soreness.advice).toContain('cutting volume');
  });

  it('omits the flag entirely when nothing hurts, so its presence IS the signal', async () => {
    const store = createMemoryStore();
    const d = deps(store);
    await seedBlock(d);
    await store.putJournalEntry(USER, {
      id: 'j1',
      day: '2026-09-14',
      activityId: null,
      soreness: 2,
      at: '2026-09-14T20:00:00.000Z'
    });

    const body = payload(await tool('get_current_week').handler(d, {}));
    expect('soreness' in body).toBe(false);
  });

  it('does not reach back past the seven-day window', async () => {
    const store = createMemoryStore();
    const d = deps(store);
    await seedBlock(d);
    // TODAY is 2026-09-16, so the window opens on the 10th; the 9th is out.
    await store.putJournalEntry(USER, {
      id: 'j1',
      day: '2026-09-09',
      activityId: null,
      soreness: 9,
      at: '2026-09-09T20:00:00.000Z'
    });

    const body = payload(await tool('get_current_week').handler(d, {}));
    expect('soreness' in body).toBe(false);
  });
});

describe('create_training_block', () => {
  it('snaps the start day to its Monday', async () => {
    const d = deps();
    const body = payload(
      await tool('create_training_block').handler(d, {
        name: 'Blok',
        startDate: '2026-08-19', // Wednesday
        weeks: 4
      })
    );
    expect((body.created as { startDay: string }).startDay).toBe('2026-08-17');
  });

  it('is held to the same validator the HTTP boundary uses', async () => {
    const d = deps();
    const result = await tool('create_training_block').handler(d, {
      name: 'Blok',
      startDate: '2026-08-17',
      weeks: 4,
      paces: { easy: { lowS: 90, highS: 100 } } // faster than the world record
    });
    expect(result.isError).toBe(true);
    expect(result.content[0]!.text).toContain('tempo');
  });

  it('refuses to overlap an existing block and names it', async () => {
    const d = deps();
    await seedBlock(d);
    const result = await tool('create_training_block').handler(d, {
      name: 'Drugi',
      startDate: '2026-10-05',
      weeks: 4
    });
    expect(result.isError).toBe(true);
    expect(result.content[0]!.text).toContain('Baza pod 5 km');
  });
});

describe('update_training_block', () => {
  it('changes only what it is given', async () => {
    const d = deps();
    const blockId = await seedBlock(d);
    const body = payload(
      await tool('update_training_block').handler(d, {
        blockId,
        paces: { threshold: { lowS: 250, highS: 260 } }
      })
    );
    const updated = body.updated as { name: string; paces: Record<string, unknown>; weeks: number };
    expect(updated.name).toBe('Baza pod 5 km');
    expect(updated.weeks).toBe(16);
    expect(updated.paces).toEqual({ threshold: { lowS: 250, highS: 260 } });
  });

  it("errors on a block that is not this user's", async () => {
    const d = deps();
    const result = await tool('update_training_block').handler(d, { blockId: 'nope', name: 'x' });
    expect(result.isError).toBe(true);
  });
});

describe('list_training_blocks', () => {
  it('reports span, position and the live week', async () => {
    const d = deps();
    await seedBlock(d);
    const body = payload(await tool('list_training_blocks').handler(d, {}));
    expect(body.count).toBe(1);
    expect((body.blocks as Array<Record<string, unknown>>)[0]).toMatchObject({
      name: 'Baza pod 5 km',
      startDay: '2026-08-17',
      endDay: '2026-12-06',
      position: 'live',
      currentWeek: 5
    });
  });
});

describe('get_week_review (spec 078)', () => {
  /** A distance step, so the planned session carries an estimate the matcher can judge. */
  const distanceSteps = (distanceM: number) => [
    {
      kind: 'work' as const,
      durationType: 'distance' as const,
      durationValue: distanceM,
      target: null,
      repeats: null,
      steps: null,
      note: null
    }
  ];

  async function planned(store: LocalStore, id: string, day: string, title: string, m: number) {
    await store.createWorkout(USER, {
      id,
      day,
      time: null,
      sport: 'running',
      title,
      steps: distanceSteps(m),
      note: null,
      createdAt: '2026-09-10T09:00:00.000Z'
    });
  }

  function ran(id: string, day: string, distanceM: number) {
    return {
      userId: USER,
      activityId: id,
      sport: 'running',
      name: 'Bieg',
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

  it('says an empty week is empty rather than letting it read as failure', async () => {
    const body = payload(await tool('get_week_review').handler(deps(), {}));
    expect(body.empty).toBe(true);
    expect(String(body.message)).toContain('Nothing was planned');
  });

  it('reconciles the week and states the verdict in one sentence', async () => {
    const store = createMemoryStore();
    const d = deps(store);
    // TODAY is 2026-09-16 (Wednesday) → the week runs 2026-09-14 to 2026-09-20.
    await planned(store, 'w1', '2026-09-14', 'Spokojny', 8000);
    await planned(store, 'w2', '2026-09-16', 'Próg', 12_000);
    await planned(store, 'w3', '2026-09-19', 'Długi', 20_000);
    await store.putActivities(USER, [
      ran('a1', '2026-09-14', 8100),
      ran('a2', '2026-09-16', 7000),
      ran('a4', '2026-09-17', 5000)
    ]);

    const body = payload(await tool('get_week_review').handler(d, {}));

    expect(body.weekStart).toBe('2026-09-14');
    expect(body.weekEnd).toBe('2026-09-20');
    expect((body.matched as unknown[]).length).toBe(2);
    expect((body.missed as Array<Record<string, unknown>>)[0]).toMatchObject({ title: 'Długi' });
    expect((body.unplanned as Array<Record<string, unknown>>)[0]).toMatchObject({ activityId: 'a4' });
    expect(String(body.verdict)).toContain('2 of 3 planned sessions done');
    expect(String(body.verdict)).toContain('1 shortened');
  });

  it('reports a session that simply moved as done, with its shift', async () => {
    const store = createMemoryStore();
    const d = deps(store);
    await planned(store, 'w1', '2026-09-15', 'Próg', 12_000);
    await store.putActivities(USER, [ran('a1', '2026-09-16', 12_000)]);

    const body = payload(await tool('get_week_review').handler(d, {}));
    const matched = (body.matched as Array<Record<string, unknown>>)[0]!;
    expect(matched).toMatchObject({ adherence: 'done', dayShift: 1, doneOn: '2026-09-16' });
    expect(body.missed).toEqual([]);
  });

  it('omits dayShift entirely when the session was done on its day', async () => {
    const store = createMemoryStore();
    const d = deps(store);
    await planned(store, 'w1', '2026-09-16', 'Próg', 12_000);
    await store.putActivities(USER, [ran('a1', '2026-09-16', 12_000)]);

    const body = payload(await tool('get_week_review').handler(d, {}));
    expect('dayShift' in (body.matched as Array<Record<string, unknown>>)[0]!).toBe(false);
  });

  it('resolves an explicit mid-week day to that week', async () => {
    const store = createMemoryStore();
    const d = deps(store);
    await planned(store, 'w1', '2026-09-08', 'Poprzedni tydzień', 8000);
    await store.putActivities(USER, [ran('a1', '2026-09-08', 8000)]);

    const body = payload(await tool('get_week_review').handler(d, { weekStart: '2026-09-10' }));
    expect(body.weekStart).toBe('2026-09-07');
    expect((body.matched as unknown[]).length).toBe(1);
  });

  it('reports the block target and the session sum as separate numbers', async () => {
    const store = createMemoryStore();
    const d = deps(store);
    const blockId = await seedBlock(d);
    await tool('update_training_block').handler(d, {
      blockId,
      weekTargets: [{ weekNumber: 5, volumeTargetKm: 34 }]
    });
    await planned(store, 'w1', '2026-09-14', 'Spokojny', 8000);
    await store.putActivities(USER, [ran('a1', '2026-09-14', 8000)]);

    const body = payload(await tool('get_week_review').handler(d, {}));
    expect(body.planned).toMatchObject({ volumeTargetKm: 34, sessionsVolumeKm: 8, sessions: 1 });
    expect(body.actual).toMatchObject({ volumeKm: 8, sessions: 1 });
    expect(String(body.verdict)).toContain('against a target of 34 km');
  });

  /**
   * Spec 081. A client that cannot tell an inferred pairing from one Garmin itself made will state
   * a guess as a fact, so `matchedBy` is on every matched row — including the heuristic ones.
   */
  it('says HOW each pairing was made', async () => {
    const store = createMemoryStore();
    const d = deps(store);
    await planned(store, 'w-guess', '2026-09-16', 'Próg', 12_000);
    await planned(store, 'w-known', '2026-09-15', 'Rozbieganie', 8000);
    await store.updateWorkout(USER, 'w-known', {
      garminWorkoutId: '1668504046',
      pushState: 'pushed',
      updatedAt: '2026-09-01T10:00:00.000Z'
    });
    await store.putActivities(USER, [
      ran('a-guess', '2026-09-16', 12_000),
      // Two days after it was planned — past MAX_DAY_SHIFT, and matched anyway because the watch
      // says this activity WAS that session.
      { ...ran('a-known', '2026-09-17', 8000), garminWorkoutId: '1668504046' }
    ]);

    const body = payload(await tool('get_week_review').handler(d, {}));
    const matched = body.matched as Array<Record<string, unknown>>;

    expect(matched).toHaveLength(2);
    expect(matched.find((m) => m.activityId === 'a-known')).toMatchObject({
      matchedBy: 'workout-id',
      dayShift: 2
    });
    expect(matched.find((m) => m.activityId === 'a-guess')).toMatchObject({ matchedBy: 'heuristic' });
    expect(body.missed).toEqual([]);
    expect(body.unplanned).toEqual([]);
  });
});

describe('delete_training_block', () => {
  it('removes the block and reports its name', async () => {
    const d = deps();
    const blockId = await seedBlock(d);
    const body = payload(await tool('delete_training_block').handler(d, { blockId }));
    expect(body).toEqual({ deleted: true, name: 'Baza pod 5 km' });
    expect(payload(await tool('get_current_week').handler(d, {})).block).toBeNull();
  });
});
