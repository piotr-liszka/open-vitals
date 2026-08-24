import type { PageServerLoad } from './$types';
import { getHealth } from '$modules/healthcheck/health.api';
import { listFeatures } from '$modules/features/features.api';
import { getMcpUrl } from '$modules/mcp-url/mcpUrl.api';
import { getIntegrationsStatus } from '$modules/integrations/integrations.api';
import { getProfile } from '$modules/settings/profile.api';
import { createIntegrations } from '$lib/server/integrations';
import { getAccountInfo, listOwnSessions } from '$modules/account/account.api';

export const load: PageServerLoad = async ({ locals }) => {
  const [health, features, mcpUrl, integrations, profile, account, sessions] = await Promise.all([
    getHealth(locals.garmin),
    listFeatures(locals.features),
    getMcpUrl(locals.container, locals.user!.id),
    getIntegrationsStatus(createIntegrations(locals), locals.user!.id),
    getProfile(locals.container.repo.settings, locals.user!.id),
    // Self-service "My Account" (spec 094): password/Google status + this user's own sessions only.
    getAccountInfo(locals.container, locals.user!.id),
    listOwnSessions(locals.container, locals.user!.id, locals.sessionId)
  ]);

  // Split by owning integration here rather than in the page: which card a switch belongs to is a
  // property of the switch (spec 071), and the page should only have to render what it is given.
  return {
    health,
    mcpUrl,
    integrations,
    // The athlete's own three numbers (spec 090) — loaded server-side so the card renders already
    // filled in, and so an empty field is a fact rather than "not fetched yet".
    profile,
    account,
    sessions,
    garminFeatures: features.features.filter((f) => f.integration === 'garmin'),
    mcpFeatures: features.features.filter((f) => f.integration === 'mcp')
  };
};
