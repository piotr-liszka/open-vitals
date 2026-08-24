/**
 * MCP workout-authoring tools (spec 050). These are the first MCP tools that WRITE, so the suite is
 * weighted towards the things that could go wrong for the athlete rather than the happy path:
 * the write switch, per-user isolation, and never silently leaving a session on the watch after a
 * delete that failed upstream.
 */
import { describe, it, expect } from 'vitest';
import { WORKOUT_TOOLS, type WorkoutToolDeps } from './workout-tools';
import { normalizeWorkout } from '../../lib/workouts';
import { createMemoryStore } from '../server/store/memory';
import { fixedClock } from '../server/clock';
import { sequenceRandom } from '../server/random';
import { createFeatureService } from '../server/features/service';
import { createMemoryFeatureStore } from '../server/features/store';
import { WORKOUT_WRITE_FEATURE } from '../server/features/registry';
import type { FeatureStore } from '../server/features/types';
import type { GarminSyncSource, GarminWorkoutDeleteResult } from '../server/interfaces';
import type { LocalStore } from '../server/store/types';

const TODAY = '2026-08-13';
const clock = fixedClock(new Date(`${TODAY}T09:00:00Z`));

function tool(name: string) {
  const t = WORKOUT_TOOLS.find((x) => x.name === name);
  if (!t) throw new Error(`tool ${name} not found`);
  return t;
}

interface Harness {
  deps: WorkoutToolDeps;
  store: LocalStore;
  featureStore: FeatureStore;
  deleted: string[];
}

/** A harness with the write switch ON (it defaults on; the off case has its own tests below). */
async function harness(
  over: { accepted?: boolean; deleteResult?: GarminWorkoutDeleteResult | 'throw' | 'none' } = {}
): Promise<Harness> {
  const store = createMemoryStore();
  const featureStore = createMemoryFeatureStore();
  const userId = 'u1';
  if (over.accepted === false) {
    await featureStore.set(userId, WORKOUT_WRITE_FEATURE, false);
  }
  const deleted: string[] = [];
  const garmin =
    over.deleteResult === 'none'
      ? ({} as GarminSyncSource)
      : ({
          async deleteWorkout(id: string) {
            deleted.push(id);
            if (over.deleteResult === 'throw') throw new Error('sidecar down');
            return over.deleteResult ?? { supported: true, removed: true };
          }
        } as unknown as GarminSyncSource);

  return {
    store,
    featureStore,
    deleted,
    deps: {
      store,
      userId,
      clock,
      timeZone: 'Europe/Warsaw',
      random: sequenceRandom('w'),
      features: createFeatureService({ store: featureStore, userId }),
      garmin
    }
  };
}

const RUN_STEPS = [
  { kind: 'warmup', durationType: 'time', durationValue: 600 },
  {
    kind: 'repeat',
    repeats: 5,
    steps: [
      {
        kind: 'work',
        durationType: 'distance',
        durationValue: 1000,
        target: { type: 'pace', low: 240, high: 250 }
      },
      { kind: 'recovery', durationType: 'time', durationValue: 120 }
    ]
  }
];

function body(res: { content: Array<{ text: string }> }): Record<string, unknown> {
  return JSON.parse(res.content[0]!.text) as Record<string, unknown>;
}

