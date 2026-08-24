/**
 * Training section shell (spec 025). One consent gate and one sub-nav for `/training` and every
 * sport subpage under it, so a Base user can never reach any of them and the tab row is derived
 * once from the sports the user actually records.
 */
import { redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';
import { trainingTabs, type TrainingTab } from '$modules/training/training-nav';

const DATA_PROCESSING = 'detailed_analytics';

export const load: LayoutServerLoad = async ({ locals }): Promise<{ tabs: TrainingTab[] }> => {
  if (!(await locals.consent.isEnabled(DATA_PROCESSING))) throw redirect(303, '/');
  const user = locals.user!;
  const sports = await locals.container.store.listSports(user.id);
  return { tabs: trainingTabs(sports) };
};
