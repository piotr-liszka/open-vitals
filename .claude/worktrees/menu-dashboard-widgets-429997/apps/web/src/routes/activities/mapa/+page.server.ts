import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { loadHeatmap } from '$modules/heatmap/heatmap.api';

const DATA_PROCESSING = 'detailed_analytics';

export const load: PageServerLoad = async ({ locals, url }) => {
  const user = locals.user!;
  // Advanced-tier gate (spec 014): base users are redirected home.
  if (!(await locals.consent.isEnabled(DATA_PROCESSING))) throw redirect(303, '/');

  const sport = url.searchParams.get('sport');
  const yearParam = url.searchParams.get('year');
  const year = yearParam ? Number(yearParam) : null;

  const data = await loadHeatmap({ store: locals.container.store }, user.id, {
    sport,
    year: year && Number.isFinite(year) ? year : null
  });
  return { heatmap: data };
};
