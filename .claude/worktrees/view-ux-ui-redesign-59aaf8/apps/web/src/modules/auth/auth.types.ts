/** Contract types for the Google OIDC auth slice (spec 012). Shared by the routes and the module. */

/** Short-lived values stashed in httpOnly cookies between /auth/login and /auth/callback. */
export interface OAuthTransaction {
  state: string;
  nonce: string;
  codeVerifier: string;
}

/** A freshly issued session for the route to set as a cookie. */
export interface IssuedSession {
  id: string;
  cookieName: string;
  maxAge: number;
}

/** Result of starting login. */
export type BeginLoginResult =
  | { kind: 'redirect'; location: string; transaction: OAuthTransaction }
  | { kind: 'session'; location: string; session: IssuedSession };

/** Result of completing the callback. */
export type CallbackResult =
  { ok: true; location: string; session: IssuedSession } | { ok: false; status: 400 | 401; error: string };
