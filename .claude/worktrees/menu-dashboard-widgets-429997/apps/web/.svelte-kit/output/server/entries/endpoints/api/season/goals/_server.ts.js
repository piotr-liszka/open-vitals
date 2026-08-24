import { json } from "@sveltejs/kit";
import { l as loadSeason, c as createGoal } from "../../../../../chunks/season.api.js";
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
const GET = async (event) => {
  return json(await loadSeason(deps(event), { userId: event.locals.user.id }));
};
const POST = async (event) => {
  const body = await event.request.json().catch(() => null);
  const result = await createGoal(deps(event), event.locals.user.id, body);
  if (!result.ok) return json({ error: result.error }, { status: result.status });
  return json({ goal: result.goal });
};
export {
  GET,
  POST
};
