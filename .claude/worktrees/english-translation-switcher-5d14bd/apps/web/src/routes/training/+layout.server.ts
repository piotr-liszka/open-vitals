/**
 * Training section shell (spec 025). One sub-nav for `/training` and every sport subpage under it,
 * so the tab row is derived once from the sports the user actually records.
 */
import type { LayoutServerLoad } from './$types';
import { trainingTabs, type TrainingTab } from '$modules/training/training-nav';
import { createTranslator } from '$lib/i18n';

export const load: LayoutServerLoad = async ({ locals }): Promise<{ tabs: TrainingTab[] }> => {
  const user = locals.user!;
  const sports = await locals.container.store.listSports(user.id);
  return { tabs: trainingTabs(createTranslator(locals.locale), sports) };
};
