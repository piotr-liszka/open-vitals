import { g as getConfig, n as navEntries } from "../../chunks/dashboards.api.js";
import { d as dashboardNavItems } from "../../chunks/dashboard-nav.js";
const load = async ({ locals }) => {
  const empty = { dashboardNav: [] };
  if (!locals.user) return empty;
  if (!await locals.consent.isEnabled("detailed_analytics")) return empty;
  const config = await getConfig(locals.container.repo.settings, locals.user.id);
  return { dashboardNav: dashboardNavItems(navEntries(config)) };
};
export {
  load
};
