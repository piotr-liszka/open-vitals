/** `PATCH`/`DELETE /api/admin/users/<id>` — edit or remove one user (spec 094). Admin-only. */
import { json, type RequestHandler } from '@sveltejs/kit';
import { deleteUser, updateUser } from '$modules/admin-users/admin-users.api';
import { requireAdminApi } from '$modules/auth/require-admin';
import type { UpdateUserInput } from '$modules/admin-users/admin-users.types';

export const PATCH: RequestHandler = async ({ locals, params, request }) => {
  const forbidden = requireAdminApi(locals.user);
  if (forbidden) return forbidden;

  const body = (await request.json().catch(() => null)) as UpdateUserInput | null;
  if (!body) return json({ error: 'invalid JSON body' }, { status: 400 });

  const result = await updateUser(locals.container, params.id!, body);
  if (!result.ok) {
    return json(
      result.error === 'invalid' ? { error: result.error, fields: result.fields } : { error: result.error },
      { status: result.status }
    );
  }
  return json({ user: result.user }, { status: result.status });
};

export const DELETE: RequestHandler = async ({ locals, params }) => {
  const forbidden = requireAdminApi(locals.user);
  if (forbidden) return forbidden;

  const result = await deleteUser(locals.container, params.id!);
  if (!result.ok) return json({ error: result.error }, { status: result.status });
  return new Response(null, { status: 204 });
};
