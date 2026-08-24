/**
 * Repository PORT (spec 012). Adapters implement these; the pg adapter talks to Postgres and the
 * in-memory fake backs tests. Handlers/services depend on the interfaces, never a concrete client.
 */

/** A provisioned user. `id` is our own opaque id — never the Google `sub`. */
export interface User {
  readonly id: string;
  readonly googleSub: string;
  readonly email: string | null;
  readonly name: string | null;
  readonly avatarUrl: string | null;
  readonly createdAt: string;
}

/** Identity captured from the OIDC provider on sign-in. Keyed by `googleSub` (the Google `sub`). */
export interface Identity {
  readonly googleSub: string;
  readonly email: string | null;
  readonly name: string | null;
  readonly avatarUrl: string | null;
}

export interface UserRepo {
  /** Look a user up by their stable Google `sub`. */
  findByGoogleSub(googleSub: string): Promise<User | null>;
  /**
   * Create the user on first sign-in for a `sub`, or refresh email/name/avatar on subsequent
   * sign-ins. Returns the persisted row (with our internal id).
   */
  upsertFromIdentity(identity: Identity): Promise<User>;
  /** Look a user up by our internal id. */
  findById(id: string): Promise<User | null>;
  /** All user ids (spec 015: the daily sync scheduler iterates these). */
  listIds(): Promise<string[]>;
}

/** A persisted, revocable session row. */
export interface SessionRow {
  readonly userId: string;
  readonly expiresAt: Date;
}

export interface SessionRepo {
  /** Persist a new session; the repository mints the opaque, high-entropy id and returns it. */
  create(input: { userId: string; expiresAt: Date }): Promise<string>;
  /** Read a session by id (no expiry check — the caller compares against its Clock). */
  find(id: string): Promise<SessionRow | null>;
  /** Delete a session row (idempotent). */
  delete(id: string): Promise<void>;
  /**
   * Delete every session that expired before `before`; returns how many rows went (spec 055).
   *
   * `resolve` already refuses an expired session, so this is not an access-control fix — it stops
   * the table growing without bound and shrinks the window in which a stolen-but-expired session id
   * is still sitting in a database backup.
   */
  deleteExpired(before: Date): Promise<number>;
}

/**
 * Per-user MCP token store (spec 012). Each user has exactly one active token that gates their
 * personal `/mcp?token=` URL. The token is an opaque, high-entropy secret minted from the CSPRNG.
 */
export interface McpTokenRepo {
  /** Return the user's current token, minting one on first call (idempotent get-or-create). */
  getOrCreate(userId: string): Promise<string>;
  /** Resolve a token to its owning user id, or null when unknown/rotated. */
  resolve(token: string): Promise<string | null>;
  /** Issue a fresh token for the user, invalidating the previous one. Returns the new token. */
  rotate(userId: string): Promise<string>;
}

/**
 * Per-user settings (spec 012). Minimal JSON bag keyed by user id — a placeholder so the schema and
 * port exist; richer typed settings are a follow-up.
 */
export type UserSettings = Record<string, unknown>;

export interface SettingsRepo {
  /** Read the user's settings (empty object when none stored). */
  get(userId: string): Promise<UserSettings>;
  /** Replace the user's settings bag. */
  set(userId: string, settings: UserSettings): Promise<void>;
}

/** The repository facade injected via the container. */
export interface Repo {
  readonly users: UserRepo;
  readonly sessions: SessionRepo;
  readonly mcpTokens: McpTokenRepo;
  readonly settings: SettingsRepo;
}
