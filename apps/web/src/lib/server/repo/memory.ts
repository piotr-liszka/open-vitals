/**
 * In-memory repository fakes for tests (AGENTS.md §7). Same contract as the pg adapter, no Postgres.
 * The container wires these in `createTestContainer` so tests NEVER touch a real database.
 */
import { systemRandom, type Random } from '../random';
import type {
  Identity,
  McpTokenRepo,
  Repo,
  SessionRepo,
  SessionRow,
  SessionSummary,
  SettingsRepo,
  User,
  UserCredential,
  UserRepo,
  UserSettings
} from './types';

export interface MemoryRepoDeps {
  /** Source for user ids + session ids (inject a deterministic one for stable assertions). */
  random?: Random;
  /** Wall clock for `created_at` (kept simple — tests rarely assert on it). */
  now?: () => Date;
  /**
   * The matching in-memory SessionRepo, so `deleteUser` can simulate the real schema's
   * `ON DELETE CASCADE` FK (spec 094) — the two fakes otherwise hold entirely separate maps.
   * `createMemoryRepo` wires this automatically; direct callers of `createMemoryUserRepo` that care
   * about the cascade (e.g. the repo contract test) pass it explicitly.
   */
  sessions?: Pick<SessionRepo, 'deleteOtherSessions'>;
}

/** Sanitize to the username charset (spec 094): lower-case, `[a-z0-9_-]` only. */
function sanitizeUsername(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '')
    .slice(0, 32);
}

/**
 * Derive a starter username from an identity for the mock adapter's dev-shortcut upsert (spec 094) —
 * the only caller left. Not a general uniqueness-safe generator: it is a fixed dev/test user, so a
 * collision here would be a fixture bug, not a real-world race.
 */
function usernameFromIdentity(identity: Identity, id: string): string {
  const local = identity.email?.split('@')[0] ?? '';
  const sanitized = sanitizeUsername(local);
  return sanitized.length >= 3 ? sanitized : sanitizeUsername(id) || id;
}

export function createMemoryUserRepo(deps: MemoryRepoDeps = {}): UserRepo {
  const random = deps.random ?? systemRandom;
  const now = deps.now ?? (() => new Date());
  const byId = new Map<string, User>();
  /** The password hash lives OUTSIDE `User` on purpose — it must never round-trip in that shape. */
  const passwordHashes = new Map<string, string | null>();

  const bySub = (): Map<string, User> => {
    const map = new Map<string, User>();
    for (const u of byId.values()) if (u.googleSub) map.set(u.googleSub, u);
    return map;
  };
  const findByEmailLower = (email: string): User | null => {
    for (const u of byId.values()) if (u.email === email) return u;
    return null;
  };
  const findByUsernameLower = (username: string): User | null => {
    for (const u of byId.values()) if (u.username === username) return u;
    return null;
  };

  return {
    async findByGoogleSub(googleSub) {
      return bySub().get(googleSub) ?? null;
    },
    async findById(id) {
      return byId.get(id) ?? null;
    },
    async listIds() {
      return [...byId.keys()];
    },
    async listAll() {
      return [...byId.values()];
    },
    async existsAdmin() {
      for (const u of byId.values()) if (u.isAdmin) return true;
      return false;
    },
    async countAdmins() {
      let n = 0;
      for (const u of byId.values()) if (u.isAdmin) n++;
      return n;
    },
    async findByEmail(email) {
      return findByEmailLower(email.toLowerCase()) ?? null;
    },
    async findByUsername(username) {
      return findByUsernameLower(username.toLowerCase()) ?? null;
    },
    async findCredentialByIdentifier(identifier) {
      const lower = identifier.toLowerCase();
      const user = findByUsernameLower(lower) ?? findByEmailLower(lower);
      if (!user) return null;
      const credential: UserCredential = { id: user.id, passwordHash: passwordHashes.get(user.id) ?? null };
      return credential;
    },
    async upsertFromIdentity(identity: Identity) {
      const existing = bySub().get(identity.googleSub);
      const id = existing?.id ?? random.token(16);
      const user: User = existing
        ? {
            ...existing,
            email: identity.email ?? existing.email,
            name: identity.name,
            avatarUrl: identity.avatarUrl
          }
        : {
            id,
            googleSub: identity.googleSub,
            email: identity.email ?? `${id}@unknown.local`,
            username: usernameFromIdentity(identity, id),
            isAdmin: false,
            hasPassword: false,
            name: identity.name,
            avatarUrl: identity.avatarUrl,
            createdAt: now().toISOString()
          };
      byId.set(user.id, user);
      if (!existing) passwordHashes.set(user.id, null);
      return user;
    },
    async createLocal(input) {
      const id = random.token(16);
      const email = input.email.toLowerCase();
      const username = input.username.toLowerCase();
      if (findByEmailLower(email)) throw new UniqueViolationError('email');
      if (findByUsernameLower(username)) throw new UniqueViolationError('username');
      const user: User = {
        id,
        googleSub: null,
        email,
        username,
        isAdmin: input.isAdmin,
        hasPassword: input.passwordHash !== null,
        name: null,
        avatarUrl: null,
        createdAt: now().toISOString()
      };
      byId.set(id, user);
      passwordHashes.set(id, input.passwordHash);
      return user;
    },
    async setPassword(userId, passwordHash) {
      const existing = byId.get(userId);
      if (!existing) throw new Error(`no such user: ${userId}`);
      const updated: User = { ...existing, hasPassword: passwordHash !== null };
      byId.set(userId, updated);
      passwordHashes.set(userId, passwordHash);
      return updated;
    },
    async setAdmin(userId, isAdmin) {
      const existing = byId.get(userId);
      if (!existing) throw new Error(`no such user: ${userId}`);
      const updated: User = { ...existing, isAdmin };
      byId.set(userId, updated);
      return updated;
    },
    async updateIdentity(userId, patch) {
      const existing = byId.get(userId);
      if (!existing) throw new Error(`no such user: ${userId}`);
      const nextUsername = patch.username?.toLowerCase();
      const nextEmail = patch.email?.toLowerCase();
      if (nextUsername && nextUsername !== existing.username && findByUsernameLower(nextUsername)) {
        throw new UniqueViolationError('username');
      }
      if (nextEmail && nextEmail !== existing.email && findByEmailLower(nextEmail)) {
        throw new UniqueViolationError('email');
      }
      const updated: User = {
        ...existing,
        username: nextUsername ?? existing.username,
        email: nextEmail ?? existing.email
      };
      byId.set(userId, updated);
      return updated;
    },
    async deleteUser(userId) {
      byId.delete(userId);
      passwordHashes.delete(userId);
      // Simulate the real schema's `sessions.user_id REFERENCES users ON DELETE CASCADE`: an id that
      // never matches a real session ("") keeps this a plain "delete every one of theirs".
      await deps.sessions?.deleteOtherSessions(userId, '');
    },
    async linkGoogle(userId, identity) {
      const existing = byId.get(userId);
      if (!existing) throw new Error(`no such user: ${userId}`);
      const updated: User = {
        ...existing,
        googleSub: existing.googleSub ?? identity.googleSub,
        email: identity.email ?? existing.email,
        name: identity.name,
        avatarUrl: identity.avatarUrl
      };
      byId.set(userId, updated);
      return updated;
    }
  };
}

