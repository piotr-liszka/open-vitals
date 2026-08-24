/**
 * Postgres repository adapter (spec 012, extended spec 094). Parameterized queries only (postgres.js
 * tagged templates are safe by construction). Ids are minted from the injected CSPRNG, never derived
 * from user input.
 */
import type { Sql } from 'postgres';
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

/** Postgres unique_violation SQLSTATE (spec 094) — the race a pre-check cannot fully rule out. */
export const PG_UNIQUE_VIOLATION = '23505';

/** True when `err` is a Postgres unique-violation, optionally on a specific constraint. */
export function isUniqueViolation(err: unknown, constraint?: string): boolean {
  if (!err || typeof err !== 'object') return false;
  const e = err as { code?: string; constraint_name?: string; constraint?: string };
  if (e.code !== PG_UNIQUE_VIOLATION) return false;
  if (!constraint) return true;
  return e.constraint_name === constraint || e.constraint === constraint;
}

interface UserRow {
  id: string;
  google_sub: string | null;
  email: string;
  username: string;
  password_hash: string | null;
  is_admin: boolean;
  name: string | null;
  avatar_url: string | null;
  created_at: Date;
}

function toUser(row: UserRow): User {
  return {
    id: row.id,
    googleSub: row.google_sub,
    email: row.email,
    username: row.username,
    isAdmin: row.is_admin,
    hasPassword: row.password_hash !== null,
    name: row.name,
    avatarUrl: row.avatar_url,
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at)
  };
}

