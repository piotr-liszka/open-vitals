import { json } from "@sveltejs/kit";
import { b as deleteWorkout, w as workoutErrorStatus, e as updateWorkout } from "../../../../../chunks/workouts.api.js";
const PATCH = async ({ locals, params, request }) => {
  const user = locals.user;
  if (!user) return json({ error: "unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => null);
  if (!body) return json({ error: "invalid JSON body" }, { status: 400 });
  const c = locals.container;
  try {
    const updated = await updateWorkout(
      { store: c.store, clock: c.clock, random: c.random, consent: locals.consent },
      user.id,
      params.id,
      body
    );
    return updated === null ? json({ error: "not found" }, { status: 404 }) : json(updated);
  } catch (err) {
    const mapped = workoutErrorStatus(err);
    if (!mapped) throw err;
    return json({ error: mapped.error }, { status: mapped.status });
  }
};
const DELETE = async ({ locals, params }) => {
  const user = locals.user;
  if (!user) return json({ error: "unauthorized" }, { status: 401 });
  const c = locals.container;
  try {
    const removed = await deleteWorkout(
      { store: c.store, clock: c.clock, random: c.random, consent: locals.consent },
      user.id,
      params.id
    );
    return removed === null ? json({ error: "not found" }, { status: 404 }) : json({ deleted: true, onGarmin: removed.onGarmin });
  } catch (err) {
    const mapped = workoutErrorStatus(err);
    if (!mapped) throw err;
    return json({ error: mapped.error }, { status: mapped.status });
  }
};
export {
  DELETE,
  PATCH
};
