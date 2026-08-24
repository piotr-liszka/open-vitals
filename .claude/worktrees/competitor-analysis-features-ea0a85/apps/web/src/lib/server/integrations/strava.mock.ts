/**
 * Deterministic Strava mock. Makes the whole connect→list→link flow work OFFLINE with no network:
 *
 * - `buildAuthUrl` returns a URL that points straight back at our own callback with a fixed `code`,
 *   so the browser "OAuth" round-trip completes locally.
 * - `exchangeCode` returns fixed tokens.
 * - `listActivities` returns a small fixed set whose start times line up with the Garmin dev-mock
 *   activities, so `matchAll` produces real links in the demo.
 *
 * DEV/TEST ONLY — the real adapter (`strava.ts`) replaces this once credentials are wired.
 */
import type { OAuthTokens, StravaActivity, StravaActivityRef, StravaClient } from './types';

export interface StravaMockDeps {
  /** Where the fake authorization "redirect" should bounce to (our callback). */
  redirectUri?: string;
}

/** Fixed fixtures — anchored to plausible instants so links land against seeded Garmin activities. */
export const STRAVA_MOCK_ACTIVITIES: readonly StravaActivity[] = [
  {
    id: 9001,
    name: 'Morning Ride',
    start_date: '2026-08-01T07:00:00Z',
    elapsed_time: 3600,
    moving_time: 3500,
    distance: 30000,
    type: 'Ride',
    sport_type: 'Ride'
  },
  {
    id: 9002,
    name: 'Lunch Run',
    start_date: '2026-08-03T17:30:00Z',
    elapsed_time: 1800,
    moving_time: 1780,
    distance: 5000,
    type: 'Run',
    sport_type: 'Run'
  },
  {
    id: 9003,
    name: 'Long Ride',
    start_date: '2026-08-06T06:15:00Z',
    elapsed_time: 5400,
    moving_time: 5200,
    distance: 45000,
    type: 'Ride',
    sport_type: 'MountainBikeRide'
  }
] as const;

const MOCK_TOKENS: OAuthTokens = {
  accessToken: 'mock-strava-access',
  refreshToken: 'mock-strava-refresh',
  expiresAt: null,
  scope: 'activity:read',
  providerUserId: 'mock-athlete-1'
};

export function createStravaMock(deps: StravaMockDeps = {}): StravaClient {
  const redirectUri = deps.redirectUri ?? '/api/integrations/strava/callback';

  return {
    buildAuthUrl(state, _codeChallenge) {
      void _codeChallenge;
      const url = new URL(redirectUri, 'http://mock.local');
      url.searchParams.set('code', 'mock-strava-code');
      url.searchParams.set('state', state);
      // Return a same-origin path when redirectUri was relative, else the absolute URL.
      return redirectUri.startsWith('http') ? url.toString() : `${url.pathname}${url.search}`;
    },

    async exchangeCode(_code, _verifier) {
      void _code;
      void _verifier;
      return MOCK_TOKENS;
    },

    async listActivities(_tokens, since) {
      void _tokens;
      if (since == null) return [...STRAVA_MOCK_ACTIVITIES];
      return STRAVA_MOCK_ACTIVITIES.filter((a) => new Date(a.start_date).getTime() / 1000 >= since);
    },

    normalizeToMatchKey(activity) {
      const ref: StravaActivityRef = {
        stravaId: String(activity.id),
        name: activity.name,
        startTime: new Date(activity.start_date).toISOString(),
        durationS: activity.elapsed_time || activity.moving_time,
        distanceM: activity.distance,
        sport: (activity.sport_type ?? activity.type).toLowerCase(),
        permalink: `https://www.strava.com/activities/${activity.id}`
      };
      return ref;
    }
  };
}
