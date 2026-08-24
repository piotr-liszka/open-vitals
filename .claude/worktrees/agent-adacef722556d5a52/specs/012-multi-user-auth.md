# Spec 012 — Multi-user auth (Google OIDC) + per-user isolation

- **Status:** Approved <!-- Draft → Approved → Closed -->
- **Module:** `apps/web/src/modules/auth/`, `apps/web/src/lib/server/{auth,repo,session}/`, `routes/auth/**`, `apps/web/src/lib/mcp/`, `services/garmin/`
- **Owner agent:** module-dev (web) + garmin-integrator (sidecar changes)
- **Depends on:** 003 (server core / container), 004 (auth it replaces), 011 (consent it migrates), 007 (MCP token gate), 002/005 (sidecar + Garmin setup)

## Context

**This spec pivots the product.** Garmin Bridge was designed as a single-user, LAN-only tool: one shared
password (spec 004), one global `MCP_TOKEN` (spec 007), one Garmin token store in the sidecar, and a single
JSON consent file (spec 011). PRODUCT.md still says "not multi-tenant." This spec supersedes that: Garmin Bridge
becomes a **multi-tenant, internet-connected** service where **anyone with a Google account** can self-register
by signing in. Each user is fully isolated — their own Garmin connection, their own consent records, their own
settings, and their own MCP token/URL. There is **no email allow-list**; sign-in is the registration.

Auth becomes passwordless Google Sign-In via **OpenID Connect (Authorization Code + PKCE)**; sessions become
**DB-backed and revocable**; per-user data moves from files/env into **Postgres** behind an injected repository
port; and the sidecar becomes **multi-tenant**, keying its encrypted token store by an opaque user id the web
passes on every call. Because the surface is now internet-facing rather than LAN-only, secret hygiene and
session security are load-bearing, not incidental. A `mock` auth adapter (mirroring `GARMIN_ADAPTER=mock`) keeps
the whole system runnable on Docker with no real Google credentials, and is refused in production.

## Requirements (acceptance criteria)

### OIDC login / callback / logout

