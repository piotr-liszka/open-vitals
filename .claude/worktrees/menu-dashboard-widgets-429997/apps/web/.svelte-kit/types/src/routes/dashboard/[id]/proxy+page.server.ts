// @ts-nocheck
import { error, redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { findDashboard, getConfig } from '$modules/dashboards/dashboards.api';
import { loadWidgetData } from '$modules/dashboards/dashboard-data';
import { loadRange } from '$lib/server/range-context';

export const load = async ({ locals, params, url }: Parameters<PageServerLoad>[0]) => {
  const user = locals.user!;
  // Advanced-tier gate (spec 014).
  if (!(await locals.consent.isEnabled('detailed_analytics'))) redirect(303, '/');

  const c = locals.container;
  const config = await getConfig(c.repo.settings, user.id);
  const dashboard = findDashboard(config, params.id);
  /*
   * A 404, not a fall back to the first dashboard (spec 064). Silently showing a different panel than
   * the URL names is how a stale bookmark turns into "my widgets disappeared" — the reader would be
   * looking at someone else's layout with no indication anything had happened.
   */
  if (!dashboard) error(404, 'Nie ma takiego panelu');

  // Even a user-configured panel of dynamic widgets honours the global range (spec 047): the window is
  // resolved once here and every range-aware widget in the registry is built from it.
  const range = await loadRange(
    { store: c.store, clock: c.clock, timeZone: c.config.appTimeZone },
    user.id,
    url
  );
  const widgetData = await loadWidgetData(c.store, user.id, c.clock, c.config.appTimeZone, range);
  return { config, dashboard, widgetData };
};
