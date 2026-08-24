/** PKCE (RFC 7636) helpers. The verifier comes from the injected Random; the challenge is derived. */
import { createHash } from 'node:crypto';
import { base64url } from '../random';

/** S256 code_challenge = base64url(sha256(code_verifier)). */
export function codeChallengeS256(codeVerifier: string): string {
  return base64url(createHash('sha256').update(codeVerifier).digest());
}
