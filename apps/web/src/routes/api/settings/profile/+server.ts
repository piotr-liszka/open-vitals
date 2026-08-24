/**
 * GET/PUT `/api/settings/profile` — the athlete's FTP, maximum heart rate and body weight (spec 090).
 *
 * Thin by design: build the port from the container, hand the untrusted body to the module, map its
 * verdict to a status. `hooks.server.ts` has already refused an unauthenticated caller, but the user
 * is re-checked here rather than asserted — a 401 is cheaper than a profile written under `undefined`.
 */
import { json, type RequestHandler } from '@sveltejs/kit';
import { getProfile, putProfile } from '$modules/settings/profile.api';

export const GET: RequestHandler = async ({ locals }) => {
  const user = locals.user;
  if (!user) return json({ error: 'unauthorized' }, { status: 401 });
  return json(await getProfile(locals.container.repo.settings, user.id));
};

export const PUT: RequestHandler = async ({ locals, request }) => {
  const user = locals.user;
  if (!user) return json({ error: 'unauthorized' }, { status: 401 });

  const body = await request.json().catch(() => null);
  const result = await putProfile(locals.container.repo.settings, user.id, body);
  return json(result.body, result.ok ? undefined : { status: result.status });
};
