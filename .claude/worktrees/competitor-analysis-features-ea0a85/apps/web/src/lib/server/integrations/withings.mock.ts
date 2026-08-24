/**
 * Deterministic Withings mock. Same offline design as the Strava mock: `buildAuthUrl` bounces back
 * to our callback with a fixed code, `exchangeCode` returns fixed tokens, and `getWeighIns` emits a
 * reproducible weekly weigh-in series (kg) within the requested range.
 *
 * DEV/TEST ONLY — replaced by `withings.ts` once credentials are wired.
 */
import type { OAuthTokens, WithingsClient, WithingsWeighIn } from './types';

export interface WithingsMockDeps {
  redirectUri?: string;
  /** First day of the synthetic series (inclusive). Default `2026-06-01`. */
  seriesStart?: string;
  /** Starting weight in kg; each subsequent week trends down by `weeklyDeltaKg`. */
  startWeightKg?: number;
  weeklyDeltaKg?: number;
  /** Number of weekly weigh-ins to emit. Default 10. */
  weeks?: number;
}

const MOCK_TOKENS: OAuthTokens = {
  accessToken: 'mock-withings-access',
  refreshToken: 'mock-withings-refresh',
  expiresAt: null,
  scope: 'user.metrics',
  providerUserId: 'mock-withings-1'
};

function addDays(day: string, n: number): string {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export function createWithingsMock(deps: WithingsMockDeps = {}): WithingsClient {
  const redirectUri = deps.redirectUri ?? '/api/integrations/withings/callback';
  const seriesStart = deps.seriesStart ?? '2026-06-01';
  const startWeightKg = deps.startWeightKg ?? 82.5;
  const weeklyDeltaKg = deps.weeklyDeltaKg ?? 0.3;
  const weeks = deps.weeks ?? 10;

  /** The full synthetic series, independent of the query range. */
  const series: WithingsWeighIn[] = Array.from({ length: weeks }, (_, i) => {
    const day = addDays(seriesStart, i * 7);
    const weightKg = Number((startWeightKg - i * weeklyDeltaKg).toFixed(3));
    return { day, weightKg, raw: { day, weightKg, source: 'withings-mock' } };
  });

  return {
    buildAuthUrl(state, _codeChallenge) {
      void _codeChallenge;
      const url = new URL(redirectUri, 'http://mock.local');
      url.searchParams.set('code', 'mock-withings-code');
      url.searchParams.set('state', state);
      return redirectUri.startsWith('http') ? url.toString() : `${url.pathname}${url.search}`;
    },

    async exchangeCode(_code, _verifier) {
      void _code;
      void _verifier;
      return MOCK_TOKENS;
    },

    async getWeighIns(_tokens, start, end) {
      void _tokens;
      return series.filter((w) => w.day >= start && w.day <= end);
    }
  };
}
