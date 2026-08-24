/**
 * LocalStore PORT (spec 015). The synced local copy of a user's Garmin data — the source the whole
 * app reads from (dashboard, analytics, insights, activities, maps, MCP). NOTHING in a request path
 * calls the sidecar directly any more; the sync engine (the only writer) pulls from the sidecar and
 * upserts here. Adapters: `pg` (Postgres) in prod, an in-memory fake in tests.
 *
 * Isolation (AGENTS.md golden rule #2): EVERY method takes `userId`; rows are keyed by it and cascade
 * on user delete. One user can never read another's synced data.
 *
 * Payload fidelity: daily metrics store the sidecar's raw `data` payload verbatim, so the existing
 * `metric-specs` extractors keep working against local reads without change.
 */
import type { SportGroup } from '$lib/sport-labels';
import type { WorkoutStep } from '$lib/workouts';
import type { ActivityLap, GarminMetricName, GarminMetricRange } from '../interfaces';

export type { ActivityLap };

/** A source that feeds the store. Sync state + provenance are tracked per source. */
export type DataSource = 'garmin' | 'strava' | 'withings';

/** Normalized activity summary (subset lifted out of the raw payload for cheap querying/sorting). */
export interface ActivitySummary {
  readonly userId: string;
  readonly activityId: string;
  /** Garmin activity type key, e.g. `cycling`, `running`, `virtual_ride`. */
  readonly sport: string;
  readonly name: string | null;
  /** ISO instant (UTC) of the start. */
  readonly startTime: string;
  /** Local wall-clock start `YYYY-MM-DD HH:MM:SS` (the day the athlete trained). */
  readonly startTimeLocal: string;
  readonly distanceM: number | null;
  readonly durationS: number | null;
  readonly movingS: number | null;
  readonly elevationGainM: number | null;
  readonly avgHr: number | null;
  readonly maxHr: number | null;
  readonly avgPower: number | null;
  readonly maxPower: number | null;
  readonly normPower: number | null;
  readonly calories: number | null;
  /** Garmin's own training load for the activity, when present. */
  readonly trainingLoad: number | null;
  /** True when a GPS track is available (drives map/heatmap eligibility). */
  readonly hasGps: boolean;
  /** The full raw activity summary payload as returned by the sidecar. */
  readonly raw: unknown;
}

/**
 * Schema version stamped on every stored stream blob (spec 023). BUMP THIS whenever the extraction
 * contract changes: the sync engine re-fetches any row stamped lower, which is how already-synced
 * activities are repaired without a resync-from-scratch.
 *
 *  - v1: gps/heartRate/power/cadence/speed/elevation/time (heartRate was in fact never persisted —
 *        the sidecar emitted `heart_rate`, so every v1 row is missing HR).
 *  - v2: camelCase wire contract fixed + running-dynamics/physiology streams, `moving`, and laps.
 */
export const STREAMS_SCHEMA_VERSION = 2;

/**
 * Per-activity time-series streams (+ laps, which ride along in the same jsonb blob so no extra
 * table/migration is needed). EVERY field may be absent: descriptors vary by device and sport, so
 * consumers must degrade gracefully rather than assume a stream exists.
 *
 * All numeric arrays are parallel — index `i` of `heartRate` and of `time` describe the same sample.
 */
