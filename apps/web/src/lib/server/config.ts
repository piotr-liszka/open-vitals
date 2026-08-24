/**
 * Typed application config. This is the ONLY module that reads process.env.
 * Everything else receives a Config via the container (AGENTS.md §2 rule 3).
 */
import { z } from 'zod';
import { DEFAULT_TIME_ZONE } from '$lib/date';

/** True when the runtime's ICU knows this IANA zone (guards a typo'd APP_TIMEZONE at boot). */
function isKnownTimeZone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat('en-CA', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

const schema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  /** Public origin (host:port) shown in the MCP URL card, e.g. http://192.168.1.10:3000 */
  PUBLIC_BASE_URL: z.string().url(),
  /** Internal URL of the Python Garmin sidecar (never LAN-exposed). */
  GARMIN_SIDECAR_URL: z.string().url().default('http://garmin:8081'),
  /**
   * Shared secret sent to the sidecar as `X-Internal-Key` on every call (spec 055). The sidecar
   * trusts `X-User-Id` to name a user, so reaching its port used to be enough to read anyone's
   * Garmin data; this makes network reachability insufficient on its own.
   *
   * Empty means "not configured": the header is omitted and the sidecar (which also treats it as
   * optional) stays open. That is deliberately NOT a hard boot failure — an in-place upgrade lands
   * on exactly that state, and refusing to start would take a running deployment down before its
   * `.env` could be edited. The container logs a warning in production instead; the guardrail is
   * live only once BOTH services have the same value set.
   */
  GARMIN_INTERNAL_KEY: z.string().default(''),
  /**
   * Which Garmin adapter to wire. `http` (default) talks to the real sidecar.
   * `mock` serves in-memory fixtures — DEV ONLY, for UI work without Garmin credentials.
   * A mock adapter in production is refused in loadConfig().
   */
  GARMIN_ADAPTER: z.enum(['http', 'mock']).default('http'),
  /** Session lifetime in seconds. */
  SESSION_TTL_SECONDS: z.coerce
    .number()
    .int()
    .positive()
    .default(60 * 60 * 12),

  /* ---- Dates (spec 018) ---- */
  /**
   * IANA timezone the app resolves "today" and renders timestamps in. App-scoped, not per-user:
   * this is a self-hosted single-household deployment and Garmin already reports days in the
   * wearer's local zone, so one configured zone is both correct and cheap. Default Europe/Warsaw.
   */
  APP_TIMEZONE: z.string().min(1).default(DEFAULT_TIME_ZONE),

  /* ---- Background sync (spec 027) ---- */
  /**
   * How often the background scheduler checks each user for new Garmin data, in minutes. A tick is
   * cheap because it fast-returns on an unchanged probe (spec 027), so the default is 30 minutes
   * rather than the nightly run this replaced. Floored at 5 so a typo cannot hammer Garmin.
   */
  SYNC_INTERVAL_MINUTES: z.coerce
    .number()
    .int()
    .min(5)
    .max(24 * 60)
    .default(30),

  /* ---- Update check (spec 068) ---- */
  /** `owner/name` of the repo Settings checks for newer commits. */
  UPDATE_CHECK_REPO: z.string().default('piotr-liszka/garmin-bridge'),
  /** Branch production tracks. */
  UPDATE_CHECK_BRANCH: z.string().min(1).default('main'),
  /**
   * GitHub token with read access to that repo. Optional: without it the Settings card reports
   * "not configured" instead of failing, so the app runs exactly as before until someone opts in.
   * A fine-grained token with read-only Contents on this one repo is enough.
   */
  GITHUB_TOKEN: z.string().default(''),

  /* ---- Datastore (spec 012) ---- */
  /** Postgres connection string (postgres://user:pass@host:port/db). */
  DATABASE_URL: z.string().url(),

  /* ---- Google OIDC (spec 012) ---- */
  /**
   * Which auth adapter to wire. `oidc` (default) is real Google Sign-In.
   * `mock` signs in a fixed dev user with NO network — refused in production.
   */
  AUTH_ADAPTER: z.enum(['oidc', 'mock']).default('oidc'),
  /** Google OAuth client id. Optional so dev/tests run without it (required for the oidc adapter). */
  GOOGLE_CLIENT_ID: z.string().default(''),
  /** Google OAuth client secret. Optional so dev/tests run without it (required for the oidc adapter). */
  GOOGLE_CLIENT_SECRET: z.string().default('')
});

