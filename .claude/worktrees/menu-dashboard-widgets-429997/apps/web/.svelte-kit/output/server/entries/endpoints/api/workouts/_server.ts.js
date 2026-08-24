import { json } from "@sveltejs/kit";
import { s as scheduleFromTemplate, a as createWorkout, w as workoutErrorStatus } from "../../../../chunks/workouts.api.js";
const isSchedule = (body) => typeof body === "object" && body !== null && typeof body.templateId === "string";
const POST = async ({ locals, request }) => {
  const user = locals.user;
  if (!user) return json({ error: "unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => null);
  if (!body) return json({ error: "invalid JSON body" }, { status: 400 });
  const c = locals.container;
  const deps = { store: c.store, clock: c.clock, random: c.random, consent: locals.consent };
  try {
    if (isSchedule(body)) {
      const scheduled = await scheduleFromTemplate(
        deps,
        user.id,
        body.templateId,
        body.day,
        body.time ?? null
      );
      return scheduled === null ? json({ error: "not found" }, { status: 404 }) : json(scheduled, { status: 201 });
    }
    const created = await createWorkout(deps, user.id, body);
    return json(created, { status: 201 });
  } catch (err) {
    const mapped = workoutErrorStatus(err);
    if (!mapped) throw err;
    return json({ error: mapped.error }, { status: mapped.status });
  }
};
export {
  POST
};