export interface ActivityStreams {
  /** `STREAMS_SCHEMA_VERSION` at write time. Absent/older ⇒ the row predates the current contract. */
  readonly v?: number;
  /** `[lat, lng]` or `[lat, lng, elevation]` samples. */
  readonly gps?: Array<[number, number] | [number, number, number]>;
  /** Seconds-from-start for each sample (parallel to the arrays below). */
  readonly time?: number[];
  readonly heartRate?: number[];
  readonly power?: number[];
  readonly cadence?: number[];
  readonly fractionalCadence?: number[];
  readonly speed?: number[];
  readonly elevation?: number[];
  /** Slope, percent. */
  readonly grade?: number[];
  /** Ambient temperature, °C. */
  readonly temperature?: number[];
  /** Breaths per minute. */
  readonly respirationRate?: number[];
  readonly verticalRatio?: number[];
  /** Centimetres. */
  readonly verticalOscillation?: number[];
  /** Milliseconds. */
  readonly groundContactTime?: number[];
  /** Left-foot share, percent. */
  readonly groundContactBalance?: number[];
  /** Centimetres. */
  readonly strideLength?: number[];
  /** Current stamina, 0–100. */
  readonly stamina?: number[];
  /** Potential stamina, 0–100. */
  readonly staminaPotential?: number[];
  readonly performanceCondition?: number[];
  /** Cumulative moving seconds. */
  readonly movingDuration?: number[];
  /** Derived per-sample flag: 1 = moving, 0 = standing/paused. */
  readonly moving?: number[];
  /** Device laps (auto-lap / lap button). */
  readonly laps?: readonly ActivityLap[];
  /** Garmin's classified splits — run/walk/stand, interval work/rest. */
  readonly typedSplits?: readonly ActivityLap[];
}

/**
 * Version stamped on an activity whose best efforts have been derived (spec 054). BUMP THIS whenever
 * the derivation changes — a new entry in `EFFORT_DISTANCES`, different windowing — and the sync
 * re-derives every activity stamped lower, exactly the way `STREAMS_SCHEMA_VERSION` repairs stale
 * stream blobs. `0` means "stream stored, efforts never derived".
 *
 *  - v1: `bestEfforts()` over the `Σ v·Δt` distance axis, for the `run` and `walk` sport families.
 */
export const BEST_EFFORTS_VERSION = 1;

/**
 * One stored effort: the fastest window inside ONE activity covering at least `metres`. Mirrors
 * `BestEffort` from `$lib/analytics/best-efforts` minus its display `label`, which is looked up from
 * `EFFORT_DISTANCES` at render time rather than frozen into storage.
 */
export interface StoredBestEffort {
  /** `EFFORT_DISTANCES` key, e.g. `5k`. */
  readonly key: string;
  /** The nominal target, metres. */
  readonly metres: number;
  readonly durationS: number;
  /** Metres the window ACTUALLY covered (≥ `metres`) — what the pace is computed over. */
  readonly actualM: number;
  readonly paceSecPerKm: number;
  /** Elapsed seconds into the activity at which the window started. */
  readonly startS: number;
  readonly samples: number;
}

/** Everything one activity contributes to the leaderboard, written as a single idempotent replace. */
export interface ActivityBestEfforts {
  readonly activityId: string;
  /** Garmin sport key of the activity (the leaderboard filters by sport family). */
  readonly sport: string;
  /** Local `YYYY-MM-DD` the activity started — what the leaderboard prints and breaks ties on. */
  readonly day: string;
  /** `BEST_EFFORTS_VERSION` at derivation time. */
  readonly version: number;
  /** May be empty: a session too short for any target still counts as derived. */
  readonly efforts: readonly StoredBestEffort[];
}

/** A leaderboard row: the stored effort plus the activity it came from (so a view can link to it). */
export interface RankedBestEffort extends StoredBestEffort {
  readonly activityId: string;
  readonly activityName: string | null;
  readonly sport: string;
  readonly day: string;
}

export interface TopBestEffortsQuery {
  /** Rows kept per distance key, fastest first. */
  readonly limit: number;
  /** Restrict to these Garmin sport keys (expand a family with `sportKeysInGroup`). */
  readonly sports?: readonly string[];
  /**
   * AS-OF bound (spec 057): keep only efforts whose activity day is `<= until` (inclusive, local
   * `YYYY-MM-DD`). Absent = all time. This is what makes "what would you have run 90 days ago" one
   * indexed query instead of a stored history of past predictions — the ranking is re-run over the
   * subset, so the answer is a real recomputation and not a cached number.
   */
  readonly until?: string;
}

/** A single weigh-in (kg). Sourced from Garmin body-composition or Withings. */
export interface WeightPoint {
  readonly day: string; // YYYY-MM-DD
  readonly weightKg: number;
  readonly source: DataSource;
  readonly raw?: unknown;
}

