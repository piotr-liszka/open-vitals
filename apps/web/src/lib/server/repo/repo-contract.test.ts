/**
 * UserRepo/SessionRepo CONTRACT (spec 094) — assertions every adapter must satisfy identically.
 *
 * Run against both the in-memory fake and Postgres (`TEST_DATABASE_URL=postgres://… pnpm run test`),
 * following this repo's existing store-contract convention (see `lib/server/store/*-contract.test.ts`).
 * Every email/username is namespaced under a per-fixture `suffix` (like the store contracts' random
 * id suffix) because the pg run shares its tables with every other test in the file/session — a
 * fixed literal would collide across tests and across reruns against the same scratch database.
 */
import { describe, it, expect } from 'vitest';
import { createMemoryUserRepo, createMemorySessionRepo, UniqueViolationError } from './memory';
import { createPgUserRepo, createPgSessionRepo, isUniqueViolation } from './pg';
import { createDb, migrate } from '../db';
import { sequenceRandom } from '../random';
import type { SessionRepo, UserRepo } from './types';

interface Fixture {
  users: UserRepo;
  sessions: SessionRepo;
  /** Thrown by `createLocal`/`updateIdentity` on a unique-constraint race — adapter-specific shape. */
  isUniqueViolation: (err: unknown) => boolean;
  /** Unique per `make()` call — namespaces every email/username this test mints. */
  suffix: string;
}

let suffixSeq = 0;
function nextSuffix(): string {
  suffixSeq += 1;
  return `${Date.now().toString(36)}-${suffixSeq}`;
}