export function createPgUserRepo(sql: Sql, random: Random = systemRandom): UserRepo {
  return {
    async findByGoogleSub(googleSub) {
      const rows = await sql<UserRow[]>`
        SELECT id, google_sub, email, username, password_hash, is_admin, name, avatar_url, created_at
        FROM users WHERE google_sub = ${googleSub} LIMIT 1`;
      return rows[0] ? toUser(rows[0]) : null;
    },
    async findById(id) {
      const rows = await sql<UserRow[]>`
        SELECT id, google_sub, email, username, password_hash, is_admin, name, avatar_url, created_at
        FROM users WHERE id = ${id} LIMIT 1`;
      return rows[0] ? toUser(rows[0]) : null;
    },
    async listIds() {
      const rows = await sql<{ id: string }[]>`SELECT id FROM users`;
      return rows.map((r) => r.id);
    },
    async listAll() {
      const rows = await sql<UserRow[]>`
        SELECT id, google_sub, email, username, password_hash, is_admin, name, avatar_url, created_at
        FROM users ORDER BY created_at ASC`;
      return rows.map(toUser);
    },
    async existsAdmin() {
      const rows = await sql<{ exists: boolean }[]>`
        SELECT EXISTS(SELECT 1 FROM users WHERE is_admin = true) AS exists`;
      return rows[0]?.exists ?? false;
    },
    async countAdmins() {
      const rows = await sql<{ count: string }[]>`
        SELECT count(*)::text AS count FROM users WHERE is_admin = true`;
      return Number(rows[0]?.count ?? '0');
    },
    async findByEmail(email) {
      const rows = await sql<UserRow[]>`
        SELECT id, google_sub, email, username, password_hash, is_admin, name, avatar_url, created_at
        FROM users WHERE email = ${email.toLowerCase()} LIMIT 1`;
      return rows[0] ? toUser(rows[0]) : null;
    },
    async findByUsername(username) {
      const rows = await sql<UserRow[]>`
        SELECT id, google_sub, email, username, password_hash, is_admin, name, avatar_url, created_at
        FROM users WHERE username = ${username.toLowerCase()} LIMIT 1`;
      return rows[0] ? toUser(rows[0]) : null;
    },
    async findCredentialByIdentifier(identifier) {
      const lower = identifier.toLowerCase();
      const rows = await sql<{ id: string; password_hash: string | null }[]>`
        SELECT id, password_hash FROM users WHERE username = ${lower} OR email = ${lower} LIMIT 1`;
      const row = rows[0];
      if (!row) return null;
      const credential: UserCredential = { id: row.id, passwordHash: row.password_hash };
      return credential;
    },
    async upsertFromIdentity(identity: Identity) {
      const id = random.token(16);
      // Only the mock adapter's fixed dev user reaches this path (spec 094) — a plain, unvalidated
      // starter username derived from the email local part is fine for that one fixture.
      const fallbackUsername = (identity.email?.split('@')[0] ?? id)
        .toLowerCase()
        .replace(/[^a-z0-9_-]/g, '')
        .slice(0, 32);
      const username = fallbackUsername.length >= 3 ? fallbackUsername : id;
      const email = identity.email ?? `${id}@unknown.local`;
      const rows = await sql<UserRow[]>`
        INSERT INTO users (id, google_sub, email, username, name, avatar_url)
        VALUES (${id}, ${identity.googleSub}, ${email}, ${username}, ${identity.name}, ${identity.avatarUrl})
        ON CONFLICT (google_sub) DO UPDATE
          SET email = EXCLUDED.email, name = EXCLUDED.name, avatar_url = EXCLUDED.avatar_url
        RETURNING id, google_sub, email, username, password_hash, is_admin, name, avatar_url, created_at`;
      return toUser(rows[0]!);
    },
    async createLocal(input) {
      const id = random.token(16);
      const rows = await sql<UserRow[]>`
        INSERT INTO users (id, email, username, password_hash, is_admin)
        VALUES (
          ${id}, ${input.email.toLowerCase()}, ${input.username.toLowerCase()},
          ${input.passwordHash}, ${input.isAdmin}
        )
        RETURNING id, google_sub, email, username, password_hash, is_admin, name, avatar_url, created_at`;
      return toUser(rows[0]!);
    },
    async setPassword(userId, passwordHash) {
      const rows = await sql<UserRow[]>`
        UPDATE users SET password_hash = ${passwordHash} WHERE id = ${userId}
        RETURNING id, google_sub, email, username, password_hash, is_admin, name, avatar_url, created_at`;
      if (!rows[0]) throw new Error(`no such user: ${userId}`);
      return toUser(rows[0]);
    },
    async setAdmin(userId, isAdmin) {
      const rows = await sql<UserRow[]>`
        UPDATE users SET is_admin = ${isAdmin} WHERE id = ${userId}
        RETURNING id, google_sub, email, username, password_hash, is_admin, name, avatar_url, created_at`;
      if (!rows[0]) throw new Error(`no such user: ${userId}`);
      return toUser(rows[0]);
    },
    async updateIdentity(userId, patch) {
      const rows = await sql<UserRow[]>`
        UPDATE users SET
          username = COALESCE(${patch.username?.toLowerCase() ?? null}, username),
          email = COALESCE(${patch.email?.toLowerCase() ?? null}, email)
        WHERE id = ${userId}
        RETURNING id, google_sub, email, username, password_hash, is_admin, name, avatar_url, created_at`;
      if (!rows[0]) throw new Error(`no such user: ${userId}`);
      return toUser(rows[0]);
    },
    async deleteUser(userId) {
      await sql`DELETE FROM users WHERE id = ${userId}`;
    },
    async linkGoogle(userId, identity) {
      const rows = await sql<UserRow[]>`
        UPDATE users SET
          google_sub = COALESCE(google_sub, ${identity.googleSub}),
          email = COALESCE(${identity.email}, email),
          name = ${identity.name},
          avatar_url = ${identity.avatarUrl}
        WHERE id = ${userId}
        RETURNING id, google_sub, email, username, password_hash, is_admin, name, avatar_url, created_at`;
      if (!rows[0]) throw new Error(`no such user: ${userId}`);
      return toUser(rows[0]);
    }
  };
}

