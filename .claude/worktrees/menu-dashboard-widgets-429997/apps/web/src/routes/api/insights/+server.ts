/** Insights API (spec 013): GET /api/insights?window=7|30|90|365 → InsightsData. */
import { json, type RequestHandler } from '@sveltejs/kit';
import { InvalidWindowError, loadInsights } from '$modules/insights/insights.api';

export const GET: RequestHandler = async ({ locals, url }) => {
  const { garmin, consent, container } = locals;
  const raw = url.searchParams.get('window');
  const window = raw === null ? 30 : Number(raw);

  try {
    const data = await loadInsights(
      { garmin, consent, clock: container.clock, timeZone: container.config.appTimeZone },
      { window }
    );
    return json(data);
  } catch (err) {
    if (err instanceof InvalidWindowError) {
      return json({ error: 'window must be one of 7, 30, 90, 365' }, { status: 400 });
    }
    throw err;
  }
};
