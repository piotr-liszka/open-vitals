/**
 * Unit tests for the `/mcp` HTTP gate (spec 055). These cover the policy that used to live as
 * untested JavaScript in server.js: token extraction, the two rate limiters, response hardening,
 * and the body reader's size/​malformed handling.
 */
import { describe, expect, it } from 'vitest';
import { createRateLimiter } from '$lib/server/rate-limit';
import { clientIpOf, extractMcpToken, mcpGate, readJsonBody, type McpGateDeps } from './http';

/** A gate wired over deterministic limiters and a fixed token->user table. */
function makeDeps(
  tokens: Record<string, string>,
  opts: { now?: () => number; failureLimit?: number; userLimit?: number } = {}
): McpGateDeps & { resolveCalls: () => number } {
  const now = opts.now ?? (() => 1_000_000);
  let resolveCalls = 0;
  return {
    resolveUser: async (token) => {
      resolveCalls++;
      return tokens[token] ?? null;
    },
    authFailures: createRateLimiter({ limit: opts.failureLimit ?? 3, windowMs: 60_000, now }),
    perUser: createRateLimiter({ limit: opts.userLimit ?? 5, windowMs: 60_000, now }),
    resolveCalls: () => resolveCalls
  };
}

const INPUT = { clientIp: '10.0.0.1', https: true };

describe('mcpGate', () => {
  it('serves a request whose token resolves to a user', async () => {
    const deps = makeDeps({ 'good-token': 'user-1' });
    const decision = await mcpGate(deps, { ...INPUT, token: 'good-token' });

    expect(decision.action).toBe('serve');
    if (decision.action !== 'serve') return;
    expect(decision.userId).toBe('user-1');
  });

  it('rejects an unknown token with 401 and no hint that it was merely wrong', async () => {
    const deps = makeDeps({ 'good-token': 'user-1' });
    const decision = await mcpGate(deps, { ...INPUT, token: 'nope' });

    expect(decision.action).toBe('reject');
    if (decision.action !== 'reject') return;
    expect(decision.status).toBe(401);
    expect(JSON.parse(decision.body)).toEqual({ error: 'unauthorized' });
  });

  it('rejects a missing token without spending a lookup', async () => {
    const deps = makeDeps({ 'good-token': 'user-1' });
    const decision = await mcpGate(deps, { ...INPUT, token: '' });

    expect(decision.action).toBe('reject');
    expect(deps.resolveCalls()).toBe(0);
  });

  it('applies the same hardened headers the SvelteKit path uses', async () => {
    const deps = makeDeps({ t: 'user-1' });
    const decision = await mcpGate(deps, { ...INPUT, token: 't' });

    expect(decision.headers['X-Content-Type-Options']).toBe('nosniff');
    expect(decision.headers['X-Frame-Options']).toBe('DENY');
    // A token can ride in the query string, so this one is load-bearing, not decorative.
    expect(decision.headers['Referrer-Policy']).toBe('strict-origin-when-cross-origin');
    expect(decision.headers['Strict-Transport-Security']).toContain('max-age=');
  });

  it('omits HSTS when the edge is not HTTPS', async () => {
    const deps = makeDeps({ t: 'user-1' });
    const decision = await mcpGate(deps, { ...INPUT, token: 't', https: false });
    expect(decision.headers['Strict-Transport-Security']).toBeUndefined();
  });

  describe('brute-force limiting', () => {
    it('blocks an IP after too many rejected tokens, and stops querying the database', async () => {
      const deps = makeDeps({ good: 'user-1' }, { failureLimit: 3 });

      for (let i = 0; i < 3; i++) {
        const d = await mcpGate(deps, { ...INPUT, token: `guess-${i}` });
        expect(d.action === 'reject' && d.status).toBe(401);
      }
      expect(deps.resolveCalls()).toBe(3);

      const blocked = await mcpGate(deps, { ...INPUT, token: 'guess-4' });
      expect(blocked.action).toBe('reject');
      if (blocked.action !== 'reject') return;
      expect(blocked.status).toBe(429);
      expect(blocked.headers['retry-after']).toBeDefined();
      // The point of the whole exercise: a blocked IP buys no further lookups.
      expect(deps.resolveCalls()).toBe(3);
    });

    it('does not charge successful requests to the failure budget', async () => {
      const deps = makeDeps({ good: 'user-1' }, { failureLimit: 2, userLimit: 50 });

      for (let i = 0; i < 10; i++) {
        const d = await mcpGate(deps, { ...INPUT, token: 'good' });
        expect(d.action).toBe('serve');
      }
      // Two failures should still be available afterwards.
      expect((await mcpGate(deps, { ...INPUT, token: 'bad' })).action).toBe('reject');
      const second = await mcpGate(deps, { ...INPUT, token: 'bad' });
      expect(second.action === 'reject' && second.status).toBe(401);
    });

    it('keys the failure budget per IP, so one attacker cannot lock out everyone', async () => {
      const deps = makeDeps({ good: 'user-1' }, { failureLimit: 1 });

      await mcpGate(deps, { ...INPUT, token: 'bad', clientIp: '10.0.0.9' });
      const attacker = await mcpGate(deps, { ...INPUT, token: 'bad', clientIp: '10.0.0.9' });
      expect(attacker.action === 'reject' && attacker.status).toBe(429);

      const bystander = await mcpGate(deps, { ...INPUT, token: 'good', clientIp: '10.0.0.2' });
      expect(bystander.action).toBe('serve');
    });
  });

  it('caps requests per resolved user with a Retry-After', async () => {
    const deps = makeDeps({ good: 'user-1' }, { userLimit: 2 });

    expect((await mcpGate(deps, { ...INPUT, token: 'good' })).action).toBe('serve');
    expect((await mcpGate(deps, { ...INPUT, token: 'good' })).action).toBe('serve');

    const third = await mcpGate(deps, { ...INPUT, token: 'good' });
    expect(third.action).toBe('reject');
    if (third.action !== 'reject') return;
    expect(third.status).toBe(429);
    expect(Number(third.headers['retry-after'])).toBeGreaterThan(0);
  });
});

