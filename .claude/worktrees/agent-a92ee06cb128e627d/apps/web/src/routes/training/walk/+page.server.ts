import type { PageServerLoad } from './$types';
import { loadWalking } from '$modules/walking/walking.api';
import { loadRange } from '$lib/server/range-context';

export const load: PageServerLoad = async ({ locals, url }) => {
  const user = locals.user!;
  const c = locals.container;
  // Window comes from the global range switch (spec 047).
  const range = await loadRange(
    { store: c.store, clock: c.clock, timeZone: c.config.appTimeZone },
    user.id,
    url
  );
  const walking = await loadWalking(
    { store: c.store, clock: c.clock },
    { userId: user.id, locale: locals.locale, range }
  );
  return { walking };
};
