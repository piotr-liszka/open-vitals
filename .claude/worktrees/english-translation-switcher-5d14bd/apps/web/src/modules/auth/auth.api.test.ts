import { describe, it, expect } from 'vitest';
import { beginLogin, completeCallback, logout } from './auth.api';
import { createTestContainer } from '$lib/server/container';
import { AuthExchangeError, type AuthProvider } from '$lib/server/auth/types';
import type { Identity } from '$lib/server/repo/types';

/** A stub OIDC-style provider so the callback flow is testable without Google. */
function stubOidc(opts: { identity?: Identity; fail?: boolean }): AuthProvider {
  return {
    kind: 'oidc',
    async authorizeUrl(input) {
      const u = new URL('https://accounts.google.com/o/oauth2/v2/auth');
      u.searchParams.set('state', input.state);
      u.searchParams.set('nonce', input.nonce);
      u.searchParams.set('code_challenge', input.codeChallenge);
      u.searchParams.set('code_challenge_method', 'S256');
      u.searchParams.set('redirect_uri', input.redirectUri);
      return u.toString();
    },
    async exchange() {
      if (opts.fail) throw new AuthExchangeError('id_token verification failed');
      return opts.identity ?? { googleSub: 'g-1', email: 'a@b.co', name: 'Ada', avatarUrl: null };
    }
  };
}

describe('mock auth flow (AUTH_ADAPTER=mock)', () => {
  it('beginLogin provisions the dev user + a resolvable session', async () => {
    const container = createTestContainer(); // mock auth + in-memory repo by default
    const result = await beginLogin(container, 'http://localhost:3000/auth/callback');

    expect(result.kind).toBe('session');
    if (result.kind !== 'session') throw new Error('expected session');

    const user = await container.session.resolve(result.session.id);
    expect(user?.googleSub).toBe('dev-user');
    expect(user?.email).toBe('dev@example.com');
    // The provisioned row exists in the repo.
    expect(await container.repo.users.findByGoogleSub('dev-user')).not.toBeNull();
  });
});

describe('oidc callback flow', () => {
  const redirectUri = 'http://localhost:3000/auth/callback';

  it('beginLogin returns a Google URL with state/nonce/PKCE and a transaction', async () => {
    const container = createTestContainer({ auth: stubOidc({}) });
    const result = await beginLogin(container, redirectUri);
    expect(result.kind).toBe('redirect');
    if (result.kind !== 'redirect') throw new Error('expected redirect');

    const url = new URL(result.location);
    expect(url.searchParams.get('state')).toBe(result.transaction.state);
    expect(url.searchParams.get('nonce')).toBe(result.transaction.nonce);
    expect(url.searchParams.get('code_challenge_method')).toBe('S256');
    expect(url.searchParams.get('code_challenge')).toBeTruthy();
    // The verifier is kept private (never in the URL).
    expect(result.location).not.toContain(result.transaction.codeVerifier);
  });

  it('completeCallback provisions a user + session on success', async () => {
    const container = createTestContainer({ auth: stubOidc({}) });
    const begin = await beginLogin(container, redirectUri);
    if (begin.kind !== 'redirect') throw new Error('expected redirect');

    const res = await completeCallback(container, {
      locale: 'pl',
      code: 'auth-code',
      state: begin.transaction.state,
      redirectUri,
      transaction: begin.transaction
    });
    expect(res.ok).toBe(true);
    if (!res.ok) throw new Error('expected ok');
    expect(await container.session.resolve(res.session.id)).toMatchObject({ googleSub: 'g-1' });
  });

  it('rejects a state mismatch with 400', async () => {
    const container = createTestContainer({ auth: stubOidc({}) });
    const begin = await beginLogin(container, redirectUri);
    if (begin.kind !== 'redirect') throw new Error('expected redirect');

    const res = await completeCallback(container, {
      locale: 'pl',
      code: 'auth-code',
      state: 'tampered',
      redirectUri,
      transaction: begin.transaction
    });
    expect(res).toMatchObject({ ok: false, status: 400 });
  });

  it('rejects a bad id_token with 401', async () => {
    const container = createTestContainer({ auth: stubOidc({ fail: true }) });
    const begin = await beginLogin(container, redirectUri);
    if (begin.kind !== 'redirect') throw new Error('expected redirect');

    const res = await completeCallback(container, {
      locale: 'pl',
      code: 'auth-code',
      state: begin.transaction.state,
      redirectUri,
      transaction: begin.transaction
    });
    expect(res).toMatchObject({ ok: false, status: 401 });
  });

  it('rejects a missing transaction with 400', async () => {
    const container = createTestContainer({ auth: stubOidc({}) });
    const res = await completeCallback(container, {
      locale: 'pl',
      code: 'auth-code',
      state: 'x',
      redirectUri,
      transaction: null
    });
    expect(res).toMatchObject({ ok: false, status: 400 });
  });
});

describe('logout', () => {
  it('destroys the session (idempotent)', async () => {
    const container = createTestContainer();
    const begin = await beginLogin(container, 'http://localhost:3000/auth/callback');
    if (begin.kind !== 'session') throw new Error('expected session');

    await logout(container, begin.session.id);
    expect(await container.session.resolve(begin.session.id)).toBeNull();
    // Idempotent: calling again (and with undefined) is safe.
    await logout(container, begin.session.id);
    await logout(container, undefined);
  });
});
