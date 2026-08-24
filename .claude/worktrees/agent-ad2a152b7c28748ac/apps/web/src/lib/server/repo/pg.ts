/**
 * Postgres repository adapter (spec 012). Parameterized queries only (postgres.js tagged templates
 * are safe by construction). Ids are minted from the injected CSPRNG, never derived from user input.
 */
import type { Sql } from 'postgres';
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

interface UserRow {
  id: string;
  google_sub: string;
  email: string | null;
  name: string | null;
  avatar_url: string | null;
  created_at: Date;
}

function toUser(row: UserRow): User {
  return {
    id: row.id,
    googleSub: row.google_sub,
    email: row.email,
    name: row.name,
    avatarUrl: row.avatar_url,
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at)
  };
}

export function createPgUserRepo(sql: Sql, random: Random = systemRandom): UserRepo {
  return {
    async findByGoogleSub(googleSub) {
      const rows = await sql<UserRow[]>`
        SELECT id, google_sub, email, name, avatar_url, created_at
        FROM users WHERE google_sub = ${googleSub} LIMIT 1`;
      return rows[0] ? toUser(rows[0]) : null;
    },
    async findById(id) {
      const rows = await sql<UserRow[]>`
        SELECT id, google_sub, email, name, avatar_url, created_at
        FROM users WHERE id = ${id} LIMIT 1`;
      return rows[0] ? toUser(rows[0]) : null;
    },
    async listIds() {
      const rows = await sql<{ id: string }[]>`SELECT id FROM users`;
      return rows.map((r) => r.id);
    },
    async upsertFromIdentity(identity: Identity) {
      const id = random.token(16);
      const rows = await sql<UserRow[]>`
        INSERT INTO users (id, google_sub, email, name, avatar_url)
        VALUES (${id}, ${identity.googleSub}, ${identity.email}, ${identity.name}, ${identity.avatarUrl})
        ON CONFLICT (google_sub) DO UPDATE
          SET email = EXCLUDED.email, name = EXCLUDED.name, avatar_url = EXCLUDED.avatar_url
        RETURNING id, google_sub, email, name, avatar_url, created_at`;
      return toUser(rows[0]!);
    }
  };
}

export function createPgSessionRepo(sql: Sql, random: Random = systemRandom): SessionRepo {
  return {
    async create({ userId, expiresAt }) {
      const id = random.token(32);
      await sql`
        INSERT INTO sessions (id, user_id, expires_at)
        VALUES (${id}, ${userId}, ${expiresAt})`;
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
