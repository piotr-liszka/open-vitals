// @ts-nocheck
import { error, redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { loadActivityDetail } from '$modules/activity-detail/activity-detail.api';

const DATA_PROCESSING = 'detailed_analytics';

export const load = async ({ locals, params }: Parameters<PageServerLoad>[0]) => {
  const user = locals.user!;
  // Advanced-tier gate (spec 014): base users are redirected home.
  if (!(await locals.consent.isEnabled(DATA_PROCESSING))) throw redirect(303, '/');

  const container = locals.container;
  const detail = await loadActivityDetail(
    { store: container.store, settings: container.repo.settings },
    user.id,
    params.id
  );
  if (!detail) throw error(404, 'Nie znaleziono aktywności');

  return { detail };
};
