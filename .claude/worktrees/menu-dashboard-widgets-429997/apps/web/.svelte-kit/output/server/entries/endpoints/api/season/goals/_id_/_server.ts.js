import { json } from "@sveltejs/kit";
import { d as deleteGoal, u as updateGoal } from "../../../../../../chunks/season.api.js";
function deps({ locals }) {
  const c = locals.container;
  return {
    store: c.store,
    settings: c.repo.settings,
    consent: locals.consent,
    clock: c.clock,
    random: c.random
  };
}
const PATCH = async (event) => {
  const e = event;
  const body = await event.request.json().catch(() => null);
  const result = await updateGoal(deps(e), event.locals.user.id, e.params.id, body);
  if (!result.ok) return json({ error: result.error }, { status: result.status });
  return json({ goal: result.goal });
};
const DELETE = async (event) => {
  const e = event;
  const result = await deleteGoal(deps(e), event.locals.user.id, e.params.id);
  if (!result.ok) return json({ error: result.error }, { status: result.status });
  return json({ deleted: true });
};
export {
  DELETE,
  PATCH
};
