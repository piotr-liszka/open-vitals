/**
 * `/dashboard` stopped being a page in spec 064 — every dashboard has its own URL now — so this is
 * just the door: it sends you to your first one. Kept rather than deleted because it is the address
 * people already have bookmarked, and "the dashboards" is a reasonable thing to link to generically.
 *
 * A `+server.ts` rather than a redirecting `+page.server.ts`, matching `/analytics`, `/power` and
 * `/running`: a route with a load but no component is not a page, and SvelteKit 404s it.
 *
 * 303 and not 308, unlike those three: which dashboard is "first" is user data that changes when they
 * reorder or delete one, so this redirect must never be cached as permanent.
 */
import { createTranslator } from '$lib/i18n';
import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { firstDashboardId, getConfig } from '$modules/dashboards/dashboards.api';
import { dashboardHref } from '$modules/dashboards/dashboard-nav';

export const GET: RequestHandler = async ({ locals, url }) => {
  const user = locals.user;
  if (!user) redirect(303, '/login');
  const config = await getConfig(createTranslator(locals.locale), locals.container.repo.settings, user.id);
  // The range rides along, so arriving here from a range-aware page keeps the window (spec 047).
  redirect(303, `${dashboardHref(firstDashboardId(config))}${url.search}`);
};
