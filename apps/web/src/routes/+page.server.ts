import type { PageServerLoad } from './$types';
import { getHealth } from '$modules/healthcheck/health.api';
import { loadDashboard } from '$modules/metrics-dashboard/dashboard.api';
import { CONDITION_WINDOW_DAYS, loadInsights } from '$modules/insights/insights.api';
import { loadTimeline } from '$modules/timeline/timeline.api';
import { loadJournal } from '$modules/journal/journal.api';
import { loadRange } from '$lib/server/range-context';
import { capRange } from '$lib/range';

export const load: PageServerLoad = async ({ locals, url }) => {
  // The guard (`hooks.server.ts`) has already redirected any unauthenticated or pre-onboarding
  // visitor away before this ever runs (spec 094 removed the marketing landing page `/` used to
  // show) — `locals.user` is guaranteed non-null here.
  const { garmin, container } = locals;

  // The personal MCP URL carries a secret token; since spec 021 it is rendered only on /settings,
  // so `/` deliberately no longer loads (or serialises) it.

  // The window is the app-wide range from `?range=` (spec 047) — sanitized in `loadRange`, so a
  // hand-typed value can never widen a store query.
  const range = await loadRange(
    { store: container.store, clock: container.clock, timeZone: container.config.appTimeZone },
    locals.user!.id,
    url
  );

  const [health, dashboard, insights] = await Promise.all([
    getHealth(garmin),
    loadDashboard(
      { garmin, clock: container.clock, timeZone: container.config.appTimeZone },
      { range, locale: locals.locale }
    ),
    /*
     * Follows the range switch for 7/14/30, but never wider (spec 095): this read feeds the condition
     * block ("how am I right now") and the timeline's anomaly markers, both of which compare today
     * against a recent baseline, and a year-long ("365"/"all") mean would answer a different question.
     * `capRange` keeps the switch's shape below the ceiling and clamps above it — so the condition
     * card carries no range badge of its own (spec 047), but the "vs" numbers do move with 7 vs 14 vs
     * 30, which is the whole point of the switch being visible on this page at all.
     */
    loadInsights(
      { garmin, clock: container.clock, timeZone: container.config.appTimeZone },
      { range: capRange(range, CONDITION_WINDOW_DAYS), locale: locals.locale }
    )
  ]);

  // The timeline (spec 022) merges the insights engine's anomalies into the event stream, so it
  // runs after them. Its own read is a single local-store activity query — no sidecar call.
  // Spec 062: today's check-in, so the card opens already holding whatever was logged this morning.
  const journal = await loadJournal(
    { store: container.store, clock: container.clock, timeZone: container.config.appTimeZone },
    locals.user!.id
  );

  const timeline = await loadTimeline(
    { store: container.store, clock: container.clock, timeZone: container.config.appTimeZone },
    { userId: locals.user!.id, locale: locals.locale, signals: insights.anomalies, pastDays: range.days }
  );

  return {
    health,
    dashboard,
    timeline,
    journal,
    readiness: {
      data: insights.readiness,
      condition: insights.condition,
      connected: insights.connected
    }
  };
};
