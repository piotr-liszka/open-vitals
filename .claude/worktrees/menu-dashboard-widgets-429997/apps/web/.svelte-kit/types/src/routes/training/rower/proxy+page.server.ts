// @ts-nocheck
import type { PageServerLoad } from './$types';
import { loadPower } from '$modules/power/power.api';

/** Cycling analysis. `group: 'ride'` is what keeps running-power efforts out of the rider radar. */
export const load = async ({ locals }: Parameters<PageServerLoad>[0]) => {
  const user = locals.user!;
  const c = locals.container;
  const power = await loadPower(
    { store: c.store, settings: c.repo.settings },
    { userId: user.id, group: 'ride' }
  );
  return { power };
};
