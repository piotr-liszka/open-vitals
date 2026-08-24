/** `POST /api/account/password` — set/change the caller's own password (spec 094). */
import { json, type RequestHandler } from '@sveltejs/kit';
import { setOwnPassword } from '$modules/account/account.api';
import type { SetOwnPasswordInput } from '$modules/account/account.types';

export const POST: RequestHandler = async ({ locals, request }) => {
  const user = locals.user;
  if (!user) return json({ error: 'unauthorized' }, { status: 401 });

  const body = (await request.json().catch(() => null)) as SetOwnPasswordInput | null;
  if (!body) return json({ error: 'invalid JSON body' }, { status: 400 });

  const result = await setOwnPassword(locals.container, user.id, body);
  if (!result.ok) return json({ error: result.error }, { status: result.status });
  return json({ ok: true });
};
