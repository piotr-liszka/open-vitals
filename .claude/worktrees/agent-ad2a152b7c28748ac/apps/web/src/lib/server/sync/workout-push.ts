/**
 * Pushing ONE authored workout to Garmin (spec 083) — create it if it is not there, then pin it to
 * its day.
 *
 * Extracted from the sync engine's push phase so the background run and the planner's
 * "Wyślij na Garmina" button share it. The rule that had to stop being duplicated is the
 * idempotency one: a row that already carries a Garmin id is never created again, only its missing
 * schedule is filled in. Two implementations of "have we already created this?" is how a session
 * ends up in the athlete's library twice.
 *
 * The result is a small discriminated value, not a log line: the sync engine turns it into counters
 * and Polish phase text, the endpoint turns it into a view. Neither wording lives here.
 */
import { composeWorkoutDescription } from '$lib/workouts';
import type { Clock } from '../clock';
import type { GarminFailure, GarminSyncSource } from '../interfaces';
import type { AuthoredWorkout, LocalStore } from '../store/types';

/** A classified failure: short human text plus the code/retryability the caller filters on. */
export interface PushFailure {
  text: string;
  code: GarminFailure['code'];
  retryable: boolean;
  endpoint?: string;
}

/**
 * What became of one workout. `failure` is set only when an error was thrown — a Garmin that simply
 * cannot take this workout (`supported: false`) is an answer, not a failure, and carries none.
 */
export interface PushWorkoutResult {
  readonly status: 'pushed' | 'unsupported' | 'failed';
  readonly failure: PushFailure | null;
}

/** The half of `GarminSyncSource` this needs, with both writes present rather than optional. */
export type WritableSource = GarminSyncSource &
  Required<Pick<GarminSyncSource, 'createWorkout' | 'scheduleWorkout'>>;

export interface PushWorkoutDeps {
  readonly store: LocalStore;
  readonly source: WritableSource;
  readonly clock: Clock;
  /**
   * Turn a thrown error into a classified failure. Injected because the two callers disagree about
   * what an error MEANS: inside a sync run a `NotConnected` aborts the whole run and is rethrown,
   * while a single button press just reports it.
   */
  readonly classify: (err: unknown) => PushFailure;
}

/** True when `source` can write at all — the guard both callers use before reaching for this. */
export function canPush(source: GarminSyncSource): source is WritableSource {
  return typeof source.createWorkout === 'function' && typeof source.scheduleWorkout === 'function';
}

/**
 * Create-if-missing, then schedule-if-missing, writing the outcome onto the row.
 *
 * Every exit path updates the stored `pushState`, so the caller never has to remember to. A thrown
 * error is caught and classified here for the same reason: a half-pushed row with a stale state is
 * worse than a failed one, because the next attempt trusts what the row says.
 */
export async function pushWorkout(
  deps: PushWorkoutDeps,
  userId: string,
  workout: AuthoredWorkout
): Promise<PushWorkoutResult> {
  const { store, source, clock, classify } = deps;
  const nowIso = clock.now().toISOString();

  try {
    let garminWorkoutId = workout.garminWorkoutId;
    if (!garminWorkoutId) {
      const created = await source.createWorkout({
        sport: workout.sport,
        title: workout.title,
        steps: workout.steps,
        // The athlete's note plus the provenance line (spec 082). Composed in this tier, which owns
        // content — the sidecar only translates it into Garmin's DTO.
        note: composeWorkoutDescription(workout.note)
      });
      if (!created.supported || !created.workoutId) {
        await store.updateWorkout(userId, workout.id, {
          pushState: 'unsupported',
          pushError:
            created.reason === 'unsupported_sport'
              ? 'Garmin nie zna tej dyscypliny jako treningu'
              : 'Garmin nie udostępnia zapisu treningów dla tego konta',
          updatedAt: nowIso
        });
        return { status: 'unsupported', failure: null };
      }
      garminWorkoutId = created.workoutId;
      // Persisted BEFORE scheduling: if scheduling throws, the id is not lost and the retry skips
      // straight to the schedule step.
      await store.updateWorkout(userId, workout.id, { garminWorkoutId, updatedAt: nowIso });
    }

    const scheduled = await source.scheduleWorkout(garminWorkoutId, workout.day);
    if (!scheduled.supported) {
      // In the library but not on the calendar — a half-push, reported as such.
      await store.updateWorkout(userId, workout.id, {
        pushState: 'failed',
        pushError: 'trening zapisany, ale nie trafił do kalendarza',
        updatedAt: nowIso
      });
      return { status: 'failed', failure: null };
    }

    await store.updateWorkout(userId, workout.id, {
      pushState: 'pushed',
      pushError: null,
      garminScheduleId: scheduled.scheduleId,
      updatedAt: nowIso
    });
    return { status: 'pushed', failure: null };
  } catch (err) {
    // A retryable failure stays `failed` (the next attempt tries again); a permanent one is parked
    // as `unsupported` rather than retried forever.
    const failure = classify(err);
    await store.updateWorkout(userId, workout.id, {
      pushState: failure.retryable ? 'failed' : 'unsupported',
      pushError: failure.text,
      updatedAt: nowIso
    });
    return { status: failure.retryable ? 'failed' : 'unsupported', failure };
  }
}
