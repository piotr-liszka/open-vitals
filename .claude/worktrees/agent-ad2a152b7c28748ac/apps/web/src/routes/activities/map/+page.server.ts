import type { PageServerLoad } from './$types';
import { loadHeatmap } from '$modules/heatmap/heatmap.api';

export const load: PageServerLoad = async ({ locals, url }) => {
  const user = locals.user!;
  const sport = url.searchParams.get('sport');
  const yearParam = url.searchParams.get('year');
  const year = yearParam ? Number(yearParam) : null;

  const data = await loadHeatmap({ store: locals.container.store }, user.id, {
    sport,
    year: year && Number.isFinite(year) ? year : null
  });
  return { heatmap: data };
};
