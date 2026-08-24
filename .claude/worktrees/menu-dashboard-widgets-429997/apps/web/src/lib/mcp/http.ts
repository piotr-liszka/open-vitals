/**
 * HTTP gate for the `/mcp` endpoint (spec 055).
 *
 * `/mcp` is the ONE published route that never passes through `hooks.server.ts`: the custom Node
 * entry (`server.js`) serves it directly, so SvelteKit's auth guard and response hardening do not
 * apply to it. Before spec 055 `server.js` hand-rolled its own copies of both — an untested,
 * silently-drifting duplicate of `lib/server/security-headers.ts` and `lib/server/rate-limit.ts`.
 *
 * Everything policy-shaped now lives here, pure over injected dependencies (AGENTS.md §2 rule 4), so
 * it is unit-testable without a socket; `server.js` is left as a thin transport shim that applies
 * whatever this decides.
 *
 * Two limiters, deliberately different in kind:
 *   - `authFailures` is keyed by client IP and charged ONLY on a rejected token. It bounds
 *     unauthenticated brute-force and the database round-trip each guess would otherwise buy for
 *     free. A legitimate client never produces a failure, so it never consumes this budget.
 *   - `perUser` is keyed by the RESOLVED user id and charged on every accepted request — the
 *     pre-existing abuse/DoS cap, unchanged in behaviour.
 */
import { securityHeaders } from '$lib/server/security-headers';
import type { RateLimiter } from '$lib/server/rate-limit';

/** What the transport should do with one `/mcp` request. */
export type McpGateDecision =
  | { action: 'serve'; userId: string; headers: Record<string, string> }
  | { action: 'reject'; status: 401 | 429; headers: Record<string, string>; body: string };

export interface McpGateDeps {
  /** Resolve a per-user MCP token to its owning user id (null when unknown/rotated). */
  resolveUser(token: string): Promise<string | null>;
  /** Per-IP limiter charged only on authentication failures. */
  authFailures: RateLimiter;
  /** Per-resolved-user limiter charged on every served request. */
  perUser: RateLimiter;
}

export interface McpGateInput {
  /** The presented token (empty string when absent). */
  token: string;
  /** Client address used to key the failure limiter. */
  clientIp: string;
  /** Whether the edge is HTTPS — decides HSTS, exactly as in the SvelteKit path. */
  https: boolean;
}

/**
 * Decide how to answer one `/mcp` request. Never throws; never reveals whether a token merely
 * existed, so a rejected caller learns nothing beyond "not authorised".
 */
export async function mcpGate(deps: McpGateDeps, input: McpGateInput): Promise<McpGateDecision> {
  const headers = securityHeaders({ https: input.https });

  const reject = (status: 401 | 429, error: string, retryAfter?: number): McpGateDecision => ({
    action: 'reject',
    status,
    headers: {
      ...headers,
      'content-type': 'application/json',
      ...(retryAfter === undefined ? {} : { 'retry-after': String(retryAfter) })
    },
    body: JSON.stringify({ error })
  });

  // Already-blocked IPs are turned away BEFORE the token lookup, so a flood of guesses cannot
  // amplify into a flood of database queries. `peek` — a blocked-but-legitimate request must not
  // be charged twice, and this bucket only ever counts failures.
  const standing = deps.authFailures.peek(input.clientIp);
  if (!standing.allowed) return reject(429, 'rate_limited', standing.retryAfterSeconds);

  const userId = input.token ? await deps.resolveUser(input.token) : null;
  if (!userId) {
    deps.authFailures.check(input.clientIp);
    return reject(401, 'unauthorized');
  }

  const gate = deps.perUser.check(userId);
  if (!gate.allowed) return reject(429, 'rate_limited', gate.retryAfterSeconds);

  return { action: 'serve', userId, headers };
}

/**
 * Extract the presented token from `?token=` or an `Authorization: Bearer` header.
 *
 * The query form is the product's copy-paste UX (the MCP URL card), so it stays — but it is the
 * reason `Referrer-Policy` is set on every response: a token in a URL must not travel in a `Referer`
 * to a third-party origin.
 */
export function extractMcpToken(input: {
  searchParams: URLSearchParams;
  authorization?: string | undefined;
}): string {
  const fromQuery = input.searchParams.get('token');
  if (fromQuery) return fromQuery;
  const header = input.authorization;
  return typeof header === 'string' ? header.replace(/^Bearer\s+/i, '').trim() : '';
}

/** Hard cap on a `/mcp` request body. A JSON-RPC call is tiny; anything larger is abuse. */
export const MCP_MAX_BODY_BYTES = 1_000_000;

/**
 * Read and JSON-parse a request body from a byte stream, or `undefined` when there is nothing
 * usable (empty, malformed, or over the cap).
 *
 * Taking an `AsyncIterable` rather than an `IncomingMessage` keeps this testable with a plain async
 * generator. It also fixes two bugs in the hand-rolled reader it replaces: that one measured the cap
 * in UTF-16 code units of a decoded string (so multi-byte input could exceed the byte budget), and
 * on tripping the cap it destroyed the socket without ever settling its promise — leaving the
 * awaiting handler, its MCP server, and its transport pinned until the connection dropped.
 */
export async function readJsonBody(
  source: AsyncIterable<Uint8Array>,
  maxBytes: number = MCP_MAX_BODY_BYTES
): Promise<unknown> {
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for await (const chunk of source) {
      size += chunk.byteLength;
      if (size > maxBytes) return undefined;
      chunks.push(chunk);
    }
  } catch {
    return undefined; // transport error mid-body — treat as no body
  }
  if (size === 0) return undefined;
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    return undefined;
  }
}

/**
 * Resolve the address the failure limiter is keyed by.
 *
 * `X-Forwarded-For` is only consulted when the deployment declares it sits behind a trusted proxy
 * (`MCP_TRUST_PROXY=on`); otherwise it is attacker-controlled and would let one client mint an
 * unlimited number of fresh buckets. Falling back to the socket address means every request behind
 * an untrusted-but-real proxy shares one bucket — acceptable precisely because this bucket counts
 * only failures, which legitimate traffic does not produce.
 */
export function clientIpOf(input: {
  forwardedFor?: string | undefined;
  remoteAddress?: string | undefined;
  trustProxy: boolean;
}): string {
  if (input.trustProxy && input.forwardedFor) {
    const first = input.forwardedFor.split(',')[0]?.trim();
    if (first) return first;
  }
  return input.remoteAddress ?? 'unknown';
}