/** Thrown by the in-memory repo to mirror Postgres's `23505` unique-violation (spec 094). */
export class UniqueViolationError extends Error {
  readonly field: 'email' | 'username';
  constructor(field: 'email' | 'username') {
    super(`unique violation: ${field}`);
    this.name = 'UniqueViolationError';
    this.field = field;
  }
}

export function createMemorySessionRepo(deps: MemoryRepoDeps = {}): SessionRepo {
  const random = deps.random ?? systemRandom;
  const now = deps.now ?? (() => new Date());
  interface Row extends SessionRow {
    readonly id: string;
    readonly createdAt: Date;
    readonly userAgent: string | null;
    readonly ipAddress: string | null;
  }
  const rows = new Map<string, Row>();

  return {
    async create({ userId, expiresAt, userAgent, ipAddress }) {
      const id = random.token(32);
      rows.set(id, {
        id,
        userId,
        expiresAt,
        createdAt: now(),
        userAgent: userAgent ?? null,
        ipAddress: ipAddress ?? null
      });
      return id;
    },
    async find(id) {
      const row = rows.get(id);
      return row ? { userId: row.userId, expiresAt: row.expiresAt } : null;
    },
    async delete(id) {
      rows.delete(id);
    },
    async deleteExpired(before: Date) {
      let removed = 0;
      for (const [id, row] of rows) {
        if (row.expiresAt.getTime() <= before.getTime()) {
          rows.delete(id);
          removed++;
        }
      }
      return removed;
    },
    async listByUser(userId) {
      const out: SessionSummary[] = [];
      for (const row of rows.values()) {
        if (row.userId !== userId) continue;
        out.push({
          id: row.id,
          createdAt: row.createdAt.toISOString(),
          expiresAt: row.expiresAt.toISOString(),
          userAgent: row.userAgent,
          ipAddress: row.ipAddress
        });
      }
      out.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      return out;
    },
    async deleteOtherSessions(userId, keepSessionId) {
      let removed = 0;
      for (const [id, row] of rows) {
        if (row.userId === userId && id !== keepSessionId) {
          rows.delete(id);
          removed++;
        }
      }
      return removed;
    }
  };
}

export function createMemoryMcpTokenRepo(deps: MemoryRepoDeps = {}): McpTokenRepo {
  const random = deps.random ?? systemRandom;
  const byUser = new Map<string, string>();
  const byToken = new Map<string, string>();

  const mint = (userId: string): string => {
    const previous = byUser.get(userId);
    if (previous) byToken.delete(previous);
    const token = random.token(32);
    byUser.set(userId, token);
    byToken.set(token, userId);
    return token;
  };

  return {
    async getOrCreate(userId) {
      return byUser.get(userId) ?? mint(userId);
    },
    async resolve(token) {
      return byToken.get(token) ?? null;
    },
    async rotate(userId) {
      return mint(userId);
    }
  };
}

export function createMemorySettingsRepo(): SettingsRepo {
  const byUser = new Map<string, UserSettings>();
  return {
    async get(userId) {
      return { ...(byUser.get(userId) ?? {}) };
    },
    async set(userId, settings) {
      byUser.set(userId, { ...settings });
    }
  };
}

/** Convenience: all fakes over a shared Random, with `deleteUser` cascading to sessions. */
export function createMemoryRepo(deps: MemoryRepoDeps = {}): Repo {
  const sessions = createMemorySessionRepo(deps);
  return {
    users: createMemoryUserRepo({ ...deps, sessions }),
    sessions,
    mcpTokens: createMemoryMcpTokenRepo(deps),
    settings: createMemorySettingsRepo()
  };
}
