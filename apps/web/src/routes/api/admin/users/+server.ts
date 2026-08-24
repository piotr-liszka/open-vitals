/**
 * `GET`/`POST /api/admin/users` — admin-only user list + create (spec 094).
 *
 * Thin per AGENTS.md §5: builds deps from the container, calls the module handler, and maps its
 * result onto a `Response`. `requireAdminApi` is the authorization checkpoint every `/api/admin/**`
 * endpoint shares — a role check, not a session check, so it stays separate from `authGuard`.
 */
import { json, type RequestHandler } from '@sveltejs/kit';
import { createUser, listUsers } from '$modules/admin-users/admin-users.api';
import { requireAdminApi } from '$modules/auth/require-admin';
import type { CreateUserInput } from '$modules/admin-users/admin-users.types';

export const GET: RequestHandler = async ({ locals }) => {
  const forbidden = requireAdminApi(locals.user);
  if (forbidden) return forbidden;
  return json(await listUsers(locals.container));
};

export const POST: RequestHandler = async ({ locals, request }) => {
  const forbidden = requireAdminApi(locals.user);
  if (forbidden) return forbidden;

  const body = (await request.json().catch(() => null)) as CreateUserInput | null;
  if (!body) return json({ error: 'invalid JSON body' }, { status: 400 });

  const result = await createUser(locals.container, body);
  if (!result.ok) {
    return json(
      result.error === 'invalid' ? { error: result.error, fields: result.fields } : { error: result.error },
      { status: result.status }
    );
  }
  return json({ user: result.user }, { status: result.status });
};
