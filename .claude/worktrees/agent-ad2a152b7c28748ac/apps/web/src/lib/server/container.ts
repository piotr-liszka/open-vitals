/**
 * Dependency container (ports & adapters). Built once at startup; handlers receive it via event.locals.
 * Tests build a container with mock adapters via `createTestContainer`.
 */
import type { Sql } from 'postgres';
import { DEFAULT_TIME_ZONE } from '$lib/date';
import { loadConfig, type Config } from './config';
import { systemClock, type Clock } from './clock';
import { createLogger, nullLogger, type Logger } from './logger';
import { systemRandom, type Random } from './random';
import { createSessionService } from './session';
import { createGarminHttpAdapter, type FetchLike } from './garmin/http-adapter';
import { createDevGarminMock } from './garmin/dev-mock';
import { createMemoryFeatureStore, createPgFeatureStore } from './features/store';
import { createFeatureService } from './features/service';
import { createDb } from './db';
import { createPgRepo } from './repo/pg';
import { createMemoryRepo } from './repo/memory';
import { createOidcAuthProvider } from './auth/oidc';
import { createMockAuthProvider } from './auth/mock';
import { createRateLimiter, type RateLimiter } from './rate-limit';
import { createPgStore } from './store/pg';
import { createMemoryStore } from './store/memory';
import { createLocalGarminService } from './store/local-garmin';
import { createSyncEngine, type SyncEngine } from './sync/engine';
import type { Scheduler } from './sync/scheduler';
import type { LocalStore } from './store/types';
import type { AuthProvider } from './auth/types';
import type { Repo } from './repo/types';
import type { FeatureService, FeatureStore } from './features/types';
import { autoWorkoutPushAllowed } from './features/registry';
import type { GarminService, GarminSyncSource, SessionService } from './interfaces';

/** Wrap a plain GarminService as a GarminSyncSource, stubbing bulk reads (test-injected sources). */
function asSyncSource(g: GarminService): GarminSyncSource {
  const maybe = g as Partial<GarminSyncSource>;
  return {
    ...g,
    listActivitiesPage: maybe.listActivitiesPage?.bind(g) ?? (async () => []),
    getActivityDetails: maybe.getActivityDetails?.bind(g) ?? (async (activityId: string) => ({ activityId })),
    getWeightRange: maybe.getWeightRange?.bind(g) ?? (async () => [])
  };
}

export interface AppContainer {
  readonly config: Config;
  readonly logger: Logger;
  readonly clock: Clock;
  readonly random: Random;
  /** Postgres client (null in tests, which use the in-memory repo). Owns the connection pool. */
  readonly db: Sql | null;
  readonly repo: Repo;
  readonly auth: AuthProvider;
  readonly session: SessionService;
  readonly featureStore: FeatureStore;
  /** Local synced-data store (spec 015): the source every read path uses instead of live Garmin. */
  readonly store: LocalStore;
  /** Sync engine (spec 015): pulls Garmin → local store. The only store writer. */
  readonly syncEngine: SyncEngine;
  /**
   * Slot holding the background sync scheduler once `hooks.server.ts` starts it (spec 027). A slot
   * rather than a field because the timer belongs to the process lifecycle, not to construction:
   * tests and dev (no db) leave it `null`, and the status API reports `autoSync: null` there.
   */
  readonly schedulerRef: { current: Scheduler | null };
  /** Rate limiter guarding Garmin credential submissions (keyed by user id). */
  readonly setupRateLimiter: RateLimiter;
  /** Manual "push this workout now" presses, per user (spec 083). */
  readonly workoutPushRateLimiter: RateLimiter;
  /**
   * READ-path GarminService scoped to one user (spec 015): metric reads resolve from the local store;
   * auth/status/disconnect delegate to the sidecar. This is what request handlers/MCP use.
   */
  garminFor(userId: string): GarminService;
  /**
   * SYNC-path source scoped to one user (spec 015): talks straight to the sidecar with the user's
   * `X-User-Id`, including bulk/backfill reads. Only the sync engine uses this — the sole store writer.
   */
  garminSyncFor(userId: string): GarminSyncSource;
  /**
   * Build a FeatureService scoped to one user — switch rows are keyed by their id. Used both by
   * request handlers (via `locals.features`) and by the background scheduler / sync engine, which
   * need a user's switches outside any request (spec 071).
   */
  featuresFor(userId: string): FeatureService;
}

