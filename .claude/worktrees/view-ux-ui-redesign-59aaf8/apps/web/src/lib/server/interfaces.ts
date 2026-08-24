/**
 * Ports (interfaces) for external dependencies. Adapters implement these; handlers/tools depend on them
 * and receive them via the container so tests can inject mocks (AGENTS.md §2 rule 3, ports & adapters).
 */
import type { WorkoutStep } from '$lib/workouts';
import type { User } from './repo/types';

/* ---------------- Garmin ---------------- */

export interface GarminStatus {
  authenticated: boolean;
  displayName?: string;
  /** ISO timestamp of token expiry, if known. */
  expiresAt?: string;
}

export interface GarminLoginInput {
  email: string;
  password: string;
  /** Present only when completing an MFA challenge. */
  mfaCode?: string;
}

export type GarminLoginResult =
  | { outcome: 'success'; status: GarminStatus }
  | { outcome: 'mfa_required' }
  | { outcome: 'invalid_credentials' };

/** Known read-only metrics the sidecar can serve. */
export type GarminMetricName =
  | 'sleep'
  | 'steps'
  | 'hrv'
  | 'body_battery'
  | 'stress'
  | 'resting_heart_rate'
  | 'activities'
  | 'spo2'
  | 'respiration'
  | 'calories'
  | 'body_composition'
  /**
   * Garmin's OWN Training Readiness (spec 059) — score, level, per-factor percentages and the
   * recovery timer. Distinct from the composite `insights.engine.ts` builds out of raw channels:
   * this one is Garmin's verdict, carried through so the card can show both.
   */
  | 'training_readiness';

export const GARMIN_METRICS: readonly GarminMetricName[] = [
  'sleep',
  'steps',
  'hrv',
  'body_battery',
  'stress',
  'resting_heart_rate',
  'activities',
  'spo2',
  'respiration',
  'calories',
  'body_composition',
  'training_readiness'
] as const;

/**
 * The metrics whose newest day answers "has the watch reached Garmin?" (spec 072).
 *
 * `body_composition` is excluded deliberately — it comes from a scale, so it can be days stale (or
 * years fresh) with nothing to say about the watch. `activities` is excluded because an athlete who
 * did not train today still wore the watch.
 */
export const FRESHNESS_METRICS: readonly GarminMetricName[] = [
  'sleep',
  'steps',
  'hrv',
  'body_battery',
  'stress',
  'resting_heart_rate',
  'spo2',
  'respiration',
  'calories',
  'training_readiness'
] as const;

/** One day's payload within a range read. `data` is null when that day's fetch failed. */
export interface GarminMetricDay {
  date: string;
  data: unknown;
}

/** Result of a multi-day metric read (spec 009). */
export interface GarminMetricRange {
  metric: GarminMetricName;
  start: string;
  end: string;
  days: GarminMetricDay[];
}

/**
 * WHY a Garmin call failed, in machine-readable form (spec 019).
 *
 * Before this existed every transport failure — a 45 s timeout, a Cloudflare block, a rate limit, an
 * expired token — collapsed into a bare `GarminUnavailableError`, and the sync log could say no more
 * than "GarminUnavailableError". The sidecar now classifies the upstream failure and returns it in the
 * response body; this is the shape it lands in on this side.
 *
 * Everything here is secret-free BY CONSTRUCTION: the sidecar derives it from the exception's class
 * name and HTTP status only, never from its message.
 */
export type GarminFailureCode =
  /** The request was aborted by our own timeout. */
  | 'timeout'
  /** The sidecar itself was unreachable (container down, DNS, refused connection). */
  | 'sidecar_unreachable'
  /** Garmin answered 429 / told us to slow down. */
  | 'rate_limited'
  /** Garmin rejected the stored tokens — the user must reconnect. */
  | 'token_rejected'
  /** No tokens stored for this user at all. */
  | 'not_connected'
  /** Cloudflare/transport blocked the call (the reason this sidecar exists). */
  | 'blocked'
  /** Garmin answered 404 for the endpoint. */
  | 'not_found'
  /** The sidecar answered, but not in a shape we can use. */
  | 'bad_response'
  /**
   * The sidecar refused us as a caller: `X-Internal-Key` missing or not matching its
   * `INTERNAL_API_KEY` (spec 055). A DEPLOYMENT fault, not a user or Garmin fault — nothing the
   * user can do about it, and retrying never helps until both services share one value.
   */
  | 'internal_key_rejected'
  /** Anything else upstream. */
  | 'upstream_error';

