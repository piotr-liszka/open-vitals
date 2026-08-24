/**
 * Root layout load (spec 064). Exists for exactly one reason: the sidebar now lists the user's own
 * dashboards, and the sidebar is on every page. Returning them here means `NavLinks` reads them from
 * `page.data` and no page has to thread them through — the alternative was adding the same prop to
 * eleven loads and remembering it on the twelfth.
 *
 * Deliberately narrow. It returns ids and names, never widgets: the nav draws neither, and a layout
 * load runs on every navigation.
 *
 * It also carries the request's LANGUAGE (spec 076), which is the one thing every page needs whether
 * or not anyone is signed in — so unlike the dashboard list it is returned on the signed-out path too.
 */
import { createTranslator } from '$lib/i18n';
import type { LayoutServerLoad } from './$types';
import { getConfig, navEntries } from '$modules/dashboards/dashboards.api';
import { dashboardNavItems } from '$modules/dashboards/dashboard-nav';
import type { NavItem } from '$lib/nav';

export const load: LayoutServerLoad = async ({ locals }) => {
  const base = { locale: locals.locale };
  if (!locals.user) return { ...base, dashboardNav: [] as NavItem[] };
  const config = await getConfig(
    createTranslator(locals.locale),
    locals.container.repo.settings,
    locals.user.id
  );
  return { ...base, dashboardNav: dashboardNavItems(navEntries(config)) };
};