describe('MCP workout tools', () => {
  it('exposes exactly the authoring tools', () => {
    expect(WORKOUT_TOOLS.map((t) => t.name)).toEqual([
      'create_workout',
      // spec 069: the library the assistant resolves names against before composing anything.
      'list_workout_templates',
      'list_workouts',
      'update_workout',
      'delete_workout'
    ]);
  });

  it('create_workout stores a session locally and says it is only queued for Garmin', async () => {
    const { deps, store } = await harness();

    const res = await tool('create_workout').handler(deps, {
      sport: 'running',
      day: '2026-08-20',
      time: '18:00',
      title: '5x1km',
      steps: RUN_STEPS
    });

    expect(res.isError).toBeFalsy();
    const out = body(res);
    expect(out.pushState).toBe('pending');
    expect(out.stepCount).toBe(4);
    expect(out.sportLabel).toBe('Run');
    // The wording must never imply the watch already has it.
    expect(String(out.next)).toContain('synchronizacja');

    const stored = await store.listWorkouts('u1');
    expect(stored).toHaveLength(1);
    expect(stored[0]?.title).toBe('5x1km');
    expect(stored[0]?.steps[1]?.repeats).toBe(5);
  });

  it('create_workout builds a session from a preset in one call', async () => {
    const { deps, store } = await harness();

    const res = await tool('create_workout').handler(deps, {
      sport: 'cycling',
      day: '2026-08-20',
      preset: 'intervals',
      repeats: 4,
      workS: 480,
      targetType: 'power',
      targetLow: 250,
      targetHigh: 265
    });

    expect(body(res).title).toBe('Interwały 4×8 min');
    expect((await store.listWorkouts('u1'))[0]?.sport).toBe('cycling');
  });

  it('create_workout refuses a target the sport cannot have', async () => {
    const { deps, store } = await harness();

    const res = await tool('create_workout').handler(deps, {
      sport: 'walking',
      day: '2026-08-20',
      title: 'Marsz',
      steps: [
        { kind: 'work', durationType: 'time', durationValue: 1800, target: { type: 'power', low: 200 } }
      ]
    });

    expect(res.isError).toBe(true);
    expect(res.content[0]!.text).toContain('does not apply');
    expect(await store.listWorkouts('u1')).toEqual([]);
  });

  it('create_workout refuses both steps and a preset, and neither', async () => {
    const { deps } = await harness();
    const both = await tool('create_workout').handler(deps, {
      sport: 'running',
      day: '2026-08-20',
      steps: RUN_STEPS,
      preset: 'tempo'
    });
    const neither = await tool('create_workout').handler(deps, { sport: 'running', day: '2026-08-20' });

    expect(both.isError).toBe(true);
    expect(neither.isError).toBe(true);
  });

  it('list_workouts defaults to today onwards and reports push state', async () => {
    const { deps, store } = await harness();
    await tool('create_workout').handler(deps, {
      sport: 'running',
      day: '2026-08-20',
      title: 'przyszły',
      steps: RUN_STEPS
    });
    await store.createWorkout('u1', {
      id: 'old',
      day: '2026-08-01',
      time: null,
      sport: 'running',
      title: 'przeszły',
      steps: [],
      note: null,
      createdAt: `${TODAY}T08:00:00.000Z`
    });

    const res = await tool('list_workouts').handler(deps, {});

    const out = body(res);
    expect(out.from).toBe(TODAY);
    expect(out.count).toBe(1);
    expect(JSON.stringify(out)).not.toContain('przeszły');
  });

  it('update_workout re-queues the session and re-validates the whole thing', async () => {
    const { deps, store } = await harness();
    const created = body(
      await tool('create_workout').handler(deps, {
        sport: 'cycling',
        day: '2026-08-20',
        title: 'Tempo',
        steps: [
          { kind: 'work', durationType: 'time', durationValue: 1200, target: { type: 'power', low: 240 } }
        ]
      })
    );
    const id = String(created.id);
    await store.updateWorkout('u1', id, {
      pushState: 'pushed',
      garminWorkoutId: 'g-1',
      updatedAt: `${TODAY}T09:00:00.000Z`
    });

    const moved = await tool('update_workout').handler(deps, { id, day: '2026-08-22' });

    expect(body(moved).day).toBe('2026-08-22');
    const after = await store.getWorkout('u1', id);
    // Re-queued for the push, but the Garmin id is kept so the re-push updates instead of duplicating.
    expect(after?.pushState).toBe('pending');
    expect(after?.garminWorkoutId).toBe('g-1');

    // Changing the sport must re-check the existing target against the new sport.
    const badSport = await tool('update_workout').handler(deps, { id, sport: 'walking' });
    expect(badSport.isError).toBe(true);
  });

  it('update_workout and delete_workout reject an unknown id', async () => {
    const { deps } = await harness();
    expect((await tool('update_workout').handler(deps, { id: 'nope', day: '2026-08-20' })).isError).toBe(
      true
    );
    expect((await tool('delete_workout').handler(deps, { id: 'nope' })).isError).toBe(true);
  });

  it('delete_workout removes a never-pushed session without touching Garmin', async () => {
    const { deps, store, deleted } = await harness();
    const id = String(
      body(
        await tool('create_workout').handler(deps, {
          sport: 'running',
          day: '2026-08-20',
          title: 'x',
          steps: RUN_STEPS
        })
      ).id
    );

    const res = await tool('delete_workout').handler(deps, { id });

    expect(body(res)).toEqual({ id, deleted: true, upstreamRemoved: false });
    expect(deleted).toEqual([]);
    expect(await store.getWorkout('u1', id)).toBeNull();
  });

  it('delete_workout removes a pushed session upstream too', async () => {
    const { deps, store, deleted } = await harness();
    await store.createWorkout('u1', {
      id: 'w-pushed',
      day: '2026-08-20',
      time: null,
      sport: 'running',
      title: 'x',
      steps: [],
      note: null,
      createdAt: `${TODAY}T08:00:00.000Z`
    });
    await store.updateWorkout('u1', 'w-pushed', {
      pushState: 'pushed',
      garminWorkoutId: 'g-9',
      updatedAt: `${TODAY}T08:00:00.000Z`
    });

    const res = await tool('delete_workout').handler(deps, { id: 'w-pushed' });

    expect(deleted).toEqual(['g-9']);
    expect(body(res)).toEqual({ id: 'w-pushed', deleted: true, upstreamRemoved: true });
    expect(await store.getWorkout('u1', 'w-pushed')).toBeNull();
  });

  it('keeps the row when the upstream delete fails, instead of leaving it on the watch silently', async () => {
    for (const deleteResult of ['throw', { supported: false, removed: false }] as const) {
      const { deps, store } = await harness({ deleteResult });
      await store.createWorkout('u1', {
        id: 'w-pushed',
        day: '2026-08-20',
        time: null,
        sport: 'running',
        title: 'Interwały',
        steps: [],
        note: null,
        createdAt: `${TODAY}T08:00:00.000Z`
      });
      await store.updateWorkout('u1', 'w-pushed', {
        pushState: 'pushed',
        garminWorkoutId: 'g-9',
        updatedAt: `${TODAY}T08:00:00.000Z`
      });

      const res = await tool('delete_workout').handler(deps, { id: 'w-pushed' });

      expect(res.isError).toBe(true);
      const kept = await store.getWorkout('u1', 'w-pushed');
      expect(kept).not.toBeNull();
      expect(kept?.pushState).toBe('failed');
      expect(kept?.pushError).toBeTruthy();
    }
  });

  it('says so plainly when the connection cannot remove an already-pushed session', async () => {
    const { deps, store } = await harness({ deleteResult: 'none' });
    await store.createWorkout('u1', {
      id: 'w-pushed',
      day: '2026-08-20',
      time: null,
      sport: 'running',
      title: 'x',
      steps: [],
      note: null,
      createdAt: `${TODAY}T08:00:00.000Z`
    });
    await store.updateWorkout('u1', 'w-pushed', {
      garminWorkoutId: 'g-9',
      updatedAt: `${TODAY}T08:00:00.000Z`
    });

    const res = await tool('delete_workout').handler(deps, { id: 'w-pushed' });

    expect(res.isError).toBe(true);
    expect(res.content[0]!.text).toContain('Garmin Connect');
    expect(await store.getWorkout('u1', 'w-pushed')).not.toBeNull();
  });

  describe('write switch', () => {
    it('refuses every WRITE tool until the workout-write terms are accepted', async () => {
      const { deps, store } = await harness({ accepted: false });

      for (const name of ['create_workout', 'update_workout', 'delete_workout']) {
        const res = await tool(name).handler(deps, {
          sport: 'running',
          day: '2026-08-20',
          title: 'x',
          steps: RUN_STEPS,
          id: 'whatever'
        });
        expect(res.isError, name).toBe(true);
        expect(res.content[0]!.text).toContain('Ustawienia');
      }
      expect(await store.listWorkouts('u1')).toEqual([]);
    });

    it('still allows READING the list with the write switch off', async () => {
      const { deps } = await harness({ accepted: false });
      const res = await tool('list_workouts').handler(deps, {});
      expect(res.isError).toBeFalsy();
    });
  });

  it('never touches another user’s workouts', async () => {
    const { deps, store } = await harness();
    await store.createWorkout('u2', {
      id: 'other',
      day: '2026-08-20',
      time: null,
      sport: 'running',
      title: 'not mine',
      steps: [],
      note: null,
      createdAt: `${TODAY}T08:00:00.000Z`
    });

    const list = await tool('list_workouts').handler(deps, {});
    const update = await tool('update_workout').handler(deps, { id: 'other', day: '2026-08-21' });
    const del = await tool('delete_workout').handler(deps, { id: 'other' });

    expect(body(list).count).toBe(0);
    expect(update.isError).toBe(true);
    expect(del.isError).toBe(true);
    expect(await store.getWorkout('u2', 'other')).not.toBeNull();
  });
});

