import { json, error } from "@sveltejs/kit";
import { r as runProviderSync, a as createIntegrations, I as IntegrationNotConnectedError } from "../../../../../../chunks/index3.js";
const PROVIDERS = /* @__PURE__ */ new Set(["strava", "withings"]);
const POST = async ({ locals, params }) => {
  const user = locals.user;
  if (!user) return json({ error: "unauthorized" }, { status: 401 });
  const provider = params.provider ?? "";
  if (!PROVIDERS.has(provider)) throw error(404, "unknown provider");
  try {
    const result = await runProviderSync(
      createIntegrations(locals),
      provider,
      user.id
    );
    return json(result);
  } catch (err) {
    if (err instanceof IntegrationNotConnectedError) return json({ error: "not_connected" }, { status: 409 });
    throw err;
  }
};
export {
  POST
};
