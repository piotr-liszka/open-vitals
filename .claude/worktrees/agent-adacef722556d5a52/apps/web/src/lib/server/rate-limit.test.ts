import { describe, it, expect } from 'vitest';
import { createRateLimiter } from './rate-limit';

describe('createRateLimiter', () => {
  it('allows up to the limit, then blocks within the window', () => {
    let t = 1_000_000;
    const rl = createRateLimiter({ limit: 3, windowMs: 60_000, now: () => t });
    expect(rl.check('a').allowed).toBe(true);
    expect(rl.check('a').allowed).toBe(true);
    expect(rl.check('a').allowed).toBe(true);
    const blocked = rl.check('a');
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
    expect(blocked.remaining).toBe(0);
  });

  it('keeps keys independent', () => {
    let t = 0;
    const rl = createRateLimiter({ limit: 1, windowMs: 1000, now: () => t });
    expect(rl.check('a').allowed).toBe(true);
    expect(rl.check('b').allowed).toBe(true);
    expect(rl.check('a').allowed).toBe(false);
  });

  it('frees a slot once the window passes', () => {
    let t = 0;
    const rl = createRateLimiter({ limit: 1, windowMs: 1000, now: () => t });
    expect(rl.check('a').allowed).toBe(true);
    expect(rl.check('a').allowed).toBe(false);
    t += 1001;
    expect(rl.check('a').allowed).toBe(true);
  });

  it('reports remaining budget', () => {
    let t = 0;
    const rl = createRateLimiter({ limit: 5, windowMs: 1000, now: () => t });
    expect(rl.check('a').remaining).toBe(4);
    expect(rl.check('a').remaining).toBe(3);
  });

  describe('peek (spec 055)', () => {
    it('reports standing without recording a hit', () => {
      const rl = createRateLimiter({ limit: 2, windowMs: 1000, now: () => 0 });
      for (let i = 0; i < 10; i++) expect(rl.peek('a').allowed).toBe(true);
      // Ten peeks consumed nothing, so the full budget is still there.
      expect(rl.check('a').allowed).toBe(true);
      expect(rl.check('a').allowed).toBe(true);
      expect(rl.check('a').allowed).toBe(false);
    });

    it('reports a blocked key, with the same Retry-After as check', () => {
      const rl = createRateLimiter({ limit: 1, windowMs: 60_000, now: () => 1_000 });
      rl.check('a');
      const peeked = rl.peek('a');
      expect(peeked.allowed).toBe(false);
      expect(peeked.retryAfterSeconds).toBe(rl.check('a').retryAfterSeconds);
    });

    it('clears once the window passes', () => {
      let t = 0;
      const rl = createRateLimiter({ limit: 1, windowMs: 1000, now: () => t });
      rl.check('a');
      expect(rl.peek('a').allowed).toBe(false);
      t += 1001;
      expect(rl.peek('a').allowed).toBe(true);
    });
  });

  it('evicts the least-recently-used key, not the busiest one', () => {
    let t = 0;
    // maxKeys 2: writing a third key must evict the stalest, which is `a` only until `a` is reused.
    const rl = createRateLimiter({ limit: 1, windowMs: 60_000, now: () => t, maxKeys: 2 });
    rl.check('a');
    rl.check('b');
    t += 1;
    rl.peek('a'); // peeking must not count as use for eviction purposes...
    expect(rl.check('a').allowed).toBe(false); // ...but `a` is still tracked and still blocked

    // `a` was just re-touched by that check, so adding `c` should evict `b` instead.
    rl.check('c');
    expect(rl.check('a').allowed).toBe(false);
    expect(rl.check('b').allowed).toBe(true); // evicted -> fresh budget
  });
});
