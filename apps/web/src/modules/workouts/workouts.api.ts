/**
 * Planner handlers (spec 066) — list a window, create, update, delete. Pure over an injected store,
 * clock, random and feature switches; no `Date.now()`, no `crypto` reached for directly.
 *
 * ## One validator, not two
 *
 * Every write goes through `normalizeWorkout` from `$lib/workouts` — the SAME function the MCP tools
 * call. That is the whole reason spec 050 put the model outside `$lib/server`. Its
 * `WorkoutValidationError` already carries a human-readable reason, which becomes the 400 body
 * verbatim, so the rule and the sentence explaining it cannot drift apart.
 *
 * ## Two sources, deliberately not merged (the data still is not — see below)
 *
 * `listWorkouts` is what the athlete authored here (editable, has a push state); `listPlannedEvents`
 * mirrors what Garmin already knew (read-only, replaced wholesale on every sync). They stay separate
 * all the way to the STORE and stay two different types all the way to the UI because only one of
 * them can be edited, and a merged type would have to carry a flag to say which — which is the same
 * information with an extra step.
 *
 * The one exception (spec 093) is RENDERING only, and touches nothing above: once a pushed session
 * has been echoed back into `synced_planned_events` on the same day, `loadPlanner` below folds that
 * one planned row out of `PlannerData.planned` and marks the authored row `syncedBack: true` instead
 * of returning both, so the day panel does not show the same real-world session as two near-identical
 * cards. `matchPlannedEcho` (`planner-merge.ts`) is the pure function that decides which pairs are
 * confident enough to fold; anything it does not pair renders exactly as if this spec did not exist.
 */
import type { Clock } from '$lib/server/clock';
import type { Random } from '$lib/server/random';
import type { FeatureService } from '$lib/server/features/types';
import { WORKOUT_WRITE_FEATURE } from '$lib/server/features/registry';
import type {
  ActivitySummary,
  AuthoredWorkout,
  LocalStore,
  PlannedEvent,
  WorkoutTemplate
} from '$lib/server/store/types';
import { garminFailureOf, type GarminFailure, type GarminSyncSource } from '$lib/server/interfaces';
import { canPush, pushWorkout, type PushFailure } from '$lib/server/sync/workout-push';
import {
  estimateWorkoutDistanceM,
  estimateWorkoutDurationS,
  workoutPrescribedAxis,
  normalizeWorkout,
  WorkoutValidationError
} from '$lib/workouts';
import { isDayKey, toDayKey, type DayKey } from '$lib/date';
import { sportGroup } from '$lib/sport-labels';
import { matchWeek, type CompletedActivity, type PlannedSession } from '$lib/session-match';
import { matchPlannedEcho, type AuthoredMergeCandidate, type PlannedMergeCandidate } from './planner-merge';
import type {
  AuthoredWorkoutView,
  PlannedEventView,
  PlannerData,
  WorkoutCompletion,
  WorkoutDraft,
  WorkoutTemplateDraft,
  WorkoutTemplateView
} from './workouts.types';

export interface WorkoutDeps {
  store: LocalStore;
  clock: Clock;
  random: Random;
  features: FeatureService;
}

/** Thrown for anything the caller could fix; the route maps it to a 400. */
export class WorkoutRequestError extends Error {}
/** Thrown when the athlete has not accepted the workout-write terms; the route maps it to 403. */
export class WorkoutWriteDisabledError extends Error {}

const toView = (
  w: AuthoredWorkout,
  completion: WorkoutCompletion | null = null,
  syncedBack = false
): AuthoredWorkoutView => ({
  id: w.id,
  day: w.day,
  time: w.time,
  sport: w.sport,
  title: w.title,
  steps: w.steps,
  note: w.note,
  pushState: w.pushState,
  pushError: w.pushError,
  // Derived rather than stored: "has this reached Garmin" is exactly "do we hold an upstream id".
  onGarmin: w.garminWorkoutId !== null,
  estimatedDurationS: estimateWorkoutDurationS(w.steps),
  estimatedDistanceM: estimateWorkoutDistanceM(w.steps),
  // Null on every write path: a session just created or edited has not been done yet, and the
  // planner re-loads (and re-derives) straight after a save anyway.
  completion,
  // False on every single-row write path (create/update/delete/push): those never know about the
  // planner's synced events, exactly as they never know about `completion` above. `loadPlanner` is
  // the only caller that computes a real value (spec 093).
  syncedBack
});

