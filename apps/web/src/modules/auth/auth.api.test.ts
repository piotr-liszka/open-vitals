import { describe, it, expect } from 'vitest';
import { beginLogin, completeCallback, loginWithPassword, logout } from './auth.api';
import { createTestContainer } from '$lib/server/container';
import { AuthExchangeError, type AuthProvider } from '$lib/server/auth/types';
import type { Identity } from '$lib/server/repo/types';
import { createFixedPasswordHasher } from '$lib/server/auth/password';

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
  it('beginLogin provisions the dev user, always admin, + a resolvable session', async () => {
    const container = createTestContainer(); // mock auth + in-memory repo by default
    const result = await beginLogin(container, 'http://localhost:3000/auth/callback');

    expect(result.kind).toBe('session');
    if (result.kind !== 'session') throw new Error('expected session');

    const user = await container.session.resolve(result.session.id);
    expect(user?.googleSub).toBe('dev-user');
    expect(user?.email).toBe('dev@example.com');
    // spec 094: the mock dev/test shortcut is always admin — never blocked by the onboarding gate.
    expect(user?.isAdmin).toBe(true);
    // The provisioned row exists in the repo.
    expect(await container.repo.users.findByGoogleSub('dev-user')).not.toBeNull();
  });

  it('beginLogin captures session provenance when given', async () => {
    const container = createTestContainer();
    const result = await beginLogin(container, 'http://localhost:3000/auth/callback', {
      userAgent: 'Mozilla/5.0 test',
      ipAddress: '203.0.113.9'
    });
    if (result.kind !== 'session') throw new Error('expected session');
    const user = await container.session.resolve(result.session.id);
    const sessions = await container.repo.sessions.listByUser(user!.id);
    expect(sessions[0]?.userAgent).toBe('Mozilla/5.0 test');
    expect(sessions[0]?.ipAddress).toBe('203.0.113.9');
  });
});

describe('oidc callback flow (spec 094: auto-link by email, no auto-create)', () => {
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

  it('signs in an existing PASSWORD account by email match and backfills its null google_sub', async () => {
    const container = createTestContainer({ auth: stubOidc({}) });
    await container.repo.users.createLocal({
      email: 'a@b.co',
      username: 'ada',
      passwordHash: 'existing-password-hash',
      isAdmin: false
    });

    const begin = await beginLogin(container, redirectUri);
    if (begin.kind !== 'redirect') throw new Error('expected redirect');

    const res = await completeCallback(container, {
      locale: 'pl',
      code: 'auth-code',
      state: begin.transaction.state,
      redirectUri,
      transaction: begin.transaction,
      userAgent: null,
      ipAddress: null
    });
    expect(res.ok).toBe(true);
    if (!res.ok) throw new Error('expected ok');
    const signedIn = await container.session.resolve(res.session.id);
    expect(signedIn).toMatchObject({ googleSub: 'g-1', email: 'a@b.co', username: 'ada' });
    // The account can now use EITHER method — linking never clears the existing password.
    expect(signedIn?.hasPassword).toBe(true);

    // No second row was created — the auto-link updated the existing one.
    expect(await container.repo.users.listAll()).toHaveLength(1);
  });

  it('refreshes name/avatar on every login, even once already linked', async () => {
    const container = createTestContainer({
      auth: stubOidc({
        identity: { googleSub: 'g-2', email: 'linked@b.co', name: 'New Name', avatarUrl: null }
      })
    });
    const created = await container.repo.users.createLocal({
      email: 'linked@b.co',
      username: 'linked',
      passwordHash: null,
      isAdmin: false
    });
    await container.repo.users.linkGoogle(created.id, {
      googleSub: 'g-2',
      email: 'linked@b.co',
      name: 'Old Name',
      avatarUrl: null
    });

    const begin = await beginLogin(container, redirectUri);
    if (begin.kind !== 'redirect') throw new Error('expected redirect');
    const res = await completeCallback(container, {
      locale: 'pl',
      code: 'auth-code',
      state: begin.transaction.state,
      redirectUri,
      transaction: begin.transaction,
      userAgent: null,
      ipAddress: null
    });
    expect(res.ok).toBe(true);
    if (!res.ok) throw new Error('expected ok');
    const signedIn = await container.session.resolve(res.session.id);
    expect(signedIn?.name).toBe('New Name');
    expect(signedIn?.googleSub).toBe('g-2'); // unchanged, still linked
  });

  it('rejects (and creates nothing) when no account matches the Google email, without logging the email/sub', async () => {
    const logged: Array<{ msg: string; meta: Record<string, unknown> | undefined }> = [];
    const logger = {
      debug: () => {},
      info: () => {},
      warn: (msg: string, meta?: Record<string, unknown>) => logged.push({ msg, meta }),
      error: () => {}
    };
    const container = createTestContainer({ auth: stubOidc({}), logger });

    const begin = await beginLogin(container, redirectUri);
    if (begin.kind !== 'redirect') throw new Error('expected redirect');
    const res = await completeCallback(container, {
      locale: 'pl',
      code: 'auth-code',
      state: begin.transaction.state,
      redirectUri,
      transaction: begin.transaction,
      userAgent: null,
      ipAddress: null
    });
    expect(res).toMatchObject({ ok: false, status: 401 });
    expect(await container.repo.users.listAll()).toHaveLength(0);

    expect(logged).toHaveLength(1);
    const line = JSON.stringify(logged[0]);
    expect(line).not.toContain('a@b.co');
    expect(line).not.toContain('g-1');
    expect(logged[0]?.meta).toBeUndefined();
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
      transaction: begin.transaction,
      userAgent: null,
      ipAddress: null
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
      transaction: begin.transaction,
      userAgent: null,
      ipAddress: null
    });
    expect(res).toMatchObject({ ok: false, status: 401 });
  });

  it('rejects a Google identity with no email as a verification failure', async () => {
    const container = createTestContainer({
      auth: stubOidc({ identity: { googleSub: 'g-3', email: null, name: null, avatarUrl: null } })
    });
    const begin = await beginLogin(container, redirectUri);
    if (begin.kind !== 'redirect') throw new Error('expected redirect');
    const res = await completeCallback(container, {
      locale: 'pl',
      code: 'auth-code',
      state: begin.transaction.state,
      redirectUri,
      transaction: begin.transaction,
      userAgent: null,
      ipAddress: null
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
      transaction: null,
      userAgent: null,
      ipAddress: null
    });
    expect(res).toMatchObject({ ok: false, status: 400 });
  });
});

