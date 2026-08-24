import { j as json } from '../../../../chunks/utils.js-D6eaf5bT.js';
import { s as saveConfig } from '../../../../chunks/dashboards.api.js-rpZOmEGy.js';
import '../../../../chunks/utils2.js-BQzn9ikS.js';
import '../../../../chunks/uneval.js-BnYgIxRU.js';
import '../../../../chunks/dashboards.types.js-BpwEQDmq.js';

const POST = async ({ locals, request }) => {
  const user = locals.user;
  if (!user) return json({ error: "unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => null);
  const saved = await saveConfig(locals.container.repo.settings, user.id, body);
  return json(saved);
};

export { POST };
//# sourceMappingURL=_server.ts.js-DwX-SAA1.js.map