describe('extractMcpToken', () => {
  it('prefers the query parameter (the product URL shape)', () => {
    const token = extractMcpToken({
      searchParams: new URLSearchParams('token=from-query'),
      authorization: 'Bearer from-header'
    });
    expect(token).toBe('from-query');
  });

  it('falls back to a Bearer header, case-insensitively', () => {
    expect(extractMcpToken({ searchParams: new URLSearchParams(), authorization: 'bearer abc' })).toBe('abc');
    expect(extractMcpToken({ searchParams: new URLSearchParams(), authorization: 'Bearer abc' })).toBe('abc');
  });

  it('returns an empty string when nothing is presented', () => {
    expect(extractMcpToken({ searchParams: new URLSearchParams() })).toBe('');
  });
});

describe('clientIpOf', () => {
  it('ignores X-Forwarded-For unless the deployment trusts a proxy', () => {
    expect(clientIpOf({ forwardedFor: '1.2.3.4', remoteAddress: '10.0.0.1', trustProxy: false })).toBe(
      '10.0.0.1'
    );
  });

  it('takes the leftmost forwarded hop when a proxy is trusted', () => {
    expect(
      clientIpOf({ forwardedFor: '1.2.3.4, 10.0.0.5', remoteAddress: '10.0.0.1', trustProxy: true })
    ).toBe('1.2.3.4');
  });

  it('falls back to the socket address when the header is absent or empty', () => {
    expect(clientIpOf({ remoteAddress: '10.0.0.1', trustProxy: true })).toBe('10.0.0.1');
    expect(clientIpOf({ forwardedFor: '', remoteAddress: '10.0.0.1', trustProxy: true })).toBe('10.0.0.1');
    expect(clientIpOf({ trustProxy: false })).toBe('unknown');
  });
});

describe('readJsonBody', () => {
  const stream = async function* (...chunks: string[]): AsyncGenerator<Uint8Array> {
    for (const c of chunks) yield Buffer.from(c, 'utf8');
  };

  it('parses a JSON body split across chunks', async () => {
    expect(await readJsonBody(stream('{"a":', '1}'))).toEqual({ a: 1 });
  });

  it('returns undefined for an empty or malformed body', async () => {
    expect(await readJsonBody(stream())).toBeUndefined();
    expect(await readJsonBody(stream('not json'))).toBeUndefined();
  });

  it('measures the cap in BYTES, not UTF-16 code units', async () => {
    // 4 characters, 12 bytes. A char-counting cap of 6 would wrongly let this through.
    const fourEmoji = '"🙂🙂🙂"';
    expect(await readJsonBody(stream(fourEmoji), 6)).toBeUndefined();
  });

  it('settles rather than hanging when the cap is tripped mid-stream', async () => {
    const huge = async function* (): AsyncGenerator<Uint8Array> {
      for (let i = 0; i < 100; i++) yield Buffer.alloc(1000);
    };
    await expect(readJsonBody(huge(), 5_000)).resolves.toBeUndefined();
  });

  it('returns undefined when the stream errors mid-body', async () => {
    const broken = async function* (): AsyncGenerator<Uint8Array> {
      yield Buffer.from('{"a":');
      throw new Error('socket reset');
    };
    await expect(readJsonBody(broken())).resolves.toBeUndefined();
  });
});
