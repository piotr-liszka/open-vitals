import { j as json } from '../../../../../chunks/utils.js-D6eaf5bT.js';
import { g as getCoverage } from '../../../../../chunks/sync.api.js-WZxo88-X.js';
import '../../../../../chunks/utils2.js-BQzn9ikS.js';
import '../../../../../chunks/uneval.js-BnYgIxRU.js';
import '../../../../../chunks/interfaces.js-CRv0EuSy.js';

const GET = async ({ locals }) => {
  const user = locals.user;
  if (!user) return json({ error: "unauthorized" }, { status: 401 });
  const c = locals.container;
  return json(await getCoverage({ store: c.store, syncEngine: c.syncEngine }, user.id));
};

export { GET };
//# sourceMappingURL=_server.ts.js-B1ZaweTL.js.map
