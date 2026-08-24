import { describe, expect, it } from 'vitest';
import { createTestContainer } from '$lib/server/container';
import { requireAdminApi } from '$modules/auth/require-admin';
import { createUser, deleteUser, listUsers, resetPassword, updateUser } from './admin-users.api';

async function adminContainer() {
  const container = createTestContainer();
  const admin = await container.repo.users.createLocal({
    email: 'admin@example.com',
    username: 'admin',
    passwordHash: null,
    isAdmin: true
  });
  return { container, admin };
}

describe('requireAdminApi (spec 094) — the one checkpoint every /api/admin/** endpoint shares', () => {
  it('403s a non-admin caller and passes an admin caller through', async () => {
    const { admin } = await adminContainer();
    expect(requireAdminApi(admin)).toBeNull();

    const nonAdmin = { ...admin, isAdmin: false };
    const rejected = requireAdminApi(nonAdmin);
    expect(rejected?.status).toBe(403);
    expect(await rejected?.json()).toEqual({ error: 'forbidden' });

    expect(requireAdminApi(null)?.status).toBe(403);
  });
});

describe('listUsers', () => {
  it('never includes a password hash, and lists every user', async () => {
    const { container } = await adminContainer();
    await container.repo.users.createLocal({
      email: 'has-pw@example.com',
      username: 'haspw',
      passwordHash: 'a-hash',
      isAdmin: false
    });
    const { users } = await listUsers(container);
    expect(users).toHaveLength(2);
    for (const u of users) expect(u).not.toHaveProperty('passwordHash');
    const withPassword = users.find((u) => u.username === 'haspw');
    expect(withPassword?.hasPassword).toBe(true);
    expect(withPassword?.hasGoogle).toBe(false);
  });
});

describe('createUser', () => {
  it('creates a Google-only account (no password) and one with a password + isAdmin', async () => {
    const { container } = await adminContainer();

    const googleOnly = await createUser(container, { email: 'g@example.com', username: 'guser' });
    expect(googleOnly).toMatchObject({ ok: true, status: 201 });
    if (!googleOnly.ok) throw new Error('expected ok');
    expect(googleOnly.user.hasPassword).toBe(false);

    const withPassword = await createUser(container, {
      email: 'p@example.com',
      username: 'puser',
      password: 'a-strong-password',
      isAdmin: true
    });
    expect(withPassword).toMatchObject({ ok: true, status: 201 });
    if (!withPassword.ok) throw new Error('expected ok');
    expect(withPassword.user.hasPassword).toBe(true);
    expect(withPassword.user.isAdmin).toBe(true);
  });

  it('rejects invalid input with 400 and field codes, writing nothing', async () => {
    const { container } = await adminContainer();
    const result = await createUser(container, { email: 'nope', username: 'ab' });
    expect(result).toMatchObject({ ok: false, status: 400, error: 'invalid' });
    expect(await container.repo.users.findByUsername('ab')).toBeNull();
  });

  it('rejects a duplicate email or username with 409, writing nothing', async () => {
    const { container } = await adminContainer();
    await createUser(container, { email: 'dup@example.com', username: 'dupuser' });

    const emailTaken = await createUser(container, { email: 'dup@example.com', username: 'other' });
    expect(emailTaken).toEqual({ ok: false, status: 409, error: 'email_taken' });

    const usernameTaken = await createUser(container, { email: 'other2@example.com', username: 'dupuser' });
    expect(usernameTaken).toEqual({ ok: false, status: 409, error: 'username_taken' });

    expect(await container.repo.users.listAll()).toHaveLength(2); // admin + the one successful create
  });
});

