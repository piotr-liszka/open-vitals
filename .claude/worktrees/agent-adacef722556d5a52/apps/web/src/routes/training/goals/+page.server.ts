import type { PageServerLoad } from './$types';
import { loadSeason } from '$modules/season/season.api';

export const load: PageServerLoad = async ({ locals }) => {
  const user = locals.user!;
  const c = locals.container;
  const season = await loadSeason(
    { store: c.store, settings: c.repo.settings, clock: c.clock, random: c.random },
    { locale: locals.locale, userId: user.id }
  );
  return { season };
};
