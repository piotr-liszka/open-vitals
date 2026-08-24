import { json } from "@sveltejs/kit";
import { l as listTemplates, c as createTemplate, w as workoutErrorStatus } from "../../../../chunks/workouts.api.js";
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
export {
  GET,
  POST
};
