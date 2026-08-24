/**
 * Direct unit tests for `pushWorkout` (spec 092) — the ONE push path both the sync engine and the
 * planner's manual button share. Exercised here directly, independent of either caller, so a
 * regression in the shared function's own branching cannot hide behind a caller-level test that
 * happens to only exercise a subset of it.
 *
 * What changed from spec 083/050: `garminWorkoutId` alone used to mean "safe to just re-schedule".
 * `contentPushed` now tells apart an id that is stale because of an EDIT (delete + recreate) from one
 * that is stale only because the schedule step has not run yet (schedule-only retry) — and Garmin's
 * `workout_not_found` answer tells apart "the id is gone for some OTHER reason" (self-heal in the
 * same call) from "this account cannot schedule at all" (parked `failed`, unchanged).
 */
import { describe, it, expect } from 'vitest';
import { pushWorkout, type PushFailure, type PushWorkoutDeps, type WritableSource } from './workout-push';
import { createMemoryStore } from '../store/memory';
import { fixedClock } from '../clock';
import type {
  GarminWorkoutDeleteResult,
  GarminWorkoutInput,
  GarminWorkoutScheduleResult,
  GarminWorkoutWriteResult
} from '../interfaces';
import type { AuthoredWorkout, LocalStore, NewAuthoredWorkout } from '../store/types';

const USER = 'u1';
const clock = fixedClock(new Date('2026-08-15T10:00:00Z'));

interface Log {
  created: GarminWorkoutInput[];
  scheduled: Array<{ id: string; day: string }>;
  deleted: string[];
}

/** Every read is empty/unused — only the workout-write trio matters to this suite. */
function testSource(
  behavior: {
    create?: () => GarminWorkoutWriteResult;
    /** `n` is the 1-based call number, so a test can answer the first call differently from later ones. */
    schedule?: (n: number) => GarminWorkoutScheduleResult;
    delete?: () => GarminWorkoutDeleteResult;
    /** False = a source that never had `deleteWorkout` in the first place (spec 092's documented gap). */
    withDelete?: boolean;
  } = {}
): WritableSource & { log: Log } {
  const log: Log = { created: [], scheduled: [], deleted: [] };
  let creates = 0;
  let schedules = 0;
  const base: WritableSource = {
    async login() {
      throw new Error('unused');
    },
    async getStatus() {
      return { authenticated: true };
    },
    async getMetric() {
      return null;
    },
    async getMetricRange(metric, start, end) {
      return { metric, start, end, days: [] };
    },
    async disconnect() {
      throw new Error('unused');
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
      schedules += 1;
      return behavior.schedule?.(schedules) ?? { supported: true, scheduleId: `s-${id}`, reason: null };
    },
    ...(behavior.withDelete === false
      ? {}
      : {
          async deleteWorkout(id: string) {
            log.deleted.push(id);
            return behavior.delete?.() ?? { supported: true, removed: true };
          }
        })
  };
  return Object.assign(base, { log });
}

/** This suite never throws from the source, so `classify` must never be reached. */
function neverClassified(): PushFailure {
  throw new Error('classify should not be called in this test');
}

async function seed(store: LocalStore, over: Partial<NewAuthoredWorkout> = {}): Promise<AuthoredWorkout> {
  return store.createWorkout(USER, {
    id: 'w1',
    day: '2026-08-20',
    time: '18:00',
    sport: 'cycling',
    title: '4x8 FTP',
    steps: [
      {
        kind: 'work',
        durationType: 'time',
        durationValue: 480,
        target: null,
        repeats: null,
        steps: null,
        note: null
      }
    ],
    note: null,
    createdAt: '2026-08-13T09:00:00.000Z',
    ...over
  });
}

