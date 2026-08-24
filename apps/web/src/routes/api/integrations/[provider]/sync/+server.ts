/** POST /api/integrations/{provider}/sync — import Withings weight / link Strava activities. */
import { json, error, type RequestHandler } from '@sveltejs/kit';
import { runProviderSync, IntegrationNotConnectedError } from '$modules/integrations/integrations.api';
import { createIntegrations } from '$lib/server/integrations';
import type { IntegrationProvider } from '$lib/server/integrations/types';

const PROVIDERS = new Set(['strava', 'withings']);

export const POST: RequestHandler = async ({ locals, params }) => {
  const user = locals.user;
  if (!user) return json({ error: 'unauthorized' }, { status: 401 });
  const provider = params.provider ?? '';
  if (!PROVIDERS.has(provider)) throw error(404, 'unknown provider');

  try {
    const result = await runProviderSync(
      createIntegrations(locals),
      provider as IntegrationProvider,
      user.id
    );
    return json(result);
  } catch (err) {
    if (err instanceof IntegrationNotConnectedError) return json({ error: 'not_connected' }, { status: 409 });
    throw err;
  }
};