export interface ContainerOverrides {
  config?: Config;
  logger?: Logger;
  clock?: Clock;
  random?: Random;
  db?: Sql | null;
  repo?: Repo;
  auth?: AuthProvider;
  /** Inject a fixed GarminService for ALL users (tests). Takes precedence over `garminFor`. */
  garmin?: GarminService;
  /** Inject a per-user GarminService factory (tests / isolation checks). */
  garminFor?: (userId: string) => GarminService;
  session?: SessionService;
  featureStore?: FeatureStore;
  /** Inject a per-user FeatureService factory (tests). */
  featuresFor?: (userId: string) => FeatureService;
  setupRateLimiter?: RateLimiter;
  workoutPushRateLimiter?: RateLimiter;
  /** Inject a LocalStore (tests use the in-memory fake). */
  store?: LocalStore;
  /** Inject the SYNC-path (raw sidecar) GarminService factory (sync-engine tests). */
  garminSyncFor?: (userId: string) => GarminService;
  fetch?: FetchLike;
}

/** Production container built from real config + adapters. */
export function createContainer(overrides: ContainerOverrides = {}): AppContainer {
  const config = overrides.config ?? loadConfig();
  const logger = overrides.logger ?? createLogger(config.isProd ? 'info' : 'debug');

  // The sidecar<->web shared secret is optional so an in-place upgrade does not fail to boot, but a
  // production deployment running without it has the guardrail switched off and should hear about it.
  if (config.isProd && config.garminAdapter === 'http' && !config.garminInternalKey) {
    logger.warn(
      'GARMIN_INTERNAL_KEY is not set: the sidecar accepts any X-User-Id from anything that can ' +
        'reach it. Set the same value as the sidecar INTERNAL_API_KEY in .env.'
    );
  }
  const clock = overrides.clock ?? systemClock;
  const random = overrides.random ?? systemRandom;
  const fetchImpl = overrides.fetch ?? (globalThis.fetch.bind(globalThis) as FetchLike);

  // Only open a real DB connection when no repo is injected (tests inject an in-memory repo).
  const db = overrides.db ?? (overrides.repo ? null : createDb(config.databaseUrl));
  const repo = overrides.repo ?? createPgRepo(db!, random);

  const auth =
    overrides.auth ??
    (config.authAdapter === 'mock'
      ? createMockAuthProvider()
      : createOidcAuthProvider({
          clientId: config.googleClientId,
          clientSecret: config.googleClientSecret,
          fetch: fetchImpl,
          clock
        }));

  // Local synced-data store (spec 015): pg in prod, in-memory fake when a repo is injected (tests).
  const store = overrides.store ?? (overrides.repo ? createMemoryStore() : createPgStore(db!));

  // SYNC path: the raw sidecar-backed service (the sole thing that fetches data from Garmin). A fixed
  // `garmin` override doubles as the sidecar source in tests. Each call carries the user's X-User-Id.
  const garminSyncFor: (userId: string) => GarminSyncSource = overrides.garminSyncFor
    ? (userId: string) => asSyncSource(overrides.garminSyncFor!(userId))
    : overrides.garmin
      ? () => asSyncSource(overrides.garmin!)
      : config.garminAdapter === 'mock'
        ? (userId: string) => createDevGarminMock(userId)
        : (userId: string) =>
            createGarminHttpAdapter({
              baseUrl: config.garminSidecarUrl,
              fetch: fetchImpl,
              logger,
              userId,
              internalKey: config.garminInternalKey
            });

  // READ path: metric reads resolve from the local store; auth/status/disconnect pass through to the
  // sidecar. A fixed `garmin`/`garminFor` override wins (tests inject their read service directly).
  const garminFor: (userId: string) => GarminService =
    overrides.garminFor ??
    (overrides.garmin
      ? () => overrides.garmin!
      : (userId: string) => createLocalGarminService({ store, sidecar: garminSyncFor(userId), userId }));

  // Per-user feature switches: one shared store (pg in prod, in-memory in tests) + a per-user view.
  // Built BEFORE the sync engine, which needs it to answer "may this user's workouts be pushed?".
  const featureStore = overrides.featureStore ?? createPgFeatureStore(db!, clock);
  const featuresFor: (userId: string) => FeatureService =
    overrides.featuresFor ?? ((userId: string) => createFeatureService({ store: featureStore, userId }));

  // Sync engine (spec 015): pulls each user's Garmin data through the sidecar into the local store.
  // `timeZone` matters: the engine resolves "today" with it, and a UTC "today" is yesterday for a
  // UTC+2 user until 02:00 local — which silently skipped the newest day of every sync (spec 018).
  const syncEngine = createSyncEngine({
    store,
    sourceFor: garminSyncFor,
    clock,
    logger,
    random,
    timeZone: config.appTimeZone,
    // Spec 050: the only phase that WRITES to Garmin. Spec 071 moved the decision from a deployment
    // env var to the user's own switch, so it is resolved per user, per run. Spec 083 split that
    // switch in two: `workout_write` is permission to write at all (the manual push needs it too),
    // `workout_auto_push` is whether the SYNC does it unasked. The phase needs both.
    workoutPushEnabledFor: (userId: string) => autoWorkoutPushAllowed(featuresFor(userId))
  });

  const session =
    overrides.session ??
    createSessionService({
      users: repo.users,
      sessions: repo.sessions,
      ttlSeconds: config.sessionTtlSeconds,
      clock
    });

  // Garmin credential submissions: at most 8 attempts per 5 minutes per user — enough for a fat-finger
  // + MFA retry, but throttles credential-stuffing and protects the user's real Garmin account.
  const setupRateLimiter =
    overrides.setupRateLimiter ??
    createRateLimiter({ limit: 8, windowMs: 5 * 60_000, now: () => clock.now().getTime() });

  // Manual workout pushes (spec 083): 20 per minute per user. Generous for a human pressing a button
  // on a busy planning session, and a ceiling on what one click-happy tab can aim at Garmin.
  const workoutPushRateLimiter =
    overrides.workoutPushRateLimiter ??
    createRateLimiter({ limit: 20, windowMs: 60_000, now: () => clock.now().getTime() });

  return {
    config,
    logger,
    clock,
    random,
    db,
    repo,
    auth,
    session,
    featureStore,
    store,
    syncEngine,
    schedulerRef: { current: null },
    setupRateLimiter,
    workoutPushRateLimiter,
    garminFor,
    garminSyncFor,
    featuresFor
  };
}