const toPlannedView = (p: PlannedEvent): PlannedEventView => ({
  id: p.id,
  day: p.day,
  kind: p.kind,
  title: p.title,
  sport: p.sport,
  description: p.description,
  estimatedDurationS: p.estimatedDurationS,
  estimatedDistanceM: p.estimatedDistanceM
});

/** `HH:MM`, or null. Anything else is a client bug, not a value to coerce. */
function cleanTime(raw: unknown): string | null {
  if (raw === null || raw === undefined || raw === '') return null;
  if (typeof raw !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(raw)) {
    throw new WorkoutRequestError('time must be HH:MM');
  }
  return raw;
}

function cleanDay(raw: unknown): string {
  if (!isDayKey(raw)) throw new WorkoutRequestError('day must be YYYY-MM-DD');
  return raw;
}

const toTemplateView = (t: WorkoutTemplate): WorkoutTemplateView => ({
  id: t.id,
  sport: t.sport,
  title: t.title,
  steps: t.steps,
  note: t.note,
  estimatedDurationS: estimateWorkoutDurationS(t.steps),
  estimatedDistanceM: estimateWorkoutDistanceM(t.steps)
});

/**
 * Everything the planner draws for one visible window.
 *
 * The window is the GRID's bounds, not the month's — the caller passes what it will actually render,
 * including the leading and trailing days borrowed from neighbouring months, or those cells would show
 * as empty when they are not.
 */
export async function loadPlanner(
  deps: WorkoutDeps,
  userId: string,
  from: string,
  to: string
): Promise<PlannerData> {
  const [workouts, planned, canWrite, templates, activities] = await Promise.all([
    deps.store.listWorkouts(userId, { from, to }),
    deps.store.listPlannedEvents(userId, from, to),
    deps.features.isEnabled(WORKOUT_WRITE_FEATURE),
    // The library is not windowed — a reusable session has no date to window BY (spec 069).
    deps.store.listWorkoutTemplates(userId),
    /*
     * What was actually done in the same window (spec 081). Deliberately non-fatal: a plan that
     * cannot be read is a broken page, a completion that cannot be read is a missing tick. So a
     * failure here leaves every session unmarked rather than blanking the planner.
     */
    deps.store.listActivities(userId, { from, to, limit: 500 }).catch((): ActivitySummary[] => [])
  ]);

  const completion = completionByWorkout(workouts, activities);

  /*
   * Fold a pushed session's Garmin echo into its own row (spec 093) — rendering only, see the module
   * header. `matchPlannedEcho` is per-day pure computation over the same two arrays this function
   * already loaded; no new store read, no new call to Garmin.
   */
  const merge = matchPlannedEcho(
    workouts.map((w): AuthoredMergeCandidate => ({
      id: w.id,
      day: w.day,
      sport: w.sport,
      title: w.title,
      garminScheduleId: w.garminScheduleId,
      garminWorkoutId: w.garminWorkoutId
    })),
    planned.map((p): PlannedMergeCandidate => ({ id: p.id, day: p.day, sport: p.sport, title: p.title }))
  );

  return {
    workouts: workouts.map((w) =>
      toView(w, completion.get(w.id) ?? null, merge.syncedBackByWorkoutId.has(w.id))
    ),
    // Excludes any event the merge folded into an authored row — that dot/card is not shown twice.
    planned: planned.filter((p) => !merge.matchedPlannedIds.has(p.id)).map(toPlannedView),
    canWrite,
    templates: templates.map(toTemplateView)
  };
}

/**
 * The local calendar day an activity was trained on — `startTimeLocal` is wall clock, not UTC.
 * `null` for a payload whose timestamp Garmin sent malformed: such an activity is dropped from the
 * matching rather than allowed to throw the whole planner page.
 */
const activityDay = (startTimeLocal: string): DayKey | null => {
  const head = startTimeLocal.slice(0, 10);
  return isDayKey(head) ? head : null;
};