export interface GarminFailure {
  readonly code: GarminFailureCode;
  /** True when trying again later could plausibly work (rate limit, timeout, blip). */
  readonly retryable: boolean;
  /** HTTP status the sidecar answered with, when there was a response. */
  readonly status?: number;
  /** Upstream HTTP status Garmin answered with, when the sidecar could tell. */
  readonly upstreamStatus?: number;
  /** Sidecar/Garmin route involved, e.g. `metrics/sleep/range` (a path, never credentials). */
  readonly endpoint?: string;
  /** Short, secret-free explanation from the sidecar. */
  readonly reason?: string;
}

/** Thrown by adapters when a metric is requested but the account is not authenticated. */
export class GarminNotAuthenticatedError extends Error {
  readonly failure: GarminFailure;
  constructor(message = 'Garmin account is not connected', failure?: GarminFailure) {
    super(message);
    this.name = 'GarminNotAuthenticatedError';
    this.failure = failure ?? { code: 'not_connected', retryable: false };
  }
}

/** Thrown when the sidecar is unreachable or errors unexpectedly. */
export class GarminUnavailableError extends Error {
  readonly failure: GarminFailure;
  constructor(message = 'Garmin service is unavailable', failure?: GarminFailure) {
    super(message);
    this.name = 'GarminUnavailableError';
    this.failure = failure ?? { code: 'upstream_error', retryable: true };
  }
}

/**
 * Best-effort classification of ANY thrown value into a `GarminFailure`. Callers (the sync engine)
 * record this instead of `err.name`, which is what made every failure look identical on /dane.
 */
export function garminFailureOf(err: unknown): GarminFailure {
  if (err instanceof GarminUnavailableError || err instanceof GarminNotAuthenticatedError) {
    return err.failure;
  }
  if (err instanceof Error && err.name === 'AbortError') return { code: 'timeout', retryable: true };
  return { code: 'upstream_error', retryable: true, reason: err instanceof Error ? err.name : 'error' };
}

/** One sanitised log record read back from the sidecar's in-memory diagnostics buffer (spec 019). */
export interface SidecarLogEntry {
  /** Epoch seconds (the sidecar's own record timestamp). */
  readonly t: number;
  /** Python level name, lower-cased (`info` | `warning` | `error`). */
  readonly level: string;
  readonly logger: string;
  readonly msg: string;
  readonly code?: string;
  readonly endpoint?: string;
}

export interface GarminService {
  /** Attempt a one-time login to obtain tokens (email/password never persisted). */
  login(input: GarminLoginInput): Promise<GarminLoginResult>;
  /** Current auth/health status derived from stored tokens. */
  getStatus(): Promise<GarminStatus>;
  /** Fetch one metric for a date (YYYY-MM-DD, defaults to today in the sidecar). */
  getMetric(name: GarminMetricName, date?: string): Promise<unknown>;
  /** Fetch one metric across an inclusive date range (YYYY-MM-DD). */
  getMetricRange(name: GarminMetricName, start: string, end: string): Promise<GarminMetricRange>;
  /** Clear stored tokens (disconnect the account). */
  disconnect(): Promise<void>;
}

/**
 * One lap / classified split of an activity (spec 023). Every field except `index` is optional —
 * Garmin only records what the device supports for that sport, so a walk lap carries far fewer keys
 * than a run lap. `type` is Garmin's own classification (`RWD_RUN`/`RWD_WALK`/`RWD_STAND`,
 * `INTERVAL_ACTIVE`, …) and is what makes the run/walk breakdown possible.
 */
