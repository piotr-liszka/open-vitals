import { j as json } from '../../../../../chunks/utils.js-D6eaf5bT.js';
import { b as getSyncStatus } from '../../../../../chunks/sync.api.js-WZxo88-X.js';
import '../../../../../chunks/utils2.js-BQzn9ikS.js';
import '../../../../../chunks/uneval.js-BnYgIxRU.js';
import '../../../../../chunks/interfaces.js-CRv0EuSy.js';

const GET = async ({ locals, url }) => {
  const user = locals.user;
  if (!user) return json({ error: "unauthorized" }, { status: 401 });
  const runId = url.searchParams.get("runId") ?? void 0;
  const c = locals.container;
  return json(
    await getSyncStatus(
      { store: c.store, syncEngine: c.syncEngine, scheduler: c.schedulerRef.current },
      user.id,
      runId
    )
  );
};

export { GET };
//# sourceMappingURL=_server.ts.js-Ckxoeqcb.js.map