/**
 * Which authored session each activity fulfilled, keyed by workout id (spec 081).
 *
 * Runs the SAME `matchWeek` the week review runs — the id pass first, then the spec-078 heuristic —
 * so the planner's ticks and the review's report can never tell two different stories about the
 * same week. Nothing is written back: completion is a read of two tables, so deleting or re-syncing
 * an activity un-ticks the session by itself.
 */
function completionByWorkout(
  workouts: readonly AuthoredWorkout[],
  activities: readonly ActivitySummary[]
): Map<string, WorkoutCompletion> {
  const sessions: PlannedSession[] = workouts.map((w) => ({
    id: w.id,
    day: toDayKey(w.day),
    family: sportGroup(w.sport),
    title: w.title,
    estimatedDistanceM: estimateWorkoutDistanceM(w.steps),
    estimatedDurationS: estimateWorkoutDurationS(w.steps),
    // Judge it on the unit it was written in, not on whichever estimate happens to be non-null.
    prescribedAxis: workoutPrescribedAxis(w.steps),
    garminWorkoutId: w.garminWorkoutId
  }));

  const done: CompletedActivity[] = [];
  for (const a of activities) {
    const day = activityDay(a.startTimeLocal);
    if (day === null) continue;
    done.push({
      id: a.activityId,
      day,
      family: sportGroup(a.sport),
      name: a.name,
      distanceM: a.distanceM,
      durationS: a.movingS ?? a.durationS,
      garminWorkoutId: a.garminWorkoutId
    });
  }

  const out = new Map<string, WorkoutCompletion>();
  for (const m of matchWeek(sessions, done).matched) {
    out.set(m.planned.id, {
      activityId: m.completed.id,
      adherence: m.adherence,
      adherenceRatio: m.adherenceRatio,
      dayShift: m.dayShift,
      matchedBy: m.matchedBy
    });
  }
  return out;
}

/** The gate every write shares. Read is not gated — showing a plan processes nothing new. */
async function requireWriteEnabled(deps: WorkoutDeps): Promise<void> {
  if (!(await deps.features.isEnabled(WORKOUT_WRITE_FEATURE))) {
    throw new WorkoutWriteDisabledError('Zapis treningów do Garmina jest wyłączony');
  }
}

export async function createWorkout(
  deps: WorkoutDeps,
  userId: string,
  draft: WorkoutDraft
): Promise<AuthoredWorkoutView> {
  await requireWriteEnabled(deps);
  const day = cleanDay(draft.day);
  const time = cleanTime(draft.time);
  // Throws `WorkoutValidationError` with its own explanation, which becomes the 400 body.
  const normalized = normalizeWorkout(draft);

  const created = await deps.store.createWorkout(userId, {
    id: deps.random.token(12),
    day,
    time,
    sport: normalized.sport,
    title: normalized.title,
    steps: normalized.steps,
    note: normalized.note,
    createdAt: deps.clock.now().toISOString()
  });
  return toView(created);
}

/**
 * Apply a patch. Editing the SESSION resets the push state to `pending`: the row on the watch is now
 * out of date, and leaving it `pushed` would tell the sync engine there is nothing to do — the athlete
 * would edit an interval here and ride the old one. `contentPushed: false` resets alongside it (spec
 * 092): whatever Garmin holds for this workout no longer matches, so the next push must delete and
 * recreate rather than trust the stale copy is still an accurate match.
 */
export async function updateWorkout(
  deps: WorkoutDeps,
  userId: string,
  id: string,
  draft: WorkoutDraft
): Promise<AuthoredWorkoutView | null> {
  await requireWriteEnabled(deps);
  const day = cleanDay(draft.day);
  const time = cleanTime(draft.time);
  const normalized = normalizeWorkout(draft);

  const updated = await deps.store.updateWorkout(userId, id, {
    day,
    time,
    sport: normalized.sport,
    title: normalized.title,
    steps: normalized.steps,
    note: normalized.note,
    pushState: 'pending',
    pushError: null,
    contentPushed: false,
    updatedAt: deps.clock.now().toISOString()
  });
  return updated === null ? null : toView(updated);
}

