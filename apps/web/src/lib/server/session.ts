/**
 * DB-backed session service (spec 012). Session ids are opaque and high-entropy (minted by the
 * SessionRepo); expiry is enforced against the injected Clock, so no JWT secret is involved.
 * `resolve` joins the session + user repos to hand handlers the full User.
 */
import type { Clock } from './clock';
import type { SessionService } from './interfaces';
import type { SessionRepo, User, UserRepo } from './repo/types';

export interface SessionDeps {
  users: UserRepo;
  sessions: SessionRepo;
  ttlSeconds: number;
  clock: Clock;
  cookieName?: string;
}

export function createSessionService(deps: SessionDeps): SessionService {
  const cookieName = deps.cookieName ?? 'gb_session';

  return {
    cookieName,
    maxAgeSeconds: deps.ttlSeconds,

    async issue(
      userId: string,
      meta?: { userAgent?: string | null; ipAddress?: string | null }
    ): Promise<string> {
      const expiresAt = new Date(deps.clock.now().getTime() + deps.ttlSeconds * 1000);
      return deps.sessions.create({
        userId,
        expiresAt,
        userAgent: meta?.userAgent ?? null,
        ipAddress: meta?.ipAddress ?? null
      });
    },

    async resolve(sessionId): Promise<User | null> {
      if (!sessionId) return null;
      const row = await deps.sessions.find(sessionId);
      if (!row) return null;
      // Expired sessions resolve to null (the row may be swept later).
      if (row.expiresAt.getTime() <= deps.clock.now().getTime()) return null;
      return deps.users.findById(row.userId);
    },

    async destroy(sessionId: string): Promise<void> {
      await deps.sessions.delete(sessionId);
    },

    async sweepExpired(): Promise<number> {
      return deps.sessions.deleteExpired(deps.clock.now());
    }
  };
}
