import { redirect } from "@sveltejs/kit";
import { g as getConfig, f as firstDashboardId } from "../../../chunks/dashboards.api.js";
import { a as dashboardHref } from "../../../chunks/dashboard-nav.js";
const GET = async ({ locals, url }) => {
  const user = locals.user;
  if (!user) redirect(303, "/login");
  if (!await locals.consent.isEnabled("detailed_analytics")) redirect(303, "/");
  const config = await getConfig(locals.container.repo.settings, user.id);
  redirect(303, `${dashboardHref(firstDashboardId(config))}${url.search}`);
};
export {
  GET
};
