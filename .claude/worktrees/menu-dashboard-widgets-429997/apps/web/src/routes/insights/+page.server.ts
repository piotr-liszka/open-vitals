import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { loadInsights } from '$modules/insights/insights.api';
import { listConsent } from '$modules/consent/consent.api';
import { loadRange } from '$lib/server/range-context';
import { isAdvanced } from '$lib/server/tier';

export const load: PageServerLoad = async ({ locals, url }) => {
  const { garmin, consent, container } = locals;

  // Advanced-only surface: Base users are sent to the upgrade home, never an empty processed screen.
  if (!(await isAdvanced(consent))) throw redirect(303, '/');

  /*
   * The window is the app-wide range (spec 047). This page used to own `?window=7|30|90|365`; the
   * global `?range=` replaces it, so a hand-typed value is sanitized in `loadRange` and the page can
   * never 400. Old `?window=` links keep working through the redirect below.
   */
  const legacy = url.searchParams.get('window');
  if (legacy !== null) {
    const target = new URL(url);
    target.searchParams.delete('window');
    // 90 has no equivalent in the global set — 30 is the nearest offered window below it.
    target.searchParams.set('range', legacy === '90' ? '30' : legacy);
    throw redirect(308, `${target.pathname}${target.search}`);
  }

  const range = await loadRange(
    { store: container.store, clock: container.clock, timeZone: container.config.appTimeZone },
    locals.user!.id,
    url
  );

  const [insights, consentList] = await Promise.all([
    loadInsights(
      { garmin, consent, clock: container.clock, timeZone: container.config.appTimeZone },
      { range }
    ),
    listConsent(consent)
  ]);
  const analyticsFeature = consentList.features.find((f) => f.id === 'detailed_analytics') ?? null;
  return { insights, range, analyticsFeature };
};
