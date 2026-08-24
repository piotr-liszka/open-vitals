/** GET /api/integrations/{provider}/connect — begin OAuth: stash state+PKCE, redirect to provider. */
import { redirect, error, type RequestHandler } from '@sveltejs/kit';
import { beginAuth } from '$modules/integrations/integrations.api';
import { createIntegrations } from '$lib/server/integrations';
import type { IntegrationProvider } from '$lib/server/integrations/types';

const PROVIDERS = new Set(['strava', 'withings']);

export const GET: RequestHandler = async ({ locals, params, cookies, url }) => {
  const user = locals.user;
  if (!user) throw redirect(303, '/login');
  const provider = params.provider ?? '';
  if (!PROVIDERS.has(provider)) throw error(404, 'unknown provider');

  const { location, transaction } = await beginAuth(
    createIntegrations(locals),
    provider as IntegrationProvider
  );
  const secure = locals.container.config.isProd || url.protocol === 'https:';
  const opts = { path: '/', httpOnly: true, sameSite: 'lax', secure, maxAge: 600 } as const;
  cookies.set(`int_${provider}_state`, transaction.state, opts);
  cookies.set(`int_${provider}_verifier`, transaction.codeVerifier, opts);
  throw redirect(303, location);
};
