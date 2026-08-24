/**
 * Real Withings adapter (Authorization-Code OAuth). All network goes through the INJECTED `fetch`;
 * time comes from the injected `Clock`. Tokens + the client secret are NEVER logged.
 *
 * Not wired into the container yet (see INTEGRATION-WIRING.md); the mock adapter drives it offline.
 *
 * Withings wraps every API response in `{ status, body }` and reports weight as `value * 10^unit`
 * (grams-ish fixed point) — we convert to kilograms here so the store only ever sees kg.
 */
import type { FetchLike } from '../garmin/http-adapter';
import type { Clock } from '../clock';
import { IntegrationRemoteError, type OAuthTokens, type WithingsClient, type WithingsWeighIn } from './types';

// ASSUMPTION: Withings public OAuth + wbsapi endpoints (developer.withings.com).
const AUTHORIZE_URL = 'https://account.withings.com/oauth2_user/authorize2';
const TOKEN_URL = 'https://wbsapi.withings.net/v2/oauth2';
const MEASURE_URL = 'https://wbsapi.withings.net/measure';
// ASSUMPTION: user.metrics scope grants access to body measurements.
const SCOPE = 'user.metrics';
// ASSUMPTION: measure type 1 == weight.
const MEASTYPE_WEIGHT = 1;

export interface WithingsAdapterDeps {
  clientId: string;
  clientSecret: string;
  /** The `/api/integrations/withings/callback` URL registered with Withings. */
  redirectUri: string;
  fetch: FetchLike;
  clock: Clock;
}

// ASSUMPTION: token body under { status, body: {...} } from POST /v2/oauth2.
interface WithingsTokenBody {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number; // seconds from now
  scope?: string;
  userid?: number | string;
}
interface WithingsMeasure {
  value?: number;
  type?: number;
  unit?: number;
}
interface WithingsMeasureGroup {
  date?: number; // epoch seconds
  measures?: WithingsMeasure[];
}
interface WithingsMeasureBody {
  measuregrps?: WithingsMeasureGroup[];
}
interface WithingsEnvelope<T> {
  status?: number;
  body?: T;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null;
}

/** `YYYY-MM-DD` in UTC for an epoch-seconds timestamp. */
function dayOf(epochSeconds: number): string {
  return new Date(epochSeconds * 1000).toISOString().slice(0, 10);
}

export function createWithingsAdapter(deps: WithingsAdapterDeps): WithingsClient {
  return {
    buildAuthUrl(state, _codeChallenge) {
      const url = new URL(AUTHORIZE_URL);
      url.searchParams.set('response_type', 'code');
      url.searchParams.set('client_id', deps.clientId);
      url.searchParams.set('scope', SCOPE);
      url.searchParams.set('redirect_uri', deps.redirectUri);
      url.searchParams.set('state', state);
      // ASSUMPTION: Withings does not support PKCE; `state` alone guards CSRF here.
      void _codeChallenge;
      return url.toString();
    },

    async exchangeCode(code, _codeVerifier) {
      const body = new URLSearchParams({
        action: 'requesttoken',
        grant_type: 'authorization_code',
        client_id: deps.clientId,
        client_secret: deps.clientSecret,
        code,
        redirect_uri: deps.redirectUri
      });
      void _codeVerifier;
      const res = await deps.fetch(TOKEN_URL, {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded', accept: 'application/json' },
        body: body.toString()
      });
      if (!res.ok) throw new IntegrationRemoteError('withings', 'Withings token exchange rejected');
      const env = (await res.json().catch(() => null)) as WithingsEnvelope<WithingsTokenBody> | null;
      // ASSUMPTION: status 0 == success; anything else is an error envelope.
      if (!env || env.status !== 0 || !env.body?.access_token) {
        throw new IntegrationRemoteError('withings', 'Withings token response missing access_token');
      }
      const t = env.body;
      const expiresAt =
        typeof t.expires_in === 'number'
          ? Math.floor(deps.clock.now().getTime() / 1000) + t.expires_in
          : null;
      return {
        accessToken: t.access_token!,
        refreshToken: t.refresh_token ?? null,
        expiresAt,
        scope: t.scope ?? null,
        providerUserId: t.userid != null ? String(t.userid) : null
      };
    },

    async getWeighIns(tokens, start, end) {
      const startEpoch = Math.floor(new Date(`${start}T00:00:00Z`).getTime() / 1000);
      const endEpoch = Math.floor(new Date(`${end}T23:59:59Z`).getTime() / 1000);
      const body = new URLSearchParams({
        action: 'getmeas',
        meastype: String(MEASTYPE_WEIGHT),
        category: '1',
        startdate: String(startEpoch),
        enddate: String(endEpoch)
      });
      const res = await deps.fetch(MEASURE_URL, {
        method: 'POST',
        headers: {
          'content-type': 'application/x-www-form-urlencoded',
          accept: 'application/json',
          authorization: `Bearer ${tokens.accessToken}`
        },
        body: body.toString()
      });
      if (!res.ok) throw new IntegrationRemoteError('withings', 'Withings measures fetch rejected');
      const env = (await res.json().catch(() => null)) as WithingsEnvelope<WithingsMeasureBody> | null;
      if (!env || env.status !== 0 || !isRecord(env.body)) return [];
      const groups = Array.isArray(env.body.measuregrps) ? env.body.measuregrps : [];

      const out: WithingsWeighIn[] = [];
      for (const g of groups) {
        if (typeof g.date !== 'number' || !Array.isArray(g.measures)) continue;
        const weight = g.measures.find(
          (m: { type?: number; value?: number; unit?: number }) => m.type === MEASTYPE_WEIGHT
        );
        if (!weight || typeof weight.value !== 'number' || typeof weight.unit !== 'number') continue;
        // ASSUMPTION: real value == value * 10^unit; the result is already in kilograms.
        const weightKg = weight.value * Math.pow(10, weight.unit);
        out.push({ day: dayOf(g.date), weightKg: Number(weightKg.toFixed(3)), raw: g });
      }
      return out;
    }
  };
}
