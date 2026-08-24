import type { PageServerLoad } from './$types';
import { getCoverage } from '$modules/sync/sync.api';
import { GarminUnavailableError } from '$lib/server/interfaces';
import { todayKey } from '$lib/date';

export const load: PageServerLoad = async ({ locals }) => {
  const user = locals.user!; // guaranteed by the auth guard for this protected route
  const c = locals.container;
  const { coverage, lastRun } = await getCoverage(
    { store: c.store, syncEngine: c.syncEngine },
    user.id,
    todayKey(c.clock, c.config.appTimeZone)
  );

  let connected = false;
  try {
    connected = (await locals.garmin.getStatus()).authenticated;
  } catch (err) {
    if (!(err instanceof GarminUnavailableError)) throw err;
  }

  // Prompt a refresh when there's nothing yet, or the last successful sync is over 12h old.
  const twelveHoursMs = 12 * 60 * 60 * 1000;
  const lastOk = lastRun?.status === 'succeeded' ? lastRun.finishedAt : null;
  const stale = !lastOk || c.clock.now().getTime() - new Date(lastOk).getTime() > twelveHoursMs;
  const prompt = connected && stale;

  return { coverage, lastRun, connected, prompt };
};