/** Coverage for one daily metric: how much we hold locally. */
export interface MetricCoverage {
  readonly metric: GarminMetricName;
  readonly firstDay: string | null;
  readonly lastDay: string | null;
  /** Days present with a non-null payload. */
  readonly presentDays: number;
}

/** On-disk footprint of a user's synced data. */
export interface StorageUsage {
  /** Total bytes across the synced_* tables (whole DB; the in-memory fake estimates from JSON size). */
  readonly totalBytes: number;
  /** Row counts contributing to the user's footprint. */
  readonly rows: { metricDays: number; activities: number; streams: number; weight: number };
}

/** Whole-store coverage snapshot for the "how much data you have" surface. */
export interface CoverageSnapshot {
  readonly metrics: MetricCoverage[];
  readonly activities: {
    readonly count: number;
    readonly withGps: number;
    readonly firstStart: string | null;
    readonly lastStart: string | null;
    readonly totalDistanceM: number;
  };
  readonly weight: {
    readonly count: number;
    readonly firstDay: string | null;
    readonly lastDay: string | null;
  };
  /** Earliest date across all synced data ("data since"), YYYY-MM-DD, or null when empty. */
  readonly earliest: string | null;
  readonly storage: StorageUsage;
}

/** Per-source, per-user sync cursor + timestamps (drives incremental sync). */
export interface SyncState {
  readonly source: DataSource;
  /** Opaque per-source cursor (e.g. last synced day, last activity page). */
  readonly cursor: Record<string, unknown>;
  readonly lastFullSyncAt: string | null;
  readonly lastSyncAt: string | null;
}

export type SyncRunStatus = 'running' | 'succeeded' | 'failed' | 'cancelled';
export type SyncRunKind = 'full' | 'incremental';

/** A tracked sync run — powers the progress bar + "last sync" surfaces. */
export interface SyncRun {
  readonly id: string;
  readonly userId: string;
  readonly kind: SyncRunKind;
  readonly status: SyncRunStatus;
  readonly startedAt: string;
  readonly finishedAt: string | null;
  /** Total planned units of work (e.g. day-metric fetches + activity pages). */
  readonly total: number;
  /** Units completed so far. */
  readonly done: number;
  /** Human-readable current step, e.g. "sleep 2026-01..2026-01-31". */
  readonly step: string | null;
  readonly error: string | null;
  /** Per-phase outcome (counts + any error) so the UI can show exactly what synced or failed. */
  readonly detail: SyncDetail | null;
}

/** Which part of a sync a log line/failure belongs to (drives the /dane filter). */
export type SyncPhase =
  'start' | 'activities' | 'streams' | 'weight' | 'planned' | 'workoutPush' | 'metrics' | 'done';

/**
 * One line in the live sync log (structural/diagnostic only — never metric payloads or PII).
 *
 * The optional fields are the spec-019 diagnostic channel: `code` is the sidecar's classification
 * (`rate_limited`, `token_rejected`, `sidecar_unreachable`, …), so /dane can group and filter by WHY
 * something failed instead of showing one undifferentiated wall of "GarminUnavailableError".
 */
export interface SyncLogEntry {
  /** ISO timestamp. */
  t: string;
  level: 'info' | 'warn' | 'error';
  msg: string;
  phase?: SyncPhase;
  /** Failure classification, when this line reports a failure. */
  code?: string;
  /** True when retrying later could plausibly succeed. */
  retryable?: boolean;
  /** Daily metric the line concerns, when it concerns one. */
  metric?: string;
  /** `YYYY-MM-DD` the line concerns, when it concerns one. */
  day?: string;
  /** Sidecar/Garmin route involved (a path, never credentials). */
  endpoint?: string;
}

/** Fields every phase records on a failure (secret-free, classified). */
interface PhaseError {
  /** Short Polish explanation shown on /dane. */
  error?: string;
  /** Machine-readable classification (`rate_limited` | `token_rejected` | …). */
  errorCode?: string;
  retryable?: boolean;
}