export interface ActivityLap {
  /** 1-based lap number. */
  index: number;
  type?: string;
  intensityType?: string;
  startTimeGmt?: string;
  distanceM?: number;
  durationS?: number;
  movingDurationS?: number;
  elapsedDurationS?: number;
  avgSpeedMps?: number;
  maxSpeedMps?: number;
  avgHr?: number;
  maxHr?: number;
  avgPower?: number;
  maxPower?: number;
  normPower?: number;
  calories?: number;
  elevationGainM?: number;
  elevationLossM?: number;
  minElevationM?: number;
  maxElevationM?: number;
  avgRunCadenceSpm?: number;
  maxRunCadenceSpm?: number;
  avgStrideLengthCm?: number;
  avgGroundContactTimeMs?: number;
  avgGroundContactBalancePct?: number;
  avgVerticalOscillationCm?: number;
  avgVerticalRatio?: number;
  avgTemperatureC?: number;
  avgRespirationRate?: number;
  /** How many underlying splits this row aggregates (typed splits only). */
  count?: number;
}

/**
 * Per-activity streams + laps from the sidecar (spec 015, extended in spec 023).
 *
 * WIRE CONTRACT: the sidecar emits exactly these camelCase keys — see
 * `services/garmin/app/garmy_client.py::_DESCRIPTOR_TO_STREAM`. It previously emitted snake_case
 * `heart_rate`, which this side never read, so HR was silently dropped on every sync; both sides now
 * carry a regression test. Absent streams are OMITTED (never null/empty): descriptors vary by device
 * and sport, so consumers must treat every stream as optional.
 */
export interface GarminActivityDetails {
  activityId: string;
  summary?: unknown;
  /** `[lat, lng]` or `[lat, lng, elevation]` samples. */
  gps?: Array<[number, number] | [number, number, number]>;
  /** Seconds from the start of the activity (parallel to every other stream). */
  time?: number[];
  heartRate?: number[];
  power?: number[];
  cadence?: number[];
  fractionalCadence?: number[];
  speed?: number[];
  elevation?: number[];
  grade?: number[];
  temperature?: number[];
  respirationRate?: number[];
  verticalRatio?: number[];
  verticalOscillation?: number[];
  groundContactTime?: number[];
  groundContactBalance?: number[];
  strideLength?: number[];
  stamina?: number[];
  staminaPotential?: number[];
  performanceCondition?: number[];
  /** Cumulative moving seconds. */
  movingDuration?: number[];
  /** Derived per-sample flag: 1 = moving, 0 = standing/paused. */
  moving?: number[];
  /** Device laps (auto-lap / lap button). */
  laps?: ActivityLap[];
  /** Garmin's classified splits — run/walk/stand, interval work/rest. */
  typedSplits?: ActivityLap[];
}

/** A single weigh-in already normalized to kg (the sidecar reports grams). */
export interface GarminWeighIn {
  day: string; // YYYY-MM-DD
  weightKg: number;
  raw?: unknown;
}

/**
 * The SYNC-path source (spec 015): everything a GarminService can do, plus the bulk/backfill reads
 * the sync engine needs. Only the sync engine uses these; request handlers use the plain read facade.
 */
