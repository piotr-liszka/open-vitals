import { redirect, error } from "@sveltejs/kit";
import { b as beginAuth, a as createIntegrations } from "../../../../../../chunks/index3.js";
const PROVIDERS = /* @__PURE__ */ new Set(["strava", "withings"]);
const GET = async ({ locals, params, cookies, url }) => {
  const user = locals.user;
  if (!user) throw redirect(303, "/login");
  const provider = params.provider ?? "";
  if (!PROVIDERS.has(provider)) throw error(404, "unknown provider");
  const { location, transaction } = await beginAuth(
    createIntegrations(locals),
    provider
  );
  const secure = locals.container.config.isProd || url.protocol === "https:";
  const opts = { path: "/", httpOnly: true, sameSite: "lax", secure, maxAge: 600 };
  cookies.set(`int_${provider}_state`, transaction.state, opts);
  cookies.set(`int_${provider}_verifier`, transaction.codeVerifier, opts);
  throw redirect(303, location);
};
export {
  GET
};
