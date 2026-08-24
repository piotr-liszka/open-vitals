/**
 * Local factory that assembles the {@link Integrations} bundle from the request container.
 *
 * TODO(wire): this slice is self-contained and uses the MOCK adapters so the whole flow works
 * offline. To go live, swap mock→real via config + container (see INTEGRATION-WIRING.md): read
 * `STRAVA_CLIENT_ID/SECRET` + `WITHINGS_CLIENT_ID/SECRET` from an extended Config, build
 * `createStravaAdapter`/`createWithingsAdapter`, move the token/link stores into the container
 * (backed by an encrypted DB table), and choose real vs mock by a `INTEGRATIONS_ADAPTER` flag.
 */
import type { AppContainer } from '../container';
import { createStravaMock } from './strava.mock';
import { createWithingsMock } from './withings.mock';
import { createMemoryIntegrationTokenStore, createMemoryStravaLinkStore } from './stores';
import type { Integrations } from './types';

// Process-local singletons so a "connected" provider (and its links) survive across requests within
// the running process. Real persistence is the DB follow-up noted above.
const tokenStore = createMemoryIntegrationTokenStore();
const linkStore = createMemoryStravaLinkStore();

/** Absolute callback URL for a provider, from the app's public origin. */
export function integrationRedirectUri(container: Pick<AppContainer, 'config'>, provider: string): string {
  return `${container.config.publicBaseUrl}/api/integrations/${provider}/callback`;
}

/** Build the injected integration bundle for a request (mock adapters for now). */
export function createIntegrations(locals: { container: AppContainer }): Integrations {
  const c = locals.container;
  return {
    store: c.store,
    tokens: tokenStore,
    links: linkStore,
    strava: createStravaMock({ redirectUri: integrationRedirectUri(c, 'strava') }),
    withings: createWithingsMock({ redirectUri: integrationRedirectUri(c, 'withings') }),
    random: c.random,
    clock: c.clock,
    logger: c.logger
  };
}
