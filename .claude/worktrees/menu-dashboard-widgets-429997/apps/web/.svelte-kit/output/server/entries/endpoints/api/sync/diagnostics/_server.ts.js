import { json } from "@sveltejs/kit";
import { a as getSidecarLog } from "../../../../../chunks/sync.api.js";
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
export {
  GET
};
