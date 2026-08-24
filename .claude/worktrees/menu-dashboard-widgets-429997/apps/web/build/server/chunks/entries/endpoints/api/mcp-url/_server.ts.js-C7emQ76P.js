import { j as json } from '../../../../chunks/utils.js-D6eaf5bT.js';
import { g as getMcpUrl } from '../../../../chunks/mcpUrl.api.js-CfdtOQKl.js';
import '../../../../chunks/utils2.js-BQzn9ikS.js';
import '../../../../chunks/uneval.js-BnYgIxRU.js';

const GET = async ({ locals }) => {
  return json({ url: await getMcpUrl(locals.container, locals.user.id) });
};

export { GET };
//# sourceMappingURL=_server.ts.js-C7emQ76P.js.map
