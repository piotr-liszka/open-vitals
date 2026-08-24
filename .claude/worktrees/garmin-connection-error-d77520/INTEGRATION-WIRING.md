# Integration wiring — Strava & Withings (going live)

The Strava + Withings slices (spec 017) are complete and run **offline on mock adapters** today, so the
whole connect → callback → sync flow works in `make dev` with no credentials. To switch to real
accounts, do the following — **no component or route changes are needed**, only config + the factory.

## 1. Register OAuth apps (you)

- **Strava** → https://www.strava.com/settings/api — scope `activity:read_all`.
  Redirect: `${PUBLIC_BASE_URL}/api/integrations/strava/callback`
- **Withings** → https://developer.withings.com — scope `user.metrics`.
  Redirect: `${PUBLIC_BASE_URL}/api/integrations/withings/callback`

## 2. Env vars (add to `.env` / compose, document in `.env.example`)

```
INTEGRATIONS_ADAPTER=real           # 'mock' (default) or 'real'
STRAVA_CLIENT_ID=...
STRAVA_CLIENT_SECRET=...
WITHINGS_CLIENT_ID=...
WITHINGS_CLIENT_SECRET=...
```

## 3. Config (`apps/web/src/lib/server/config.ts`)

Add the five keys to the zod schema + `Config` (secrets optional so mock/dev still boots). Mirror the
existing `GARMIN_ADAPTER` pattern; refuse `INTEGRATIONS_ADAPTER=real` without the client id/secret.

## 4. Factory (`apps/web/src/lib/server/integrations/index.ts`)

`createIntegrations(locals)` currently always builds the mocks. Make it branch on
`config.integrationsAdapter`: when `real`, build `createStravaAdapter` / `createWithingsAdapter`
(`strava.ts` / `withings.ts`) with `{ clientId, clientSecret, redirectUri: integrationRedirectUri(...),
fetch: globalThis.fetch, clock }`; otherwise keep the mocks.

## 5. Persistence follow-up (optional, recommended for prod)

Tokens + Strava links are held in a **process-local** in-memory store today (`stores.ts`), so they
reset on restart. For durable prod use, add an encrypted `integration_tokens` table (mirror the
sidecar's Fernet-at-rest pattern; the web tier must never store raw provider tokens in plaintext) and
a `strava_links` table, then swap the memory stores in the factory for pg-backed adapters.

## Security notes (already enforced in code)

- OAuth `state` validated constant-time (`safeEqual`); PKCE verifier + tokens never in responses/logs.
- `state`/`verifier` live in short-lived httpOnly, SameSite=Lax cookies, cleared on callback.
- Provider paths are allow-listed (`strava`/`withings`) in every route.
