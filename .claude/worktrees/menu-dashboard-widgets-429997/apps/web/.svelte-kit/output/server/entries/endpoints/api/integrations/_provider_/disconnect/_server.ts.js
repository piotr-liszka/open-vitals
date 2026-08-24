import { json, error } from "@sveltejs/kit";
import { d as disconnect, a as createIntegrations } from "../../../../../../chunks/index3.js";
const PROVIDERS = /* @__PURE__ */ new Set(["strava", "withings"]);
const POST = async ({ locals, params }) => {
  const user = locals.user;
  if (!user) return json({ error: "unauthorized" }, { status: 401 });
  const provider = params.provider ?? "";
  if (!PROVIDERS.has(provider)) throw error(404, "unknown provider");
  await disconnect(createIntegrations(locals), provider, user.id);
  return json({ ok: true });
};
export {
  POST
};