describe('pushWorkout (spec 092)', () => {
  it('no id yet → create + schedule (unchanged)', async () => {
    const store = createMemoryStore();
    const workout = await seed(store);
    const source = testSource();
    const deps: PushWorkoutDeps = { store, source, clock, classify: neverClassified };

    const result = await pushWorkout(deps, USER, workout);

    expect(result).toEqual({ status: 'pushed', failure: null });
    expect(source.log.created).toHaveLength(1);
    expect(source.log.scheduled).toHaveLength(1);
    expect(source.log.deleted).toHaveLength(0);
    const stored = await store.getWorkout(USER, 'w1');
    expect(stored?.garminWorkoutId).toBe('g-1');
    expect(stored?.garminScheduleId).toBe('s-g-1');
    expect(stored?.contentPushed).toBe(true);
    expect(stored?.pushState).toBe('pushed');
  });

  it('id present, contentPushed true, schedule succeeds → schedule-only, no delete, no create', async () => {
    const store = createMemoryStore();
    await seed(store);
    const workout = (await store.updateWorkout(USER, 'w1', {
      garminWorkoutId: 'g-existing',
      contentPushed: true,
      pushState: 'failed', // half-pushed: create ok, scheduling had not landed yet
      updatedAt: '2026-08-13T10:00:00.000Z'
    }))!;
    const source = testSource();
    const deps: PushWorkoutDeps = { store, source, clock, classify: neverClassified };

    const result = await pushWorkout(deps, USER, workout);

    expect(result).toEqual({ status: 'pushed', failure: null });
    expect(source.log.created).toHaveLength(0);
    expect(source.log.deleted).toHaveLength(0);
    expect(source.log.scheduled).toEqual([{ id: 'g-existing', day: '2026-08-20' }]);
    const stored = await store.getWorkout(USER, 'w1');
    expect(stored?.garminWorkoutId).toBe('g-existing');
  });

  it('id present, contentPushed false (post-edit) → delete then create + schedule fresh, ending with new ids', async () => {
    const store = createMemoryStore();
    await seed(store);
    const workout = (await store.updateWorkout(USER, 'w1', {
      garminWorkoutId: 'g-old',
      garminScheduleId: 's-old',
      contentPushed: false,
      pushState: 'pending',
      updatedAt: '2026-08-13T10:00:00.000Z'
    }))!;
    const source = testSource();
    const deps: PushWorkoutDeps = { store, source, clock, classify: neverClassified };

    const result = await pushWorkout(deps, USER, workout);

    expect(result).toEqual({ status: 'pushed', failure: null });
    expect(source.log.deleted).toEqual(['g-old']);
    expect(source.log.created).toHaveLength(1);
    expect(source.log.scheduled).toHaveLength(1);
    const stored = await store.getWorkout(USER, 'w1');
    expect(stored?.garminWorkoutId).not.toBe('g-old');
    expect(stored?.garminScheduleId).not.toBe('s-old');
    expect(stored?.contentPushed).toBe(true);
    expect(stored?.pushState).toBe('pushed');
  });

  it(
    'id present, contentPushed true, schedule reports workout_not_found → clears the stale id and ' +
      'retries fresh in the SAME call, ending pushed with new ids',
    async () => {
      const store = createMemoryStore();
      await seed(store);
      const workout = (await store.updateWorkout(USER, 'w1', {
        garminWorkoutId: 'g-gone',
        contentPushed: true,
        pushState: 'failed',
        updatedAt: '2026-08-13T10:00:00.000Z'
      }))!;
      const source = testSource({
        schedule: (n) =>
          n === 1
            ? { supported: false, scheduleId: null, reason: 'workout_not_found' }
            : { supported: true, scheduleId: 's-fresh', reason: null }
      });
      const deps: PushWorkoutDeps = { store, source, clock, classify: neverClassified };

      const result = await pushWorkout(deps, USER, workout);

      expect(result).toEqual({ status: 'pushed', failure: null });
      // Never a delete: the id was already useless upstream, so there was nothing there to clean up.
      expect(source.log.deleted).toHaveLength(0);
      expect(source.log.created).toHaveLength(1);
      expect(source.log.scheduled).toHaveLength(2);
      const stored = await store.getWorkout(USER, 'w1');
      expect(stored?.garminWorkoutId).not.toBe('g-gone');
      expect(stored?.pushState).toBe('pushed');
      expect(stored?.contentPushed).toBe(true);
    }
  );

  it('id present, contentPushed true, schedule reports unsupported_endpoint → unchanged: failed, id kept', async () => {
    const store = createMemoryStore();
    await seed(store);
    const workout = (await store.updateWorkout(USER, 'w1', {
      garminWorkoutId: 'g-existing',
      contentPushed: true,
      pushState: 'failed',
      updatedAt: '2026-08-13T10:00:00.000Z'
    }))!;
    const source = testSource({
      schedule: () => ({ supported: false, scheduleId: null, reason: 'unsupported_endpoint' })
    });
    const deps: PushWorkoutDeps = { store, source, clock, classify: neverClassified };

    const result = await pushWorkout(deps, USER, workout);

    expect(result).toEqual({ status: 'failed', failure: null });
    expect(source.log.created).toHaveLength(0);
    expect(source.log.deleted).toHaveLength(0);
    const stored = await store.getWorkout(USER, 'w1');
    expect(stored?.garminWorkoutId).toBe('g-existing');
    expect(stored?.pushState).toBe('failed');
  });

  it('already pushed, contentPushed true, garminScheduleId set → zero adapter calls, same state back', async () => {
    const store = createMemoryStore();
    await seed(store);
    const workout = (await store.updateWorkout(USER, 'w1', {
      garminWorkoutId: 'g-existing',
      garminScheduleId: 's-existing',
      contentPushed: true,
      pushState: 'pushed',
      pushError: null,
      updatedAt: '2026-08-13T10:00:00.000Z'
    }))!;
    const source = testSource();
    const deps: PushWorkoutDeps = { store, source, clock, classify: neverClassified };

    const result = await pushWorkout(deps, USER, workout);

    expect(result).toEqual({ status: 'pushed', failure: null });
    expect(source.log.created).toHaveLength(0);
    expect(source.log.scheduled).toHaveLength(0);
    expect(source.log.deleted).toHaveLength(0);
    // Untouched — the point of the guarantee is that nothing was written either.
    const stored = await store.getWorkout(USER, 'w1');
    expect(stored?.garminWorkoutId).toBe('g-existing');
    expect(stored?.garminScheduleId).toBe('s-existing');
  });

  it('a source without deleteWorkout degrades to create+schedule without a delete (documented gap)', async () => {
    const store = createMemoryStore();
    await seed(store);
    const workout = (await store.updateWorkout(USER, 'w1', {
      garminWorkoutId: 'g-old',
      contentPushed: false,
      pushState: 'pending',
      updatedAt: '2026-08-13T10:00:00.000Z'
    }))!;
    const source = testSource({ withDelete: false });
    const deps: PushWorkoutDeps = { store, source, clock, classify: neverClassified };

    const result = await pushWorkout(deps, USER, workout);

    expect(result.status).toBe('pushed');
    expect(source.log.deleted).toHaveLength(0);
    expect(source.log.created).toHaveLength(1);
  });
});
