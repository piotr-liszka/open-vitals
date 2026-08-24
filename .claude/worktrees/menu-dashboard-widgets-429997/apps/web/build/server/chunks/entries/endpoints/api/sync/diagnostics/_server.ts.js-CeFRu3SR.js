import { j as json } from '../../../../../chunks/utils.js-D6eaf5bT.js';
import { a as getSidecarLog } from '../../../../../chunks/sync.api.js-WZxo88-X.js';
import '../../../../../chunks/utils2.js-BQzn9ikS.js';
import '../../../../../chunks/uneval.js-BnYgIxRU.js';
import '../../../../../chunks/interfaces.js-CRv0EuSy.js';

const GET = async ({ locals, url }) => {
  const user = locals.user;
  if (!user) return json({ error: "unauthorized" }, { status: 401 });
  const raw = Number(url.searchParams.get("limit") ?? "100");
  const limit = Number.isFinite(raw) ? Math.max(1, Math.min(400, Math.trunc(raw))) : 100;
  const c = locals.container;
  const res = await getSidecarLog(
    { store: c.store, syncEngine: c.syncEngine, garminSync: c.garminSyncFor(user.id) },
    limit
  );
  return json(res);
};

export { GET };
//# sourceMappingURL=_server.ts.js-CeFRu3SR.js.map