export interface GarminSyncSource extends GarminService {
  /** One newest-first page of the FULL activity list (backfill). Empty array = past the end. */
  listActivitiesPage(limit: number, start: number): Promise<unknown[]>;
  /** Per-activity streams (GPS/HR/power/…); absent streams are omitted, never null. */
  getActivityDetails(activityId: string): Promise<GarminActivityDetails>;
  /** Weigh-ins over an inclusive range, converted to kg. */
  getWeightRange(start: string, end: string): Promise<GarminWeighIn[]>;
  /**
   * Planned workouts/races scheduled in `[start, end]` (spec 024). OPTIONAL: a source that cannot
   * read Garmin's calendar simply omits it, and the caller reports "not synced" rather than an empty
   * plan. `available: false` means Garmin answered nothing usable for this account.
   */
  getPlannedEvents?(start: string, end: string): Promise<GarminPlannedFeed>;
  /**
   * Create a structured workout in the user's Garmin workout library (spec 050). OPTIONAL for the
   * same reason as `getPlannedEvents`: a source that cannot write simply omits it and the push phase
   * is skipped entirely. `supported: false` means Garmin serves no such endpoint for this account (or
   * the sport has no Garmin workout type) — a permanent answer, not a transient failure.
   */
  createWorkout?(input: GarminWorkoutInput): Promise<GarminWorkoutWriteResult>;
  /** Pin a created workout to a local calendar day `YYYY-MM-DD` (spec 050). */
  scheduleWorkout?(garminWorkoutId: string, day: string): Promise<GarminWorkoutScheduleResult>;
  /** Remove a workout upstream (spec 050). An already-deleted workout is not an error. */
  deleteWorkout?(garminWorkoutId: string): Promise<GarminWorkoutDeleteResult>;
  /**
   * Recent sidecar log records for this user (spec 019). OPTIONAL — only the real HTTP adapter can
   * serve it; mocks and the local read facade omit it.
   */
  getDiagnostics?(limit?: number): Promise<SidecarLogEntry[]>;
}

/**
 * A workout on its way OUT to Garmin (spec 050). `steps` is the shared client-safe tree from
 * `$lib/workouts`; the sidecar owns the translation into Garmin's own step DTOs, so nothing in the
 * web tier needs to know them.
 */
export interface GarminWorkoutInput {
  readonly sport: string;
  readonly title: string;
  readonly steps: readonly WorkoutStep[];
}

export interface GarminWorkoutWriteResult {
  /** False = Garmin cannot take this workout at all (absent endpoint / no such sport type). */
  readonly supported: boolean;
  readonly workoutId: string | null;
  /** Short machine reason when unsupported (`unsupported_sport` / `unsupported_endpoint`). */
  readonly reason: string | null;
}

export interface GarminWorkoutScheduleResult {
  readonly supported: boolean;
  readonly scheduleId: string | null;
  readonly reason: string | null;
}

export interface GarminWorkoutDeleteResult {
  readonly supported: boolean;
  /** False when it was already gone upstream — which still counts as cleaned up. */
  readonly removed: boolean;
}

/** One planned (future) calendar item as the sidecar normalises it (spec 024). */
export interface GarminPlannedEvent {
  readonly id: string;
  /** `YYYY-MM-DD` in the wearer's local calendar. */
  readonly day: string;
  /** Local `HH:MM`, or null for a whole-day plan. */
  readonly time: string | null;
  readonly kind: 'workout' | 'race' | 'note';
  readonly title: string;
  /** Garmin `typeKey` so the web renders it like any other sport. */
  readonly sport: string | null;
  readonly description: string | null;
  readonly estimatedDurationS: number | null;
  readonly estimatedDistanceM: number | null;
  readonly targetLoad: number | null;
}

export interface GarminPlannedFeed {
  readonly start: string;
  readonly end: string;
  /** False when Garmin's calendar service served nothing usable — NOT the same as "no plans". */
  readonly available: boolean;
  readonly events: GarminPlannedEvent[];
}

/* ---------------- Session ---------------- */

/**
 * DB-backed, revocable session service (spec 012). Opaque high-entropy session ids (no JWT/claims);
 * the row is the source of truth, so deleting it revokes the session immediately.
 */
export interface SessionService {
  /** Create a session row for a user and return its opaque id (to set in the cookie). */
  issue(userId: string): Promise<string>;
  /** Resolve a session id to its user (joins session + user repos); null if unknown/expired. */
  resolve(sessionId: string | undefined | null): Promise<User | null>;
  /** Delete a session row (idempotent) — logout / revoke. */
  destroy(sessionId: string): Promise<void>;
  /**
   * Delete every session that has already expired; returns how many rows went (spec 055). Run
   * periodically by the background scheduler — expired sessions never resolve, but left in place
   * they grow the table forever and linger in database backups.
   */
  sweepExpired(): Promise<number>;
  /** Cookie name used to carry the session. */
  readonly cookieName: string;
  /** Max-Age (seconds) callers should set on the cookie. */
  readonly maxAgeSeconds: number;
}
