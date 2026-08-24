/**
 * Third-party integration PORTS (Strava, Withings) — ports & adapters per AGENTS.md §2/§4.
 *
 * These integrations are injectable so the whole flow is testable offline TODAY (via the mock
 * adapters) and goes live LATER when real OAuth credentials land — no handler code changes, only
 * the container/config wiring described in INTEGRATION-WIRING.md.
 *
 * Security (AGENTS.md §10): OAuth uses Authorization-Code + `state`; PKCE (S256) is threaded through
 * for providers that honour it. Access/refresh tokens are treated as secrets — never logged, never
 * put in URLs we render, only ever passed through the injected logger's redaction net.
 */
import type { ActivitySummary, LocalStore } from '../store/types';
import type { Clock } from '../clock';
import type { Logger } from '../logger';
import type { Random } from '../random';
import type { StravaLink } from './matching';

/** The external providers this module can talk to. */
export type IntegrationProvider = 'strava' | 'withings';

export const INTEGRATION_PROVIDERS: readonly IntegrationProvider[] = ['strava', 'withings'] as const;

export function isIntegrationProvider(v: string): v is IntegrationProvider {
  return v === 'strava' || v === 'withings';
}

/**
 * OAuth tokens for one user+provider. Persisted through the {@link IntegrationTokenStore} port.
 * Every field here is a secret or provider-identifier — keep it out of logs and rendered UI.
 */
export interface OAuthTokens {
  readonly accessToken: string;
  /** Long-lived refresh token, when the provider issues one (Strava + Withings both do). */
  readonly refreshToken: string | null;
  /** Epoch seconds at which `accessToken` expires, if the provider tells us. */
  readonly expiresAt: number | null;
  /** Granted scope string, verbatim from the provider. */
  readonly scope: string | null;
  /** The provider's own user id (Strava athlete id / Withings `userid`), for reference. */
  readonly providerUserId: string | null;
}

/* --------------------------------------------------------------------------------------------- */
/* Strava                                                                                        */
/* --------------------------------------------------------------------------------------------- */

/**
 * A raw Strava activity. Only the fields we actually read are typed (each tagged `// ASSUMPTION`
 * in the real adapter); the rest of the payload is preserved but ignored.
 */
export interface StravaActivity {
  readonly id: number;
  readonly name: string;
  /** ISO-8601 UTC start, e.g. `2026-08-01T07:00:00Z`. */
  readonly start_date: string;
  /** Wall-clock elapsed time in seconds. */
  readonly elapsed_time: number;
  /** Moving time in seconds. */
  readonly moving_time: number;
  /** Distance in metres. */
  readonly distance: number;
  /** Coarse Strava type, e.g. `Ride`, `Run`. */
  readonly type: string;
  /** Finer Strava sport type when present, e.g. `MountainBikeRide`. */
  readonly sport_type?: string;
}

/** Normalized, provider-agnostic reference to a Strava activity used for matching + linking. */
export interface StravaActivityRef {
  readonly stravaId: string;
  readonly name: string;
  /** ISO-8601 UTC start instant. */
  readonly startTime: string;
  /** Duration in seconds (elapsed). */
  readonly durationS: number;
  /** Distance in metres. */
  readonly distanceM: number;
  /** Lower-cased sport key, e.g. `ride`, `run`. */
  readonly sport: string;
  /** Public Strava URL to attach to the matched Garmin activity. */
  readonly permalink: string;
}

/**
 * Strava port. The adapter is constructed with a fixed `{ clientId, redirectUri, ... }`, so the auth
 * methods only take the per-transaction `state` + PKCE `codeChallenge`/`codeVerifier`.
 */
