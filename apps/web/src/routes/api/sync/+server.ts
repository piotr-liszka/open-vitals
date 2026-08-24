/** POST /api/sync — trigger a sync for the current user (non-blocking; returns the run id). */
import { json, type RequestHandler } from '@sveltejs/kit';
import { cancelSync, triggerSync } from '$modules/sync/sync.api';

export const POST: RequestHandler = async ({ locals, url, request }) => {
  const user = locals.user;
  if (!user) return json({ error: 'unauthorized' }, { status: 401 });

  // kind from query (?kind=full) or JSON body; default to a fast incremental top-up.
  let kind = url.searchParams.get('kind');
  if (!kind) {
    const body = (await request.json().catch(() => null)) as { kind?: string } | null;
    kind = body?.kind ?? null;
  }
  const resolved: 'full' | 'incremental' = kind === 'full' ? 'full' : 'incremental';

  const c = locals.container;
  const res = await triggerSync(
    { store: c.store, syncEngine: c.syncEngine },
    user.id,
    resolved,
    c.clock.now()
  );
  return json(res);
};

/** DELETE /api/sync — stop the current user's in-flight sync. */
export const DELETE: RequestHandler = async ({ locals }) => {
  const user = locals.user;
  if (!user) return json({ error: 'unauthorized' }, { status: 401 });
  const c = locals.container;
  const res = await cancelSync(
    { store: c.store, syncEngine: c.syncEngine, scheduler: c.schedulerRef.current },
    user.id,
    c.clock.now()
  );
  return json(res);
};
