// @ts-nocheck
import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getConfig } from '$modules/dashboards/dashboards.api';

export const load = async ({ locals }: Parameters<PageServerLoad>[0]) => {
  const user = locals.user!;
  // Advanced-tier gate (spec 014).
  if (!(await locals.consent.isEnabled('detailed_analytics'))) redirect(303, '/');

  // The existing config comes along because creating means POSTing the whole document back with one
  // more dashboard in it (spec 064) — the page needs what it is appending to.
  return { config: await getConfig(locals.container.repo.settings, user.id) };
};