describe('updateUser', () => {
  it('changes username/email and toggles isAdmin', async () => {
    const { container } = await adminContainer();
    const target = await container.repo.users.createLocal({
      email: 'target@example.com',
      username: 'target',
      passwordHash: null,
      isAdmin: false
    });

    const result = await updateUser(container, target.id, {
      username: 'renamed',
      email: 'renamed@example.com',
      isAdmin: true
    });
    expect(result).toMatchObject({ ok: true, status: 200 });
    if (!result.ok) throw new Error('expected ok');
    expect(result.user.username).toBe('renamed');
    expect(result.user.email).toBe('renamed@example.com');
    expect(result.user.isAdmin).toBe(true);
  });

  it('404s an unknown user', async () => {
    const { container } = await adminContainer();
    expect(await updateUser(container, 'no-such-id', { username: 'x' })).toEqual({
      ok: false,
      status: 404,
      error: 'not_found'
    });
  });

  it('409s a duplicate email/username on update', async () => {
    const { container } = await adminContainer();
    const target = await container.repo.users.createLocal({
      email: 'target@example.com',
      username: 'target',
      passwordHash: null,
      isAdmin: false
    });
    await container.repo.users.createLocal({
      email: 'taken@example.com',
      username: 'takenname',
      passwordHash: null,
      isAdmin: false
    });

    expect(await updateUser(container, target.id, { email: 'taken@example.com' })).toEqual({
      ok: false,
      status: 409,
      error: 'email_taken'
    });
    expect(await updateUser(container, target.id, { username: 'takenname' })).toEqual({
      ok: false,
      status: 409,
      error: 'username_taken'
    });
  });

  it('409s demoting the sole admin, and succeeds once a second admin exists', async () => {
    const { container, admin } = await adminContainer();

    const soleAdminDemote = await updateUser(container, admin.id, { isAdmin: false });
    expect(soleAdminDemote).toEqual({ ok: false, status: 409, error: 'last_admin' });

    const secondAdmin = await container.repo.users.createLocal({
      email: 'second@example.com',
      username: 'second',
      passwordHash: null,
      isAdmin: true
    });
    void secondAdmin;

    const demoteWithAnotherAdmin = await updateUser(container, admin.id, { isAdmin: false });
    expect(demoteWithAnotherAdmin).toMatchObject({ ok: true, status: 200 });
  });
});

describe('resetPassword', () => {
  it('sets a new password for another user without needing their current one', async () => {
    const { container } = await adminContainer();
    const target = await container.repo.users.createLocal({
      email: 'target@example.com',
      username: 'target',
      passwordHash: null,
      isAdmin: false
    });

    const result = await resetPassword(container, target.id, 'a-brand-new-password');
    expect(result).toEqual({ ok: true, status: 200 });

    const credential = await container.repo.users.findCredentialByIdentifier('target');
    expect(credential?.passwordHash).not.toBeNull();
  });

  it('rejects a too-short password and 404s an unknown user', async () => {
    const { container } = await adminContainer();
    const target = await container.repo.users.createLocal({
      email: 'target@example.com',
      username: 'target',
      passwordHash: null,
      isAdmin: false
    });
    expect(await resetPassword(container, target.id, 'short')).toEqual({
      ok: false,
      status: 400,
      error: 'invalid_password'
    });
    expect(await resetPassword(container, 'no-such-id', 'a-valid-password')).toEqual({
      ok: false,
      status: 404,
      error: 'not_found'
    });
  });
});

describe('deleteUser', () => {
  it('deletes a non-admin user and cascades sessions', async () => {
    const { container } = await adminContainer();
    const target = await container.repo.users.createLocal({
      email: 'target@example.com',
      username: 'target',
      passwordHash: null,
      isAdmin: false
    });
    const sid = await container.repo.sessions.create({
      userId: target.id,
      expiresAt: new Date('2030-01-01T00:00:00Z')
    });

    expect(await deleteUser(container, target.id)).toEqual({ ok: true, status: 204 });
    expect(await container.repo.users.findById(target.id)).toBeNull();
    expect(await container.repo.sessions.find(sid)).toBeNull();
  });

  it('404s an unknown user', async () => {
    const { container } = await adminContainer();
    expect(await deleteUser(container, 'no-such-id')).toEqual({ ok: false, status: 404, error: 'not_found' });
  });

  it('409s deleting the sole admin, and succeeds once a second admin exists', async () => {
    const { container, admin } = await adminContainer();
    expect(await deleteUser(container, admin.id)).toEqual({ ok: false, status: 409, error: 'last_admin' });

    await container.repo.users.createLocal({
      email: 'second@example.com',
      username: 'second',
      passwordHash: null,
      isAdmin: true
    });
    expect(await deleteUser(container, admin.id)).toEqual({ ok: true, status: 204 });
  });
});
