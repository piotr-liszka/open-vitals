# Spec 002 — Garmin Python sidecar

- **Status:** Approved <!-- Draft → Approved → Closed -->
- **Module:** `services/garmin/`
- **Owner agent:** garmin-integrator
- **Depends on:** none

## Context

Garmin fronts its private Connect API with Cloudflare TLS fingerprinting that blocks plain HTTP clients. The `garmy`
library (browser-TLS impersonation via `curl_cffi`) is the reliable way through, and it is Python. This sidecar is the
**only** component allowed to reach Garmin. It runs on the internal Docker network **only** (never LAN-exposed) and
offers a small local HTTP API that the SvelteKit Node service calls for login/MFA, auth status, and metric reads.
Garmin email/password are used once to obtain OAuth tokens and then discarded; only Fernet-encrypted tokens persist.

## Requirements (acceptance criteria)

- [x] `GET /health` returns `{status:"ok"}` without touching Garmin (liveness probe)
- [x] `GET /status` returns `{authenticated: bool, display_name?, expires_at?}` from the stored token bundle
- [x] `POST /login {email,password,mfa_code?}` logs in via garmy; 200 on success
- [x] `POST /login` signals MFA-required with `{mfa_required:true}` (HTTP 202) when Garmin asks for a code
- [x] `POST /login` returns 401 on bad credentials
- [x] `POST /login` completes MFA when `mfa_code` is supplied
- [x] `GET /metrics/{name}?date=YYYY-MM-DD` returns metric JSON when authenticated; 409 when not
- [x] Supported metrics: sleep, steps, hrv, body_battery, stress, resting_heart_rate, activities
- [x] `DELETE /session` clears the stored token bundle
- [x] Token bundle (OAuth1+OAuth2) is Fernet-encrypted at rest; never written as plaintext
- [x] Garmin email/password/tokens are never logged or returned in responses
- [x] All external input validated with pydantic
- [x] Unit + API-integration tests pass with garmy mocked at the client boundary (no e2e, no real Garmin)
- [x] No secrets logged or committed
- [x] Dockerfile: python:3.12-slim, non-root user, expose 8081, small image
- [x] README documents env vars and the one-time browser-assisted token-seeding fallback

## API contract

```
GET  /health                          res: {status:"ok"}                                     200
GET  /status                          res: {authenticated:bool, display_name?, expires_at?}  200
POST /login   req: {email,password,mfa_code?}
                                      res: {authenticated:true, display_name?, expires_at?}   200 success
                                      res: {mfa_required:true}                                202 MFA needed
                                      res: {detail:"..."}                                     401 bad creds
GET  /metrics/{name}?date=YYYY-MM-DD  res: {metric, date, data}                               200
                                      res: {detail:"not authenticated"}                       409 no tokens
                                      res: {detail:"unknown metric"}                          404 bad name
DELETE /session                       res: {cleared:bool}                                     200
```

## UI

N/A — backend-only sidecar. Consumed by `apps/web` over the internal Docker network (`GARMIN_SIDECAR_URL`).

## Design / implementation notes

- **Ports & adapters:** every garmy touchpoint is isolated in `app/garmy_client.py` (the only module importing garmy)
  and marked with `# ASSUMPTION:` where garmy's exact API is uncertain, so real-API drift is easy to fix in one place.
- `app/config.py` — pydantic-settings `Settings` from env (`TOKEN_ENCRYPTION_KEY` required Fernet key,
  `TOKEN_STORE_PATH`, `HOST`, `PORT`, `LOG_LEVEL`).
- `app/tokens.py` — `TokenStore`: Fernet read/write of the token bundle JSON; `load/save/clear/exists`; never logs contents.
- `app/auth.py` — `GarminAuth`: `login()` (with MFA), `status()`. Email/password used once then dropped.
- `app/metrics.py` — `MetricsService`: `get_metric(name, date)` dispatch + per-metric wrappers → plain JSON; 409 if unauthenticated.
- `app/main.py` — FastAPI app factory wiring the above; pydantic request models; logging that never emits secrets.
- **Edge cases:** MFA required (in-memory pending-login state keyed by email until the code arrives), sidecar has no
  tokens yet (409 on metrics), token refresh on `status()`, Cloudflare-blocked headless login (README seeding fallback).

## Test plan

- **Unit:** TokenStore Fernet round-trip; ciphertext on disk is not plaintext (no token substrings); metric name dispatch.
- **API integration (mock garmy at AuthClient/APIClient boundary):** `/health` + `/status` shapes; `/login` success;
  `/login` MFA-required → `{mfa_required:true}`; `/login` bad creds → 401; `/metrics/{name}` data when authed, 409 when not.
- **Security:** `caplog` assertion that no credential/token string appears in logs across login + metrics flows.

## Closeout

- Commits: <pending>
- Notes / follow-ups: garmy's real API is stubbed behind `app/garmy_client.py`; verify the `# ASSUMPTION:` calls
  against the installed garmy version and adjust that one module if they differ.
