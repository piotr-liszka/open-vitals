import { g as getHealth } from '../../../chunks/health.api.js-BgYjM4BU.js';
import { l as listConsent } from '../../../chunks/consent.api.js-X7al9k4a.js';
import { g as getMcpUrl } from '../../../chunks/mcpUrl.api.js-CfdtOQKl.js';
import { g as getIntegrationsStatus, c as createIntegrations } from '../../../chunks/index3.js-BGrpIs1E.js';
import { A as ADVANCED_FEATURE } from '../../../chunks/tier.js-D9LGF7b1.js';

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

var _page_server_ts = /*#__PURE__*/Object.freeze({
  __proto__: null,
  load: load
});

export { _page_server_ts as _ };
//# sourceMappingURL=_page.server.ts.js-9wZjh6WF.js.map
