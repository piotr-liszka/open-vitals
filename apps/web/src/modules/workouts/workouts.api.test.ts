/**
 * API-integration tests for the planner handlers (spec 066), against the in-memory store.
 *
 * The step model itself is already covered by `$lib/workouts`' own tests; what matters here is that
 * this slice REUSES that validator rather than re-implementing it, that the write switch holds on
 * every write, and that editing a session invalidates the copy already on the watch.
 */
import { describe, it, expect } from 'vitest';
import { createMemoryStore } from '$lib/server/store/memory';
import { pushWorkout, type WritableSource } from '$lib/server/sync/workout-push';
import { fixedClock } from '$lib/server/clock';
import { sequenceRandom } from '$lib/server/random';
import type { FeatureService } from '$lib/server/features/types';
import { GarminUnavailableError } from '$lib/server/interfaces';
import type {
  GarminSyncSource,
  GarminWorkoutInput,
  GarminWorkoutScheduleResult,
  GarminWorkoutWriteResult
} from '$lib/server/interfaces';
import type { ActivitySummary } from '$lib/server/store/types';
import { WORKOUT_PROVENANCE_LINE, type WorkoutStep } from '$lib/workouts';
import {
  WorkoutWriteDisabledError,
  WorkoutRequestError,
  WorkoutValidationError,
  createWorkout,
  deleteWorkout,
  loadPlanner,
  pushWorkoutNow,
  updateWorkout,
  workoutErrorStatus,
  createTemplate,
  deleteTemplate,
  listTemplates,
  scheduleFromTemplate,
  updateTemplate
} from './workouts.api';
import type { WorkoutDraft, WorkoutTemplateDraft } from './workouts.types';

const USER = 'u1';
const clock = fixedClock(new Date('2026-08-15T10:00:00Z'));

/** Only `isEnabled` is used; the rest of the port would be noise here. */
function featuresStub(enabled: boolean): FeatureService {
  return {
    async list() {
      return [];
    },
    async isEnabled() {
      return enabled;
    },
    async setEnabled() {
      throw new Error('unused');
    }
  } as unknown as FeatureService;
}

const deps = (enabled = true) => ({
  store: createMemoryStore(),
  clock,
  random: sequenceRandom('w'),
  features: featuresStub(enabled)
});

const step = (over: Partial<WorkoutStep> = {}): WorkoutStep => ({
  kind: 'work',
  durationType: 'time',
  durationValue: 300,
  target: null,
  repeats: null,
  steps: null,
  note: null,
  ...over
});

const draft = (over: Partial<WorkoutDraft> = {}): WorkoutDraft => ({
  day: '2026-08-20',
  time: '18:00',
  sport: 'running',
  title: 'Interwały 5×1 km',
  steps: [
    step({ kind: 'warmup', durationValue: 900 }),
    step(),
    step({ kind: 'cooldown', durationValue: 600 })
  ],
  note: null,
  ...over
});

