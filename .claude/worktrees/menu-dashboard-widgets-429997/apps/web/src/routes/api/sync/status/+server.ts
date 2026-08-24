/** GET /api/sync/status?runId= — poll a sync run's progress (defaults to the user's latest run). */
import { json, type RequestHandler } from '@sveltejs/kit';
import { getSyncStatus } from '$modules/sync/sync.api';

export const GET: RequestHandler = async ({ locals, url }) => {
  const user = locals.user;
  if (!user) return json({ error: 'unauthorized' }, { status: 401 });
  const runId = url.searchParams.get('runId') ?? undefined;
  const c = locals.container;
  // The scheduler handle (when this process runs one) is what lets the response say WHEN the next
  // automatic sync lands, so the sidebar can count down to it (spec 027).
  return json(
    await getSyncStatus(
      { store: c.store, syncEngine: c.syncEngine, scheduler: c.schedulerRef.current },
      user.id,
      runId
    )
  );
};
