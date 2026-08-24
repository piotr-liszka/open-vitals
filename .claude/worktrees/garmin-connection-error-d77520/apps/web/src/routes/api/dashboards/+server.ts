/** POST /api/dashboards — persist the current user's dashboard layout (sanitized server-side). */
import { json, type RequestHandler } from '@sveltejs/kit';
import { saveConfig } from '$modules/dashboards/dashboards.api';

export const POST: RequestHandler = async ({ locals, request }) => {
  const user = locals.user;
  if (!user) return json({ error: 'unauthorized' }, { status: 401 });
  const body = await request.json().catch(() => null);
  const saved = await saveConfig(locals.container.repo.settings, user.id, body);
  return json(saved);
};
