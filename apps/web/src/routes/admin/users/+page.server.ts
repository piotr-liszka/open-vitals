/** `/admin/users` — admin-only user management (spec 094). Thin per AGENTS.md §5. */
import type { PageServerLoad } from './$types';
import { requireAdmin } from '$modules/auth/require-admin';
import { listUsers } from '$modules/admin-users/admin-users.api';

export const load: PageServerLoad = async ({ locals }) => {
  requireAdmin(locals.user);
  const { users } = await listUsers(locals.container);
  return { users, currentUserId: locals.user!.id };
};
