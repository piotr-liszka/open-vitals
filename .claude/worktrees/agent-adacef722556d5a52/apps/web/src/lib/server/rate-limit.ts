/**
 * In-memory sliding-window rate limiter (defense-in-depth, spec 014 security follow-up). Pure over an
 * injected clock so it is deterministic and unit-testable (AGENTS.md §2 rule 4). One instance guards
 * one class of action; callers key by user id / token. Suitable for a single-node deployment — a
 * multi-node setup would swap this adapter for a shared store (Redis) behind the same interface.
 */
export interface RateLimitResult {
  allowed: boolean;
  /** Seconds until the caller may retry (0 when allowed). */
  retryAfterSeconds: number;
  /** Requests still available in the current window (0 when blocked). */
  remaining: number;
}

export interface RateLimiter {
  /** Record a hit and report whether it was allowed. */
  check(key: string): RateLimitResult;
  /**
   * Report the key's current standing WITHOUT recording a hit.
   *
   * Needed by failure-only limiters (spec 055): the `/mcp` gate must know whether an IP is already
   * blocked *before* it spends a database round-trip resolving the token, but a legitimate request
   * must not consume from a bucket that only counts authentication failures.
   */
  peek(key: string): RateLimitResult;
}

export interface RateLimiterOptions {
  /** Max allowed hits per window. */
  limit: number;
  /** Window length in milliseconds. */
  windowMs: number;
  /** Injected time source (ms since epoch). */
  now: () => number;
  /** Cap on tracked keys — evicts the oldest to bound memory. Default 10_000. */
  maxKeys?: number;
}

export function createRateLimiter(opts: RateLimiterOptions): RateLimiter {
  const { limit, windowMs, now } = opts;
  const maxKeys = opts.maxKeys ?? 10_000;
  const hits = new Map<string, number[]>();

  /** Drop hits that fell out of the window and re-seat the key so eviction order stays LRU. */
  const prune = (key: string, t: number): number[] => {
    const recent = (hits.get(key) ?? []).filter((ts) => ts > t - windowMs);
    return recent;
  };

  const blocked = (recent: number[], t: number): RateLimitResult => ({
    allowed: false,
    // Oldest hit in the window determines when a slot frees up.
    retryAfterSeconds: Math.max(1, Math.ceil((recent[0]! + windowMs - t) / 1000)),
    remaining: 0
  });

  /**
   * Re-seat a key at the END of Map iteration order so eviction is genuinely least-recently-used.
   *
   * Applied on BOTH the allowed and the blocked path. Skipping it for blocked keys would mean an
   * actively-throttled caller is the stalest entry in the map and therefore the first evicted —
   * handing them a fresh budget precisely when the limiter is supposed to be holding them back.
   */
  const touch = (key: string, recent: number[]): void => {
    hits.delete(key);
    hits.set(key, recent);
    // Bound memory: if we exceed maxKeys, drop the least-recently-touched key.
    if (hits.size > maxKeys) {
      const firstKey = hits.keys().next().value;
      if (firstKey !== undefined) hits.delete(firstKey);
    }
  };

  return {
    check(key: string): RateLimitResult {
      const t = now();
      const recent = prune(key, t);

      if (recent.length >= limit) {
        touch(key, recent);
        return blocked(recent, t);
      }

      recent.push(t);
      touch(key, recent);
      return { allowed: true, retryAfterSeconds: 0, remaining: limit - recent.length };
    },

    peek(key: string): RateLimitResult {
      const t = now();
      const recent = prune(key, t);
      if (recent.length >= limit) return blocked(recent, t);
      return { allowed: true, retryAfterSeconds: 0, remaining: limit - recent.length };
    }
  };
}
