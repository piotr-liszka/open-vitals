import { j as json, B as error } from '../../../../../../chunks/utils.js-D6eaf5bT.js';
import { r as runProviderSync, c as createIntegrations, I as IntegrationNotConnectedError } from '../../../../../../chunks/index3.js-BGrpIs1E.js';
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

export { POST };
//# sourceMappingURL=_server.ts.js-B9ZqSihI.js.map
