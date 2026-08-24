# Spec 007 — MCP server (Streamable HTTP) + token gate + Garmin tools

- **Status:** Closed
- **Module:** `apps/web/src/lib/mcp/`, `apps/web/server.js`
- **Owner agent:** module-dev
- **Depends on:** 003 (server core / GarminService)

## Context

The whole point of the app is to let an AI client query the user's Garmin data. That surface is an MCP
server exposed over Streamable HTTP at `/mcp`, gated by a static `MCP_TOKEN`, with read-only tools that
proxy the sidecar through the injected `GarminService`. Tool logic is kept framework-independent so it is
unit-testable with the mock adapter.

## Requirements (acceptance criteria)

- [x] Tools defined as pure handlers over `GarminService` (`tools.ts`): `get_status`, `get_health_snapshot`,
      `get_sleep`, `get_steps`, `get_body_battery`, `get_hrv`, `get_stress`, `get_resting_heart_rate`, `get_activities`
- [x] `date` args validated as `YYYY-MM-DD`; default to today (sidecar-side)
- [x] Not-connected / unavailable failures returned as friendly `isError` tool results, not thrown to the client
- [x] `createMcpServer(garmin)` registers all tools on an `McpServer`
- [x] `/mcp` served via `StreamableHTTPServerTransport` (stateless) from a custom `server.js`; other requests
      delegate to the SvelteKit handler
- [x] `/mcp` rejects requests whose `?token=` / `Authorization: Bearer` != `MCP_TOKEN` with 401
- [x] Build wires an esbuild bundle (`build-mcp/index.js`) reusing the app container; Docker runs `node server.js`
- [x] Unit tests cover tool behaviour with a mock GarminService
- [x] No secrets logged

## API contract

```
POST /mcp?token=<MCP_TOKEN>     JSON-RPC (MCP Streamable HTTP). 401 when token invalid.
GET  /mcp?token=<MCP_TOKEN>     SSE/stream per MCP. 401 when token invalid.
```
MCP URL shown to the user: `${PUBLIC_BASE_URL}/mcp?token=${MCP_TOKEN}`.

## UI

N/A (the MCP-URL card that surfaces this lives in spec 006).

## Design / implementation notes

- Stateless transport: a fresh `McpServer` + transport per request, torn down on `res` close.
- Token comparison is exact-match on env `MCP_TOKEN`; rotate by changing env.
- `entry.ts` reuses `createContainer()` so tools share config + the same `GarminHttpAdapter`.

## Test plan

- **Unit:** `tools.test.ts` — names/prefixes, `get_status` text, metric date forwarding, not-connected → isError,
  snapshot aggregation.

## Closeout

- Files: `lib/mcp/{tools,create-server,entry}.ts` + `tools.test.ts`, `server.js`, Dockerfile + package.json build wiring.
- Follow-up: needs a runtime smoke test once Node is installed (connect a real MCP client to `/mcp`).