/** Per-phase sync results. Each phase records what it did and any error (secret-free). */
export interface SyncDetail {
  activities?: { pages: number; count: number } & PhaseError;
  /**
   * `fetched` = new streams; `repaired` = rows re-pulled after a schema bump; `pending` = backlog left
   * for the next run. `efforts`/`effortsPending` are the best-efforts derivation (spec 054), reported
   * inside this phase because it is derived FROM these streams and does no upstream work of its own.
   */
  streams?: {
    fetched: number;
    repaired?: number;
    pending?: number;
    efforts?: number;
    effortsPending?: number;
  } & PhaseError;
  weight?: { points: number } & PhaseError;
  /**
   * Daily metrics. `backfillTo` is the oldest day the backwards walk has reached (the resumable
   * frontier), `backfillTarget` the day it is walking towards and `remainingDays` what is left — the
   * numbers /dane turns into "uzupełniono do 2021-03-04, zostało ~N dni".
   */
  metrics?: {
    chunks: number;
    days: number;
    windowStart: string | null;
    backfillTo?: string;
    backfillTarget?: string;
    remainingDays?: number;
    complete?: boolean;
  } & PhaseError;
  /** Planned workouts (spec 024). `available: false` = Garmin served no calendar for this account. */
  planned?: { available: boolean; count: number; from?: string; to?: string } & PhaseError;
  /**
   * Authored-workout push (spec 050): how many of the athlete's own sessions reached Garmin this run.
   * `unsupported` counts rows Garmin can never take (absent endpoint / no such sport type), which is
   * why they are reported separately from `failed` — one is worth retrying, the other never is.
   */
  workoutPush?: {
    pushed: number;
    failed: number;
    unsupported: number;
    /** Still waiting after this run (batch cap reached, or the phase stopped early). */
    pending: number;
  } & PhaseError;
  /** Rolling, capped diagnostic log of what the sync did (newest last). */
  log?: SyncLogEntry[];
}

/**
 * A workout/race the user has SCHEDULED (spec 024) — the forward half of the start-page timeline.
 * Stored per user and per source; the sync engine replaces a whole date window at a time so a plan
 * deleted in Garmin also disappears here.
 */
export interface PlannedEvent {
  readonly id: string;
  /** `YYYY-MM-DD` local calendar day. */
  readonly day: string;
  /** Local `HH:MM`, or null for a whole-day plan. */
  readonly time: string | null;
  readonly kind: 'workout' | 'race' | 'note';
  readonly title: string;
  /** Garmin `typeKey`, so it renders like any other sport. */
  readonly sport: string | null;
  readonly description: string | null;
  readonly estimatedDurationS: number | null;
  readonly estimatedDistanceM: number | null;
  readonly targetLoad: number | null;
  readonly source: DataSource;
}

/**
 * How far a locally AUTHORED workout (spec 050) has got towards the athlete's watch.
 *
 * `pending`     — stored here, not on Garmin yet (the push phase will try it)
 * `pushed`      — created + scheduled upstream; `garminWorkoutId` is set
 * `failed`      — the last push failed for a retryable reason; the next sync tries again
 * `unsupported` — Garmin serves no workout endpoint for this account, or this sport has no Garmin
 *                 workout type. Retrying cannot help, so the phase stops trying.
 */
export type WorkoutPushState = 'pending' | 'pushed' | 'failed' | 'unsupported';

/**
 * A workout the athlete AUTHORED here (spec 050) — the inverse of `PlannedEvent`, which mirrors what
 * Garmin already knows. This row is the source of truth: the push phase projects it onto Garmin and
 * writes the resulting ids back, so Garmin can be rebuilt from here but never the other way round.
 *
 * `matchedActivityId` is reserved for the planned-vs-actual comparison (spec 052); nothing in spec
 * 050 populates it.
 */
