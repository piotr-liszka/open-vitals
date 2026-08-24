// @ts-nocheck
import type { PageServerLoad } from './$types';
import { loadSeason } from '$modules/season/season.api';

export const load = async ({ locals }: Parameters<PageServerLoad>[0]) => {
  const user = locals.user!;
  const c = locals.container;
  const season = await loadSeason(
    { store: c.store, settings: c.repo.settings, consent: locals.consent, clock: c.clock, random: c.random },
    { userId: user.id }
  );
  return { season };
};
