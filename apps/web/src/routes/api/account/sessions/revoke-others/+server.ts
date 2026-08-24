/** `POST /api/account/sessions/revoke-others` — sign out every OTHER session of the caller's own (spec 094). */
import { json, type RequestHandler } from '@sveltejs/kit';
import { revokeOtherSessions } from '$modules/account/account.api';

export const POST: RequestHandler = async ({ locals }) => {
  const user = locals.user;
  if (!user) return json({ error: 'unauthorized' }, { status: 401 });
  if (!locals.sessionId) return json({ error: 'unauthorized' }, { status: 401 });

  const result = await revokeOtherSessions(locals.container, user.id, locals.sessionId);
  return json({ ok: true, revoked: result.revoked });
};
