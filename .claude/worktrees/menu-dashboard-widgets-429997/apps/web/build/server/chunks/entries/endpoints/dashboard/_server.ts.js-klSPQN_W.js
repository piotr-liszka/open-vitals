import { M as redirect } from '../../../chunks/utils.js-D6eaf5bT.js';
import { g as getConfig, a as firstDashboardId } from '../../../chunks/dashboards.api.js-rpZOmEGy.js';
import { a as dashboardHref } from '../../../chunks/dashboard-nav.js-D1hZ-GfH.js';
import '../../../chunks/utils2.js-BQzn9ikS.js';
import '../../../chunks/uneval.js-BnYgIxRU.js';
import '../../../chunks/dashboards.types.js-BpwEQDmq.js';

const GET = async ({ locals, url }) => {
  const user = locals.user;
  if (!user) redirect(303, "/login");
  if (!await locals.consent.isEnabled("detailed_analytics")) redirect(303, "/");
  const config = await getConfig(locals.container.repo.settings, user.id);
  redirect(303, `${dashboardHref(firstDashboardId(config))}${url.search}`);
};

export { GET };
//# sourceMappingURL=_server.ts.js-klSPQN_W.js.map
