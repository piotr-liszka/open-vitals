import { describe, it, expect } from 'vitest';
import { createSessionService } from './session';
import { createMemoryUserRepo, createMemorySessionRepo } from './repo/memory';
import { fixedClock } from './clock';
import { sequenceRandom } from './random';
import type { SessionRepo, UserRepo } from './repo/types';

function serviceAt(users: UserRepo, sessions: SessionRepo, now: Date, ttlSeconds = 3600) {
  return createSessionService({ users, sessions, ttlSeconds, clock: fixedClock(now) });
}

describe('session service', () => {
  it('issues a session that resolves to its user', async () => {
    const random = sequenceRandom('id');
    const users = createMemoryUserRepo({ random });
    const sessions = createMemorySessionRepo({ random });
    const svc = serviceAt(users, sessions, new Date('2026-08-02T12:00:00Z'));

    const user = await users.upsertFromIdentity({
      googleSub: 'sub-1',
      email: 'a@b.co',
      name: 'Ada',
      avatarUrl: null
    });
    const id = await svc.issue(user.id);
    const resolved = await svc.resolve(id);
    expect(resolved?.id).toBe(user.id);
    expect(resolved?.googleSub).toBe('sub-1');
  });

  it('resolves an expired session to null', async () => {
    const users = createMemoryUserRepo();
    const sessions = createMemorySessionRepo();
    const issuer = serviceAt(users, sessions, new Date('2026-08-02T12:00:00Z'), 60);
    const user = await users.upsertFromIdentity({
      googleSub: 'sub-1',
      email: null,
      name: null,
      avatarUrl: null
    });
    const id = await issuer.issue(user.id);

    // A later service (same repos) sees the row past its expiry.
    const later = serviceAt(users, sessions, new Date('2026-08-02T12:02:00Z'), 60);
    expect(await later.resolve(id)).toBeNull();
  });

  it('resolves unknown/undefined ids to null', async () => {
    const svc = serviceAt(
      createMemoryUserRepo(),
      createMemorySessionRepo(),
      new Date('2026-08-02T12:00:00Z')
    );
    expect(await svc.resolve(undefined)).toBeNull();
    expect(await svc.resolve('nope')).toBeNull();
  });

  it('destroy revokes a session immediately', async () => {
    const users = createMemoryUserRepo();
    const sessions = createMemorySessionRepo();
    const svc = serviceAt(users, sessions, new Date('2026-08-02T12:00:00Z'));
    const user = await users.upsertFromIdentity({
      googleSub: 'sub-2',
      email: null,
      name: null,
      avatarUrl: null
    });
    const id = await svc.issue(user.id);
    await svc.destroy(id);
    expect(await svc.resolve(id)).toBeNull();
  });

  describe('sweepExpired (spec 055)', () => {
    /** Two users, one session each, issued at `issuedAt` with the given TTLs. */
    async function twoSessions(issuedAt: Date, ttlSeconds: number) {
      const random = sequenceRandom('id');
      const users = createMemoryUserRepo({ random });
      const sessions = createMemorySessionRepo({ random });
      const svc = serviceAt(users, sessions, issuedAt, ttlSeconds);
      const ids: string[] = [];
      for (const sub of ['sweep-1', 'sweep-2']) {
        const user = await users.upsertFromIdentity({
          googleSub: sub,
          email: null,
          name: null,
          avatarUrl: null
        });
        ids.push(await svc.issue(user.id));
      }
      return { users, sessions, ids };
    }

    it('deletes sessions that are past their expiry and reports the count', async () => {
      const issuedAt = new Date('2026-08-02T12:00:00Z');
      const { users, sessions, ids } = await twoSessions(issuedAt, 60);

      // An hour later both have expired.
      const later = serviceAt(users, sessions, new Date('2026-08-02T13:00:00Z'));
      expect(await later.sweepExpired()).toBe(2);
      // Gone from the store, not merely refused on read.
      for (const id of ids) expect(await sessions.find(id)).toBeNull();
    });

    it('leaves live sessions alone', async () => {
      const issuedAt = new Date('2026-08-02T12:00:00Z');
      const { users, sessions, ids } = await twoSessions(issuedAt, 3600);

      const later = serviceAt(users, sessions, new Date('2026-08-02T12:10:00Z'));
      expect(await later.sweepExpired()).toBe(0);
      expect(await later.resolve(ids[0]!)).not.toBeNull();
    });

    it('is idempotent — a second sweep finds nothing left', async () => {
      const { users, sessions } = await twoSessions(new Date('2026-08-02T12:00:00Z'), 60);
      const later = serviceAt(users, sessions, new Date('2026-08-02T13:00:00Z'));
      expect(await later.sweepExpired()).toBe(2);
      expect(await later.sweepExpired()).toBe(0);
    });
  });
});
