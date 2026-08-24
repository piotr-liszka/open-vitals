# Spec 006 — Dashboard: health check + MCP URL cards

- **Status:** Closed
- **Module:** `apps/web/src/modules/{healthcheck,mcp-url}/`, `routes/+page.*`, `routes/api/{garmin/status,mcp-url}/`
- **Owner agent:** module-dev
- **Depends on:** 003, 001, 005

## Context

After logging in the user needs to see, at a glance, whether Garmin is connected and the MCP URL to paste into
their AI client. The dashboard composes the health-check and MCP-URL modules inside the `AppShell`, and surfaces
the setup form when not yet connected. (Richer dashboard widgets are deferred.)

## Requirements (acceptance criteria)

- [x] `GET /api/garmin/status` returns `{ connected, displayName, expiresAt, reachable }`; tolerates an unreachable sidecar
- [x] `GET /api/mcp-url` returns the personal MCP URL
- [x] Dashboard `+page.server.ts` loads health + MCP URL; page shows `HealthCard`, `McpUrlCard`, and `SetupForm` (when disconnected)
- [x] `McpUrlCard` copies the URL and warns it contains a secret token
- [x] Sign-out button clears the session
- [x] Built from `lib/ui`; unit tests pass

## API contract

```
GET /api/garmin/status -> 200 { connected, displayName, expiresAt, reachable }
GET /api/mcp-url        -> 200 { url }
```
Types: `modules/healthcheck/health.types.ts`.

## UI

`HealthCard.svelte` (status beacon + Badge + account/expiry), `McpUrlCard.svelte` (code + copy + secret warning),
composed in `routes/+page.svelte` via `AppShell` with nav + sign-out.

## Test plan

- **Unit/integration:** `health.api.test.ts` (connected / not-connected / unreachable), `mcpUrl.api.test.ts` (URL shape).

## Closeout

- Files: `modules/healthcheck/{health.types,health.api,HealthCard.svelte}` + test,
  `modules/mcp-url/{mcpUrl.api,McpUrlCard.svelte}` + test, `routes/+page.{server.ts,svelte}`,
  `routes/api/garmin/status/+server.ts`, `routes/api/mcp-url/+server.ts`.
- Follow-up: dashboard metric widgets (StatTile grid) once the sidecar metric shapes are confirmed.
