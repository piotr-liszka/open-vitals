import { W as WORKOUT_WRITE_FEATURE } from "./registry.js";
import { n as normalizeWorkout, W as WorkoutValidationError, e as estimateWorkoutDistanceM, a as estimateWorkoutDurationS } from "./workouts.js";
import { i as isDayKey } from "./date.js";
class WorkoutRequestError extends Error {
}
class WorkoutConsentError extends Error {
}
const toView = (w) => ({
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
const toPlannedView = (p) => ({
  id: p.id,
  day: p.day,
  kind: p.kind,
  title: p.title,
  sport: p.sport,
  description: p.description,
  estimatedDurationS: p.estimatedDurationS,
  estimatedDistanceM: p.estimatedDistanceM
});
function cleanTime(raw) {
  if (raw === null || raw === void 0 || raw === "") return null;
  if (typeof raw !== "string" || !/^([01]\d|2[0-3]):[0-5]\d$/.test(raw)) {
    throw new WorkoutRequestError("time must be HH:MM");
  }
  return raw;
}
function cleanDay(raw) {
  if (!isDayKey(raw)) throw new WorkoutRequestError("day must be YYYY-MM-DD");
  return raw;
}
const toTemplateView = (t) => ({
  id: t.id,
  sport: t.sport,
  title: t.title,
  steps: t.steps,
  note: t.note,
  estimatedDurationS: estimateWorkoutDurationS(t.steps),
  estimatedDistanceM: estimateWorkoutDistanceM(t.steps)
});
async function loadPlanner(deps, userId, from, to) {
  const [workouts, planned, canWrite, templates] = await Promise.all([
    deps.store.listWorkouts(userId, { from, to }),
    deps.store.listPlannedEvents(userId, from, to),
    deps.consent.isEnabled(WORKOUT_WRITE_FEATURE),
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
async function requireWriteConsent(deps) {
  if (!await deps.consent.isEnabled(WORKOUT_WRITE_FEATURE)) {
    throw new WorkoutConsentError("Zgoda na zapis treningów jest wyłączona");
  }
}
async function createWorkout(deps, userId, draft) {
  await requireWriteConsent(deps);
  const day = cleanDay(draft.day);
  const time = cleanTime(draft.time);
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
async function updateWorkout(deps, userId, id, draft) {
  await requireWriteConsent(deps);
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
    pushState: "pending",
    pushError: null,
    updatedAt: deps.clock.now().toISOString()
  });
  return updated === null ? null : toView(updated);
}
async function deleteWorkout(deps, userId, id) {
  await requireWriteConsent(deps);
  const removed = await deps.store.deleteWorkout(userId, id);
  return removed === null ? null : toView(removed);
}
async function listTemplates(deps, userId) {
  const rows = await deps.store.listWorkoutTemplates(userId);
  return rows.map(toTemplateView);
}
async function createTemplate(deps, userId, draft) {
  await requireWriteConsent(deps);
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
async function updateTemplate(deps, userId, id, draft) {
  await requireWriteConsent(deps);
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
async function deleteTemplate(deps, userId, id) {
  await requireWriteConsent(deps);
  const removed = await deps.store.deleteWorkoutTemplate(userId, id);
  return removed === null ? null : toTemplateView(removed);
}
async function scheduleFromTemplate(deps, userId, templateId, day, time = null) {
  await requireWriteConsent(deps);
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
function workoutErrorStatus(err) {
  if (err instanceof WorkoutConsentError) return { status: 403, error: err.message };
  if (err instanceof WorkoutValidationError || err instanceof WorkoutRequestError) {
    return { status: 400, error: err.message };
  }
  return null;
}
export {
  createWorkout as a,
  deleteWorkout as b,
  createTemplate as c,
  deleteTemplate as d,
  updateWorkout as e,
  loadPlanner as f,
  listTemplates as l,
  scheduleFromTemplate as s,
  updateTemplate as u,
  workoutErrorStatus as w
};
