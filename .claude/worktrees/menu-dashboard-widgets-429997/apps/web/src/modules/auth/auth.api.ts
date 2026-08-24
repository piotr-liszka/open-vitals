/**
 * Pure auth handlers (spec 012). Routes stay thin: they translate these results into cookies +
 * redirects. No `fetch`/`env`/`Date.now()` here — everything comes from the injected container.
 * Never returns or logs id_tokens, the client secret, the code_verifier, or the session id.
 */
import type { AppContainer } from '$lib/server/container';
import { safeEqual } from '$lib/server/crypto';
import { codeChallengeS256 } from '$lib/server/auth/pkce';
import { AuthExchangeError } from '$lib/server/auth/types';
import type { BeginLoginResult, CallbackResult, OAuthTransaction } from './auth.types';

/** Short-lived httpOnly cookies carrying the OAuth transaction between /auth/login and /auth/callback. */
export const OAUTH_COOKIES = {
  state: 'gb_oauth_state',
  nonce: 'gb_oauth_nonce',
  verifier: 'gb_oauth_verifier'
} as const;

/** Lifetime of the OAuth transaction cookies (seconds). */
export const OAUTH_TX_MAX_AGE = 600;

/** Only ever redirect to internal paths (open-redirect guard). */
function safeLocation(): string {
  return '/';
}

/**
 * Start login. In `mock` mode we provision the fixed dev user and issue a session immediately (no
 * Google). In `oidc` mode we mint state/nonce/PKCE and return the provider URL + the transaction to
 * stash in short-lived cookies.
 */
export async function beginLogin(container: AppContainer, redirectUri: string): Promise<BeginLoginResult> {
  const { auth, random, session, repo } = container;

  if (auth.kind === 'mock') {
    const identity = await auth.exchange({ code: '', codeVerifier: '', redirectUri, expectedNonce: '' });
    const user = await repo.users.upsertFromIdentity(identity);
    const id = await session.issue(user.id);
    return {
      kind: 'session',
      location: safeLocation(),
      session: { id, cookieName: session.cookieName, maxAge: session.maxAgeSeconds }
    };
  }

  const state = random.token(24);
  const nonce = random.token(24);
  const codeVerifier = random.token(32);
  const location = await auth.authorizeUrl({
    state,
    nonce,
    codeChallenge: codeChallengeS256(codeVerifier),
    redirectUri
  });
  return { kind: 'redirect', location, transaction: { state, nonce, codeVerifier } };
}

/**
 * Complete the callback: validate state (constant-time), exchange + verify, provision the user, and
 * issue a session. Missing/expired transaction or state mismatch → 400; id_token/exchange failure → 401.
 */
export async function completeCallback(
  container: AppContainer,
  input: {
    code: string | null;
    state: string | null;
    redirectUri: string;
    transaction: OAuthTransaction | null;
  }
): Promise<CallbackResult> {
  const { auth, session, repo } = container;
  const { transaction } = input;

  if (!transaction || !transaction.state || !transaction.codeVerifier) {
    return { ok: false, status: 400, error: 'Sesja logowania wygasła. Spróbuj ponownie.' };
  }
  if (!input.code) {
    return { ok: false, status: 400, error: 'Brak kodu autoryzacji.' };
  }
  if (!input.state || !safeEqual(input.state, transaction.state)) {
    return { ok: false, status: 400, error: 'Nieprawidłowy stan logowania. Spróbuj ponownie.' };
  }

  let user;
  try {
    const identity = await auth.exchange({
      code: input.code,
      codeVerifier: transaction.codeVerifier,
      redirectUri: input.redirectUri,
      expectedNonce: transaction.nonce
    });
    user = await repo.users.upsertFromIdentity(identity);
  } catch (err) {
    if (err instanceof AuthExchangeError) {
      return { ok: false, status: 401, error: 'Nie udało się zweryfikować logowania Google.' };
    }
    throw err;
  }

  const id = await session.issue(user.id);
  return {
    ok: true,
    location: safeLocation(),
    session: { id, cookieName: session.cookieName, maxAge: session.maxAgeSeconds }
  };
}

/** Destroy a session (idempotent). Safe to call with an undefined id. */
export async function logout(container: AppContainer, sessionId: string | undefined | null): Promise<void> {
  if (sessionId) await container.session.destroy(sessionId);
}