describe('createWorkout', () => {
  it('stores a session and returns it with its estimates derived', async () => {
    const d = deps();
    const created = await createWorkout(d, USER, draft());

    expect(created.title).toBe('Interwały 5×1 km');
    expect(created.day).toBe('2026-08-20');
    expect(created.time).toBe('18:00');
    expect(created.pushState).toBe('pending');
    expect(created.onGarmin).toBe(false);
    // 900 + 300 + 600 — derived from the tree, never stored.
    expect(created.estimatedDurationS).toBe(1800);
  });

  it('round-trips a repeat block unchanged', async () => {
    const d = deps();
    const block = step({
      kind: 'repeat',
      durationType: null,
      durationValue: null,
      repeats: 5,
      steps: [
        step({
          durationType: 'distance',
          durationValue: 1000,
          target: { type: 'pace', low: 250, high: 260 }
        }),
        step({ kind: 'recovery', durationValue: 120 })
      ]
    });
    const created = await createWorkout(d, USER, draft({ steps: [block] }));

    const stored = created.steps[0]!;
    expect(stored.kind).toBe('repeat');
    expect(stored.repeats).toBe(5);
    expect(stored.steps).toHaveLength(2);
    expect(stored.steps![0]!.target).toEqual({ type: 'pace', low: 250, high: 260 });
  });

  /**
   * The point of reusing `normalizeWorkout`: the rejection AND its wording come from the one place
   * that defines a valid workout, so the UI can show the message verbatim.
   */
  it('rejects an invalid step with the validator own reason', async () => {
    const d = deps();
    await expect(createWorkout(d, USER, draft({ steps: [] }))).rejects.toBeInstanceOf(WorkoutValidationError);
    await expect(createWorkout(d, USER, draft({ sport: 'quidditch' }))).rejects.toThrow(/unknown sport/);
    await expect(createWorkout(d, USER, draft({ steps: [step({ durationValue: null })] }))).rejects.toThrow(
      /positive durationValue/
    );
  });

  it('refuses a target the sport does not allow, without a second copy of that table', async () => {
    const d = deps();
    // Power on a walk: `WORKOUT_TARGETS_BY_GROUP` says no, and the editor never offers it either.
    await expect(
      createWorkout(
        d,
        USER,
        draft({ sport: 'walking', steps: [step({ target: { type: 'power', low: 200, high: 240 } })] })
      )
    ).rejects.toThrow(/does not apply to this sport/);
  });

  it('rejects a malformed day or time before touching the store', async () => {
    const d = deps();
    await expect(createWorkout(d, USER, draft({ day: '20-08-2026' }))).rejects.toBeInstanceOf(
      WorkoutRequestError
    );
    await expect(createWorkout(d, USER, draft({ time: '25:00' }))).rejects.toBeInstanceOf(
      WorkoutRequestError
    );
    expect(await d.store.listWorkouts(USER)).toHaveLength(0);
  });

  it('accepts a session with no time — "sometime that day" is a real answer', async () => {
    const created = await createWorkout(deps(), USER, draft({ time: null }));
    expect(created.time).toBeNull();
  });
});

describe('the workout_write write switch', () => {
  it('refuses every write when the feature is off', async () => {
    const d = deps(false);
    await expect(createWorkout(d, USER, draft())).rejects.toBeInstanceOf(WorkoutWriteDisabledError);
    await expect(updateWorkout(d, USER, 'x', draft())).rejects.toBeInstanceOf(WorkoutWriteDisabledError);
    await expect(deleteWorkout(d, USER, 'x')).rejects.toBeInstanceOf(WorkoutWriteDisabledError);
  });

  /** Reading is not gated: drawing a plan the athlete already has processes nothing new. */
  it('still lists, and reports that writing is off', async () => {
    const d = deps(false);
    const planner = await loadPlanner(d, USER, '2026-08-01', '2026-08-31');
    expect(planner.canWrite).toBe(false);
    expect(planner.workouts).toEqual([]);
  });
});

describe('updateWorkout', () => {
  /**
   * The row on the watch is now out of date. Leaving it `pushed` would tell the sync engine there is
   * nothing to do — the athlete would edit an interval here and go and ride the old one.
   */
  it('resets an already-pushed session to pending, and contentPushed to false (spec 092)', async () => {
    const d = deps();
    const created = await createWorkout(d, USER, draft());
    await d.store.updateWorkout(USER, created.id, {
      pushState: 'pushed',
      garminWorkoutId: 'g-1',
      contentPushed: true,
      updatedAt: clock.now().toISOString()
    });

    const updated = await updateWorkout(d, USER, created.id, draft({ title: 'Inne interwały' }));
    expect(updated?.title).toBe('Inne interwały');
    expect(updated?.pushState).toBe('pending');
    expect(updated?.pushError).toBeNull();
    // The id is KEPT (spec 092 needs it to delete the stale upstream copy on the next push), but the
    // content flag flips back to false in the SAME patch — the next push must not trust the old copy.
    const stored = await d.store.getWorkout(USER, created.id);
    expect(stored?.garminWorkoutId).toBe('g-1');
    expect(stored?.contentPushed).toBe(false);
  });

  it('is null for an id this user does not own', async () => {
    const d = deps();
    await createWorkout(d, USER, draft());
    expect(await updateWorkout(d, USER, 'nope', draft())).toBeNull();
    // AGENTS.md §10: another user's row is "not found", never "forbidden".
    expect(await updateWorkout(d, 'someone-else', 'w-1', draft())).toBeNull();
  });

  it('validates the patch as strictly as a create', async () => {
    const d = deps();
    const created = await createWorkout(d, USER, draft());
    await expect(updateWorkout(d, USER, created.id, draft({ title: '' }))).rejects.toThrow(
      /title is required/
    );
  });
});

