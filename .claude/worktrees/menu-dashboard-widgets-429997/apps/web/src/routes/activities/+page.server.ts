import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { loadActivities } from '$modules/activities/activities.api';
import { loadRange } from '$lib/server/range-context';
import type { ActivitySort, SortDir } from '$modules/activities/activities.types';

const DATA_PROCESSING = 'detailed_analytics';

const isSort = (v: string | null): v is ActivitySort => v === 'date' || v === 'distance' || v === 'duration';
const isDir = (v: string | null): v is SortDir => v === 'asc' || v === 'desc';

export const load: PageServerLoad = async ({ locals, url }) => {
  const user = locals.user!;
  // Advanced-tier gate (spec 014): base users are redirected home.
  if (!(await locals.consent.isEnabled(DATA_PROCESSING))) throw redirect(303, '/');

  const sortParam = url.searchParams.get('sort');
  const dirParam = url.searchParams.get('dir');
  const pageParam = Number(url.searchParams.get('page'));

  const c = locals.container;
  // The list narrows to the global range too (spec 047), combined with sport/search/sort.
  const range = await loadRange(
    { store: c.store, clock: c.clock, timeZone: c.config.appTimeZone },
    user.id,
    url
  );

  const data = await loadActivities({ store: c.store }, user.id, {
    sport: url.searchParams.get('sport'),
    search: url.searchParams.get('search'),
    range,
    ...(isSort(sortParam) ? { sort: sortParam } : {}),
    ...(isDir(dirParam) ? { dir: dirParam } : {}),
    ...(Number.isFinite(pageParam) && pageParam > 0 ? { page: pageParam } : {})
  });

  return { activities: data };
};