export interface StravaClient {
  /** Build the provider authorization URL to redirect the browser to. */
  buildAuthUrl(state: string, codeChallenge: string): string;
  /** Exchange an authorization `code` (+ PKCE verifier) for tokens. */
  exchangeCode(code: string, codeVerifier: string): Promise<OAuthTokens>;
  /** List the athlete's activities, optionally only those after `since` (epoch seconds). */
  listActivities(tokens: OAuthTokens, since?: number): Promise<StravaActivity[]>;
  /** Project a raw activity onto the stable match reference (start/duration/distance + permalink). */
  normalizeToMatchKey(activity: StravaActivity): StravaActivityRef;
}

/* --------------------------------------------------------------------------------------------- */
/* Withings                                                                                      */
/* --------------------------------------------------------------------------------------------- */

/** A single Withings weigh-in, already converted to kilograms. */
export interface WithingsWeighIn {
  readonly day: string; // YYYY-MM-DD
  readonly weightKg: number;
  /** The raw measure group, kept for provenance. */
  readonly raw: unknown;
}

/** Withings port. Same construction contract as {@link StravaClient}. */
export interface WithingsClient {
  buildAuthUrl(state: string, codeChallenge: string): string;
  exchangeCode(code: string, codeVerifier: string): Promise<OAuthTokens>;
  /** Weigh-ins over an inclusive `YYYY-MM-DD` range, converted to kg. */
  getWeighIns(tokens: OAuthTokens, start: string, end: string): Promise<WithingsWeighIn[]>;
}

/* --------------------------------------------------------------------------------------------- */
/* Persistence ports                                                                             */
/* --------------------------------------------------------------------------------------------- */

/**
 * Per user+provider OAuth token store.
 *
 * NOTE(follow-up): the only implementation today is the in-memory fake in `stores.ts`. Production
 * persistence (an encrypted `integration_tokens` table, keyed by user id, tokens encrypted at rest
 * like the sidecar's Garmin tokens) is a deliberate follow-up — this slice ships behind the port so
 * that swap is drop-in. Do NOT add a DB table/migration here.
 */
export interface IntegrationTokenStore {
  get(userId: string, provider: IntegrationProvider): Promise<OAuthTokens | null>;
  set(userId: string, provider: IntegrationProvider, tokens: OAuthTokens): Promise<void>;
  clear(userId: string, provider: IntegrationProvider): Promise<void>;
}

/**
 * Store for the Strava↔Garmin cross-reference links. Kept separate from the activities schema on
 * purpose (spec constraint): linking must never mutate synced Garmin rows.
 *
 * NOTE(follow-up): in-memory only for now (see token store note).
 */
export interface StravaLinkStore {
  put(userId: string, links: readonly StravaLink[]): Promise<void>;
  list(userId: string): Promise<StravaLink[]>;
  clear(userId: string): Promise<void>;
}

/* --------------------------------------------------------------------------------------------- */
/* Bundle + errors                                                                               */
/* --------------------------------------------------------------------------------------------- */

/** The injected dependency bundle the sync service + API handlers run over. */
export interface Integrations {
  readonly store: LocalStore;
  readonly tokens: IntegrationTokenStore;
  readonly links: StravaLinkStore;
  readonly strava: StravaClient;
  readonly withings: WithingsClient;
  readonly random: Random;
  readonly clock: Clock;
  readonly logger: Logger;
}

/** Raised when a user asks to sync a provider they have not connected. Maps to HTTP 409. */
export class IntegrationNotConnectedError extends Error {
  constructor(readonly provider: IntegrationProvider) {
    super(`Integration not connected: ${provider}`);
    this.name = 'IntegrationNotConnectedError';
  }
}

/** Raised when a provider rejects the token exchange / a remote call. Maps to HTTP 502. */
export class IntegrationRemoteError extends Error {
  constructor(
    readonly provider: IntegrationProvider,
    message = 'Integration remote call failed'
  ) {
    super(message);
    this.name = 'IntegrationRemoteError';
  }
}

/** A weigh-in candidate re-export used by the sync service (mirrors the store contract). */
export type { ActivitySummary };
