/**
 * Repository PORT (spec 012, extended spec 094). Adapters implement these; the pg adapter talks to
 * Postgres and the in-memory fake backs tests. Handlers/services depend on the interfaces, never a
 * concrete client.
 */

/**
 * A provisioned user. `id` is our own opaque id — never the Google `sub`.
 *
 * `passwordHash` is deliberately NOT part of this type (spec 094): it must never round-trip into a
 * JSON response by accident. Callers that need to verify a password use `UserCredential` instead.
 */
export interface User {
  readonly id: string;
  /** Google `sub`, or null for a password-only account that has never signed in with Google. */
  readonly googleSub: string | null;
  /** The Google auto-link key (spec 094) — required + unique, lower-cased before storage/lookup. */
  readonly email: string;
  /** The local sign-in handle (spec 094) — required + unique, separate from email, lower-cased. */
  readonly username: string;
  /** True once onboarding (or an admin) has granted this account admin rights (spec 094). */
  readonly isAdmin: boolean;
  /** Derived: whether a password is set. The hash itself never leaves the repo. */
  readonly hasPassword: boolean;
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

/** Narrow, security-sensitive projection used ONLY by password verification (spec 094). */
export interface UserCredential {
  readonly id: string;
  readonly passwordHash: string | null;
}

export interface UserRepo {
  /** Look a user up by their stable Google `sub`. */
  findByGoogleSub(googleSub: string): Promise<User | null>;
  /**
   * Create the user on first sign-in for a `sub`, or refresh email/name/avatar on subsequent
   * sign-ins. Returns the persisted row (with our internal id).
   *
   * Spec 094: the real Google OIDC path no longer calls this — it auto-links by email and never
   * creates a user (see `linkGoogle`). This stays in use ONLY by the `mock` auth adapter's dev/test
   * shortcut, which still auto-provisions its one fixed dev user.
   */
  upsertFromIdentity(identity: Identity): Promise<User>;
  /** Look a user up by our internal id. */
  findById(id: string): Promise<User | null>;
  /** All user ids (spec 015: the daily sync scheduler iterates these). */
  listIds(): Promise<string[]>;

  /** The onboarding gate's one query: does any admin exist yet? (spec 094) */
  existsAdmin(): Promise<boolean>;
  /** How many admins exist — the last-admin guard's one query (spec 094). */
  countAdmins(): Promise<number>;
  /** Look a user up by their (lower-cased) email. */
  findByEmail(email: string): Promise<User | null>;
  /** Look a user up by their (lower-cased) username. */
  findByUsername(username: string): Promise<User | null>;
  /** Look a user's password credential up by username OR email (case-insensitive). */
  findCredentialByIdentifier(identifier: string): Promise<UserCredential | null>;
  /** Every user (admin list). */
  listAll(): Promise<User[]>;

  /**
   * Onboarding + admin "create user". Caller pre-validates uniqueness; a DB unique-violation on a
   * race is still possible and must be caught by the handler.
   */
  createLocal(input: {
    email: string;
    username: string;
    passwordHash: string | null;
    isAdmin: boolean;
  }): Promise<User>;

  setPassword(userId: string, passwordHash: string | null): Promise<User>;
  setAdmin(userId: string, isAdmin: boolean): Promise<User>;
  updateIdentity(userId: string, patch: { username?: string; email?: string }): Promise<User>;
  /** Sessions cascade via the existing FK. */
  deleteUser(userId: string): Promise<void>;

  /** Auto-link-by-email on Google sign-in: backfills google_sub + refreshes name/avatar/email. */
  linkGoogle(userId: string, identity: Identity): Promise<User>;
}

/** A persisted, revocable session row. */
export interface SessionRow {
  readonly userId: string;
  readonly expiresAt: Date;
}

/** One row of a user's own "active sessions" list (spec 094). */
export interface SessionSummary {
  readonly id: string;
  readonly createdAt: string;
  readonly expiresAt: string;
  readonly userAgent: string | null;
  readonly ipAddress: string | null;
}

export interface SessionRepo {
  /** Persist a new session; the repository mints the opaque, high-entropy id and returns it. */
  create(input: {
    userId: string;
    expiresAt: Date;
    /** Raw request User-Agent at issue time (spec 094) — never logged, only stored. */
    userAgent?: string | null;
    /** Client address at issue time (spec 094) — never logged, only stored. */
    ipAddress?: string | null;
  }): Promise<string>;
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

  /** Every session belonging to one user, newest first (spec 094 — "My Account" active sessions). */
  listByUser(userId: string): Promise<SessionSummary[]>;
  /** Delete every one of a user's sessions except `keepSessionId`; returns how many rows went. */
  deleteOtherSessions(userId: string, keepSessionId: string): Promise<number>;
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
