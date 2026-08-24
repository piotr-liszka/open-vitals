import { M as redirect, B as error } from '../../../../../../chunks/utils.js-D6eaf5bT.js';
import { b as beginAuth, c as createIntegrations } from '../../../../../../chunks/index3.js-BGrpIs1E.js';
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

export { GET };
//# sourceMappingURL=_server.ts.js-DAn5iPs1.js.map