export interface Config {
  readonly nodeEnv: 'development' | 'production' | 'test';
  readonly publicBaseUrl: string;
  readonly garminSidecarUrl: string;
  /** Shared secret sent to the sidecar as `X-Internal-Key`; empty when not configured (spec 055). */
  readonly garminInternalKey: string;
  readonly garminAdapter: 'http' | 'mock';
  readonly sessionTtlSeconds: number;
  /** IANA timezone used for "today" and for rendering instants (spec 018). */
  readonly appTimeZone: string;
  /** Background sync cadence in minutes (spec 027). */
  readonly syncIntervalMinutes: number;
  /** `owner/name` checked for newer commits (spec 068). */
  readonly updateCheckRepo: string;
  /** Branch production tracks (spec 068). */
  readonly updateCheckBranch: string;
  /** GitHub read token; empty when the update check is not configured (spec 068). */
  readonly githubToken: string;
  readonly databaseUrl: string;
  readonly authAdapter: 'oidc' | 'mock';
  readonly googleClientId: string;
  readonly googleClientSecret: string;
  readonly isProd: boolean;
}

/** Parse and validate config from an env-like record (defaults to process.env). Throws on invalid config. */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const parsed = schema.safeParse(env);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`).join('\n');
    throw new Error(`Invalid configuration:\n${issues}`);
  }
  const v = parsed.data;
  const isProd = v.NODE_ENV === 'production';
  // Never let a fixture adapter serve real users.
  if (isProd && v.GARMIN_ADAPTER === 'mock') {
    throw new Error(
      'Invalid configuration:\n  - GARMIN_ADAPTER: "mock" is not allowed when NODE_ENV=production'
    );
  }
  if (isProd && v.AUTH_ADAPTER === 'mock') {
    throw new Error(
      'Invalid configuration:\n  - AUTH_ADAPTER: "mock" is not allowed when NODE_ENV=production'
    );
  }
  // A typo'd zone would silently shift every "today"; fail fast at boot instead.
  if (!isKnownTimeZone(v.APP_TIMEZONE)) {
    throw new Error(
      `Invalid configuration:\n  - APP_TIMEZONE: "${v.APP_TIMEZONE}" is not a known IANA timezone`
    );
  }
  // The real Google adapter needs OAuth credentials; the mock adapter deliberately needs none.
  if (v.AUTH_ADAPTER === 'oidc' && (!v.GOOGLE_CLIENT_ID || !v.GOOGLE_CLIENT_SECRET)) {
    throw new Error(
      'Invalid configuration:\n  - GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET are required when AUTH_ADAPTER=oidc'
    );
  }
  return {
    nodeEnv: v.NODE_ENV,
    publicBaseUrl: v.PUBLIC_BASE_URL.replace(/\/$/, ''),
    garminSidecarUrl: v.GARMIN_SIDECAR_URL.replace(/\/$/, ''),
    garminInternalKey: v.GARMIN_INTERNAL_KEY,
    garminAdapter: v.GARMIN_ADAPTER,
    sessionTtlSeconds: v.SESSION_TTL_SECONDS,
    appTimeZone: v.APP_TIMEZONE,
    syncIntervalMinutes: v.SYNC_INTERVAL_MINUTES,
    updateCheckRepo: v.UPDATE_CHECK_REPO,
    updateCheckBranch: v.UPDATE_CHECK_BRANCH,
    githubToken: v.GITHUB_TOKEN,
    databaseUrl: v.DATABASE_URL,
    authAdapter: v.AUTH_ADAPTER,
    googleClientId: v.GOOGLE_CLIENT_ID,
    googleClientSecret: v.GOOGLE_CLIENT_SECRET,
    isProd
  };
}
