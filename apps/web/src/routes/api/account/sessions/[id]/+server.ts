/**
 * `DELETE /api/account/sessions/<id>` — revoke one of the caller's OWN sessions (spec 094).
 * Equivalent to "sign out" when it happens to be the current one — `wasCurrent` tells the client
 * whether to redirect to `/login` right away instead of leaving a dead cookie in the browser.
 */
import { json, type RequestHandler } from '@sveltejs/kit';
import { revokeOwnSession } from '$modules/account/account.api';

export const DELETE: RequestHandler = async ({ locals, params }) => {
  const user = locals.user;
  if (!user) return json({ error: 'unauthorized' }, { status: 401 });

  const result = await revokeOwnSession(locals.container, user.id, params.id!, locals.sessionId);
  if (!result.ok) return json({ error: result.error }, { status: result.status });
  return json({ ok: true, wasCurrent: result.wasCurrent });
};
