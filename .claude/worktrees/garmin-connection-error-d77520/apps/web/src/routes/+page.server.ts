import type { PageServerLoad } from './$types';
import { getHealth } from '$modules/healthcheck/health.api';
import { loadDashboard } from '$modules/metrics-dashboard/dashboard.api';
import { CONDITION_WINDOW_DAYS, loadInsights } from '$modules/insights/insights.api';
import { loadTimeline } from '$modules/timeline/timeline.api';
import { loadJournal } from '$modules/journal/journal.api';
import { loadRange } from '$lib/server/range-context';

export const load: PageServerLoad = async ({ locals, url }) => {
  // `/` is public: logged-out visitors get the marketing landing (no per-user loads).
  if (!locals.user) return { authed: false as const };

  const { garmin, container } = locals;

  // The personal MCP URL carries a secret token; since spec 021 it is rendered only on /settings,
  // so `/` deliberately no longer loads (or serialises) it.

  // The window is the app-wide range from `?range=` (spec 047) — sanitized in `loadRange`, so a
  // hand-typed value can never widen a store query.
  const range = await loadRange(
    { store: container.store, clock: container.clock, timeZone: container.config.appTimeZone },
    locals.user.id,
    url
  );

  const [health, dashboard, insights] = await Promise.all([
    getHealth(garmin),
    loadDashboard({ garmin, clock: container.clock, timeZone: container.config.appTimeZone }, { range }),
    /*
     * NOT range-driven, deliberately. This read feeds the condition block ("how am I right now") and
     * the timeline's anomaly markers, both of which compare today against a recent baseline. Widening
     * that baseline to a year would answer a different question — so the condition card carries no
     * range badge either (spec 047).
     */
    loadInsights(
      { garmin, clock: container.clock, timeZone: container.config.appTimeZone },
      { window: CONDITION_WINDOW_DAYS }
    )
  ]);

  // The timeline (spec 022) merges the insights engine's anomalies into the event stream, so it
  // runs after them. Its own read is a single local-store activity query — no sidecar call.
  // Spec 062: today's check-in, so the card opens already holding whatever was logged this morning.
  const journal = await loadJournal(
    { store: container.store, clock: container.clock, timeZone: container.config.appTimeZone },
    locals.user.id
  );

  const timeline = await loadTimeline(
    { store: container.store, clock: container.clock, timeZone: container.config.appTimeZone },
    { userId: locals.user.id, signals: insights.anomalies, pastDays: range.days }
  );

  return {
    authed: true as const,
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
