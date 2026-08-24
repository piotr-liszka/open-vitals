import { g as getHealth } from "../../../chunks/health.api.js";
import { l as listConsent } from "../../../chunks/consent.api.js";
import { g as getMcpUrl } from "../../../chunks/mcpUrl.api.js";
import { g as getIntegrationsStatus, a as createIntegrations } from "../../../chunks/index3.js";
import { A as ADVANCED_FEATURE } from "../../../chunks/tier.js";
const load = async ({ locals }) => {
  const advanced = await locals.consent.isEnabled(ADVANCED_FEATURE);
  const [health, consent, mcpUrl, integrations] = await Promise.all([
    getHealth(locals.garmin),
    listConsent(locals.consent),
    getMcpUrl(locals.container, locals.user.id),
    // Integrations live under Settings now; only meaningful for Advanced users.
    advanced ? getIntegrationsStatus(createIntegrations(locals), locals.user.id) : Promise.resolve(null)
  ]);
  const advancedFeature = consent.features.find((f) => f.id === ADVANCED_FEATURE) ?? null;
  const features = consent.features.filter((f) => f.id !== ADVANCED_FEATURE);
  return { health, advancedFeature, features, mcpUrl, integrations, advanced };
};
export {
  load
};
