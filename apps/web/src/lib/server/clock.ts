/** Injectable clock so time-dependent code stays deterministic in tests (AGENTS.md §7). */
export interface Clock {
  now(): Date;
  /** Epoch seconds — convenient for JWT iat/exp. */
  nowSeconds(): number;
}

export const systemClock: Clock = {
  now: () => new Date(),
  nowSeconds: () => Math.floor(Date.now() / 1000)
};

/** Test helper: a clock frozen at a fixed instant. */
export function fixedClock(at: Date): Clock {
  return {
    now: () => new Date(at.getTime()),
    nowSeconds: () => Math.floor(at.getTime() / 1000)
  };
}