export function createPgSessionRepo(sql: Sql, random: Random = systemRandom): SessionRepo {
  return {
    async create({ userId, expiresAt, userAgent, ipAddress }) {
      const id = random.token(32);
      await sql`
        INSERT INTO sessions (id, user_id, expires_at, user_agent, ip_address)
        VALUES (${id}, ${userId}, ${expiresAt}, ${userAgent ?? null}, ${ipAddress ?? null})`;
      return id;
    },
    async find(id) {
      const rows = await sql<{ user_id: string; expires_at: Date }[]>`
        SELECT user_id, expires_at FROM sessions WHERE id = ${id} LIMIT 1`;
      const row = rows[0];
      if (!row) return null;
      const out: SessionRow = {
        userId: row.user_id,
        expiresAt: row.expires_at instanceof Date ? row.expires_at : new Date(row.expires_at)
      };
      return out;
    },
    async delete(id) {
      await sql`DELETE FROM sessions WHERE id = ${id}`;
    },
    async deleteExpired(before: Date) {
      const rows = await sql<{ id: string }[]>`
        DELETE FROM sessions WHERE expires_at <= ${before} RETURNING id`;
      return rows.length;
    },
    async listByUser(userId) {
      const rows = await sql<
        {
          id: string;
          created_at: Date;
          expires_at: Date;
          user_agent: string | null;
          ip_address: string | null;
        }[]
      >`
        SELECT id, created_at, expires_at, user_agent, ip_address
        FROM sessions WHERE user_id = ${userId} ORDER BY created_at DESC`;
      return rows.map((r): SessionSummary => ({
        id: r.id,
        createdAt: r.created_at instanceof Date ? r.created_at.toISOString() : String(r.created_at),
        expiresAt: r.expires_at instanceof Date ? r.expires_at.toISOString() : String(r.expires_at),
        userAgent: r.user_agent,
        ipAddress: r.ip_address
      }));
    },
    async deleteOtherSessions(userId, keepSessionId) {
      const rows = await sql<{ id: string }[]>`
        DELETE FROM sessions WHERE user_id = ${userId} AND id != ${keepSessionId} RETURNING id`;
      return rows.length;
    }
  };
}

export function createPgMcpTokenRepo(sql: Sql, random: Random = systemRandom): McpTokenRepo {
  return {
    async getOrCreate(userId: string) {
      // Atomic get-or-create: on conflict the no-op UPDATE returns the existing row's token.
      const token = random.token(32);
      const rows = await sql<{ token: string }[]>`
        INSERT INTO mcp_tokens (user_id, token)
        VALUES (${userId}, ${token})
        ON CONFLICT (user_id) DO UPDATE SET user_id = EXCLUDED.user_id
        RETURNING token`;
      return rows[0]!.token;
    },
    async resolve(token: string) {
      const rows = await sql<{ user_id: string }[]>`
        SELECT user_id FROM mcp_tokens WHERE token = ${token} LIMIT 1`;
      return rows[0]?.user_id ?? null;
    },
    async rotate(userId: string) {
      const token = random.token(32);
      const rows = await sql<{ token: string }[]>`
        INSERT INTO mcp_tokens (user_id, token)
        VALUES (${userId}, ${token})
        ON CONFLICT (user_id) DO UPDATE SET token = EXCLUDED.token, created_at = now()
        RETURNING token`;
      return rows[0]!.token;
    }
  };
}

export function createPgSettingsRepo(sql: Sql): SettingsRepo {
  return {
    async get(userId: string) {
      const rows = await sql<{ data: UserSettings }[]>`
        SELECT data FROM settings WHERE user_id = ${userId} LIMIT 1`;
      return rows[0]?.data ?? {};
    },
    async set(userId: string, settings: UserSettings) {
      await sql`
        INSERT INTO settings (user_id, data)
        VALUES (${userId}, ${sql.json(settings as Parameters<typeof sql.json>[0])})
        ON CONFLICT (user_id) DO UPDATE SET data = EXCLUDED.data, updated_at = now()`;
    }
  };
}

export function createPgRepo(sql: Sql, random: Random = systemRandom): Repo {
  return {
    users: createPgUserRepo(sql, random),
    sessions: createPgSessionRepo(sql, random),
    mcpTokens: createPgMcpTokenRepo(sql, random),
    settings: createPgSettingsRepo(sql)
  };
}
