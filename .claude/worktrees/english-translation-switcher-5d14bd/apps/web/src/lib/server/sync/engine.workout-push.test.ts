/**
 * Authored-workout PUSH phase (spec 050) — the only phase that writes to the user's Garmin account.
 *
 * What these tests defend, in order of how much a regression would cost the athlete:
 *  1. a workout is never created twice upstream (a retry after a partial push must not duplicate it);
 *  2. an "unsupported" answer parks the row instead of retrying forever;
 *  3. a transient failure keeps the row queued;
 *  4. the phase does not run at all unless the user's own switch is on AND the source can write.
 */
import { describe, it, expect } from 'vitest';
import { createSyncEngine } from './engine';
import { createMemoryStore } from '../store/memory';
import { fixedClock } from '../clock';
import { nullLogger } from '../logger';
import { sequenceRandom } from '../random';
import { GarminUnavailableError } from '../interfaces';
import type {
  GarminMetricRange,
  GarminStatus,
  GarminSyncSource,
  GarminWorkoutDeleteResult,
  GarminWorkoutInput,
  GarminWorkoutScheduleResult,
  GarminWorkoutWriteResult
} from '../interfaces';
import type { LocalStore, NewAuthoredWorkout } from '../store/types';

const TODAY = '2026-08-08';
const clock = fixedClock(new Date(`${TODAY}T12:00:00Z`));

interface WriteLog {
  created: GarminWorkoutInput[];
  scheduled: Array<{ id: string; day: string }>;
  deleted: string[];
}

interface WriteBehavior {
  create?: (input: GarminWorkoutInput, n: number) => GarminWorkoutWriteResult | never;
  schedule?: (id: string, day: string) => GarminWorkoutScheduleResult | never;
  /** Omit the write methods entirely — a source that cannot author at all. */
  readOnly?: boolean;
}

/** Minimal sync source: every read is empty, so a test sees ONLY the push phase's effects. */
function writeSource(behavior: WriteBehavior = {}): GarminSyncSource & { log: WriteLog } {
  const log: WriteLog = { created: [], scheduled: [], deleted: [] };
  let creates = 0;
  const base: GarminSyncSource = {
    async getStatus(): Promise<GarminStatus> {
      return { authenticated: true };
    },
    async login() {
      return { outcome: 'success', status: { authenticated: true } };
    },
    async disconnect() {},
    async getMetric() {
      return null;
    },
    async getMetricRange(metric, start, end): Promise<GarminMetricRange> {
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
    }
  };
  if (behavior.readOnly) return { ...base, log };
  return {
    ...base,
    async createWorkout(input): Promise<GarminWorkoutWriteResult> {
      log.created.push(input);
      creates += 1;
      return (
        behavior.create?.(input, creates) ?? { supported: true, workoutId: `g-${creates}`, reason: null }
      );
    },
    async scheduleWorkout(id, day): Promise<GarminWorkoutScheduleResult> {
      log.scheduled.push({ id, day });
      return behavior.schedule?.(id, day) ?? { supported: true, scheduleId: `s-${id}`, reason: null };
    },
    async deleteWorkout(id): Promise<GarminWorkoutDeleteResult> {
      log.deleted.push(id);
      return { supported: true, removed: true };
    },
    log
  };
}

function engineWith(source: GarminSyncSource, workoutPushEnabled = true) {
  const store = createMemoryStore();
  const engine = createSyncEngine({
    store,
    sourceFor: () => source,
    clock,
    logger: nullLogger,
    random: sequenceRandom('run'),
    workoutPushEnabledFor: async () => workoutPushEnabled
  });
  return { store, engine };
}

function newWorkout(over: Partial<NewAuthoredWorkout> = {}): NewAuthoredWorkout {
  return {
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
        target: { type: 'power', low: 250, high: 265 },
        repeats: null,
        steps: null,
        note: null
      }
    ],
    note: null,
    createdAt: `${TODAY}T09:00:00.000Z`,
    ...over
  };
}

