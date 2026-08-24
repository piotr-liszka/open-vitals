/**
 * Bundled entry for the custom Node server (server.js). esbuild compiles this to build-mcp/index.js
 * so the production bootstrap can build MCP servers that share the app container (config + adapters).
 *
 * Since spec 055 this also owns the `/mcp` request POLICY (auth, rate limiting, response headers).
 * `server.js` used to hand-roll all three, drifting from the tested modules the SvelteKit path uses;
 * it is now a transport shim that applies the decision `mcpGate` returns.
 */
import { createContainer, type AppContainer } from '../server/container';
import { createRateLimiter } from '../server/rate-limit';
import { createMcpServer } from './create-server';
import { mcpGate, type McpGateDecision, type McpGateInput } from './http';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

export { clientIpOf, extractMcpToken, readJsonBody, MCP_MAX_BODY_BYTES } from './http';
export type { McpGateDecision } from './http';

let ref: AppContainer | null = null;
function container(): AppContainer {
  if (!ref) ref = createContainer();
  return ref;
}

/** Requests per minute per resolved user — the pre-existing abuse/DoS cap. */
const PER_USER_LIMIT = Number(process.env.MCP_RATE_LIMIT ?? 120);
/**
 * Rejected tokens per minute per client IP. Legitimate clients never produce an authentication
 * failure, so this budget exists purely to bound brute-force and the database lookup each guess buys.
 */
const AUTH_FAILURE_LIMIT = Number(process.env.MCP_AUTH_FAILURE_LIMIT ?? 30);

const now = (): number => container().clock.now().getTime();
const perUser = createRateLimiter({ limit: PER_USER_LIMIT, windowMs: 60_000, now });
const authFailures = createRateLimiter({ limit: AUTH_FAILURE_LIMIT, windowMs: 60_000, now });

/** Whether `X-Forwarded-For` may be believed when keying the failure limiter. */
export const trustProxy = (process.env.MCP_TRUST_PROXY ?? 'off') === 'on';

/**
 * Decide how to answer one `/mcp` request: reject it (401/429) or serve it for a resolved user.
 * The returned headers are the same hardened set every SvelteKit response carries.
 */
export function gateMcpRequest(input: McpGateInput): Promise<McpGateDecision> {
  return mcpGate(
    { resolveUser: (token) => container().repo.mcpTokens.resolve(token), authFailures, perUser },
    input
  );
}

/**
 * Fresh MCP server bound to ONE user's GarminService (stateless: one per request). Only the resolved
 * user's data is ever served, because every sidecar call carries their `X-User-Id`.
 */
export function newMcpServerForUser(userId: string): McpServer {
  const c = container();
  return createMcpServer(
    c.garminFor(userId),
    { clock: c.clock, timeZone: c.config.appTimeZone },
    // Workout authoring (spec 050): writes go to the LOCAL store, which the sync then projects onto
    // Garmin. The sidecar source is passed only so a delete can be cleaned up upstream immediately.
    {
      store: c.store,
      userId,
      clock: c.clock,
      timeZone: c.config.appTimeZone,
      random: c.random,
      consent: c.consentFor(userId),
      garmin: c.garminSyncFor(userId)
    },
    // Season goals (spec 060): read + write, entirely against the local store — no Garmin call at all.
    {
      store: c.store,
      settings: c.repo.settings,
      userId,
      clock: c.clock,
      consent: c.consentFor(userId),
      random: c.random
    }
  );
}
