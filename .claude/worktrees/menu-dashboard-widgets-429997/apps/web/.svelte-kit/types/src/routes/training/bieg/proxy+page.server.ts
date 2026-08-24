// @ts-nocheck
import type { PageServerLoad } from './$types';
import { loadRunning } from '$modules/running/running.api';
import { loadBestEfforts } from '$modules/best-efforts/best-efforts.api';
import { loadRange } from '$lib/server/range-context';

export const load = async ({ locals, url }: Parameters<PageServerLoad>[0]) => {
  const user = locals.user!;
  const c = locals.container;
  // Window comes from the global range switch (spec 047). Personal bests and the runner archetype
  // stay all-time inside the loader — see `loadRunning`.
  const range = await loadRange(
    { store: c.store, clock: c.clock, timeZone: c.config.appTimeZone },
    user.id,
    url
  );
  // Two independent modules, one page (spec 054): the leaderboard is its own slice, read straight
  // from the stored efforts, and takes no range — a record is over a career.
  const [running, bestEfforts] = await Promise.all([
    loadRunning({ store: c.store, settings: c.repo.settings, clock: c.clock }, { userId: user.id, range }),
    loadBestEfforts({ store: c.store }, { userId: user.id, group: 'run' })
  ]);
  return { running, bestEfforts };
};
