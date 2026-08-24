/** POST /auth/logout — delete the session row and clear the cookie (idempotent). */
import { json, type RequestHandler } from '@sveltejs/kit';
import { logout } from '$modules/auth/auth.api';

export const POST: RequestHandler = async ({ locals, cookies }) => {
  const cookieName = locals.container.session.cookieName;
  await logout(locals.container, cookies.get(cookieName));
  cookies.delete(cookieName, { path: '/' });
  return json({ ok: true });
};
