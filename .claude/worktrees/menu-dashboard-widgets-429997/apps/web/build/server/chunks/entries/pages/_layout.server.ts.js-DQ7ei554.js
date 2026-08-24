import { g as getConfig, n as navEntries } from '../../chunks/dashboards.api.js-rpZOmEGy.js';
import { d as dashboardNavItems } from '../../chunks/dashboard-nav.js-D1hZ-GfH.js';

const load = async ({ locals }) => {
  const empty = { dashboardNav: [] };
  if (!locals.user) return empty;
  if (!await locals.consent.isEnabled("detailed_analytics")) return empty;
  const config = await getConfig(locals.container.repo.settings, locals.user.id);
  return { dashboardNav: dashboardNavItems(navEntries(config)) };
};

var _layout_server_ts = /*#__PURE__*/Object.freeze({
  __proto__: null,
  load: load
});

export { _layout_server_ts as _ };
//# sourceMappingURL=_layout.server.ts.js-DQ7ei554.js.map
