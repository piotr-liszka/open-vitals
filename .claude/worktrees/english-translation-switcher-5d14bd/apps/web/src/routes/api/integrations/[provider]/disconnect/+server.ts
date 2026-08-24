/** POST /api/integrations/{provider}/disconnect — drop tokens (and Strava links). */
import { json, error, type RequestHandler } from '@sveltejs/kit';
import { disconnect } from '$modules/integrations/integrations.api';
import { createIntegrations } from '$lib/server/integrations';
import type { IntegrationProvider } from '$lib/server/integrations/types';

const PROVIDERS = new Set(['strava', 'withings']);

export const POST: RequestHandler = async ({ locals, params }) => {
  const user = locals.user;
  if (!user) return json({ error: 'unauthorized' }, { status: 401 });
  const provider = params.provider ?? '';
  if (!PROVIDERS.has(provider)) throw error(404, 'unknown provider');

  await disconnect(createIntegrations(locals), provider as IntegrationProvider, user.id);
  return json({ ok: true });
};
