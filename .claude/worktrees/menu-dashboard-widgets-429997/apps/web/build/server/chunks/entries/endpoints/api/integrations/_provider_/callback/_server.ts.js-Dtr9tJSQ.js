import { M as redirect, B as error } from '../../../../../../chunks/utils.js-D6eaf5bT.js';
import { a as completeAuth, c as createIntegrations } from '../../../../../../chunks/index3.js-BGrpIs1E.js';
import '../../../../../../chunks/utils2.js-BQzn9ikS.js';
import '../../../../../../chunks/uneval.js-BnYgIxRU.js';
import '../../../../../../chunks/crypto.js-CdmV8EtA.js';
import 'node:crypto';
import '../../../../../../chunks/pkce.js-C0gQeWNp.js';

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

export { GET };
//# sourceMappingURL=_server.ts.js-Dtr9tJSQ.js.map