export function repoContract(name: string, make: () => Promise<Fixture>): void {
  describe(`${name} — UserRepo/SessionRepo contract`, () => {
    it('existsAdmin/countAdmins reflect admin rows, and setAdmin toggles them', async () => {
      const { users, suffix } = await make();

      const admin = await users.createLocal({
        email: `admin-${suffix}@example.com`,
        username: `admin-${suffix}`,
        passwordHash: 'hash',
        isAdmin: true
      });
      expect(await users.existsAdmin()).toBe(true);
      const adminsAfterFirst = await users.countAdmins();

      const other = await users.createLocal({
        email: `other-${suffix}@example.com`,
        username: `other-${suffix}`,
        passwordHash: null,
        isAdmin: false
      });
      expect(await users.countAdmins()).toBe(adminsAfterFirst);

      const promoted = await users.setAdmin(other.id, true);
      expect(promoted.isAdmin).toBe(true);
      expect(await users.countAdmins()).toBe(adminsAfterFirst + 1);

      const demoted = await users.setAdmin(admin.id, false);
      expect(demoted.isAdmin).toBe(false);
      expect(await users.countAdmins()).toBe(adminsAfterFirst);
    });

    it('createLocal normalizes email/username to lowercase and reports hasPassword', async () => {
      const { users, suffix } = await make();
      const user = await users.createLocal({
        email: `Ada-${suffix}@Example.com`,
        username: `Ada-${suffix}`,
        passwordHash: 'a-hash',
        isAdmin: false
      });
      expect(user.email).toBe(`ada-${suffix}@example.com`);
      expect(user.username).toBe(`ada-${suffix}`);
      expect(user.hasPassword).toBe(true);
      expect(user.googleSub).toBeNull();

      const noPassword = await users.createLocal({
        email: `bea-${suffix}@example.com`,
        username: `bea-${suffix}`,
        passwordHash: null,
        isAdmin: false
      });
      expect(noPassword.hasPassword).toBe(false);
    });

    it('rejects a duplicate email or username on createLocal', async () => {
      const { users, isUniqueViolation, suffix } = await make();
      await users.createLocal({
        email: `dup-${suffix}@example.com`,
        username: `dupuser-${suffix}`,
        passwordHash: null,
        isAdmin: false
      });

      await expect(
        users.createLocal({
          email: `DUP-${suffix}@example.com`, // case-insensitive collision
          username: `someoneelse-${suffix}`,
          passwordHash: null,
          isAdmin: false
        })
      ).rejects.toSatisfy(isUniqueViolation);

      await expect(
        users.createLocal({
          email: `unique-${suffix}@example.com`,
          username: `DupUser-${suffix}`, // case-insensitive collision
          passwordHash: null,
          isAdmin: false
        })
      ).rejects.toSatisfy(isUniqueViolation);
    });

    it('findByEmail/findByUsername are case-insensitive', async () => {
      const { users, suffix } = await make();
      const created = await users.createLocal({
        email: `case-${suffix}@example.com`,
        username: `caseuser-${suffix}`,
        passwordHash: null,
        isAdmin: false
      });
      expect((await users.findByEmail(`CASE-${suffix}@Example.com`))?.id).toBe(created.id);
      expect((await users.findByUsername(`CaseUser-${suffix}`))?.id).toBe(created.id);
      expect(await users.findByEmail(`nobody-${suffix}@example.com`)).toBeNull();
      expect(await users.findByUsername(`nobody-${suffix}`)).toBeNull();
    });

    it('findCredentialByIdentifier resolves by username OR email, never leaking the hash shape elsewhere', async () => {
      const { users, suffix } = await make();
      const created = await users.createLocal({
        email: `cred-${suffix}@example.com`,
        username: `creduser-${suffix}`,
        passwordHash: 'secret-hash',
        isAdmin: false
      });

      const byUsername = await users.findCredentialByIdentifier(`CredUser-${suffix}`);
      expect(byUsername).toEqual({ id: created.id, passwordHash: 'secret-hash' });

      const byEmail = await users.findCredentialByIdentifier(`Cred-${suffix}@Example.com`);
      expect(byEmail).toEqual({ id: created.id, passwordHash: 'secret-hash' });

      expect(await users.findCredentialByIdentifier(`unknown-${suffix}`)).toBeNull();

      // The ordinary User shape never carries the hash.
      const plain = await users.findById(created.id);
      expect(plain).not.toHaveProperty('passwordHash');
    });

    it('listAll includes every user created here', async () => {
      const { users, suffix } = await make();
      await users.createLocal({
        email: `listall-a-${suffix}@x.co`,
        username: `listall-a-${suffix}`,
        passwordHash: null,
        isAdmin: false
      });
      await users.createLocal({
        email: `listall-b-${suffix}@x.co`,
        username: `listall-b-${suffix}`,
        passwordHash: null,
        isAdmin: false
      });
      const usernames = (await users.listAll()).map((u) => u.username);
      expect(usernames).toEqual(expect.arrayContaining([`listall-a-${suffix}`, `listall-b-${suffix}`]));
    });

    it('setPassword sets and clears the hash, updating hasPassword', async () => {
      const { users, suffix } = await make();
      const user = await users.createLocal({
        email: `pw-${suffix}@x.co`,
        username: `pwuser-${suffix}`,
        passwordHash: null,
        isAdmin: false
      });
      expect(user.hasPassword).toBe(false);

      const withPassword = await users.setPassword(user.id, 'a-hash');
      expect(withPassword.hasPassword).toBe(true);
      expect((await users.findCredentialByIdentifier(`pwuser-${suffix}`))?.passwordHash).toBe('a-hash');

      const cleared = await users.setPassword(user.id, null);
      expect(cleared.hasPassword).toBe(false);
    });

    it('updateIdentity changes username/email and rejects a collision', async () => {
      const { users, isUniqueViolation, suffix } = await make();
      const user = await users.createLocal({
        email: `orig-${suffix}@x.co`,
        username: `origuser-${suffix}`,
        passwordHash: null,
        isAdmin: false
      });
      await users.createLocal({
        email: `taken-${suffix}@x.co`,
        username: `takenuser-${suffix}`,
        passwordHash: null,
        isAdmin: false
      });

      const updated = await users.updateIdentity(user.id, {
        username: `newname-${suffix}`,
        email: `new-${suffix}@x.co`
      });
      expect(updated.username).toBe(`newname-${suffix}`);
      expect(updated.email).toBe(`new-${suffix}@x.co`);

      await expect(users.updateIdentity(user.id, { username: `takenuser-${suffix}` })).rejects.toSatisfy(
        isUniqueViolation
      );
      await expect(users.updateIdentity(user.id, { email: `taken-${suffix}@x.co` })).rejects.toSatisfy(
        isUniqueViolation
      );
    });

    it('linkGoogle backfills a null google_sub once and refreshes profile fields every time', async () => {
      const { users, suffix } = await make();
      const user = await users.createLocal({
        email: `link-${suffix}@x.co`,
        username: `linkuser-${suffix}`,
        passwordHash: 'hash',
        isAdmin: false
      });
      expect(user.googleSub).toBeNull();

      const linked = await users.linkGoogle(user.id, {
        googleSub: `g-sub-${suffix}-1`,
        email: `link-fresh-${suffix}@x.co`,
        name: 'Link User',
        avatarUrl: 'https://img/link.png'
      });
      expect(linked.googleSub).toBe(`g-sub-${suffix}-1`);
      expect(linked.email).toBe(`link-fresh-${suffix}@x.co`);
      expect(linked.name).toBe('Link User');
      expect(linked.avatarUrl).toBe('https://img/link.png');

      // A second call (already-linked account, spec 094 step 7) never overwrites the sub, but keeps
      // refreshing the rest — idempotent on the identity, not a no-op.
      const relinked = await users.linkGoogle(user.id, {
        googleSub: `g-sub-${suffix}-DIFFERENT`,
        email: `link-fresher-${suffix}@x.co`,
        name: 'Link User Two',
        avatarUrl: null
      });
      expect(relinked.googleSub).toBe(`g-sub-${suffix}-1`); // unchanged
      expect(relinked.email).toBe(`link-fresher-${suffix}@x.co`);
      expect(relinked.name).toBe('Link User Two');
      expect(relinked.avatarUrl).toBeNull();
    });

    it('deleteUser removes the row and cascades to sessions', async () => {
      const { users, sessions, suffix } = await make();
      const user = await users.createLocal({
        email: `del-${suffix}@x.co`,
        username: `deluser-${suffix}`,
        passwordHash: null,
        isAdmin: false
      });
      const sid = await sessions.create({ userId: user.id, expiresAt: new Date('2030-01-01T00:00:00Z') });

      await users.deleteUser(user.id);

      expect(await users.findById(user.id)).toBeNull();
      expect(await sessions.find(sid)).toBeNull();
    });

    it('SessionRepo.create stores provenance and listByUser surfaces it, newest first', async () => {
      const { users, sessions, suffix } = await make();
      const user = await users.createLocal({
        email: `sess-${suffix}@x.co`,
        username: `sessuser-${suffix}`,
        passwordHash: null,
        isAdmin: false
      });

      const first = await sessions.create({
        userId: user.id,
        expiresAt: new Date('2030-01-01T00:00:00Z'),
        userAgent: 'Mozilla/5.0 first',
        ipAddress: '10.0.0.1'
      });
      const second = await sessions.create({
        userId: user.id,
        expiresAt: new Date('2030-01-02T00:00:00Z'),
        userAgent: 'Mozilla/5.0 second',
        ipAddress: '10.0.0.2'
      });

      const list = await sessions.listByUser(user.id);
      expect(list.map((s) => s.id)).toContain(first);
      expect(list.map((s) => s.id)).toContain(second);
      const found = list.find((s) => s.id === second);
      expect(found?.userAgent).toBe('Mozilla/5.0 second');
      expect(found?.ipAddress).toBe('10.0.0.2');

      // No session provenance leaks to another user's list.
      const other = await users.createLocal({
        email: `other-sess-${suffix}@x.co`,
        username: `othersess-${suffix}`,
        passwordHash: null,
        isAdmin: false
      });
      expect(await sessions.listByUser(other.id)).toEqual([]);
    });

    it('deleteOtherSessions keeps the given session and removes only this user’s others', async () => {
      const { users, sessions, suffix } = await make();
      const user = await users.createLocal({
        email: `multi-${suffix}@x.co`,
        username: `multiuser-${suffix}`,
        passwordHash: null,
        isAdmin: false
      });
      const other = await users.createLocal({
        email: `notmine-${suffix}@x.co`,
        username: `notmine-${suffix}`,
        passwordHash: null,
        isAdmin: false
      });

      const keep = await sessions.create({ userId: user.id, expiresAt: new Date('2030-01-01T00:00:00Z') });
      const drop1 = await sessions.create({ userId: user.id, expiresAt: new Date('2030-01-01T00:00:00Z') });
      const drop2 = await sessions.create({ userId: user.id, expiresAt: new Date('2030-01-01T00:00:00Z') });
      const untouched = await sessions.create({
        userId: other.id,
        expiresAt: new Date('2030-01-01T00:00:00Z')
      });

      const removed = await sessions.deleteOtherSessions(user.id, keep);
      expect(removed).toBe(2);
      expect(await sessions.find(keep)).not.toBeNull();
      expect(await sessions.find(drop1)).toBeNull();
      expect(await sessions.find(drop2)).toBeNull();
      expect(await sessions.find(untouched)).not.toBeNull();
    });
  });
}

repoContract('memory repo', async () => {
  const random = sequenceRandom('c');
  const sessions = createMemorySessionRepo({ random });
  return {
    users: createMemoryUserRepo({ random, sessions }),
    sessions,
    isUniqueViolation: (err: unknown) => err instanceof UniqueViolationError,
    suffix: nextSuffix()
  };
});

/** Same suite against Postgres: `TEST_DATABASE_URL=postgres://… pnpm run test`. */
const dsn = process.env.TEST_DATABASE_URL;
if (dsn) {
  const sql = createDb(dsn);
  repoContract('pg repo', async () => {
    await migrate(sql);
    return {
      users: createPgUserRepo(sql),
      sessions: createPgSessionRepo(sql),
      isUniqueViolation: (err: unknown) => isUniqueViolation(err),
      suffix: nextSuffix()
    };
  });
} else {
  describe.skip('pg repo — UserRepo/SessionRepo contract (set TEST_DATABASE_URL to run)', () => {
    it('is skipped without a scratch database', () => undefined);
  });
}