/**
 * Spec 069. Without the library, "Interwały 5×1 km on Tuesday" asked twice a month apart builds two
 * subtly different sessions under one name. These pin both halves of the fix: resolve an existing
 * entry by name, and file a new one when there is none.
 */
describe('the workout library (spec 069)', () => {
  /**
   * The library only ever holds VALIDATED trees, so seeds go through the same validator a real write
   * would — which also fills the defaults `RUN_STEPS` omits.
   */
  const libSteps = (sport = 'running') =>
    normalizeWorkout({ sport, title: 'seed', steps: RUN_STEPS as never }).steps;

  it('reuses a library session when the title matches and no steps are given', async () => {
    const { deps, store } = await harness();
    await store.createWorkoutTemplate('u1', {
      id: 'wt-1',
      sport: 'running',
      title: 'Interwały 5×1 km',
      steps: libSteps(),
      note: null,
      createdAt: '2026-08-01T00:00:00.000Z'
    });

    const res = await tool('create_workout').handler(deps, {
      sport: 'running',
      day: '2026-08-20',
      title: 'Interwały 5×1 km'
      // No `steps`, no `preset` — the whole point: the name is enough.
    });

    expect(res.isError).toBeFalsy();
    expect(body(res).library).toBe('used');

    /*
     * The saved session is the library tree AFTER `normalizeWorkout` — which fills the defaults a
     * hand-written step omits (`target: null`, `repeats: null`, …). Comparing against the normalised
     * template states the actual contract: the stored tree was reused, not rebuilt from the arguments.
     */
    const [template] = await store.listWorkoutTemplates('u1');
    const [saved] = await store.listWorkouts('u1');
    const expected = normalizeWorkout({
      sport: 'running',
      title: template!.title,
      steps: template!.steps
    }).steps;
    expect(saved!.steps).toEqual(expected);
  });

  it('matches the name case- and whitespace-insensitively, because a human typed it', async () => {
    const { deps, store } = await harness();
    await store.createWorkoutTemplate('u1', {
      id: 'wt-1',
      sport: 'running',
      title: 'Interwały 5×1 km',
      steps: libSteps(),
      note: null,
      createdAt: '2026-08-01T00:00:00.000Z'
    });

    const res = await tool('create_workout').handler(deps, {
      sport: 'running',
      day: '2026-08-20',
      title: '  interwały 5×1 KM  '
    });
    expect(body(res).library).toBe('used');
  });

  it('files a new session into the library when nothing matched', async () => {
    const { deps, store } = await harness();

    const res = await tool('create_workout').handler(deps, {
      sport: 'running',
      day: '2026-08-20',
      title: 'Nowy trening',
      steps: RUN_STEPS
    });

    expect(body(res).library).toBe('added');
    const templates = await store.listWorkoutTemplates('u1');
    expect(templates.map((t) => t.title)).toEqual(['Nowy trening']);
    // The library holds the session, not the date it happened to be scheduled for.
    expect(templates[0]).not.toHaveProperty('day');
  });

  it('does not file a duplicate when the same session is scheduled twice', async () => {
    const { deps, store } = await harness();
    const args = { sport: 'running', day: '2026-08-20', title: 'Powtarzalny', steps: RUN_STEPS };

    await tool('create_workout').handler(deps, args);
    await tool('create_workout').handler(deps, { ...args, day: '2026-08-27' });

    expect(await store.listWorkoutTemplates('u1')).toHaveLength(1);
    expect(await store.listWorkouts('u1')).toHaveLength(2);
  });

  it('list_workout_templates returns this user library only', async () => {
    const { deps, store } = await harness();
    await store.createWorkoutTemplate('u1', {
      id: 'wt-1',
      sport: 'running',
      title: 'Mój',
      steps: libSteps(),
      note: null,
      createdAt: '2026-08-01T00:00:00.000Z'
    });
    await store.createWorkoutTemplate('u2', {
      id: 'wt-2',
      sport: 'running',
      title: 'Cudzy',
      steps: libSteps(),
      note: null,
      createdAt: '2026-08-01T00:00:00.000Z'
    });

    const out = body(await tool('list_workout_templates').handler(deps, {}));
    expect(out.count).toBe(1);
    expect((out.templates as { title: string }[]).map((t) => t.title)).toEqual(['Mój']);
  });
});
