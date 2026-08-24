import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { loadActivityDetail } from '$modules/activity-detail/activity-detail.api';

export const load: PageServerLoad = async ({ locals, params }) => {
  const user = locals.user!;
  const container = locals.container;
  const detail = await loadActivityDetail(
    { store: container.store, settings: container.repo.settings },
    user.id,
    params.id
  );
  if (!detail) throw error(404, 'Nie znaleziono aktywności');

  /*
   * Spec 062: the RPE already logged for THIS session, if any. Read straight off the store rather
   * than through `loadJournal` — the page wants one entry, not a month of them.
   */
  const day = detail.activity.startTimeLocal.slice(0, 10);
  const entries = await container.store.listJournalEntries(user.id, { from: day, to: day });
  const rpeEntry = entries.find((e) => e.activityId === params.id) ?? null;

  return { detail, day, rpeEntry };
};