export interface AuthoredWorkout {
  readonly id: string;
  readonly userId: string;
  /** `YYYY-MM-DD` local calendar day the session is scheduled for. */
  readonly day: string;
  /** Local `HH:MM`, or null for "sometime that day". */
  readonly time: string | null;
  /** Garmin `typeKey` (`running`, `cycling`, …) — validated against `SPORT_LABELS`. */
  readonly sport: string;
  readonly title: string;
  readonly steps: readonly WorkoutStep[];
  readonly note: string | null;
  readonly pushState: WorkoutPushState;
  /** Short, secret-free reason for the last failed/unsupported push. */
  readonly pushError: string | null;
  readonly garminWorkoutId: string | null;
  readonly garminScheduleId: string | null;
  /** Reserved for spec 052 (planned vs actual). Always null here. */
  readonly matchedActivityId: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

/**
 * Everything needed to store a new authored workout. `id` and `createdAt` come from the CALLER
 * (injected `Random` + `Clock`, AGENTS.md §4) so the store stays deterministic and testable.
 */
export interface NewAuthoredWorkout {
  readonly id: string;
  readonly day: string;
  readonly time: string | null;
  readonly sport: string;
  readonly title: string;
  readonly steps: readonly WorkoutStep[];
  readonly note: string | null;
  readonly createdAt: string;
}

/** Partial update. Absent keys are left alone; `updatedAt` is always required. */
export interface AuthoredWorkoutPatch {
  readonly day?: string;
  readonly time?: string | null;
  readonly sport?: string;
  readonly title?: string;
  readonly steps?: readonly WorkoutStep[];
  readonly note?: string | null;
  readonly pushState?: WorkoutPushState;
  readonly pushError?: string | null;
  readonly garminWorkoutId?: string | null;
  readonly garminScheduleId?: string | null;
  readonly matchedActivityId?: string | null;
  readonly updatedAt: string;
}

/**
 * A reusable session (spec 069) — the same step model as an `AuthoredWorkout` with the DATE removed.
 *
 * That absence is the whole type. A template is a session you HAVE; an `AuthoredWorkout` is a session
 * you have COMMITTED TO on a day. Scheduling copies the steps across rather than linking, so editing a
 * template can never rewrite a session already pushed to the athlete's watch — see the spec for why
 * that trade is the right way round.
 */
export interface WorkoutTemplate {
  readonly id: string;
  readonly userId: string;
  /** Garmin `typeKey` — validated against `SPORT_LABELS`, like an authored workout's. */
  readonly sport: string;
  readonly title: string;
  readonly steps: readonly WorkoutStep[];
  readonly note: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

/** `id` and `createdAt` come from the CALLER (injected `Random` + `Clock`, AGENTS.md §4). */
export interface NewWorkoutTemplate {
  readonly id: string;
  readonly sport: string;
  readonly title: string;
  readonly steps: readonly WorkoutStep[];
  readonly note: string | null;
  readonly createdAt: string;
}

/** Partial update. Absent keys are left alone; `updatedAt` is always required. */
export interface WorkoutTemplatePatch {
  readonly sport?: string;
  readonly title?: string;
  readonly steps?: readonly WorkoutStep[];
  readonly note?: string | null;
  readonly updatedAt: string;
}

export interface ListWorkoutsQuery {
  /** Inclusive local-day bounds `YYYY-MM-DD`. */
  readonly from?: string;
  readonly to?: string;
  readonly pushState?: WorkoutPushState;
  readonly limit?: number;
}

/* ---------------------------------------------------------------------------------------------
 * Season goals (spec 060)
 * ------------------------------------------------------------------------------------------- */

/**
 * What kind of target this is. A `race` has a finish line and can carry a distance and a wanted
 * time; a `fitness` goal is a date and a CTL to be at by then, for the athlete with no race on the
 * calendar who still wants the trajectory drawn.
 */
export type GoalKind = 'race' | 'fitness';

/** A-priority is the season; B and C are stepping stones raced through. */
export type GoalPriority = 'a' | 'b' | 'c';

/**
 * A target the athlete has told us about (spec 060) — the only forward-looking row in the store.
 *
 * `garminEventId` links a goal back to the synced planned event it was imported from, so the same
 * race on the Garmin calendar can never be adopted twice. It stays null for hand-entered goals, and
 * a goal outlives the event it came from: once imported the row is ours.
 */
export interface SeasonGoal {
  readonly id: string;
  readonly userId: string;
  /** `YYYY-MM-DD` local day of the race, or the day the fitness target is wanted by. */
  readonly day: string;
  /** Sport FAMILY (`run` | `ride` | …), because the trajectory is scored on that family's own CTL. */
  readonly sport: SportGroup;
  readonly title: string;
  readonly kind: GoalKind;
  readonly priority: GoalPriority;
  /** Race distance in metres; null for a fitness goal or a race with no fixed distance. */
  readonly distanceM: number | null;
  /** Wanted finish time in seconds; null when the athlete only wants to finish. */
  readonly targetTimeS: number | null;
  /** CTL to be at by the start of the taper; null when the athlete has not set one. */
  readonly targetCtl: number | null;
  readonly note: string | null;
  readonly source: 'manual' | 'garmin';
  readonly garminEventId: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

/**
 * Everything needed to store a new goal. `id` and `createdAt` come from the CALLER (injected
 * `Random` + `Clock`, AGENTS.md §4) so the store stays deterministic and testable — the same rule
 * `NewAuthoredWorkout` follows.
 */
export interface NewSeasonGoal {
  readonly id: string;
  readonly day: string;
  readonly sport: SportGroup;
  readonly title: string;
  readonly kind: GoalKind;
  readonly priority: GoalPriority;
  readonly distanceM: number | null;
  readonly targetTimeS: number | null;
  readonly targetCtl: number | null;
  readonly note: string | null;
  readonly source: 'manual' | 'garmin';
  readonly garminEventId: string | null;
  readonly createdAt: string;
}

/** Partial update. Absent keys are left alone; `updatedAt` is always required. */
export interface SeasonGoalPatch {
  readonly day?: string;
  readonly sport?: SportGroup;
  readonly title?: string;
  readonly kind?: GoalKind;
  readonly priority?: GoalPriority;
  readonly distanceM?: number | null;
  readonly targetTimeS?: number | null;
  readonly targetCtl?: number | null;
  readonly note?: string | null;
  readonly updatedAt: string;
}

export interface ListGoalsQuery {
  /** Inclusive local-day bounds `YYYY-MM-DD`. */
  readonly from?: string;
  readonly to?: string;
  readonly sport?: SportGroup;
  readonly limit?: number;
}

/** Raised when a goal would adopt a synced race some other goal already holds. */
export class DuplicateGoalError extends Error {
  constructor(public readonly garminEventId: string) {
    super('goal already imported for this planned event');
    this.name = 'DuplicateGoalError';
  }
}

/** One sport facet: the Garmin sport key plus how many activities the user has of it (spec 020). */
export interface SportCount {
  readonly sport: string;
  readonly count: number;
}

export interface ListActivitiesQuery {
  readonly sport?: string;
  /**
   * Sport-FAMILY filter: match any of these Garmin sport keys (spec 024). Callers expand a
   * `SportGroup` with `sportKeysInGroup()` so the database does the filtering — before this the
   * training/power/running pages each read the whole history (`limit: 100000`) and filtered in
   * memory. ANDs with `sport` when both are given; an empty array matches nothing.
   */
  readonly sports?: readonly string[];
  /** Inclusive local-day bounds `YYYY-MM-DD`. */
  readonly from?: string;
  readonly to?: string;
  readonly search?: string;
  readonly sort?: 'date' | 'distance' | 'duration';
  readonly dir?: 'asc' | 'desc';
  readonly limit?: number;
  readonly offset?: number;
}

/**
 * The store facade. Writers: the sync engine + integrations. Readers: everything else.
 * All mutations are idempotent upserts so re-syncing a day/activity is safe.
 */
export interface LocalStore {
  /* ---- daily metrics ---- */
  putMetricDay(userId: string, metric: GarminMetricName, day: string, data: unknown): Promise<void>;
  putMetricDays(
    userId: string,
    metric: GarminMetricName,
    days: Array<{ day: string; data: unknown }>
  ): Promise<void>;
  getMetricDay(userId: string, metric: GarminMetricName, day: string): Promise<unknown>;
  /** Returns the same shape as the sidecar range read, so metric-specs extractors work unchanged. */
  getMetricRange(
    userId: string,
    metric: GarminMetricName,
    start: string,
    end: string
  ): Promise<GarminMetricRange>;

