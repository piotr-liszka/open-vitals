// @ts-nocheck
import type { PageServerLoad } from './$types';
import { loadVolume } from '$modules/volume/volume.api';

export const load = async ({ locals }: Parameters<PageServerLoad>[0]) => {
  const user = locals.user!;
  const c = locals.container;
  const volume = await loadVolume({ store: c.store, clock: c.clock }, { userId: user.id });
  return { volume };
};
