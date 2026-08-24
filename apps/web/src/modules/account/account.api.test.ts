import { describe, expect, it } from 'vitest';
import { createTestContainer } from '$lib/server/container';
import {
  getAccountInfo,
  listOwnSessions,
  revokeOtherSessions,
  revokeOwnSession,
  setOwnPassword
} from './account.api';

describe('getAccountInfo', () => {
  it('never includes a password hash, and reports the right shape for each account kind', async () => {
    const container = createTestContainer();
    const googleOnly = await container.repo.users.createLocal({
      email: 'g@example.com',
      username: 'guser',
      passwordHash: null,
      isAdmin: false
    });
    await container.repo.users.linkGoogle(googleOnly.id, {
      googleSub: 'g-sub',
      email: 'g@example.com',
      name: 'G User',
      avatarUrl: 'https://img/g.png'
    });

    const info = await getAccountInfo(container, googleOnly.id);
    expect(info).not.toBeNull();
    expect(info).not.toHaveProperty('passwordHash');
    expect(info).toMatchObject({
      username: 'guser',
      hasPassword: false,
      hasGoogle: true,
      googleEmail: 'g@example.com',
      googleAvatarUrl: 'https://img/g.png'
    });
  });

  it('returns null for an unknown user', async () => {
    const container = createTestContainer();
    expect(await getAccountInfo(container, 'no-such-id')).toBeNull();
  });
});

describe('setOwnPassword', () => {
  it('sets an initial password with no current-password field, for a Google-only account', async () => {
    const container = createTestContainer();
    const user = await container.repo.users.createLocal({
      email: 'g@example.com',
      username: 'guser',
      passwordHash: null,
      isAdmin: false
    });

    const result = await setOwnPassword(container, user.id, {
      newPassword: 'a-strong-password',
      confirmPassword: 'a-strong-password'
    });
    expect(result).toEqual({ ok: true, status: 200 });
    expect((await container.repo.users.findById(user.id))?.hasPassword).toBe(true);
  });

  it('changes an existing password only with the correct current password', async () => {
    const container = createTestContainer();
    const currentHash = await container.passwordHasher.hash('old-password-1');
    const user = await container.repo.users.createLocal({
      email: 'p@example.com',
      username: 'puser',
      passwordHash: currentHash,
      isAdmin: false
    });

    const wrongCurrent = await setOwnPassword(container, user.id, {
      currentPassword: 'not-the-old-password',
      newPassword: 'a-new-password-1',
      confirmPassword: 'a-new-password-1'
    });
    expect(wrongCurrent).toEqual({ ok: false, status: 401, error: 'invalid_current_password' });

    const changed = await setOwnPassword(container, user.id, {
      currentPassword: 'old-password-1',
      newPassword: 'a-new-password-1',
      confirmPassword: 'a-new-password-1'
    });
    expect(changed).toEqual({ ok: true, status: 200 });
  });

  it('rejects a weak password or a mismatched confirm', async () => {
    const container = createTestContainer();
    const user = await container.repo.users.createLocal({
      email: 'g@example.com',
      username: 'guser',
      passwordHash: null,
      isAdmin: false
    });

    expect(
      await setOwnPassword(container, user.id, { newPassword: 'short', confirmPassword: 'short' })
    ).toEqual({ ok: false, status: 400, error: 'invalid_password' });

    expect(
      await setOwnPassword(container, user.id, {
        newPassword: 'a-strong-password',
        confirmPassword: 'different-password'
      })
    ).toEqual({ ok: false, status: 400, error: 'mismatch' });
  });
});

describe('sessions — strictly scoped to the caller (spec 094)', () => {
  async function twoUsersWithSessions() {
    const container = createTestContainer();
    const alice = await container.repo.users.createLocal({
      email: 'alice@example.com',
      username: 'alice',
      passwordHash: null,
      isAdmin: false
    });
    const bob = await container.repo.users.createLocal({
      email: 'bob@example.com',
      username: 'bob',
      passwordHash: null,
      isAdmin: false
    });
    const aliceCurrent = await container.repo.sessions.create({
      userId: alice.id,
      expiresAt: new Date('2030-01-01T00:00:00Z'),
      userAgent: 'alice-ua',
      ipAddress: '10.0.0.1'
    });
    const aliceOther = await container.repo.sessions.create({
      userId: alice.id,
      expiresAt: new Date('2030-01-01T00:00:00Z')
    });
    const bobSession = await container.repo.sessions.create({
      userId: bob.id,
      expiresAt: new Date('2030-01-01T00:00:00Z')
    });
    return { container, alice, bob, aliceCurrent, aliceOther, bobSession };
  }

  it('listOwnSessions never returns another user’s sessions, and marks the current one', async () => {
    const { container, alice, aliceCurrent, bobSession } = await twoUsersWithSessions();
    const list = await listOwnSessions(container, alice.id, aliceCurrent);
    expect(list.map((s) => s.id)).not.toContain(bobSession);
    expect(list.find((s) => s.id === aliceCurrent)?.isCurrent).toBe(true);
    expect(list.find((s) => s.id !== aliceCurrent)?.isCurrent).toBe(false);
  });

  it('revokeOwnSession 404s a session belonging to a different user, and never deletes it', async () => {
    const { container, alice, bob, bobSession } = await twoUsersWithSessions();
    const result = await revokeOwnSession(container, alice.id, bobSession, null);
    expect(result).toEqual({ ok: false, status: 404, error: 'not_found' });
    // Bob's session survived — alice's call never touched it.
    expect(await container.repo.sessions.find(bobSession)).not.toBeNull();
    void bob;
  });

  it('revokeOwnSession deletes the caller’s own row and reports wasCurrent correctly', async () => {
    const { container, alice, aliceCurrent, aliceOther } = await twoUsersWithSessions();

    const notCurrent = await revokeOwnSession(container, alice.id, aliceOther, aliceCurrent);
    expect(notCurrent).toEqual({ ok: true, status: 200, wasCurrent: false });
    expect(await container.repo.sessions.find(aliceOther)).toBeNull();

    const current = await revokeOwnSession(container, alice.id, aliceCurrent, aliceCurrent);
    expect(current).toEqual({ ok: true, status: 200, wasCurrent: true });
    expect(await container.repo.sessions.find(aliceCurrent)).toBeNull();
  });

  it('revokeOtherSessions deletes every one of the caller’s sessions except the current one, leaving the other user’s alone', async () => {
    const { container, alice, aliceCurrent, aliceOther, bobSession } = await twoUsersWithSessions();

    const result = await revokeOtherSessions(container, alice.id, aliceCurrent);
    expect(result).toEqual({ ok: true, status: 200, revoked: 1 });
    expect(await container.repo.sessions.find(aliceCurrent)).not.toBeNull();
    expect(await container.repo.sessions.find(aliceOther)).toBeNull();
    expect(await container.repo.sessions.find(bobSession)).not.toBeNull();
  });
});