describe('deleteWorkout', () => {
  it('removes the row and reports whether it had reached Garmin', async () => {
    const d = deps();
    const created = await createWorkout(d, USER, draft());
    await d.store.updateWorkout(USER, created.id, {
      garminWorkoutId: 'g-1',
      updatedAt: clock.now().toISOString()
    });

    const removed = await deleteWorkout(d, USER, created.id);
    // The confirmation needs this to say "still on your watch until the next sync".
    expect(removed?.onGarmin).toBe(true);
    expect(await d.store.listWorkouts(USER)).toHaveLength(0);
  });

  it('is null for an unknown id', async () => {
    expect(await deleteWorkout(deps(), USER, 'nope')).toBeNull();
  });
});

describe('loadPlanner', () => {
  it('returns authored sessions and synced events separately', async () => {
    const d = deps();
    await createWorkout(d, USER, draft({ day: '2026-08-20' }));
    await d.store.replacePlannedEvents(USER, '2026-08-01', '2026-08-31', [
      {
        id: 'p-1',
        day: '2026-08-21',
        time: null,
        kind: 'race',
        title: 'Bieg uliczny',
        sport: 'running',
        description: null,
        estimatedDurationS: null,
        estimatedDistanceM: 10000,
        targetLoad: null,
        source: 'garmin'
      }
    ]);

    const planner = await loadPlanner(d, USER, '2026-08-01', '2026-08-31');
    // Kept apart all the way to the UI: only one of them can be edited.
    expect(planner.workouts.map((w) => w.day)).toEqual(['2026-08-20']);
    expect(planner.planned.map((p) => p.title)).toEqual(['Bieg uliczny']);
    expect(planner.canWrite).toBe(true);
  });

  it('windows to the range it was asked for', async () => {
    const d = deps();
    await createWorkout(d, USER, draft({ day: '2026-08-20' }));
    await createWorkout(d, USER, draft({ day: '2026-10-01' }));

    const planner = await loadPlanner(d, USER, '2026-08-01', '2026-08-31');
    expect(planner.workouts).toHaveLength(1);
  });

  /** AGENTS.md golden rule #2. */
  it('never shows one user another user sessions', async () => {
    const d = deps();
    await createWorkout(d, USER, draft());
    const other = await loadPlanner(d, 'u2', '2026-08-01', '2026-08-31');
    expect(other.workouts).toEqual([]);
  });
});

/**
 * spec 093 — folding a pushed session's own Garmin echo into one row, rendering-only. `loadPlanner`
 * runs `matchPlannedEcho` over the exact same two arrays it already loaded above; these tests pin the
 * wiring (`syncedBack` set, the matched planned event dropped from `planned`), not the matcher's own
 * rules — those are `planner-merge.test.ts`'s job.
 */
