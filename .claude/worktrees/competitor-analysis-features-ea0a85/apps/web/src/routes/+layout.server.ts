/**
 * Root layout load (spec 064). Exists for exactly one reason: the sidebar now lists the user's own
 * dashboards, and the sidebar is on every page. Returning them here means `NavLinks` reads them from
 * `page.data` and no page has to thread them through — the alternative was adding the same prop to
 * eleven loads and remembering it on the twelfth.
 *
 * Deliberately narrow. It returns ids and names, never widgets: the nav draws neither, and a layout
 * load runs on every navigation. It is skipped entirely for signed-out visitors (the landing page).
 */
import type { LayoutServerLoad } from './$types';
import { getConfig, navEntries } from '$modules/dashboards/dashboards.api';
import { dashboardNavItems } from '$modules/dashboards/dashboard-nav';
import type { NavItem } from '$lib/nav';

export const load: LayoutServerLoad = async ({ locals }) => {
  const empty: { dashboardNav: NavItem[] } = { dashboardNav: [] };
  if (!locals.user) return empty;
  const config = await getConfig(locals.container.repo.settings, locals.user.id);
  return { dashboardNav: dashboardNavItems(navEntries(config)) };
};
