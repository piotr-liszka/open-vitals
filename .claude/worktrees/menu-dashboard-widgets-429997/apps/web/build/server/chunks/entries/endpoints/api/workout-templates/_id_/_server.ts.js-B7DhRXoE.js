import { j as json } from '../../../../../chunks/utils.js-D6eaf5bT.js';
import { d as deleteTemplate, w as workoutErrorStatus, u as updateTemplate } from '../../../../../chunks/workouts.api.js-CJgF3eKY.js';
import '../../../../../chunks/utils2.js-BQzn9ikS.js';
import '../../../../../chunks/uneval.js-BnYgIxRU.js';
import '../../../../../chunks/registry.js-Cb3jz9-9.js';
import '../../../../../chunks/workouts.js-DQl_W_Sk.js';
import '../../../../../chunks/sport-labels.js-BKqMzU19.js';
import '../../../../../chunks/date.js-Cf0GyZI8.js';

const PATCH = async ({ locals, params, request }) => {
  const user = locals.user;
  if (!user) return json({ error: "unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => null);
  if (!body) return json({ error: "invalid JSON body" }, { status: 400 });
  const c = locals.container;
  try {
    const updated = await updateTemplate(
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
    const removed = await deleteTemplate(
      { store: c.store, clock: c.clock, random: c.random, consent: locals.consent },
      user.id,
      params.id
    );
    return removed === null ? json({ error: "not found" }, { status: 404 }) : json({ deleted: true });
  } catch (err) {
    const mapped = workoutErrorStatus(err);
    if (!mapped) throw err;
    return json({ error: mapped.error }, { status: mapped.status });
  }
};

export { DELETE, PATCH };
//# sourceMappingURL=_server.ts.js-B7DhRXoE.js.map
