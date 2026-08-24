import { j as json, B as error } from '../../../../../../chunks/utils.js-D6eaf5bT.js';
import { d as disconnect, c as createIntegrations } from '../../../../../../chunks/index3.js-BGrpIs1E.js';
import '../../../../../../chunks/utils2.js-BQzn9ikS.js';
import '../../../../../../chunks/uneval.js-BnYgIxRU.js';
import '../../../../../../chunks/crypto.js-CdmV8EtA.js';
import 'node:crypto';
import '../../../../../../chunks/pkce.js-C0gQeWNp.js';

const PROVIDERS = /* @__PURE__ */ new Set(["strava", "withings"]);
const POST = async ({ locals, params }) => {
  const user = locals.user;
  if (!user) return json({ error: "unauthorized" }, { status: 401 });
  const provider = params.provider ?? "";
  if (!PROVIDERS.has(provider)) throw error(404, "unknown provider");
  await disconnect(createIntegrations(locals), provider, user.id);
  return json({ ok: true });
};

export { POST };
//# sourceMappingURL=_server.ts.js-D74tY4Un.js.map
