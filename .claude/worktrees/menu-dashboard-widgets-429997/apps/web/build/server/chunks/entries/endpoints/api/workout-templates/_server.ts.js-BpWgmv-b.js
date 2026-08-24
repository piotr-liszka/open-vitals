import { j as json } from '../../../../chunks/utils.js-D6eaf5bT.js';
import { a as listTemplates, c as createTemplate, w as workoutErrorStatus } from '../../../../chunks/workouts.api.js-CJgF3eKY.js';
import '../../../../chunks/utils2.js-BQzn9ikS.js';
import '../../../../chunks/uneval.js-BnYgIxRU.js';
import '../../../../chunks/registry.js-Cb3jz9-9.js';
import '../../../../chunks/workouts.js-DQl_W_Sk.js';
import '../../../../chunks/sport-labels.js-BKqMzU19.js';
import '../../../../chunks/date.js-Cf0GyZI8.js';

const GET = async ({ locals }) => {
  const user = locals.user;
  if (!user) return json({ error: "unauthorized" }, { status: 401 });
  const c = locals.container;
  const templates = await listTemplates(
    { store: c.store, clock: c.clock, random: c.random, consent: locals.consent },
    user.id
  );
  return json({ templates });
};
const POST = async ({ locals, request }) => {
  const user = locals.user;
  if (!user) return json({ error: "unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => null);
  if (!body) return json({ error: "invalid JSON body" }, { status: 400 });
  const c = locals.container;
  try {
    const created = await createTemplate(
      { store: c.store, clock: c.clock, random: c.random, consent: locals.consent },
      user.id,
      body
    );
    return json(created, { status: 201 });
  } catch (err) {
    const mapped = workoutErrorStatus(err);
    if (!mapped) throw err;
    return json({ error: mapped.error }, { status: mapped.status });
  }
};

export { GET, POST };
//# sourceMappingURL=_server.ts.js-BpWgmv-b.js.map