/**
 * Remove the local row.
 *
 * Upstream cleanup is the sync engine's job, exactly as it is for the MCP delete tool — this handler
 * does not reach Garmin. The UI's confirmation says so when the session has already been pushed,
 * because "deleted here, still on your watch until the next sync" is a fact the athlete needs before
 * they confirm, not after.
 */
export async function deleteWorkout(
  deps: WorkoutDeps,
  userId: string,
  id: string
): Promise<AuthoredWorkoutView | null> {
  await requireWriteEnabled(deps);
  const removed = await deps.store.deleteWorkout(userId, id);
  return removed === null ? null : toView(removed);
}

/**
 * Push ONE session to Garmin now (spec 083) — create it if it is not there, pin it to its own day
 * if it is not pinned. The same `pushWorkout` the sync engine runs, so the idempotency rule has one
 * implementation: pressing the button on an unchanged, already-pushed session makes no adapter calls
 * at all (spec 092).
 *
 * Gated on `workout_write` only. `workout_auto_push` deliberately is NOT consulted — an athlete who
 * turned the automation off did so in order to press this button, and checking it here would make
 * the switch disable the thing it exists to enable.
 *
 * Garmin refusing the workout comes back as a 200 carrying `pushState: 'unsupported'` and its
 * reason. That is an answer about the session, not a broken request, and the panel needs the reason.
 */
export async function pushWorkoutNow(
  deps: WorkoutDeps & { source: GarminSyncSource },
  userId: string,
  id: string
): Promise<AuthoredWorkoutView | null> {
  await requireWriteEnabled(deps);

  let workout = await deps.store.getWorkout(userId, id);
  // Null, not an error, for another user's id — indistinguishable from "does not exist" on purpose.
  if (workout === null) return null;

  if (!canPush(deps.source)) {
    throw new WorkoutRequestError('Zapis treningów nie jest dostępny dla tego konta Garmin');
  }

  /*
   * The manual FORCE for the "Wyślij ponownie" affordance (spec 092). The only way this handler is
   * ever invoked with a row already `pushed` is a deliberate press — the sync engine's automatic
   * phase never selects a `pushed` row (see `engine.ts`), and the planner replaces the primary push
   * control with the de-emphasized re-push button the moment a row reaches `pushed`. So a `pushed`
   * row here always means "make this current content live again," never an accidental repeat click:
   * this same patch is what an edit already does, forcing `pushWorkout`'s delete-then-recreate branch
   * whether or not the athlete actually changed anything.
   */
  if (workout.pushState === 'pushed') {
    workout =
      (await deps.store.updateWorkout(userId, id, {
        pushState: 'pending',
        contentPushed: false,
        updatedAt: deps.clock.now().toISOString()
      })) ?? workout;
  }

  await pushWorkout(
    { store: deps.store, source: deps.source, clock: deps.clock, classify: pushFailureOf },
    userId,
    workout
  );

  // Re-read rather than trusting the result: `pushWorkout` owns the row's state, and the view must
  // show what was actually stored — including a `pushError` this handler never sees.
  const after = await deps.store.getWorkout(userId, id);
  return after === null ? null : toView(after);
}

/**
 * Classify a push failure for a single button press.
 *
 * Unlike the sync engine's own classifier this rethrows nothing: there is no run to abort, and a
 * disconnected Garmin account is a sentence the athlete should read, not a 500.
 */
function pushFailureOf(err: unknown): PushFailure {
  const failure = garminFailureOf(err);
  return {
    text: WORKOUT_PUSH_FAILURE_TEXT[failure.code] ?? 'nie udało się wysłać treningu',
    code: failure.code,
    retryable: failure.retryable
  };
}

const WORKOUT_PUSH_FAILURE_TEXT: Record<GarminFailure['code'], string> = {
  timeout: 'Garmin nie odpowiedział na czas',
  sidecar_unreachable: 'usługa Garmin (sidecar) nie odpowiada',
  rate_limited: 'Garmin ogranicza tempo zapytań — spróbuj za chwilę',
  token_rejected: 'Garmin odrzucił token — połącz konto ponownie',
  not_connected: 'konto Garmin nie jest połączone',
  blocked: 'Garmin zablokował połączenie',
  not_found: 'endpoint Garmina nie istnieje',
  bad_response: 'nieoczekiwana odpowiedź usługi',
  internal_key_rejected: 'błąd konfiguracji: web i sidecar mają różne INTERNAL_API_KEY',
  upstream_error: 'błąd po stronie Garmina'
};