  /* ---- activities ---- */
  putActivities(userId: string, activities: ActivitySummary[]): Promise<void>;
  getActivity(userId: string, activityId: string): Promise<ActivitySummary | null>;
  listActivities(userId: string, query?: ListActivitiesQuery): Promise<ActivitySummary[]>;
  countActivities(userId: string, query?: ListActivitiesQuery): Promise<number>;
  /** Distinct sports present with their activity counts, most frequent first (ties: key asc). */
  listSports(userId: string): Promise<SportCount[]>;

  /* ---- activity streams ---- */
  /**
   * Upsert an activity's streams. Also CLEARS the stored best-efforts version (spec 054): new samples
   * mean the derived efforts are stale, so the next sync re-derives them.
   */
  putStreams(userId: string, activityId: string, streams: ActivityStreams): Promise<void>;
  getStreams(userId: string, activityId: string): Promise<ActivityStreams | null>;
  /**
   * activityId → stored `v` (0 when the blob predates versioning), for EVERY stream row this user
   * has. One cheap query: the sync engine needs to know what is missing/stale without loading
   * thousands of full stream blobs into memory just to decide.
   */
  listStreamVersions(userId: string): Promise<Map<string, number>>;
  /**
   * Batch-read ONE numeric stream field for many activities in a single query (spec 019 perf). Avoids
   * the N+1 + full-blob memory blow-up of calling getStreams per activity — pages that only need
   * power (or HR) never load GPS/other arrays. Returns a map of activityId → that array (present only
   * for activities whose stream carries a non-empty array for `field`).
   */
  getStreamField(
    userId: string,
    activityIds: string[],
    field: 'power' | 'heartRate' | 'cadence' | 'speed' | 'elevation'
  ): Promise<Map<string, number[]>>;
  /** All activities that have GPS, for the heatmap (streams only, optionally filtered). */
  listGpsTracks(
    userId: string,
    query?: { sport?: string; year?: number }
  ): Promise<
    Array<{ activityId: string; sport: string; startTimeLocal: string; gps: ActivityStreams['gps'] }>
  >;