describe('loginWithPassword (spec 094)', () => {
  async function containerWithUser() {
    const hasher = createFixedPasswordHasher();
    const container = createTestContainer({ passwordHasher: hasher });
    const passwordHash = await hasher.hash('correct-password-1');
    const user = await container.repo.users.createLocal({
      email: 'pw@example.com',
      username: 'pwuser',
      passwordHash,
      isAdmin: false
    });
    return { container, user };
  }

  it('signs in by username', async () => {
    const { container, user } = await containerWithUser();
    const res = await loginWithPassword(container, {
      identifier: 'pwuser',
      password: 'correct-password-1',
      userAgent: null,
      ipAddress: null,
      locale: 'pl'
    });
    expect(res.ok).toBe(true);
    if (!res.ok) throw new Error('expected ok');
    expect(await container.session.resolve(res.session.id)).toMatchObject({ id: user.id });
  });

  it('signs in by email', async () => {
    const { container } = await containerWithUser();
    const res = await loginWithPassword(container, {
      identifier: 'PW@Example.com',
      password: 'correct-password-1',
      userAgent: null,
      ipAddress: null,
      locale: 'pl'
    });
    expect(res.ok).toBe(true);
  });

  it('gives the identical 401 for wrong password, unknown identifier, and a Google-only account', async () => {
    const { container } = await containerWithUser();
    const googleOnly = await container.repo.users.createLocal({
      email: 'google-only@example.com',
      username: 'googleonly',
      passwordHash: null,
      isAdmin: false
    });
    expect(googleOnly.hasPassword).toBe(false);

    const wrongPassword = await loginWithPassword(container, {
      identifier: 'pwuser',
      password: 'not-the-password',
      userAgent: null,
      ipAddress: null,
      locale: 'pl'
    });
    const unknownIdentifier = await loginWithPassword(container, {
      identifier: 'no-such-user',
      password: 'whatever12',
      userAgent: null,
      ipAddress: null,
      locale: 'pl'
    });
    const googleOnlyLogin = await loginWithPassword(container, {
      identifier: 'googleonly',
      password: 'whatever12',
      userAgent: null,
      ipAddress: null,
      locale: 'pl'
    });

    expect(wrongPassword).toEqual(unknownIdentifier);
    expect(unknownIdentifier).toEqual(googleOnlyLogin);
    expect(wrongPassword).toMatchObject({ ok: false, status: 401 });
  });

  it('captures session provenance', async () => {
    const { container } = await containerWithUser();
    const res = await loginWithPassword(container, {
      identifier: 'pwuser',
      password: 'correct-password-1',
      userAgent: 'Mozilla/5.0 test',
      ipAddress: '203.0.113.9',
      locale: 'pl'
    });
    if (!res.ok) throw new Error('expected ok');
    const signedIn = await container.session.resolve(res.session.id);
    const sessions = await container.repo.sessions.listByUser(signedIn!.id);
    expect(sessions[0]?.userAgent).toBe('Mozilla/5.0 test');
    expect(sessions[0]?.ipAddress).toBe('203.0.113.9');
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