/**
 * Test container: sensible defaults (null logger, in-memory repo + mock auth). Callers pass mock
 * adapters via overrides. A minimal config is synthesized unless one is supplied. Never touches a
 * real Postgres or the network.
 */
export function createTestContainer(overrides: ContainerOverrides = {}): AppContainer {
  const config: Config =
    overrides.config ??
    ({
      nodeEnv: 'test',
      publicBaseUrl: 'http://localhost:3000',
      garminSidecarUrl: 'http://garmin:8081',
      garminInternalKey: '',
      garminAdapter: 'http',
      sessionTtlSeconds: 3600,
      appTimeZone: DEFAULT_TIME_ZONE,
      syncIntervalMinutes: 30,
      updateCheckRepo: 'owner/repo',
      updateCheckBranch: 'main',
      githubToken: '',
      databaseUrl: 'postgres://test/test',
      authAdapter: 'mock',
      googleClientId: '',
      googleClientSecret: '',
      isProd: false
    } satisfies Config);

  const clock = overrides.clock ?? systemClock;
  const random = overrides.random ?? systemRandom;
  return createContainer({
    ...overrides,
    config,
    clock,
    random,
    logger: overrides.logger ?? nullLogger,
    // Hermetic by default: in-memory adapters so tests never touch Postgres/network/filesystem.
    repo: overrides.repo ?? createMemoryRepo({ random }),
    auth: overrides.auth ?? createMockAuthProvider(),
    featureStore: overrides.featureStore ?? createMemoryFeatureStore()
  });
}
