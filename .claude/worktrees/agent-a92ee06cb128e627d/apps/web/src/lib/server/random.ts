/**
 * Injectable CSPRNG source so id/token generation stays behind a port (AGENTS.md §2 rule 3) and
 * tests can make it deterministic. Used for session ids, OAuth `state`/`nonce`, and PKCE verifiers.
 */
import { randomBytes } from 'node:crypto';

export interface Random {
  /** URL-safe, high-entropy opaque token (base64url of `byteLength` random bytes). */
  token(byteLength?: number): string;
}

/** base64url encode without padding. */
export function base64url(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString('base64url');
}

export const systemRandom: Random = {
  token: (byteLength = 32) => base64url(randomBytes(byteLength))
};

/**
 * Deterministic Random for tests: emits a predictable sequence of tokens.
 * NEVER use outside tests.
 */
export function sequenceRandom(prefix = 'tok'): Random {
  let n = 0;
  return { token: () => `${prefix}-${++n}` };
}
