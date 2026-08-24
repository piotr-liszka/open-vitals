import { describe, expect, it } from 'vitest';
import { createTestContainer } from '$lib/server/container';
import { createInitialAdmin } from './onboarding.api';

const valid = {
  email: 'admin@example.com',
  username: 'admin',
  password: 'a-strong-password',
  confirmPassword: 'a-strong-password'
};

describe('createInitialAdmin', () => {
  it('creates the first admin and issues a session', async () => {
    const container = createTestContainer();
    const result = await createInitialAdmin(container, valid);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('expected ok');

    const signedIn = await container.session.resolve(result.session.id);
    expect(signedIn).toMatchObject({ email: 'admin@example.com', username: 'admin', isAdmin: true });
    expect(await container.repo.users.existsAdmin()).toBe(true);
  });

  it('captures session provenance without ever needing to log it', async () => {
    const container = createTestContainer();
    const result = await createInitialAdmin(container, {
      ...valid,
      userAgent: 'Mozilla/5.0 test',
      ipAddress: '203.0.113.9'
    });
    if (!result.ok) throw new Error('expected ok');
    const signedIn = await container.session.resolve(result.session.id);
    const sessions = await container.repo.sessions.listByUser(signedIn!.id);
    expect(sessions[0]?.userAgent).toBe('Mozilla/5.0 test');
    expect(sessions[0]?.ipAddress).toBe('203.0.113.9');
  });

  it('rejects a second createInitialAdmin once one exists, and creates nothing', async () => {
    const container = createTestContainer();
    await createInitialAdmin(container, valid);

    const second = await createInitialAdmin(container, {
      email: 'someone-else@example.com',
      username: 'someoneelse',
      password: 'another-strong-password',
      confirmPassword: 'another-strong-password'
    });
    expect(second).toEqual({ ok: false, kind: 'already_onboarded' });
    expect(await container.repo.users.listAll()).toHaveLength(1);
  });

  it('rejects mismatched or weak passwords, writing nothing', async () => {
    const container = createTestContainer();
    const mismatched = await createInitialAdmin(container, { ...valid, confirmPassword: 'different' });
    expect(mismatched.ok).toBe(false);
    if (mismatched.ok) throw new Error('expected failure');
    expect(mismatched.kind).toBe('validation');

    const weak = await createInitialAdmin(container, {
      ...valid,
      password: 'short',
      confirmPassword: 'short'
    });
    expect(weak.ok).toBe(false);

    expect(await container.repo.users.existsAdmin()).toBe(false);
    expect(await container.repo.users.listAll()).toHaveLength(0);
  });

  it('rejects a duplicate email or username without writing anything', async () => {
    const container = createTestContainer();
    await container.repo.users.createLocal({
      email: 'taken@example.com',
      username: 'takenname',
      passwordHash: null,
      isAdmin: false
    });

    const emailTaken = await createInitialAdmin(container, { ...valid, email: 'taken@example.com' });
    expect(emailTaken.ok).toBe(false);
    if (emailTaken.ok) throw new Error('expected failure');
    if (emailTaken.kind !== 'validation') throw new Error('expected validation failure');
    expect(emailTaken.fields.email).toBeTruthy();

    const usernameTaken = await createInitialAdmin(container, { ...valid, username: 'takenname' });
    expect(usernameTaken.ok).toBe(false);

    // Still no admin — neither rejected submission created one.
    expect(await container.repo.users.existsAdmin()).toBe(false);
  });

  it('malformed email/username/password all fail as validation without writing anything', async () => {
    const container = createTestContainer();
    const result = await createInitialAdmin(container, {
      email: 'not-an-email',
      username: 'ab',
      password: 'short',
      confirmPassword: 'short'
    });
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected failure');
    if (result.kind !== 'validation') throw new Error('expected validation failure');
    expect(result.fields.email).toBeTruthy();
    expect(result.fields.username).toBeTruthy();
    expect(result.fields.password).toBeTruthy();
    expect(await container.repo.users.listAll()).toHaveLength(0);
  });
});