describe('loadPlanner — synced-back merge (spec 093)', () => {
  function echo(over: { id: string; day: string; sport?: string | null; title?: string }): {
    id: string;
    day: string;
    time: string | null;
    kind: 'workout' | 'race' | 'note';
    title: string;
    sport: string | null;
    description: string | null;
    estimatedDurationS: number | null;
    estimatedDistanceM: number | null;
    targetLoad: number | null;
    source: 'garmin';
  } {
    return {
      id: over.id,
      day: over.day,
      time: null,
      kind: 'workout',
      title: over.title ?? 'Interwały 5×1 km',
      sport: over.sport ?? 'running',
      description: null,
      estimatedDurationS: null,
      estimatedDistanceM: null,
      targetLoad: null,
      source: 'garmin'
    };
  }

  it('one authored (pushed) + its matching echo on the same day: syncedBack true, echo dropped from planned', async () => {
    const d = deps();
    const created = await createWorkout(d, USER, draft({ day: '2026-08-20' }));
    await d.store.updateWorkout(USER, created.id, {
      pushState: 'pushed',
      garminWorkoutId: 'g-1',
      updatedAt: clock.now().toISOString()
    });
    await d.store.replacePlannedEvents(USER, '2026-08-01', '2026-08-31', [
      echo({ id: 'g-1', day: '2026-08-20', title: created.title })
    ]);

    const data = await loadPlanner(d, USER, '2026-08-01', '2026-08-31');

    expect(data.workouts).toHaveLength(1);
    expect(data.workouts[0]!.syncedBack).toBe(true);
    expect(data.planned).toEqual([]);
  });

  it('one authored, never pushed, no planned events that day: syncedBack false, planned empty', async () => {
    const d = deps();
    await createWorkout(d, USER, draft({ day: '2026-08-20' }));

    const data = await loadPlanner(d, USER, '2026-08-01', '2026-08-31');

    expect(data.workouts).toHaveLength(1);
    expect(data.workouts[0]!.syncedBack).toBe(false);
    expect(data.planned).toEqual([]);
  });

  it('one planned event with no authored counterpart: present in planned, no syncedBack', async () => {
    const d = deps();
    await d.store.replacePlannedEvents(USER, '2026-08-01', '2026-08-31', [
      echo({ id: 'p-1', day: '2026-08-20' })
    ]);

    const data = await loadPlanner(d, USER, '2026-08-01', '2026-08-31');

    expect(data.planned).toHaveLength(1);
    expect(data.planned[0]!.id).toBe('p-1');
    expect(data.workouts.some((w) => w.syncedBack)).toBe(false);
  });

  it('two authored workouts, different disciplines, both echoed: both syncedBack, planned empty for that day', async () => {
    const d = deps();
    const run = await createWorkout(d, USER, draft({ day: '2026-08-20', sport: 'running', title: 'Bieg' }));
    const ride = await createWorkout(d, USER, draft({ day: '2026-08-20', sport: 'cycling', title: 'Rower' }));
    await d.store.updateWorkout(USER, run.id, {
      pushState: 'pushed',
      garminWorkoutId: 'g-run',
      updatedAt: clock.now().toISOString()
    });
    await d.store.updateWorkout(USER, ride.id, {
      pushState: 'pushed',
      garminWorkoutId: 'g-ride',
      updatedAt: clock.now().toISOString()
    });
    await d.store.replacePlannedEvents(USER, '2026-08-01', '2026-08-31', [
      echo({ id: 'g-run', day: '2026-08-20', sport: 'running', title: 'Bieg' }),
      echo({ id: 'g-ride', day: '2026-08-20', sport: 'cycling', title: 'Rower' })
    ]);

    const data = await loadPlanner(d, USER, '2026-08-01', '2026-08-31');

    const byId = new Map(data.workouts.map((w) => [w.id, w]));
    expect(byId.get(run.id)?.syncedBack).toBe(true);
    expect(byId.get(ride.id)?.syncedBack).toBe(true);
    expect(data.planned).toEqual([]);
  });
});

/**
 * The error→HTTP mapping lives in the module, not the route: SvelteKit refuses any non-handler export
 * from a `+server.ts` — a BUILD-time error that `test`, `check` and `lint` all pass straight over
 * (AGENTS.md §7 says exactly this about `pnpm run build`). Keeping it here also makes it testable.
 */
describe('workoutErrorStatus', () => {
  it('maps a disabled write switch to 403 and a validation failure to 400', () => {
    expect(workoutErrorStatus(new WorkoutWriteDisabledError('nope'))).toEqual({ status: 403, error: 'nope' });
    expect(workoutErrorStatus(new WorkoutValidationError('title is required'))).toEqual({
      status: 400,
      error: 'title is required'
    });
    expect(workoutErrorStatus(new WorkoutRequestError('day must be YYYY-MM-DD'))).toEqual({
      status: 400,
      error: 'day must be YYYY-MM-DD'
    });
  });

  /** Anything else is a real bug and must reach the error handler as a 500, not be flattened to 400. */
  it('returns null for an unexpected error', () => {
    expect(workoutErrorStatus(new Error('database on fire'))).toBeNull();
  });
});

/**
 * Spec 069 — the workout library. The step model is already covered above; what these pin is the one
 * decision the spec argues about: scheduling COPIES a template's steps rather than referencing them,
 * so editing the library can never rewrite a session already pushed to the athlete's watch.
 */
