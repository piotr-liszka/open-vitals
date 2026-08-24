import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { loadTrainingOverview } from '$modules/training/training.api';
import { loadWeeklySummary } from '$modules/weekly-summary/weekly-summary.api';
import { loadRange } from '$lib/server/range-context';
import { SPORT_SLUGS } from '$modules/training/training-nav';

/** Old `/training?sport=…` bookmarks now belong to a real subpage (spec 025). */
const LEGACY_SPORT: Record<string, string> = {
  cycling: SPORT_SLUGS.ride,
  running: SPORT_SLUGS.run
};

export const load: PageServerLoad = async ({ locals, url }) => {
  const legacy = LEGACY_SPORT[url.searchParams.get('sport') ?? ''];
  if (legacy) throw redirect(308, `/training/${legacy}`);

  const user = locals.user!;
  const c = locals.container;
  const range = await loadRange(
    { store: c.store, clock: c.clock, timeZone: c.config.appTimeZone },
    user.id,
    url
  );
  /*
   * Two independent slices, one page. The weekly card deliberately takes NO range (spec 056): its
   * window is a fixed 12 weeks, because "this week against my recent normal" only means anything
   * over a constant span. It therefore carries no range badge either — see the module.
   */
  const [overview, weekly] = await Promise.all([
    loadTrainingOverview(
      { store: c.store, settings: c.repo.settings, clock: c.clock },
      { userId: user.id, range }
    ),
    loadWeeklySummary({ store: c.store, clock: c.clock, timeZone: c.config.appTimeZone }, { userId: user.id })
  ]);
  return { overview, weekly };
};
