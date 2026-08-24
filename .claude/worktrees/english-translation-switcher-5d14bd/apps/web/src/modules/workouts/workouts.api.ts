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
 * ## Two sources, deliberately not merged
 *
 * `listWorkouts` is what the athlete authored here (editable, has a push state); `listPlannedEvents`
 * mirrors what Garmin already knew (read-only, replaced wholesale on every sync). They stay separate
 * all the way to the UI because only one of them can be edited, and a merged list would have to carry
 * a flag to say which — which is the same information with an extra step.
 */
import type { Clock } from '$lib/server/clock';
import type { Random } from '$lib/server/random';
import type { FeatureService } from '$lib/server/features/types';
import { WORKOUT_WRITE_FEATURE } from '$lib/server/features/registry';
import type { AuthoredWorkout, LocalStore, PlannedEvent, WorkoutTemplate } from '$lib/server/store/types';
import {
  estimateWorkoutDistanceM,
  estimateWorkoutDurationS,
  normalizeWorkout,
  WorkoutValidationError
} from '$lib/workouts';
import { isDayKey } from '$lib/date';
import type {
  AuthoredWorkoutView,
  PlannedEventView,
  PlannerData,
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

const toView = (w: AuthoredWorkout): AuthoredWorkoutView => ({
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
  estimatedDistanceM: estimateWorkoutDistanceM(w.steps)
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
  const [workouts, planned, canWrite, templates] = await Promise.all([
    deps.store.listWorkouts(userId, { from, to }),
    deps.store.listPlannedEvents(userId, from, to),
    deps.features.isEnabled(WORKOUT_WRITE_FEATURE),
    // The library is not windowed — a reusable session has no date to window BY (spec 069).
    deps.store.listWorkoutTemplates(userId)
  ]);
  return {
    workouts: workouts.map(toView),
    planned: planned.map(toPlannedView),
    canWrite,
    templates: templates.map(toTemplateView)
  };
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
 * would edit an interval here and ride the old one.
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