/* ---------------------------------------------------------------------------------------------
 * The workout library (spec 069)
 * ------------------------------------------------------------------------------------------- */

export async function listTemplates(deps: WorkoutDeps, userId: string): Promise<WorkoutTemplateView[]> {
  const rows = await deps.store.listWorkoutTemplates(userId);
  return rows.map(toTemplateView);
}

/**
 * A library entry is validated by the same `normalizeWorkout` as a dated session — it is the same step
 * tree, and a second validator would be a second definition of a valid workout. The date fields it
 * does not have are simply not passed.
 */
export async function createTemplate(
  deps: WorkoutDeps,
  userId: string,
  draft: WorkoutTemplateDraft
): Promise<WorkoutTemplateView> {
  await requireWriteEnabled(deps);
  const normalized = normalizeWorkout(draft);
  const created = await deps.store.createWorkoutTemplate(userId, {
    id: deps.random.token(12),
    sport: normalized.sport,
    title: normalized.title,
    steps: normalized.steps,
    note: normalized.note,
    createdAt: deps.clock.now().toISOString()
  });
  return toTemplateView(created);
}

/**
 * Edit a library entry. Deliberately does NOT touch sessions already scheduled from it: scheduling
 * copies the steps (spec 069), so a past session stays an accurate record of what was actually asked
 * for. The UI says so at the point of editing rather than leaving it to be discovered.
 */
export async function updateTemplate(
  deps: WorkoutDeps,
  userId: string,
  id: string,
  draft: WorkoutTemplateDraft
): Promise<WorkoutTemplateView | null> {
  await requireWriteEnabled(deps);
  const normalized = normalizeWorkout(draft);
  const updated = await deps.store.updateWorkoutTemplate(userId, id, {
    sport: normalized.sport,
    title: normalized.title,
    steps: normalized.steps,
    note: normalized.note,
    updatedAt: deps.clock.now().toISOString()
  });
  return updated === null ? null : toTemplateView(updated);
}

export async function deleteTemplate(
  deps: WorkoutDeps,
  userId: string,
  id: string
): Promise<WorkoutTemplateView | null> {
  await requireWriteEnabled(deps);
  const removed = await deps.store.deleteWorkoutTemplate(userId, id);
  return removed === null ? null : toTemplateView(removed);
}

/**
 * Put a library workout on a day — what a drag from the library onto a calendar cell does.
 *
 * The steps are COPIED, not referenced. `createWorkout` below goes through `normalizeWorkout` again on
 * the way in, which both re-validates a tree that may have been stored before a rule changed and
 * guarantees the new row owns its own array. Returns null when the template is not this user's, which
 * the route turns into a 404.
 */
export async function scheduleFromTemplate(
  deps: WorkoutDeps,
  userId: string,
  templateId: string,
  day: string,
  time: string | null = null
): Promise<AuthoredWorkoutView | null> {
  await requireWriteEnabled(deps);
  const template = await deps.store.getWorkoutTemplate(userId, templateId);
  if (template === null) return null;
  return createWorkout(deps, userId, {
    day,
    time,
    sport: template.sport,
    title: template.title,
    steps: template.steps,
    note: template.note
  });
}

export { WorkoutValidationError };

/**
 * Map a thrown reason to a status + a message the UI shows VERBATIM. Lives here, not in the route,
 * for two reasons: SvelteKit refuses any export from a `+server.ts` that is not a method handler (a
 * build-time error, invisible to test/check/lint), and mapping a typed error to a status is the
 * handler's job per AGENTS.md §9 — the route is transport.
 *
 * The validator's own sentence is the message. Inventing a second wording here is how a rule and its
 * explanation drift apart.
 */
export function workoutErrorStatus(err: unknown): { status: number; error: string } | null {
  if (err instanceof WorkoutWriteDisabledError) return { status: 403, error: err.message };
  if (err instanceof WorkoutValidationError || err instanceof WorkoutRequestError) {
    return { status: 400, error: err.message };
  }
  return null;
}