describe('workout library (spec 069)', () => {
  const template = (over: Partial<WorkoutTemplateDraft> = {}): WorkoutTemplateDraft => ({
    sport: 'running',
    title: 'Interwały 5×1 km',
    steps: [step({ kind: 'warmup', durationValue: 900 }), step()],
    note: null,
    ...over
  });

  it('creates a reusable session with no date and derives its estimates', async () => {
    const d = deps();
    const created = await createTemplate(d, USER, template());

    expect(created.title).toBe('Interwały 5×1 km');
    expect(created.estimatedDurationS).toBe(1200);
    // The absence of a date IS the type — a template must not carry one.
    expect(created).not.toHaveProperty('day');
    expect(created).not.toHaveProperty('pushState');
  });

  it('validates with the SAME validator as a dated session', async () => {
    const d = deps();
    await expect(createTemplate(d, USER, template({ steps: [] }))).rejects.toBeInstanceOf(
      WorkoutValidationError
    );
    await expect(
      createTemplate(
        d,
        USER,
        template({ sport: 'walking', steps: [step({ target: { type: 'power', low: 200, high: 240 } })] })
      )
    ).rejects.toThrow(/does not apply to this sport/);
  });

  it('lists a user own library, title ascending, and nobody else', async () => {
    const d = deps();
    await createTemplate(d, USER, template({ title: 'Zeta' }));
    await createTemplate(d, USER, template({ title: 'Alfa' }));
    await createTemplate(d, 'u2', template({ title: 'Obcy' }));

    expect((await listTemplates(d, USER)).map((t) => t.title)).toEqual(['Alfa', 'Zeta']);
    expect((await listTemplates(d, 'u2')).map((t) => t.title)).toEqual(['Obcy']);
  });

  it('schedules a template onto a day as an ordinary authored workout', async () => {
    const d = deps();
    const t = await createTemplate(d, USER, template());

    const scheduled = await scheduleFromTemplate(d, USER, t.id, '2026-09-01');
    expect(scheduled?.day).toBe('2026-09-01');
    expect(scheduled?.title).toBe(t.title);
    expect(scheduled?.pushState).toBe('pending');
    expect(scheduled?.steps).toEqual(t.steps);
  });

  /** The heart of the spec: a copy, not a link. */
  it('COPIES the steps — editing the library later does not touch a scheduled session', async () => {
    const d = deps();
    const t = await createTemplate(d, USER, template());
    const scheduled = await scheduleFromTemplate(d, USER, t.id, '2026-09-01');

    await updateTemplate(d, USER, t.id, template({ steps: [step({ durationValue: 9999 })] }));

    const after = await d.store.getWorkout(USER, scheduled!.id);
    expect(after?.steps).toEqual(scheduled!.steps);
    expect(after?.steps.some((s) => s.durationValue === 9999)).toBe(false);
  });

  it('is 404 (null) when scheduling a template that is not this user', async () => {
    const d = deps();
    const t = await createTemplate(d, USER, template());
    expect(await scheduleFromTemplate(d, 'u2', t.id, '2026-09-01')).toBeNull();
    expect(await scheduleFromTemplate(d, USER, 'nope', '2026-09-01')).toBeNull();
  });

  it('deleting a template leaves sessions already scheduled from it alone', async () => {
    const d = deps();
    const t = await createTemplate(d, USER, template());
    const scheduled = await scheduleFromTemplate(d, USER, t.id, '2026-09-01');

    await deleteTemplate(d, USER, t.id);

    expect(await listTemplates(d, USER)).toEqual([]);
    // The commitment survives the idea it came from — what the delete dialog promises.
    expect(await d.store.getWorkout(USER, scheduled!.id)).not.toBeNull();
  });

  it('gates every library write on workout_write, but not the read', async () => {
    const d = deps(false);
    await expect(createTemplate(d, USER, template())).rejects.toBeInstanceOf(WorkoutWriteDisabledError);
    await expect(updateTemplate(d, USER, 'x', template())).rejects.toBeInstanceOf(WorkoutWriteDisabledError);
    await expect(deleteTemplate(d, USER, 'x')).rejects.toBeInstanceOf(WorkoutWriteDisabledError);
    await expect(scheduleFromTemplate(d, USER, 'x', '2026-09-01')).rejects.toBeInstanceOf(
      WorkoutWriteDisabledError
    );
    await expect(listTemplates(d, USER)).resolves.toEqual([]);
  });

  it('carries the library into the planner payload', async () => {
    const d = deps();
    await createTemplate(d, USER, template());
    const planner = await loadPlanner(d, USER, '2026-08-01', '2026-08-31');
    // Not windowed: a reusable session has no date to window BY.
    expect(planner.templates.map((t) => t.title)).toEqual(['Interwały 5×1 km']);
  });
});

