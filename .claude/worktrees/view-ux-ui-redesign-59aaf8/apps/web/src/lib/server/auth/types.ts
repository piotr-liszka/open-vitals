/**
 * AuthProvider PORT (spec 012): abstracts the OIDC identity step so the flow is testable without
 * Google. Two adapters implement it — `oidc` (real Google) and `mock` (fixed dev user, no network).
 */
import type { Identity } from '../repo/types';

export interface AuthorizeUrlInput {
  /** Opaque CSRF value echoed back on the callback. */
  state: string;
  /** Replay-guard bound into the id_token and checked on exchange. */
  nonce: string;
  /** PKCE S256 code_challenge (base64url(sha256(code_verifier))). */
  codeChallenge: string;
  /** Where Google should redirect after consent. */
  redirectUri: string;
}

export interface ExchangeInput {
  /** Authorization code from the callback query. */
  code: string;
  /** PKCE code_verifier stashed at /auth/login. */
  codeVerifier: string;
  /** Must match the redirect_uri used to obtain the code. */
  redirectUri: string;
  /** Nonce stashed at /auth/login; must equal the id_token `nonce`. */
  expectedNonce: string;
}

/** Raised when the provider rejects the callback (bad code, failed id_token verification, etc.). */
export class AuthExchangeError extends Error {
  constructor(message = 'OIDC token exchange failed') {
    super(message);
    this.name = 'AuthExchangeError';
  }
}

export interface AuthProvider {
  /** Which adapter this is — routes short-circuit the redirect in `mock`. */
  readonly kind: 'oidc' | 'mock';
  /** Build the provider authorization URL to redirect the browser to. */
  authorizeUrl(input: AuthorizeUrlInput): Promise<string>;
  /** Exchange the code for tokens, verify the id_token, and return the user's identity. */
  exchange(input: ExchangeInput): Promise<Identity>;
}
