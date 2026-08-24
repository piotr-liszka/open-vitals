/**
 * API-integration tests for the planner handlers (spec 066), against the in-memory store.
 *
 * The step model itself is already covered by `$lib/workouts`' own tests; what matters here is that
 * this slice REUSES that validator rather than re-implementing it, that the write switch holds on
 * every write, and that editing a session invalidates the copy already on the watch.
 */
import { describe, it, expect } from 'vitest';
import { createMemoryStore } from '$lib/server/store/memory';
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
  it('resets an already-pushed session to pending', async () => {
    const d = deps();
    const created = await createWorkout(d, USER, draft());
    await d.store.updateWorkout(USER, created.id, {
      pushState: 'pushed',
      garminWorkoutId: 'g-1',
      updatedAt: clock.now().toISOString()
    });

    const updated = await updateWorkout(d, USER, created.id, draft({ title: 'Inne interwały' }));
    expect(updated?.title).toBe('Inne interwały');
    expect(updated?.pushState).toBe('pending');
    expect(updated?.pushError).toBeNull();
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
}

/** A source that writes, with a log of what reached it and per-call behaviour overrides. */
function pushSource(
  behavior: {
    create?: () => GarminWorkoutWriteResult;
    schedule?: () => GarminWorkoutScheduleResult;
  } = {}
): GarminSyncSource & { log: PushLog } {
  const log: PushLog = { created: [], scheduled: [] };
  let creates = 0;
  const source: GarminSyncSource = {
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
      return behavior.schedule?.() ?? { supported: true, scheduleId: `s-${id}`, reason: null };
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

  it('is a no-op the second time — the same idempotency rule the sync run obeys', async () => {
    const d = deps();
    const source = pushSource();
    const created = await createWorkout(d, USER, draft());

    await pushWorkoutNow({ ...d, source }, USER, created.id);
    const again = await pushWorkoutNow({ ...d, source }, USER, created.id);

    // Created once; the second press only re-pins, which is what stops a duplicate in the library.
    expect(source.log.created).toHaveLength(1);
    expect(source.log.scheduled).toHaveLength(2);
    expect(again?.pushState).toBe('pushed');
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
