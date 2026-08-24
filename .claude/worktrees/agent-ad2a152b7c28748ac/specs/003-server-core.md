# Spec 003 — Server core (config, DI container, interfaces/adapters, hooks, /api/health)

- **Status:** Closed
- **Module:** `apps/web/src/lib/server/`, `apps/web/src/hooks.server.ts`, `apps/web/src/routes/api/health/`
- **Owner agent:** module-dev (lead)
- **Depends on:** none

## Context

Everything else (feature modules, MCP tools) depends on a small, testable core: typed config, injectable
services behind interfaces (ports & adapters), a per-request DI container, session verification, and a
liveness endpoint. Building this first fixes the contracts so slices can be developed and tested in isolation
with mock adapters.

## Requirements (acceptance criteria)

- [x] `Config` loaded/validated from env in one place (`config.ts`), no other module reads `process.env`
- [x] `Clock`, `Logger` injectable; logger redacts secret-ish keys
- [x] `GarminService` + `SessionService` interfaces defined (`interfaces.ts`)
- [x] `GarminHttpAdapter` talks to the sidecar via an injected `fetch`; maps status/login/metric/disconnect
- [x] `GarminMock` scriptable adapter for tests
- [x] `SessionService` (jose JWT) issues/verifies with an injected clock
- [x] `AppContainer` + `createContainer` / `createTestContainer` wire real vs mock deps
- [x] `hooks.server.ts` injects the container, resolves session → `locals.authenticated`, guards protected routes
- [x] `GET /api/health` returns liveness JSON (no Garmin call)
- [x] Unit + API-integration tests pass (config, session, http-adapter, health)
- [x] No secrets logged or committed

## API contract

```
GET /api/health -> 200 { status:"ok", service:"garmin-bridge-web", time: ISO }
```
Types: `apps/web/src/lib/server/interfaces.ts`.

## UI

N/A (backend core).

## Design / implementation notes

- Ports & adapters: handlers receive `event.locals.container`; no direct `fetch`/`Date.now`/`process.env` in handlers.
- `hooks.server.ts` builds the container once; public paths: `/login`, `/api/login`, `/api/health`, `/styleguide`.
- Session cookie name `gb_session`; HS256; expiry via injected clock (`currentDate` on verify).

## Test plan

- **Unit:** `config.test.ts` (valid/invalid env), `session.test.ts` (issue/verify/expiry/wrong-secret).
- **Integration:** `http-adapter.test.ts` (mock fetch: login outcomes, metric 409, transport error, disconnect),
  `health.test.ts` (handler returns injected-clock time).

## Closeout

- Files: `lib/server/{config,clock,logger,interfaces,session,container}.ts`, `lib/server/garmin/{http-adapter,mock-adapter}.ts`,
  `hooks.server.ts`, `routes/api/health/+server.ts`, plus co-located tests.
- Follow-ups: custom `server.ts` mounting `/mcp` lands in Phase 3 (spec for MCP).
