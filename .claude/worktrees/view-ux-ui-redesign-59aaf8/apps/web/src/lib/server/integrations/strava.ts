/**
 * Real Strava adapter (Authorization-Code OAuth). All network goes through the INJECTED `fetch`;
 * time comes from the injected `Clock`. Tokens + the client secret are NEVER logged.
 *
 * Not wired into the container yet — constructed from config in a follow-up (see INTEGRATION-WIRING.md).
 * The mock adapter (`strava.mock.ts`) drives the flow offline until real credentials land.
 */
import type { FetchLike } from '../garmin/http-adapter';
import type { Clock } from '../clock';
import {
  IntegrationRemoteError,
  type OAuthTokens,
  type StravaActivity,
  type StravaActivityRef,
  type StravaClient
} from './types';

// ASSUMPTION: Strava's public OAuth + v3 API endpoints (docs.strava.com).
const AUTHORIZE_URL = 'https://www.strava.com/oauth/authorize';
const TOKEN_URL = 'https://www.strava.com/oauth/token';
const ACTIVITIES_URL = 'https://www.strava.com/api/v3/athlete/activities';
// ASSUMPTION: read access to activities is enough for cross-referencing.
const SCOPE = 'activity:read';

export interface StravaAdapterDeps {
  clientId: string;
  clientSecret: string;
  /** The `/api/integrations/strava/callback` URL registered with Strava. */
  redirectUri: string;
  fetch: FetchLike;
  clock: Clock;
}

// ASSUMPTION: token response shape from POST /oauth/token.
interface StravaTokenResponse {
  access_token?: string;
  refresh_token?: string;
  expires_at?: number; // epoch seconds
  scope?: string;
  athlete?: { id?: number };
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null;
}

/** Narrow an untrusted JSON element to a StravaActivity, dropping anything malformed. */
function toActivity(v: unknown): StravaActivity | null {
  if (!isRecord(v)) return null;
  // ASSUMPTION: id, name, start_date, elapsed_time, moving_time, distance, type per v3 schema.
  if (typeof v.id !== 'number') return null;
  if (typeof v.start_date !== 'string') return null;
  return {
    id: v.id,
    name: typeof v.name === 'string' ? v.name : '',
    start_date: v.start_date,
    elapsed_time: typeof v.elapsed_time === 'number' ? v.elapsed_time : 0,
    moving_time: typeof v.moving_time === 'number' ? v.moving_time : 0,
    distance: typeof v.distance === 'number' ? v.distance : 0,
    type: typeof v.type === 'string' ? v.type : 'workout',
    ...(typeof v.sport_type === 'string' ? { sport_type: v.sport_type } : {})
  };
}

export function createStravaAdapter(deps: StravaAdapterDeps): StravaClient {
  const bearer = (tokens: OAuthTokens): Record<string, string> => ({
    authorization: `Bearer ${tokens.accessToken}`
  });

  return {
    buildAuthUrl(state, codeChallenge) {
      const url = new URL(AUTHORIZE_URL);
      url.searchParams.set('client_id', deps.clientId);
      url.searchParams.set('redirect_uri', deps.redirectUri);
      url.searchParams.set('response_type', 'code');
      url.searchParams.set('scope', SCOPE);
      url.searchParams.set('approval_prompt', 'auto');
      url.searchParams.set('state', state);
      // ASSUMPTION: Strava ignores unknown params, so PKCE fields are harmless where unsupported.
      url.searchParams.set('code_challenge', codeChallenge);
      url.searchParams.set('code_challenge_method', 'S256');
      return url.toString();
    },

    async exchangeCode(code, codeVerifier) {
      const body = new URLSearchParams({
        client_id: deps.clientId,
        client_secret: deps.clientSecret,
        code,
        grant_type: 'authorization_code',
        code_verifier: codeVerifier
      });
      const res = await deps.fetch(TOKEN_URL, {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded', accept: 'application/json' },
        body: body.toString()
      });
      if (!res.ok) throw new IntegrationRemoteError('strava', 'Strava token exchange rejected');
      const json = (await res.json().catch(() => null)) as StravaTokenResponse | null;
      if (!json?.access_token)
        throw new IntegrationRemoteError('strava', 'Strava token response missing access_token');
      return {
        accessToken: json.access_token,
        refreshToken: json.refresh_token ?? null,
        expiresAt: typeof json.expires_at === 'number' ? json.expires_at : null,
        scope: json.scope ?? null,
        providerUserId: typeof json.athlete?.id === 'number' ? String(json.athlete.id) : null
      };
    },

    async listActivities(tokens, since) {
      const url = new URL(ACTIVITIES_URL);
      url.searchParams.set('per_page', '100');
      if (since != null) url.searchParams.set('after', String(Math.floor(since)));
      const res = await deps.fetch(url.toString(), {
        headers: { accept: 'application/json', ...bearer(tokens) }
      });
      if (!res.ok) throw new IntegrationRemoteError('strava', 'Strava activities fetch rejected');
      const json: unknown = await res.json().catch(() => null);
      if (!Array.isArray(json)) return [];
      return json.map(toActivity).filter((a): a is StravaActivity => a !== null);
    },

    normalizeToMatchKey(activity) {
      const ref: StravaActivityRef = {
        stravaId: String(activity.id),
        name: activity.name,
        // ASSUMPTION: start_date is UTC; normalize to a canonical ISO instant.
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
