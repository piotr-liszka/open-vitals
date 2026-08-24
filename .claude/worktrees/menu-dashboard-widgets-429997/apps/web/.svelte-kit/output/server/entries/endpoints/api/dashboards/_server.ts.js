import { json } from "@sveltejs/kit";
import { s as saveConfig } from "../../../../chunks/dashboards.api.js";
const POST = async ({ locals, request }) => {
  const user = locals.user;
  if (!user) return json({ error: "unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => null);
  const saved = await saveConfig(locals.container.repo.settings, user.id, body);
  return json(saved);
};
export {
  POST
};
