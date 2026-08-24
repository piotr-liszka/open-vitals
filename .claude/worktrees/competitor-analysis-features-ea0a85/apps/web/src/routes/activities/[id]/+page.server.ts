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

  return { detail };
};