async function seed(store: LocalStore, over: Partial<NewAuthoredWorkout> = {}): Promise<void> {
  await store.createWorkout('u1', newWorkout(over));
}

describe('sync engine — authored workout push (spec 050)', () => {
  it('creates, schedules and marks the workout as pushed', async () => {
    const source = writeSource();
    const { store, engine } = engineWith(source);
    await seed(store);

    const run = await engine.syncUser('u1', { kind: 'incremental' });

    expect(source.log.created).toHaveLength(1);
    expect(source.log.created[0]?.title).toBe('4x8 FTP');
    expect(source.log.scheduled).toEqual([{ id: 'g-1', day: '2026-08-20' }]);

    const stored = await store.getWorkout('u1', 'w1');
    expect(stored?.pushState).toBe('pushed');
    expect(stored?.garminWorkoutId).toBe('g-1');
    expect(stored?.garminScheduleId).toBe('s-g-1');
    expect(stored?.pushError).toBeNull();
    expect(run.detail?.workoutPush).toMatchObject({ pushed: 1, failed: 0, unsupported: 0, pending: 0 });
  });

  it('never creates the same workout twice, even across runs', async () => {
    const source = writeSource();
    const { store, engine } = engineWith(source);
    await seed(store);

    await engine.syncUser('u1', { kind: 'incremental' });
    await engine.syncUser('u1', { kind: 'incremental' });

    // Second run: nothing left to do — the row is `pushed`, so it is not even a candidate.
    expect(source.log.created).toHaveLength(1);
  });

  it('a workout whose schedule failed is re-scheduled, NOT re-created', async () => {
    // The half-push case: Garmin took the workout into the library but not onto the calendar.
    let allowSchedule = false;
    const source = writeSource({
      schedule: (id) =>
        allowSchedule
          ? { supported: true, scheduleId: `s-${id}`, reason: null }
          : { supported: false, scheduleId: null, reason: 'unsupported_endpoint' }
    });
    const { store, engine } = engineWith(source);
    await seed(store);

    await engine.syncUser('u1', { kind: 'incremental' });
    const half = await store.getWorkout('u1', 'w1');
    expect(half?.pushState).toBe('failed');
    expect(half?.garminWorkoutId).toBe('g-1'); // the id is KEPT — that is what prevents a duplicate

    allowSchedule = true;
    await engine.syncUser('u1', { kind: 'incremental' });

    expect(source.log.created).toHaveLength(1);
    expect(source.log.scheduled).toHaveLength(2);
    expect((await store.getWorkout('u1', 'w1'))?.pushState).toBe('pushed');
  });

  it('parks an unsupported endpoint instead of retrying it forever', async () => {
    const source = writeSource({
      create: () => ({ supported: false, workoutId: null, reason: 'unsupported_endpoint' })
    });
    const { store, engine } = engineWith(source);
    await seed(store);

    const run = await engine.syncUser('u1', { kind: 'incremental' });
    const parked = await store.getWorkout('u1', 'w1');
    expect(parked?.pushState).toBe('unsupported');
    expect(parked?.pushError).toContain('Garmin');
    expect(run.detail?.workoutPush).toMatchObject({ unsupported: 1, pending: 0 });

    // A second run must not try again: `unsupported` is a permanent answer.
    await engine.syncUser('u1', { kind: 'incremental' });
    expect(source.log.created).toHaveLength(1);
  });

  it('marks a sport Garmin cannot take as unsupported, with its own reason', async () => {
    const source = writeSource({
      create: () => ({ supported: false, workoutId: null, reason: 'unsupported_sport' })
    });
    const { store, engine } = engineWith(source);
    await seed(store, { sport: 'walking' });

    await engine.syncUser('u1', { kind: 'incremental' });

    expect((await store.getWorkout('u1', 'w1'))?.pushError).toContain('dyscypliny');
  });

  it('keeps a transient failure queued for the next run', async () => {
    let fail = true;
    const source = writeSource({
      create: () => {
        if (fail) throw new GarminUnavailableError('boom', { code: 'upstream_error', retryable: true });
        return { supported: true, workoutId: 'g-late', reason: null };
      }
    });
    const { store, engine } = engineWith(source);
    await seed(store);

    const first = await engine.syncUser('u1', { kind: 'incremental' });
    const failed = await store.getWorkout('u1', 'w1');
    expect(failed?.pushState).toBe('failed');
    expect(failed?.garminWorkoutId).toBeNull();
    expect(first.detail?.workoutPush).toMatchObject({ failed: 1, pending: 1 });
    // The failure is recorded per phase and the run carries on — later phases still ran. (Run STATUS
    // is not asserted here: this fake serves no data at all, which is its own "no_data_synced" verdict.)
    expect(first.detail?.metrics).toBeDefined();

    fail = false;
    await engine.syncUser('u1', { kind: 'incremental' });
    expect((await store.getWorkout('u1', 'w1'))?.pushState).toBe('pushed');
  });

  it('stops the batch when the sidecar is unreachable rather than hammering it', async () => {
    const source = writeSource({
      create: () => {
        throw new GarminUnavailableError('down', { code: 'sidecar_unreachable', retryable: true });
      }
    });
    const { store, engine } = engineWith(source);
    await seed(store, { id: 'w1', day: '2026-08-20' });
    await seed(store, { id: 'w2', day: '2026-08-21' });
    await seed(store, { id: 'w3', day: '2026-08-22' });

    const run = await engine.syncUser('u1', { kind: 'incremental' });

    expect(source.log.created).toHaveLength(1);
    expect(run.detail?.workoutPush?.errorCode).toBe('sidecar_unreachable');
    expect((await store.getWorkout('u1', 'w2'))?.pushState).toBe('pending');
  });

  it('leaves past days alone — a session for a day that has gone is not pushed', async () => {
    const source = writeSource();
    const { store, engine } = engineWith(source);
    await seed(store, { day: '2026-08-01' });

    const run = await engine.syncUser('u1', { kind: 'incremental' });

    expect(source.log.created).toEqual([]);
    expect(run.detail?.workoutPush).toMatchObject({ pushed: 0, pending: 0 });
    expect((await store.getWorkout('u1', 'w1'))?.pushState).toBe('pending');
  });

  it('does not run when the push is disabled, and the workout stays pending', async () => {
    const source = writeSource();
    const { store, engine } = engineWith(source, false);
    await seed(store);

    const run = await engine.syncUser('u1', { kind: 'incremental' });

    expect(source.log.created).toEqual([]);
    expect(run.detail?.workoutPush).toBeUndefined();
    expect((await store.getWorkout('u1', 'w1'))?.pushState).toBe('pending');
  });

  // Spec 071 moved the decision from one deployment-wide flag to each user's own Settings switch,
  // so it has to be asked PER USER — a single engine now serves users who disagree about it.
  it('asks per user: one athlete pushes while another, switched off, does not', async () => {
    const source = writeSource();
    const store = createMemoryStore();
    const engine = createSyncEngine({
      store,
      sourceFor: () => source,
      clock,
      logger: nullLogger,
      random: sequenceRandom('run'),
      workoutPushEnabledFor: async (userId) => userId === 'u1'
    });
    await seed(store);
    await store.createWorkout('u2', newWorkout({ id: 'w2' }));

    await engine.syncUser('u1', { kind: 'incremental' });
    await engine.syncUser('u2', { kind: 'incremental' });

    expect(source.log.created).toHaveLength(1);
    expect((await store.getWorkout('u1', 'w1'))?.pushState).toBe('pushed');
    expect((await store.getWorkout('u2', 'w2'))?.pushState).toBe('pending');
  });

  it('skips the phase entirely for a source that cannot write', async () => {
    const source = writeSource({ readOnly: true });
    const { store, engine } = engineWith(source);
    await seed(store);

    const run = await engine.syncUser('u1', { kind: 'incremental' });

    expect(run.detail?.workoutPush).toBeUndefined();
    expect((await store.getWorkout('u1', 'w1'))?.pushState).toBe('pending');
  });
});