/* ---------------------------------------------------------------------------------------------
 * Push on demand (spec 083)
 * ------------------------------------------------------------------------------------------- */

interface PushLog {
  created: GarminWorkoutInput[];
  scheduled: { id: string; day: string }[];
  deleted: string[];
}

/** A source that writes, with a log of what reached it and per-call behaviour overrides. */
function pushSource(
  behavior: {
    create?: () => GarminWorkoutWriteResult;
    schedule?: () => GarminWorkoutScheduleResult;
    /** Answers `scheduleWorkout` differently for the FIRST call only, then falls back (spec 092). */
    scheduleOnce?: () => GarminWorkoutScheduleResult;
  } = {}
): WritableSource & { log: PushLog } {
  const log: PushLog = { created: [], scheduled: [], deleted: [] };
  let creates = 0;
  let scheduleCalls = 0;
  const source: WritableSource = {
    async getStatus() {
      return { authenticated: true, displayName: 'Ada' };
    },
    async login() {
      throw new Error('unused');
    },
    async disconnect() {
      throw new Error('unused');
    },
    async getMetric() {
      return null;
    },
    async getMetricRange(metric, start, end) {
      return { metric, start, end, days: [] };
    },
    async listActivitiesPage() {
      return [];
    },
    async getActivityDetails(activityId) {
      return { activityId };
    },
    async getWeightRange() {
      return [];
    },
    async createWorkout(input) {
      log.created.push(input);
      creates += 1;
      return behavior.create?.() ?? { supported: true, workoutId: `g-${creates}`, reason: null };
    },
    async scheduleWorkout(id, day) {
      log.scheduled.push({ id, day });
      scheduleCalls += 1;
      if (scheduleCalls === 1 && behavior.scheduleOnce) return behavior.scheduleOnce();
      return behavior.schedule?.() ?? { supported: true, scheduleId: `s-${id}`, reason: null };
    },
    async deleteWorkout(id) {
      log.deleted.push(id);
      return { supported: true, removed: true };
    }
  };
  return Object.assign(source, { log });
}

