import { json } from "@sveltejs/kit";
import { g as getCoverage } from "../../../../../chunks/sync.api.js";
const GET = async ({ locals }) => {
  const user = locals.user;
  if (!user) return json({ error: "unauthorized" }, { status: 401 });
  const c = locals.container;
  return json(await getCoverage({ store: c.store, syncEngine: c.syncEngine }, user.id));
};
export {
  GET
};
