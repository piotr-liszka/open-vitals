import { j as json } from '../../../../../../chunks/utils.js-D6eaf5bT.js';
import { r as rotateMcpUrl } from '../../../../../../chunks/mcpUrl.api.js-CfdtOQKl.js';
import '../../../../../../chunks/utils2.js-BQzn9ikS.js';
import '../../../../../../chunks/uneval.js-BnYgIxRU.js';

const POST = async ({ locals }) => {
  const url = await rotateMcpUrl(locals.container, locals.user.id);
  return json({ url });
};

export { POST };
//# sourceMappingURL=_server.ts.js-DbTRbKyN.js.map