describe('pushWorkoutNow (spec 083)', () => {
  it('creates the workout, pins it to ITS OWN day, and reports the stored state', async () => {
    const d = deps();
    const source = pushSource();
    const created = await createWorkout(d, USER, draft({ day: '2026-08-20' }));

    const pushed = await pushWorkoutNow({ ...d, source }, USER, created.id);

    expect(source.log.created).toHaveLength(1);
    // Not "today" (2026-08-15 on this clock): a session belongs on the day it was planned for.
    expect(source.log.scheduled).toEqual([{ id: 'g-1', day: '2026-08-20' }]);
    expect(pushed?.pushState).toBe('pushed');
    expect(pushed?.onGarmin).toBe(true);
  });

  it('pushWorkout itself makes zero adapter calls on an unchanged, already-pushed row (spec 092)', async () => {
    // The strengthened guarantee `pushWorkout` (the function the sync engine ALSO calls) makes: once
    // a row is fully pushed and untouched since, calling it again reaches Garmin not at all — no
    // create, no schedule, no delete. Exercised directly (not through `pushWorkoutNow`, which now has
    // its OWN re-push forcing for the "Wyślij ponownie" affordance — see the test below) because that
    // forcing is deliberately what makes a pressed re-push NOT a no-op; the no-op guarantee belongs to
    // the shared push function on a row nothing has touched.
    const d = deps();
    const source = pushSource();
    const created = await createWorkout(d, USER, draft());
    await pushWorkoutNow({ ...d, source }, USER, created.id);
    const pushedRow = await d.store.getWorkout(USER, created.id);
    expect(pushedRow?.contentPushed).toBe(true);

    const result = await pushWorkout(
      {
        store: d.store,
        source,
        clock: d.clock,
        classify: () => ({ text: 'unused', code: 'bad_response', retryable: false })
      },
      USER,
      pushedRow!
    );

    expect(source.log.created).toHaveLength(1);
    expect(source.log.scheduled).toHaveLength(1);
    expect(source.log.deleted).toHaveLength(0);
    expect(result).toEqual({ status: 'pushed', failure: null });
  });

  it('pressing the push endpoint again on an already-pushed row deletes and recreates fresh (spec 092)', async () => {
    // The server-side force behind "Wyślij ponownie" (spec 092): the ONLY way this handler is ever
    // called on a row already `pushed` is a deliberate re-push (the planner never shows the primary
    // button once pushed, and the sync engine never selects a pushed row), so every such call runs
    // the delete-then-recreate branch, whether or not the athlete actually edited anything.
    const d = deps();
    const source = pushSource();
    const created = await createWorkout(d, USER, draft());

    await pushWorkoutNow({ ...d, source }, USER, created.id);
    const first = await d.store.getWorkout(USER, created.id);

    const again = await pushWorkoutNow({ ...d, source }, USER, created.id);

    expect(source.log.deleted).toEqual([first?.garminWorkoutId]);
    expect(source.log.created).toHaveLength(2);
    expect(source.log.scheduled).toHaveLength(2);
    expect(again?.pushState).toBe('pushed');
    expect(again?.onGarmin).toBe(true);
    // A fresh upstream id, not the one from the first push — never two live entries.
    const second = await d.store.getWorkout(USER, created.id);
    expect(second?.garminWorkoutId).not.toBe(first?.garminWorkoutId);
    expect(second?.contentPushed).toBe(true);
  });

  it('sends the note and the provenance line as the description (spec 082)', async () => {
    const d = deps();
    const source = pushSource();
    const created = await createWorkout(d, USER, draft({ note: 'Na luzie' }));

    await pushWorkoutNow({ ...d, source }, USER, created.id);

    expect(source.log.created[0]?.note).toBe(`Na luzie\n\n${WORKOUT_PROVENANCE_LINE}`);
  });

  it('reports a sport Garmin cannot take as an answer, not an exception', async () => {
    const d = deps();
    const source = pushSource({
      create: () => ({ supported: false, workoutId: null, reason: 'unsupported_sport' })
    });
    const created = await createWorkout(d, USER, draft());

    const pushed = await pushWorkoutNow({ ...d, source }, USER, created.id);

    expect(pushed?.pushState).toBe('unsupported');
    expect(pushed?.pushError).toMatch(/dyscypliny/);
    expect(source.log.scheduled).toHaveLength(0);
  });

  it('reports a workout that landed in the library but not on the calendar', async () => {
    const d = deps();
    const source = pushSource({
      schedule: () => ({ supported: false, scheduleId: null, reason: 'unsupported_endpoint' })
    });
    const created = await createWorkout(d, USER, draft());

    const pushed = await pushWorkoutNow({ ...d, source }, USER, created.id);

    expect(pushed?.pushState).toBe('failed');
    // The id is KEPT even so — that is what stops the retry from creating a second copy.
    expect(pushed?.onGarmin).toBe(true);
  });

  it('turns a thrown sidecar failure into a readable reason on the row', async () => {
    const d = deps();
    const source = pushSource();
    const created = await createWorkout(d, USER, draft());
    source.createWorkout = async () => {
      throw new GarminUnavailableError('boom', { code: 'sidecar_unreachable', retryable: true });
    };

    const pushed = await pushWorkoutNow({ ...d, source }, USER, created.id);

    expect(pushed?.pushState).toBe('failed');
    expect(pushed?.pushError).toMatch(/sidecar/);
  });

  it('needs the write switch, and says so rather than reaching Garmin', async () => {
    const enabled = deps();
    const created = await createWorkout(enabled, USER, draft());
    const source = pushSource();
    const off = { ...enabled, features: featuresStub(false), source };

    await expect(pushWorkoutNow(off, USER, created.id)).rejects.toBeInstanceOf(WorkoutWriteDisabledError);
    expect(source.log.created).toHaveLength(0);
  });

  it('answers null for an id that is not this user’s', async () => {
    const d = deps();
    const source = pushSource();
    await createWorkout(d, USER, draft());

    expect(await pushWorkoutNow({ ...d, source }, 'someone-else', 'nope')).toBeNull();
    expect(source.log.created).toHaveLength(0);
  });
});

