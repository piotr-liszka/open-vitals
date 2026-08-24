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
  SettingsRepo,
  User,
  UserRepo,
  UserSettings
} from './types';

export interface MemoryRepoDeps {
  /** Source for user ids + session ids (inject a deterministic one for stable assertions). */
  random?: Random;
  /** Wall clock for `created_at` (kept simple — tests rarely assert on it). */
  now?: () => Date;
}

export function createMemoryUserRepo(deps: MemoryRepoDeps = {}): UserRepo {
  const random = deps.random ?? systemRandom;
  const now = deps.now ?? (() => new Date());
  const bySub = new Map<string, User>();
  const byId = new Map<string, User>();

  return {
    async findByGoogleSub(googleSub) {
      return bySub.get(googleSub) ?? null;
    },
    async findById(id) {
      return byId.get(id) ?? null;
    },
    async listIds() {
      return [...byId.keys()];
    },
    async upsertFromIdentity(identity: Identity) {
      const existing = bySub.get(identity.googleSub);
      const user: User = existing
        ? { ...existing, email: identity.email, name: identity.name, avatarUrl: identity.avatarUrl }
        : {
            id: random.token(16),
            googleSub: identity.googleSub,
            email: identity.email,
            name: identity.name,
            avatarUrl: identity.avatarUrl,
            createdAt: now().toISOString()
          };
      bySub.set(user.googleSub, user);
      byId.set(user.id, user);
      return user;
    }
  };
}

export function createMemorySessionRepo(deps: MemoryRepoDeps = {}): SessionRepo {
  const random = deps.random ?? systemRandom;
  const rows = new Map<string, SessionRow>();

  return {
    async create({ userId, expiresAt }) {
      const id = random.token(32);
      rows.set(id, { userId, expiresAt });
      return id;
    },
    async find(id) {
      return rows.get(id) ?? null;
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

/** Convenience: all fakes over a shared Random. */
export function createMemoryRepo(deps: MemoryRepoDeps = {}): Repo {
  return {
    users: createMemoryUserRepo(deps),
    sessions: createMemorySessionRepo(deps),
    mcpTokens: createMemoryMcpTokenRepo(deps),
    settings: createMemorySettingsRepo()
  };
}
