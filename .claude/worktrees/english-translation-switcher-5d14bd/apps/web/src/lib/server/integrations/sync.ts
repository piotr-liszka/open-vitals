/**
 * PURE integration sync services. Everything is passed in via the {@link Integrations} bundle
 * (store, clients, token store, clock, logger) — no direct `fetch`/`Date.now()`/env — so both flows
 * are fully unit-testable with the memory store + mock clients.
 *
 *  - `syncWithingsWeight`  → pulls weigh-ins and upserts them into the LocalStore as `source:'withings'`.
 *  - `linkStravaActivities` → matches Strava activities to already-synced Garmin activities and records
 *    the cross-reference links (NEVER mutating the activities schema — links live in their own store).
 *
 * Never logs tokens (AGENTS.md §10) — only counts + non-secret ids.
 */
import { matchAll, type StravaLink, type MatchOptions } from './matching';
import { IntegrationNotConnectedError, type Integrations } from './types';

/** How far back each sync reaches, in days. */
const WITHINGS_LOOKBACK_DAYS = 365;
const STRAVA_LOOKBACK_DAYS = 90;

export interface WithingsSyncResult {
  readonly provider: 'withings';
  readonly imported: number;
  readonly firstDay: string | null;
  readonly lastDay: string | null;
}

export interface StravaLinkResult {
  readonly provider: 'strava';
  /** Strava activities scanned in the window. */
  readonly scanned: number;
  /** How many were successfully linked to a Garmin activity. */
  readonly matched: number;
  readonly links: readonly StravaLink[];
}

function isoDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function daysAgo(now: Date, n: number): Date {
  const d = new Date(now.getTime());
  d.setUTCDate(d.getUTCDate() - n);
  return d;
}

/**
 * Import Withings weigh-ins for the trailing year into the LocalStore. Idempotent: re-running
 * upserts the same `(day, source)` rows, so weights never duplicate.
 */
export async function syncWithingsWeight(deps: Integrations, userId: string): Promise<WithingsSyncResult> {
  const tokens = await deps.tokens.get(userId, 'withings');
  if (!tokens) throw new IntegrationNotConnectedError('withings');

  const now = deps.clock.now();
  const start = isoDay(daysAgo(now, WITHINGS_LOOKBACK_DAYS));
  const end = isoDay(now);

  const weighIns = await deps.withings.getWeighIns(tokens, start, end);
  if (weighIns.length > 0) {
    await deps.store.putWeight(
      userId,
      weighIns.map((w) => ({ day: w.day, weightKg: w.weightKg, source: 'withings' as const, raw: w.raw }))
    );
  }

  const days = weighIns.map((w) => w.day).sort();
  deps.logger.info('withings weight import', { userId, imported: weighIns.length });
  return {
    provider: 'withings',
    imported: weighIns.length,
    firstDay: days[0] ?? null,
    lastDay: days[days.length - 1] ?? null
  };
}

/**
 * Cross-reference Strava activities against the user's synced Garmin activities and persist the
 * resulting permalink links. The activities schema is untouched — links are stored separately.
 */
export async function linkStravaActivities(
  deps: Integrations,
  userId: string,
  options: MatchOptions = {}
): Promise<StravaLinkResult> {
  const tokens = await deps.tokens.get(userId, 'strava');
  if (!tokens) throw new IntegrationNotConnectedError('strava');

  const now = deps.clock.now();
  const since = Math.floor(daysAgo(now, STRAVA_LOOKBACK_DAYS).getTime() / 1000);

  const raw = await deps.strava.listActivities(tokens, since);
  const refs = raw.map((a) => deps.strava.normalizeToMatchKey(a));

  // Match against every synced Garmin activity for this user.
  const candidates = await deps.store.listActivities(userId);
  const links = matchAll(refs, candidates, options);

  await deps.links.put(userId, links);
  deps.logger.info('strava link', { userId, scanned: refs.length, matched: links.length });
  return { provider: 'strava', scanned: refs.length, matched: links.length, links };
}
