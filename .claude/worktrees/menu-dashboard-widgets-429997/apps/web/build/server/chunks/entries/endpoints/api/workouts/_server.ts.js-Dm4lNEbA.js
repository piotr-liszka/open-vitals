import { j as json } from '../../../../chunks/utils.js-D6eaf5bT.js';
import { s as scheduleFromTemplate, b as createWorkout, w as workoutErrorStatus } from '../../../../chunks/workouts.api.js-CJgF3eKY.js';
import '../../../../chunks/utils2.js-BQzn9ikS.js';
import '../../../../chunks/uneval.js-BnYgIxRU.js';
import '../../../../chunks/registry.js-Cb3jz9-9.js';
import '../../../../chunks/workouts.js-DQl_W_Sk.js';
import '../../../../chunks/sport-labels.js-BKqMzU19.js';
import '../../../../chunks/date.js-Cf0GyZI8.js';

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

export { POST };
//# sourceMappingURL=_server.ts.js-Dm4lNEbA.js.map