- [ ] `GET /auth/login` starts Authorization Code + PKCE: generates `code_verifier` + `code_challenge` (S256),
      a random `state`, and a `nonce`; stores them in short-lived, httpOnly cookies (or a server-side transaction
      row); redirects (302) to Google's authorization endpoint with `client_id`, `redirect_uri`, `scope=openid
      email profile`, `response_type=code`, `code_challenge`, `state`, `nonce`
- [ ] `GET /auth/callback` validates `state` (constant-time) and rejects mismatch/missing with 400; exchanges the
      `code` at Google's token endpoint using the stored `code_verifier` (+ `GOOGLE_CLIENT_SECRET`)
- [ ] The returned `id_token` is verified against **Google's JWKS** (signature, `iss`, `aud`==`GOOGLE_CLIENT_ID`,
      `exp`, and `nonce` matches the stored nonce); invalid token → 401 and no session
- [ ] Identity key is the Google **`sub`** claim (never email); `email`, `name`, `picture` are captured as profile data
- [ ] On success a DB-backed session is created and its opaque id set in the session cookie, then a 302 redirect to `/`
- [ ] `POST /auth/logout` deletes the current session row and clears the cookie (idempotent; 200 even if already gone)
- [ ] No passwords are ever stored, requested, or accepted anywhere in the flow

### Sessions & guard

- [ ] Session cookie carries an **opaque, high-entropy session id** (not a JWT, no claims) — httpOnly,
      SameSite=Lax, `Secure` when the request is https, `Path=/`, Max-Age = session TTL
- [ ] `SessionService.verify(sessionId)` looks the session up in the repository, checks `expires_at` against the
      injected `Clock`, and returns the associated `userId` (or null); expired/unknown/revoked → null
- [ ] Sessions are **revocable per user**: deleting the row (logout, or "sign out everywhere") invalidates it immediately
- [ ] `hooks.server.ts` resolves the session to a `userId`, stores it on `event.locals`, and guards routes:
      unauthenticated page → 302 `/login`; unauthenticated non-public `/api/*` → 401; `/auth/**` and `/login`
      and `/styleguide` are public
- [ ] `event.locals` exposes the resolved `userId` (and `authenticated`) so every downstream handler is user-scoped

### User provisioning (first login)

- [ ] First successful sign-in for a Google `sub` **creates** a `users` row (id, google_sub, email, name,
      avatar_url, created_at); subsequent sign-ins **look up** by `sub` and refresh email/name/avatar_url
- [ ] The internal user `id` (opaque, e.g. UUID) — never the Google `sub` — is what is passed to the sidecar and
      what per-user data is keyed by

### Per-user isolation

- [ ] Garmin connection is per-user: the web passes an **`X-User-Id`** header (the internal user id) to the
      sidecar on login/status/metric/range/disconnect; a user only ever sees their own connection status/metrics
- [ ] Consent is per-user: consent records move from the JSON file to a `consents` table keyed by `user_id`;
      `ConsentStore` operations are scoped to the current user (spec 011 semantics otherwise unchanged)
- [ ] Settings are per-user: a `settings` table keyed by `user_id`
- [ ] MCP is per-user: `/mcp?token=<t>` resolves `t` via the `mcp_tokens` table to a `user_id` and serves ONLY
      that user's Garmin data; an unknown/rotated token → 401; the global `MCP_TOKEN` env is removed
- [ ] A user can **rotate** their MCP token from Settings (issues a new random token, invalidates the old); the
      MCP URL card shows the current per-user token
- [ ] Cross-user access is impossible by construction: no handler, tool, or sidecar call omits the user scope

### Mock auth adapter

- [ ] `AUTH_ADAPTER=mock` signs in a fixed dev user (stable `sub`/email/name) WITHOUT contacting Google:
      `GET /auth/login` short-circuits to create the dev user + session and redirect to `/`
- [ ] `AUTH_ADAPTER=mock` is **refused when `NODE_ENV=production`** (config throws, mirroring `GARMIN_ADAPTER=mock`)
- [ ] With `AUTH_ADAPTER=mock` the full stack runs on Docker with no `GOOGLE_CLIENT_ID/SECRET` set

### Datastore & ports

- [ ] Postgres is a new `docker compose` service; the web connects via injected config (`DATABASE_URL`)
- [ ] Schema (migrations): `users`, `sessions`, `consents`, `settings`, `mcp_tokens` — all per-user data keyed by `user_id`
- [ ] A **repository PORT** (`UserRepository`/`SessionRepository`/`McpTokenRepository`, or one `Repository`
      facade) is defined; a **pg adapter** implements it and an **in-memory fake** exists for tests
- [ ] The repository, OIDC client, and session service are injected via the container; `createTestContainer`
      wires the in-memory fake + the mock auth adapter (no network, no Postgres in tests)

### Standing criteria

- [ ] Unit + API-integration tests pass (no e2e)
- [ ] UI built only from `lib/ui` components + design tokens
- [ ] No secrets logged or committed — specifically **id_tokens, access/refresh tokens, `GOOGLE_CLIENT_SECRET`,
      `code_verifier`, session ids, and MCP tokens** never appear in logs or error text

## API contract

```
GET  /auth/login
     -> 302 Location: https://accounts.google.com/o/oauth2/v2/auth?... (state+nonce+PKCE set in httpOnly cookies)
        AUTH_ADAPTER=mock: -> 302 Location: /   (+ Set-Cookie session; dev user provisioned)

GET  /auth/callback?code=<c>&state=<s>
     -> 302 Location: /            + Set-Cookie <session cookie> (opaque id, httpOnly, SameSite=Lax, Secure when https)
     -> 400 { error }              state mismatch / missing code / expired transaction
     -> 401 { error }              id_token verification failed (bad sig/iss/aud/exp/nonce) or token exchange rejected

POST /auth/logout
     -> 200 { ok: true }           deletes session row + clears cookie (idempotent)

# MCP (spec 007), now per-user:
GET|POST /mcp?token=<per-user token>
     -> serves ONLY the resolving user's Garmin data ; 401 when token resolves to no user
     MCP URL shown to the user: ${PUBLIC_BASE_URL}/mcp?token=${user.mcpToken}

# Settings (MCP token rotation):
POST /api/settings/mcp-token/rotate
     -> 200 { token }              new per-user token (old invalidated)
```

Sidecar contract change (services/garmin), all endpoints gain a required user scope via header:

```
POST   /login    header: X-User-Id: <internal user id>   body unchanged (email/password/mfa_code)
GET    /status   header: X-User-Id: <internal user id>
GET    /metrics/<name>[?date=]            header: X-User-Id
GET    /metrics/<name>/range?start=&end=  header: X-User-Id
DELETE /session  header: X-User-Id
     -> 400 when X-User-Id missing ; token store is keyed by X-User-Id ; Garmin tokens NEVER returned to the web
```

Types: `modules/auth/auth.types.ts` (login/callback/logout + session view of the user); server ports in
`lib/server/auth/` (`OidcClient`, `AuthAdapter`) and `lib/server/repo/` (repository interfaces + row types);
`SessionService` in `lib/server/interfaces.ts` is reshaped to be user-bearing.

## UI

- `routes/login/+page.svelte` — replace the shared-password `LoginForm` with a **"Continue with Google"**
  `Button` (link to `GET /auth/login`); same centered `Card` + `ThemeToggle` layout. Add a short "you're
  registering by signing in" line. Remove the password field.
- **Settings** (per-user): a section showing the signed-in Google identity (name/email/avatar via `lib/ui`
  primitives), a **Sign out** action (`POST /auth/logout`), the per-user **MCP URL card** with a **Rotate token**
  `Button`, plus the existing consent review/revoke and Garmin disconnect (now user-scoped).
- States: loading (`Spinner`), signed-in, error (callback failure surfaces a friendly message on `/login`,
  never the raw token/error). Composed only from `lib/ui`; light + dark via tokens; labeled, focusable controls.

## Design / implementation notes

- **Ports & adapters:**
  - `AuthAdapter` port with two implementations: `google` (real OIDC via an injected `OidcClient` + injected
    `fetch` + injected JWKS source) and `mock` (fixed dev user, no network). Selected by `AUTH_ADAPTER`.
  - `OidcClient` wraps authorization-URL building, token exchange, and id_token verification against Google's
    JWKS (use `jose` `createRemoteJWKSet` + `jwtVerify`); `fetch` and `Clock` injected — no `Date.now()`/`fetch`
    inline. JWKS fetching goes through the injected `fetch`/adapter, cached.
  - `Repository` port(s) with a **pg adapter** (parameterized queries only) and an **in-memory fake** for tests.
    Container gains `repo`, `auth` (AuthAdapter), reshaped `session`; `createTestContainer` wires the fake +
    `AUTH_ADAPTER=mock`.
  - `SessionService` reshaped: `issue(userId)` creates a session row (id from a CSPRNG, `expires_at` from
    `Clock` + TTL) and returns the opaque id; `verify(sessionId)` reads the row + returns `{ userId }` or null;
    `revoke(sessionId)`. It depends on the repo + `Clock`, not on a JWT secret.
- **Config (`lib/server/config.ts`)** — the ONLY reader of env. Add `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`,
  `GOOGLE_REDIRECT_URI`, `AUTH_ADAPTER` (`google`|`mock`, default `google`, `mock` refused in prod),
  `DATABASE_URL`, and `SESSION_TTL_SECONDS` (kept). Google vars are optional when `AUTH_ADAPTER=mock`, required
  otherwise. **Remove** `APP_PASSWORD`, `SESSION_SECRET` (JWT signing no longer used), `MCP_TOKEN`,
  `CONSENT_STORE_PATH`.
- **Sidecar (`services/garmin/`, garmin-integrator):** the encrypted (Fernet) token store becomes a **map keyed
  by user id**; every endpoint requires `X-User-Id`, operates only on that user's slot, and `DELETE /session`
  clears only that slot. Garmin tokens stay ONLY in the sidecar (web never sees them). `GarminService` and its
  http adapter carry the user id through (constructed per-request with the current `userId`, or take it per call).
- **Consent migration:** `ConsentStore` file adapter → pg adapter keyed by `user_id`; `ConsentService` semantics
  unchanged (spec 011). Registry stays static.
- **Edge cases / security:** callback replay (used/expired transaction) → 400; `state`/`nonce` compared
  constant-time; open-redirect avoided (only redirect to internal paths); cookies `Secure` under https;
  never log token bodies, secrets, or session ids; treat all Google/Garmin responses as untrusted data.

## Migration / rollout note

This **replaces** the single-user model end to end and is a breaking change:

- Shared-password auth (spec 004) and its `APP_PASSWORD`/`SESSION_SECRET` JWT are removed; existing session
  cookies are invalidated (everyone re-signs-in with Google).
- The global `MCP_TOKEN` (spec 007) is removed; every user gets their own token — **existing MCP client
  configs break and must be re-copied** from Settings after first sign-in.
- The file-backed consent store (spec 011) is migrated into the `consents` table. Because there was only ever a
  single implicit user, either drop prior consent (users re-accept) or migrate the JSON into the first
  provisioned user's rows — **open follow-up** (see below).
- The sidecar's single-tenant token store becomes multi-tenant; any previously stored single-user Garmin token
  does not carry a user id and should be treated as absent (user reconnects) — **open follow-up**.
- `.env.example` and AGENTS.md §11 must be updated (new Google/DATABASE_URL/AUTH_ADAPTER keys; removed keys);
  `docker-compose.yml` gains a Postgres service; §1/§10 and PRODUCT.md ("LAN-only, not multi-tenant") must be
  revised to describe the internet-facing multi-tenant posture.

## Test plan

- **Unit:**
  - `OidcClient` — authorization URL contains `state`/`nonce`/`code_challenge`(S256)/scope; id_token verify
    accepts a well-formed token (signed by a test JWKS) and rejects bad `aud`/`iss`/`exp`/`nonce`/signature.
  - `SessionService` (over in-memory repo + fixed `Clock`) — `issue` creates a verifiable session; `verify`
    returns the `userId`; expired/unknown/revoked → null; `revoke` invalidates immediately.
  - User provisioning — first login inserts a `users` row keyed by `sub`; second login updates profile, no dup.
  - Repository fake vs. pg adapter share a contract test suite (same assertions) where feasible.
- **API integration (mock adapters, in-memory repo, no network/Postgres):**
  - `GET /auth/login` (google adapter) → 302 to Google with required params + transaction cookies set.
  - `GET /auth/callback` with a stubbed `OidcClient` → session cookie + 302 `/`; state mismatch → 400; bad
    id_token → 401.
  - `AUTH_ADAPTER=mock`: `GET /auth/login` → provisions dev user + session + 302 `/`.
  - `POST /auth/logout` → clears cookie + row (idempotent).
  - Guard: unauthenticated page → 302 `/login`; unauthenticated `/api/*` → 401; authed request carries `userId`.
  - Per-user isolation: two sessions (user A, user B) see only their own consent/settings/Garmin status; MCP
    token for A resolves to A's data only; unknown/rotated token → 401.
  - Config: `AUTH_ADAPTER=mock` + `NODE_ENV=production` → `loadConfig` throws.
- **Sidecar (pytest):** `X-User-Id` required (400 when missing); token store isolates two user ids;
  `DELETE /session` clears only the caller's slot; `garmy` mocked at the client boundary.

## Open questions / follow-ups

- Consent + Garmin-token migration from the legacy single-user records: drop-and-reconsent vs. attach to the
  first provisioned user — decide during implementation (flagged above).
- "Sign out everywhere" (bulk session revoke) and a session list in Settings — likely a separate spec.
- Session refresh / sliding expiry vs. fixed TTL; and whether to store Google refresh tokens at all (default: no).
- Account deletion / data export (GDPR-style) for a now-multi-tenant service — separate spec.
- MCP token in a query string is logged by intermediaries; consider header-only auth for `/mcp` — separate spec.
- Rate limiting / abuse protection now that registration is open to any Google account — separate spec.

## Closeout

- Commits: <pending>
- Notes / follow-ups: see Open questions. Update AGENTS.md §11 + `.env.example` + `docker-compose.yml` +
  PRODUCT.md during implementation; coordinate the web + sidecar changes as one rollout.
