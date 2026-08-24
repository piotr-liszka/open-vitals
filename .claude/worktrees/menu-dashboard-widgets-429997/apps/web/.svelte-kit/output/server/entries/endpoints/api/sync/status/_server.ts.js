import { json } from "@sveltejs/kit";
import { b as getSyncStatus } from "../../../../../chunks/sync.api.js";
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
export {
  GET
};
