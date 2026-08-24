import { M as redirect } from '../../../../chunks/utils.js-D6eaf5bT.js';
import { g as getConfig } from '../../../../chunks/dashboards.api.js-rpZOmEGy.js';

const load = async ({ locals }) => {
  const user = locals.user;
  if (!await locals.consent.isEnabled("detailed_analytics")) redirect(303, "/");
  return { config: await getConfig(locals.container.repo.settings, user.id) };
};

var _page_server_ts = /*#__PURE__*/Object.freeze({
  __proto__: null,
  load: load
});

export { _page_server_ts as _ };
//# sourceMappingURL=_page.server.ts.js-D4WenlXt.js.map