/**
 * Spec 081 — the planner marks what was done. Derived on READ from the activity table by the same
 * `matchWeek` the week review runs, so the grid and the review can never disagree.
 */
describe('loadPlanner — completion (spec 081)', () => {
  const activity = (over: Partial<ActivitySummary> = {}): ActivitySummary => ({
    userId: USER,
    activityId: 'a1',
    sport: 'running',
    name: 'Bieg',
    startTime: '2026-08-20T16:00:00.000Z',
    startTimeLocal: '2026-08-20 18:00:00',
    distanceM: 5000,
    durationS: 1800,
    movingS: 1800,
    elevationGainM: null,
    avgHr: null,
    maxHr: null,
    avgPower: null,
    maxPower: null,
    normPower: null,
    calories: null,
    trainingLoad: null,
    hasGps: false,
    garminWorkoutId: null,
    raw: {},
    ...over
  });

  /** A 5 km session on 2026-08-20 — `draft()`'s day, so a same-day activity is a candidate. */
  const distanceDraft = (over: Partial<WorkoutDraft> = {}): WorkoutDraft =>
    draft({
      steps: [step({ durationType: 'distance', durationValue: 5000 })],
      ...over
    });

  it('marks a session that has a matching activity and leaves the others null', async () => {
    const d = deps();
    const done = await createWorkout(d, USER, distanceDraft());
    const notDone = await createWorkout(d, USER, distanceDraft({ day: '2026-08-28', title: 'Later' }));
    await d.store.putActivities(USER, [activity()]);

    const data = await loadPlanner(d, USER, '2026-08-01', '2026-08-31');

    const byId = Object.fromEntries(data.workouts.map((w) => [w.id, w]));
    expect(byId[done.id]?.completion).toEqual({
      activityId: 'a1',
      adherence: 'done',
      adherenceRatio: 1,
      dayShift: 0,
      matchedBy: 'heuristic'
    });
    expect(byId[notDone.id]?.completion).toBeNull();
  });

  it('reports a shortened session with its ratio rather than as done', async () => {
    const d = deps();
    await createWorkout(d, USER, distanceDraft());
    await d.store.putActivities(USER, [activity({ distanceM: 3000 })]);

    const data = await loadPlanner(d, USER, '2026-08-01', '2026-08-31');

    expect(data.workouts[0]?.completion).toMatchObject({ adherence: 'shortened', adherenceRatio: 0.6 });
  });

  it('marks a session the watch linked even when it was run days later', async () => {
    const d = deps();
    const created = await createWorkout(d, USER, distanceDraft());
    await d.store.updateWorkout(USER, created.id, {
      garminWorkoutId: 'g-1',
      pushState: 'pushed',
      updatedAt: '2026-09-01T10:00:00.000Z'
    });
    await d.store.putActivities(USER, [
      activity({ startTimeLocal: '2026-08-24 18:00:00', garminWorkoutId: 'g-1' })
    ]);

    const data = await loadPlanner(d, USER, '2026-08-01', '2026-08-31');

    expect(data.workouts[0]?.completion).toMatchObject({ dayShift: 4, matchedBy: 'workout-id' });
  });

  it('leaves every session unmarked when the activities cannot be read', async () => {
    // A plan that cannot be read is a broken page; a completion that cannot be read is a missing
    // tick. The planner must still render.
    const d = deps();
    await createWorkout(d, USER, distanceDraft());
    const store = {
      ...d.store,
      listActivities: () => Promise.reject(new Error('store down'))
    };

    const data = await loadPlanner({ ...d, store }, USER, '2026-08-01', '2026-08-31');

    expect(data.workouts).toHaveLength(1);
    expect(data.workouts[0]?.completion).toBeNull();
  });

  it("never marks a session with another athlete's activity", async () => {
    const d = deps();
    await createWorkout(d, USER, distanceDraft());
    await d.store.putActivities('someone-else', [{ ...activity(), userId: 'someone-else' }]);

    const data = await loadPlanner(d, USER, '2026-08-01', '2026-08-31');

    expect(data.workouts[0]?.completion).toBeNull();
  });
});
