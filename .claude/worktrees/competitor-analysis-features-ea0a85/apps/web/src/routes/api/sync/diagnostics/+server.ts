/**
 * GET /api/sync/diagnostics?limit= — the sidecar's recent log records for the CURRENT user (spec 019).
 *
 * The sidecar is never published (AGENTS.md §3); this authenticated route is the only way its buffer
 * is readable, and the sidecar itself only ever returns records tagged with the caller's user id.
 */
import { json, type RequestHandler } from '@sveltejs/kit';
import { getSidecarLog } from '$modules/sync/sync.api';

export const GET: RequestHandler = async ({ locals, url }) => {
  const user = locals.user;
  if (!user) return json({ error: 'unauthorized' }, { status: 401 });

  const raw = Number(url.searchParams.get('limit') ?? '100');
  const limit = Number.isFinite(raw) ? Math.max(1, Math.min(400, Math.trunc(raw))) : 100;

  const c = locals.container;
  const res = await getSidecarLog(
    { store: c.store, syncEngine: c.syncEngine, garminSync: c.garminSyncFor(user.id) },
    limit
  );
  return json(res);
};
