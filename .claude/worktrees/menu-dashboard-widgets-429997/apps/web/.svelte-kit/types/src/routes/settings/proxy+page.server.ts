// @ts-nocheck
import type { PageServerLoad } from './$types';
import { getHealth } from '$modules/healthcheck/health.api';
import { listConsent } from '$modules/consent/consent.api';
import { getMcpUrl } from '$modules/mcp-url/mcpUrl.api';
import { getIntegrationsStatus } from '$modules/integrations/integrations.api';
import { createIntegrations } from '$lib/server/integrations';
import { ADVANCED_FEATURE } from '$lib/server/tier';

export const load = async ({ locals }: Parameters<PageServerLoad>[0]) => {
  const advanced = await locals.consent.isEnabled(ADVANCED_FEATURE);
  const [health, consent, mcpUrl, integrations] = await Promise.all([
    getHealth(locals.garmin),
    listConsent(locals.consent),
    getMcpUrl(locals.container, locals.user!.id),
    // Integrations live under Settings now; only meaningful for Advanced users.
    advanced ? getIntegrationsStatus(createIntegrations(locals), locals.user!.id) : Promise.resolve(null)
  ]);
  // Advanced mode gets its own dedicated toggle card; the rest stay in the generic consent list.
  const advancedFeature = consent.features.find((f) => f.id === ADVANCED_FEATURE) ?? null;
  const features = consent.features.filter((f) => f.id !== ADVANCED_FEATURE);
  return { health, advancedFeature, features, mcpUrl, integrations, advanced };
};