  /* ---- all-time best efforts (spec 054) ---- */
  /**
   * REPLACE every stored effort for one activity and stamp `input.version` on its stream row. A plain
   * upsert would leave behind rows for distances a re-derivation no longer finds, so the activity's
   * set is rewritten wholesale — which is also what makes re-syncing idempotent.
   */
  putActivityBestEfforts(userId: string, input: ActivityBestEfforts): Promise<void>;
  /**
   * activityId → stamped `BEST_EFFORTS_VERSION` (0 when never derived), for every activity of this
   * user that HAS a stream row. Same contract as `listStreamVersions`: an activity absent from the map
   * has no streams to derive from, so the backfill must skip it rather than retry it forever.
   */
  listBestEffortVersions(userId: string): Promise<Map<string, number>>;
  /**
   * The leaderboard: the fastest `limit` efforts per distance key, joined to their activity. Ordered
   * by distance ascending, then duration ascending, ties broken by the EARLIER day — the record
   * belongs to whoever set it first.
   */
  listTopBestEfforts(userId: string, query: TopBestEffortsQuery): Promise<RankedBestEffort[]>;

  /* ---- planned workouts (spec 024) ---- */
  /**
   * Replace EVERY planned event in `[from, to]` with `events`. A plain upsert would leave behind
   * plans the user has since deleted in Garmin, so the window is rewritten wholesale.
   */
  replacePlannedEvents(userId: string, from: string, to: string, events: PlannedEvent[]): Promise<void>;
  /** Planned events in `[from, to]`, day then time ascending. */
  listPlannedEvents(userId: string, from: string, to: string): Promise<PlannedEvent[]>;

