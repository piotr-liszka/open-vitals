import { redirect, error } from "@sveltejs/kit";
import { c as completeAuth, a as createIntegrations } from "../../../../../../chunks/index3.js";
const PROVIDERS = /* @__PURE__ */ new Set(["strava", "withings"]);
const GET = async ({ locals, params, cookies, url }) => {
  const user = locals.user;
  if (!user) throw redirect(303, "/login");
  const provider = params.provider ?? "";
  if (!PROVIDERS.has(provider)) throw error(404, "unknown provider");
  const stateCookie = cookies.get(`int_${provider}_state`) ?? "";
  const verifier = cookies.get(`int_${provider}_verifier`) ?? "";
  cookies.delete(`int_${provider}_state`, { path: "/" });
  cookies.delete(`int_${provider}_verifier`, { path: "/" });
  const result = await completeAuth(
    createIntegrations(locals),
    provider,
    {
      code: url.searchParams.get("code"),
      state: url.searchParams.get("state"),
      transaction: stateCookie ? { state: stateCookie, codeVerifier: verifier } : null
    },
    user.id
  );
  const q = result.ok ? `connected=${provider}` : `error=${provider}`;
  throw redirect(303, `/settings/integrations?${q}`);
};
export {
  GET
};
