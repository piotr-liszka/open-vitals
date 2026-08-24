import type { PageServerLoad } from './$types';
import { getConfig } from '$modules/dashboards/dashboards.api';

export const load: PageServerLoad = async ({ locals }) => {
  const user = locals.user!;
  // The existing config comes along because creating means POSTing the whole document back with one
  // more dashboard in it (spec 064) — the page needs what it is appending to.
  return { config: await getConfig(locals.container.repo.settings, user.id) };
};
