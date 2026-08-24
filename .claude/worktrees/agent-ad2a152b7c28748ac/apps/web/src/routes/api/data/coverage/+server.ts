/** GET /api/data/coverage — "how much data do you have" for the current user. */
import { json, type RequestHandler } from '@sveltejs/kit';
import { getCoverage } from '$modules/sync/sync.api';
import { todayKey } from '$lib/date';

export const GET: RequestHandler = async ({ locals }) => {
  const user = locals.user;
  if (!user) return json({ error: 'unauthorized' }, { status: 401 });
  const c = locals.container;
  const today = todayKey(c.clock, c.config.appTimeZone);
  return json(await getCoverage({ store: c.store, syncEngine: c.syncEngine }, user.id, today));
};
