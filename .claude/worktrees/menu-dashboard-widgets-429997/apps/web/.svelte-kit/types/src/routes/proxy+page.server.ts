// @ts-nocheck
import type { PageServerLoad } from './$types';
import { getHealth } from '$modules/healthcheck/health.api';
import { loadDashboard } from '$modules/metrics-dashboard/dashboard.api';
import { listConsent } from '$modules/consent/consent.api';
import { CONDITION_WINDOW_DAYS, loadInsights } from '$modules/insights/insights.api';
import { loadTimeline } from '$modules/timeline/timeline.api';
import { loadRange } from '$lib/server/range-context';
import { resolveTier, ADVANCED_FEATURE } from '$lib/server/tier';

export const load = async ({ locals, url }: Parameters<PageServerLoad>[0]) => {
  // `/` is public: logged-out visitors get the marketing landing (no per-user loads).
  if (!locals.user) return { authed: false as const };

  const { garmin, consent: consentService, container } = locals;

  // Base tier: the connect flow + the upgrade invitation only. We process/display NO health data
  // here, so we deliberately do NOT load the dashboard or insights.
  const tier = await resolveTier(consentService);

  // The personal MCP URL carries a secret token; since spec 021 it is rendered only on /settings,
  // so `/` deliberately no longer loads (or serialises) it.
  if (tier === 'base') {
    const [health, consent] = await Promise.all([getHealth(garmin), listConsent(consentService)]);
    return {
      authed: true as const,
      tier,
      health,
      advancedFeature: consent.features.find((f) => f.id === ADVANCED_FEATURE) ?? null
    };
  }

  // Advanced tier: the full processed dashboard. The window is the app-wide range from `?range=`
  // (spec 047) — sanitized in `loadRange`, so a hand-typed value can never widen a store query.
  const range = await loadRange(
    { store: container.store, clock: container.clock, timeZone: container.config.appTimeZone },
    locals.user.id,
    url
  );

  const [health, dashboard, consent, insights] = await Promise.all([
    getHealth(garmin),
    loadDashboard(
      {
        garmin,
        consent: consentService,
        clock: container.clock,
        timeZone: container.config.appTimeZone
      },
      { range }
    ),
    listConsent(consentService),
    /*
     * NOT range-driven, deliberately. This read feeds the condition block ("how am I right now") and
     * the timeline's anomaly markers, both of which compare today against a recent baseline. Widening
     * that baseline to a year would answer a different question — so the condition card carries no
     * range badge either (spec 047).
     */
    loadInsights(
      { garmin, consent: consentService, clock: container.clock, timeZone: container.config.appTimeZone },
      { window: CONDITION_WINDOW_DAYS }
    )
  ]);

  // The timeline (spec 022) merges the insights engine's anomalies into the event stream, so it
  // runs after them. Its own read is a single local-store activity query — no sidecar call.
  const timeline = await loadTimeline(
    { store: container.store, clock: container.clock, timeZone: container.config.appTimeZone },
    { userId: locals.user.id, signals: insights.anomalies, pastDays: range.days }
  );

  return {
    authed: true as const,
    tier,
    health,
    dashboard,
    timeline,
    advancedFeature: consent.features.find((f) => f.id === ADVANCED_FEATURE) ?? null,
    readiness: {
      data: insights.readiness,
      condition: insights.condition,
      connected: insights.connected,
      enabled: insights.enabled
    }
  };
};