  /* ---- authored workouts (spec 050) ---- */
  /**
   * Store a workout the athlete composed HERE. Separate from `synced_planned_events` on purpose: that
   * window is replaced wholesale from Garmin on every sync, which would delete these rows.
   */
  createWorkout(userId: string, input: NewAuthoredWorkout): Promise<AuthoredWorkout>;
  getWorkout(userId: string, id: string): Promise<AuthoredWorkout | null>;
  /** Authored workouts, day then time ascending. */
  listWorkouts(userId: string, query?: ListWorkoutsQuery): Promise<AuthoredWorkout[]>;
  /** Apply a patch; returns the updated row, or null when the id is not this user's. */
  updateWorkout(userId: string, id: string, patch: AuthoredWorkoutPatch): Promise<AuthoredWorkout | null>;
  /**
   * Delete and return the row that was removed (null when unknown), so the caller still has the
   * `garminWorkoutId` it needs to clean the workout up upstream.
   */
  deleteWorkout(userId: string, id: string): Promise<AuthoredWorkout | null>;

  /* ---- workout library (spec 069) ---- */
  /**
   * Reusable sessions, independent of any date. Separate from `authored_workouts` because that table
   * is date-bound by construction — there was no row that could mean "this session, whenever".
   */
  createWorkoutTemplate(userId: string, input: NewWorkoutTemplate): Promise<WorkoutTemplate>;
  getWorkoutTemplate(userId: string, id: string): Promise<WorkoutTemplate | null>;
  /** The user's library, title ascending — the order a list of named things is read in. */
  listWorkoutTemplates(userId: string): Promise<WorkoutTemplate[]>;
  /**
   * Resolve by sport + title, case-insensitively. This is what MCP matches on (spec 069): an assistant
   * is handed a NAME by a human, so a name is what it can look up. Null when the library has none.
   */
  findWorkoutTemplateByTitle(userId: string, sport: string, title: string): Promise<WorkoutTemplate | null>;
  updateWorkoutTemplate(
    userId: string,
    id: string,
    patch: WorkoutTemplatePatch
  ): Promise<WorkoutTemplate | null>;
  deleteWorkoutTemplate(userId: string, id: string): Promise<WorkoutTemplate | null>;

  /* ---- season goals (spec 060) ---- */
  /**
   * Store a target. Throws `DuplicateGoalError` when `garminEventId` is already held by another of
   * this user's goals — the guard that makes importing a synced race idempotent however two requests
   * race, the same reason spec 050 put a partial unique index on `garminWorkoutId`.
   */
  createGoal(userId: string, input: NewSeasonGoal): Promise<SeasonGoal>;
  getGoal(userId: string, id: string): Promise<SeasonGoal | null>;
  /** Goals by day ascending — the order a season is read in. */
  listGoals(userId: string, query?: ListGoalsQuery): Promise<SeasonGoal[]>;
  /** Apply a patch; returns the updated row, or null when the id is not this user's. */
  updateGoal(userId: string, id: string, patch: SeasonGoalPatch): Promise<SeasonGoal | null>;
  /** Delete and return the removed row, or null when the id is not this user's. */
  deleteGoal(userId: string, id: string): Promise<SeasonGoal | null>;

  /* ---- weight ---- */
  putWeight(userId: string, points: WeightPoint[]): Promise<void>;
  getWeightRange(userId: string, start: string, end: string): Promise<WeightPoint[]>;

  /* ---- coverage ---- */
  coverage(userId: string): Promise<CoverageSnapshot>;

  /* ---- sync state ---- */
  getSyncState(userId: string, source: DataSource): Promise<SyncState | null>;
  setSyncState(userId: string, state: SyncState): Promise<void>;

  /* ---- sync runs (progress) ---- */
  startRun(input: {
    id: string;
    userId: string;
    kind: SyncRunKind;
    total: number;
    startedAt: string;
  }): Promise<void>;
  updateRun(
    id: string,
    patch: Partial<Pick<SyncRun, 'done' | 'total' | 'step' | 'status' | 'finishedAt' | 'error' | 'detail'>>
  ): Promise<void>;
  getRun(id: string): Promise<SyncRun | null>;
  getLatestRun(userId: string): Promise<SyncRun | null>;
  /**
   * Mark every still-`running` run as failed. Called once at startup: the sync only ever runs inside
   * this process, so a restart means none of them can still be live. Without this, a run killed
   * mid-flight (container restart, crash) stays `running` forever — showing a phantom progress bar
   * and blocking new syncs. Returns how many rows were healed.
   */
  failRunningRuns(reason: string, finishedAt: string): Promise<number>;
}
