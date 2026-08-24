import { json } from "@sveltejs/kit";
import { c as cancelSync, t as triggerSync } from "../../../../chunks/sync.api.js";
const POST = async ({ locals, url, request }) => {
  const user = locals.user;
  if (!user) return json({ error: "unauthorized" }, { status: 401 });
  let kind = url.searchParams.get("kind");
  if (!kind) {
    const body = await request.json().catch(() => null);
    kind = body?.kind ?? null;
  }
  const resolved = kind === "full" ? "full" : "incremental";
  const c = locals.container;
  const res = await triggerSync(
    { store: c.store, syncEngine: c.syncEngine },
    user.id,
    resolved,
    c.clock.now()
  );
  return json(res);
};
const DELETE = async ({ locals }) => {
  const user = locals.user;
  if (!user) return json({ error: "unauthorized" }, { status: 401 });
  const c = locals.container;
  const res = await cancelSync(
    { store: c.store, syncEngine: c.syncEngine, scheduler: c.schedulerRef.current },
    user.id,
    c.clock.now()
  );
  return json(res);
};
export {
  DELETE,
  POST
};
