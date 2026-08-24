/**
 * Pure auth handlers (spec 012, extended spec 094). Routes stay thin: they translate these results
 * into cookies + redirects. No `fetch`/`env`/`Date.now()` here — everything comes from the injected
 * container. Never returns or logs id_tokens, the client secret, the code_verifier, the session id,
 * or a password/hash.
 */
import type { AppContainer } from '$lib/server/container';
import { safeEqual } from '$lib/server/crypto';
import { codeChallengeS256 } from '$lib/server/auth/pkce';
import { AuthExchangeError } from '$lib/server/auth/types';
import type { BeginLoginResult, CallbackResult, OAuthTransaction, PasswordLoginResult } from './auth.types';
import { createTranslator, type Locale } from '$lib/i18n';

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
export async function beginLogin(
  container: AppContainer,
  redirectUri: string,
  meta?: { userAgent?: string | null; ipAddress?: string | null }
): Promise<BeginLoginResult> {
  const { auth, random, session, repo } = container;

  if (auth.kind === 'mock') {
    const identity = await auth.exchange({ code: '', codeVerifier: '', redirectUri, expectedNonce: '' });
    const user = await repo.users.upsertFromIdentity(identity);
    // Spec 094: the mock adapter's dev/test shortcut is a deliberate carve-out from the onboarding
    // gate — AUTH_ADAPTER=mock is already refused in production, so this never touches a real
    // deployment. Idempotent: setting `true` on an already-`true` row is a no-op.
    await repo.users.setAdmin(user.id, true);
    const id = await session.issue(user.id, meta);
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
 * Complete the callback: validate state (constant-time), exchange + verify, then AUTO-LINK by email
 * (spec 094) — sign in only if an account already exists for this email; never auto-create.
 *
 * Missing/expired transaction or state mismatch → 400; id_token/exchange failure, a Google identity
 * with no email, or no matching account → 401.
 */
export async function completeCallback(
  container: AppContainer,
  input: {
    code: string | null;
    state: string | null;
    redirectUri: string;
    transaction: OAuthTransaction | null;
    /** Language of the request these errors will be shown in (spec 076). */
    locale: Locale;
    /** Session provenance captured at the route layer (spec 094) — never logged. */
    userAgent: string | null;
    ipAddress: string | null;
  }
): Promise<CallbackResult> {
  const { auth, session, repo, logger } = container;
  const { transaction } = input;
  const t = createTranslator(input.locale);

  if (!transaction || !transaction.state || !transaction.codeVerifier) {
    return { ok: false, status: 400, error: t('auth.sessionExpired') };
  }
  if (!input.code) {
    return { ok: false, status: 400, error: t('auth.missingCode') };
  }
  if (!input.state || !safeEqual(input.state, transaction.state)) {
    return { ok: false, status: 400, error: t('auth.invalidState') };
  }

  let identity;
  try {
    identity = await auth.exchange({
      code: input.code,
      codeVerifier: transaction.codeVerifier,
      redirectUri: input.redirectUri,
      expectedNonce: transaction.nonce
    });
  } catch (err) {
    if (err instanceof AuthExchangeError) {
      return { ok: false, status: 401, error: t('auth.verificationFailed') };
    }
    throw err;
  }

  // A Google account that denied the `email` scope claim is treated as a verification failure — rare
  // (the OIDC scope has requested `email` since spec 012) and not worth a bespoke user-facing message.
  if (!identity.email) {
    return { ok: false, status: 401, error: t('auth.verificationFailed') };
  }

  let user = await repo.users.findByGoogleSub(identity.googleSub);
  if (!user) user = await repo.users.findByEmail(identity.email);

  if (!user) {
    // Reject without revealing whether any OTHER account exists — a standard enumeration-resistance
    // measure. No identity field is logged, deliberately, rather than relying on redaction alone.
    logger.warn('google sign-in rejected: no matching account');
    return { ok: false, status: 401, error: t('auth.noAccountForGoogleEmail') };
  }

  // Auto-link by email (backfills a null google_sub) AND refresh name/avatar/email on every login —
  // idempotent either way, so this runs whether the account was already linked or not.
  user = await repo.users.linkGoogle(user.id, identity);

  const id = await session.issue(user.id, { userAgent: input.userAgent, ipAddress: input.ipAddress });
  return {
    ok: true,
    location: safeLocation(),
    session: { id, cookieName: session.cookieName, maxAge: session.maxAgeSeconds }
  };
}

/**
 * Username/email + password login (spec 094). The SAME generic 401 covers every failure reason
 * (unknown identifier, no password set, wrong password) — never reveal which applies.
 */
export async function loginWithPassword(
  container: AppContainer,
  input: {
    identifier: string;
    password: string;
    userAgent: string | null;
    ipAddress: string | null;
    locale: Locale;
  }
): Promise<PasswordLoginResult> {
  const { repo, session, passwordHasher } = container;
  const t = createTranslator(input.locale);
  const invalid = { ok: false, status: 401, error: t('auth.invalidCredentials') } as const;

  if (!input.identifier || !input.password) return invalid;

  const credential = await repo.users.findCredentialByIdentifier(input.identifier);
  if (!credential || credential.passwordHash === null) return invalid;

  const verified = await passwordHasher.verify(input.password, credential.passwordHash);
  if (!verified) return invalid;

  const id = await session.issue(credential.id, {
    userAgent: input.userAgent,
    ipAddress: input.ipAddress
  });
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
