# Spec 004 — Shared-password auth (login/logout + session guard)

- **Status:** Closed
- **Module:** `apps/web/src/modules/auth/`, `routes/login/`, `routes/api/{login,logout}/`
- **Owner agent:** module-dev
- **Depends on:** 003 (server core), 001 (UI)

## Context

The web UI is LAN-facing and must be protected. A single shared password gates access; a successful login
issues a signed JWT session cookie, and `hooks.server.ts` redirects unauthenticated users to `/login`.

## Requirements (acceptance criteria)

- [x] `POST /api/login` validates the password (constant-time compare) and sets an httpOnly session cookie
- [x] `POST /api/logout` clears the cookie
- [x] Wrong password → 401; malformed body → 400
- [x] Unauthenticated page requests redirect to `/login`; unauthenticated `/api/*` (non-public) → 401 (hooks)
- [x] Login page built from `lib/ui` (Card, Field, Input, Button); accessible
- [x] Unit/integration tests pass; no secrets logged

## API contract

```
POST /api/login   { password }        -> 200 { ok:true } + Set-Cookie gb_session ; 401/400 { ok:false, error }
POST /api/logout                       -> 200 { ok:true } (clears cookie)
```
Types: `modules/auth/login.types.ts`.

## UI

`routes/login/+page.svelte` — centered Card with `LoginForm.svelte`. Light+dark via tokens.

## Design / implementation notes

- Cookie: httpOnly, SameSite=Lax, `secure` iff request is https (LAN is http). Max-Age = session TTL.
- Constant-time compare via `lib/server/crypto.ts` `safeEqual`.

## Test plan

- **Integration:** `login.api.test.ts` — correct password issues a verifiable token; wrong → 401; empty → 400.

## Closeout

- Files: `modules/auth/{login.types,login.api,LoginForm.svelte}` + test, `routes/login/+page.svelte`,
  `routes/api/login/+server.ts`, `routes/api/logout/+server.ts`, `lib/server/crypto.ts`.
