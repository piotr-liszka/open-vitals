/** `POST /api/admin/users/<id>/password` — set a new password for another user (spec 094). Admin-only. */
import { json, type RequestHandler } from '@sveltejs/kit';
import { resetPassword } from '$modules/admin-users/admin-users.api';
import { requireAdminApi } from '$modules/auth/require-admin';

export const POST: RequestHandler = async ({ locals, params, request }) => {
  const forbidden = requireAdminApi(locals.user);
  if (forbidden) return forbidden;

  const body = (await request.json().catch(() => null)) as { password?: unknown } | null;
  const result = await resetPassword(locals.container, params.id!, body?.password);
  if (!result.ok) return json({ error: result.error }, { status: result.status });
  return json({ ok: true }, { status: result.status });
};
