/**
 * Training section shell (spec 025). One sub-nav for `/training` and every subpage under it.
 *
 * Since spec 088 the pathname also decides WHICH bar: `Analiza` (derived from the sports the user
 * actually records) or `Plan treningowy` (the same two tabs for everyone). `url.pathname` is read
 * here, which is what makes SvelteKit re-run this load when the reader crosses between the two.
 */
import type { LayoutServerLoad } from './$types';
import { loadTrainingTabs } from '$modules/training/training.api';
import type { TrainingTabsResult } from '$modules/training/training.types';

export const load: LayoutServerLoad = async ({ locals, url }): Promise<TrainingTabsResult> => {
  const user = locals.user!;
  return loadTrainingTabs(
    { store: locals.container.store },
    { userId: user.id, locale: locals.locale, pathname: url.pathname }
  );
};
