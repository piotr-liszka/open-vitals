/**
 * Sync engine (spec 015, hardened spec 019). The ONLY writer of the local store. Pulls a user's
 * Garmin data through the sidecar (`GarminSyncSource`) and upserts it locally.
 *
 * Phase ORDER matters (spec 019): activities → streams → weight → planned → workoutPush → daily metrics.
 * Activities/streams/weight are what the maps, power and activity pages need and they are cheap to
 * fetch (paged), so they land FIRST and fast. Daily metrics are LAST and budgeted because each day is
 * a separate upstream fetch — an unbounded multi-year daily backfill against real Garmin is thousands
 * of sequential calls (slow + rate-limited), and running it first left activities empty when it stalled.
 *
 * DAILY-METRIC DEPTH (spec 019): history is walked backwards a bounded number of chunks PER RUN, and
 * the frontier reached is persisted in the sync cursor after every chunk. So a deep backfill is
 * resumable (a restart/cancel loses at most one chunk), cancellable, and it keeps deepening on the
 * nightly scheduled run until it reaches the same horizon as the activity history. Freshness (the
 * last `incrementalDays`) and depth (the frontier) are tracked as SEPARATE cursors — conflating them
 * is what pinned history at 365 days no matter how many times the sync ran.
 *
 * Every phase runs in isolation: a failure is recorded in the run's `detail` (per-phase counts +
 * a secret-free CLASSIFIED reason — rate limit vs expired token vs sidecar down) and the next phase
 * still runs, so one broken endpoint never blanks everything. Time comes from the injected Clock and
 * "today" is resolved in the app timezone (`$lib/date`), never UTC.
 */
import { addDays, daysBetween, maxDay, minDay, todayKey, DEFAULT_TIME_ZONE, type DayKey } from '$lib/date';
import type { Clock } from '../clock';
import type { Logger } from '../logger';
import type { Random } from '../random';
import {
  GARMIN_METRICS,
  GarminNotAuthenticatedError,
  garminFailureOf,
  type GarminFailure,
  type GarminMetricName,
  type GarminSyncSource
} from '../interfaces';
import {
  STREAMS_SCHEMA_VERSION,
  type ActivitySummary,
  type DataSource,
  type LocalStore,
  type SyncDetail,
  type SyncLogEntry,
  type SyncPhase,
  type SyncRun
} from '../store/types';
import { extractMetricValue } from '../garmin/metric-specs';
import { backfillBestEfforts } from './best-efforts';
import { normalizeActivity, streamsFromDetails } from './normalize';

/**
 * Which activities are worth a stream fetch (one upstream call each). GPS or power was too narrow —
 * it excluded indoor runs and every HR-only session, which is most of a runner's history — so any
 * activity with a heart rate now qualifies too. Everything else (a manual weigh-in-style entry with
 * no sensor data at all) still costs nothing.
 */
function wantsStreams(a: ActivitySummary): boolean {
  return a.hasGps || a.avgPower != null || a.avgHr != null || a.maxHr != null;
}

const DAILY_METRICS: GarminMetricName[] = GARMIN_METRICS.filter(
  (m) => m !== 'activities' && m !== 'body_composition'
);

const CHUNK_DAYS = 31; // sidecar range cap
/**
 * How many consecutive all-empty 31-day chunks end the backwards walk. The old value of 2 (~2 months)
 * also ended it across any genuine gap in wearing the watch — an injury, a holiday, a dead battery —
 * silently truncating years of history behind it. A full year of nothing is a real end-of-history.
 */
const EMPTY_CHUNK_STOP = 12;
const ACTIVITY_PAGE = 100;
const MAX_ACTIVITY_PAGES = 200; // full-history activity guard (~20k activities)
const WEIGHT_CHUNK_DAYS = 366;
/**
 * Absolute floor for the daily-metric walk. Nothing is ever fetched older than this, whatever the
 * activity history says — a guard, not a target.
 */
const METRICS_FLOOR_DAYS = 365 * 12;
/** Used as the backfill target when the user has no activities yet to derive a horizon from. */
const METRICS_DEFAULT_TARGET_DAYS = 365;
/** Lead-in pulled BEFORE the first activity, so the baseline around it is not a cliff edge. */
const METRICS_PRE_ACTIVITY_DAYS = 90;
/**
 * Chunks of backfill attempted per run (each ≈ 31 days × 9 metrics of upstream work). Deliberately
 * modest: a deep backfill is spread over successive runs — including the nightly scheduled one —
 * rather than hammering Garmin for an hour in one go.
 */
const BACKFILL_CHUNKS_FULL = 8;
const BACKFILL_CHUNKS_INCREMENTAL = 6;
/** Weight is one upstream call per ~year, so its full backfill can safely go deep. */
const WEIGHT_BACKFILL_DAYS = 365 * 8;
/** Hard cap on the freshness window, however long the app was down (see `freshStart`). */
const MAX_FRESH_DAYS = 366;
/** Forward window of planned workouts kept in the store (the start page shows the next 7). */
const PLANNED_AHEAD_DAYS = 28;
const PLANNED_BEHIND_DAYS = 1;

/**
 * How many authored workouts one run pushes (spec 050). Each is 2 upstream WRITES, so the batch is
 * kept small: a backlog drains over consecutive ticks instead of hammering Garmin in one burst.
 */
const WORKOUT_PUSH_PER_RUN = 20;

/**
 * Activities whose best efforts (spec 054) one run derives. LOCAL work — a stream read plus a small
 * write each, no upstream call — but a stream blob is large, so a career is drained over successive
 * ticks rather than loaded in one pass on a constrained host.
 */
const EFFORTS_PER_RUN_FULL = 200;
const EFFORTS_PER_RUN_INCREMENTAL = 60;
/**
 * Budget for the pass that runs when the change probe found NOTHING new. Without it a quiet account
 * would fast-return on every tick and never finish its backfill; kept small because this path is
 * meant to cost almost nothing.
 */
const EFFORTS_PER_UNCHANGED_TICK = 40;

export interface SyncOptions {
  kind: 'full' | 'incremental';
  /**
   * Oldest day the daily-metric walk may reach, as days before today, and a HARD stop when given.
   * Left out (the default), the walk runs until the data runs out — the reported target is the
   * user's own activity horizon (first activity − 90 days) but it is free to go deeper, down to
   * `METRICS_FLOOR_DAYS`.
   */
  metricsBackfillDays?: number;
  /** Backfill chunks attempted this run. Default 8 (full) / 6 (incremental). */
  backfillChunksPerRun?: number;
  /** Start the backwards walk over, ignoring the stored frontier (deliberate re-pull). */
  resetBackfill?: boolean;
  /** Weight backfill window for a full sync (days). Default ~8y (cheap). */
  weightBackfillDays?: number;
  /** Max activity-stream fetches per run (each is one upstream call). */
  streamsPerRun?: number;
  /** Max activities whose best efforts are derived per run (local work). Default 200 full / 60 incr. */
  effortsPerRun?: number;
  /** Recent days re-pulled for daily metrics on every run (the freshness window). */
  incrementalDays?: number;
  /** Called with the run id as soon as the run row exists (so callers can return early). */
  onStart?: (runId: string) => void;
}

export interface SyncEngine {
  syncUser(userId: string, opts: SyncOptions): Promise<SyncRun>;
  /**
   * Scheduled entry point (spec 027): probe first, sync only when something upstream actually moved.
   * Returns the run, or `null` when the probe matched the stored signature and the tick fast-returned.
   */
  syncIfChanged(userId: string, opts: SyncOptions): Promise<SyncRun | null>;
}

/** How many of the newest activities the change probe looks at (one upstream call). */
const PROBE_ACTIVITIES = 10;

export interface SyncEngineDeps {
  store: LocalStore;
  sourceFor: (userId: string) => GarminSyncSource;
  clock: Clock;
  logger: Logger;
  random: Random;
  /** IANA zone "today" is resolved in. Defaults to the app timezone (spec 018) — never UTC. */
  timeZone?: string;
  /**
   * Whether the authored-workout push phase may run (spec 050, `GARMIN_WORKOUT_PUSH`). Defaults to
   * FALSE: the Garmin workout endpoints are unverified, and this is the only phase that writes to the
   * user's account, so it is opt-in per deployment rather than on by default.
   */
  workoutPushEnabled?: boolean;
}

/** Thrown to abort the whole run when the account is not connected (distinct from a phase failure). */
class NotConnected extends Error {
  constructor(readonly failure: GarminFailure) {
    super('garmin not connected');
  }
}

/** Thrown when the user cancelled the run from the UI (checked cooperatively at phase boundaries). */
class Cancelled extends Error {}

/**
 * Polish, human-readable wording for each failure classification. This is the difference between
 * "… nie powiodło się (GarminUnavailableError)" and a line the user can actually act on.
 */
const FAILURE_TEXT: Record<GarminFailure['code'], string> = {
  timeout: 'Garmin nie odpowiedział na czas',
  sidecar_unreachable: 'usługa Garmin (sidecar) nie odpowiada',
  rate_limited: 'Garmin ogranicza tempo zapytań',
  token_rejected: 'Garmin odrzucił token — połącz konto ponownie',
  not_connected: 'konto Garmin nie jest połączone',
  blocked: 'Garmin zablokował połączenie',
  not_found: 'endpoint Garmina nie istnieje',
  bad_response: 'nieoczekiwana odpowiedź usługi',
  internal_key_rejected: 'błąd konfiguracji: web i sidecar mają różne INTERNAL_API_KEY',
  upstream_error: 'błąd po stronie Garmina'
};

/** A classified phase failure: short Polish text for humans + the code/retryability for filtering. */
interface PhaseFailure {
  text: string;
  code: GarminFailure['code'];
  retryable: boolean;
  endpoint?: string;
}

/**
 * Classify an error for the run log. Cancellation and "not connected" abort the whole run (rethrown);
 * everything else is recorded per phase so later phases still run.
 */
function phaseFailure(err: unknown): PhaseFailure {
  if (err instanceof Cancelled) throw err;
  // Already-classified aborts pass straight through: re-classifying a NotConnected as a generic
  // upstream error would swallow the abort and let the run limp on against a dead token.
  if (err instanceof NotConnected) throw err;
  const failure = garminFailureOf(err);
  if (err instanceof GarminNotAuthenticatedError) throw new NotConnected(failure);
  const text = FAILURE_TEXT[failure.code] ?? 'błąd';
  return {
    text: failure.upstreamStatus ? `${text} (HTTP ${failure.upstreamStatus})` : text,
    code: failure.code,
    retryable: failure.retryable,
    ...(failure.endpoint ? { endpoint: failure.endpoint } : {})
  };
}

export function createSyncEngine(deps: SyncEngineDeps): SyncEngine {
  const { store, sourceFor, clock, logger, random } = deps;
  const timeZone = deps.timeZone ?? DEFAULT_TIME_ZONE;
  const workoutPushEnabled = deps.workoutPushEnabled ?? false;

  async function syncUser(userId: string, opts: SyncOptions): Promise<SyncRun> {
    const source = sourceFor(userId);
    const kind = opts.kind;
    const streamsBudget = opts.streamsPerRun ?? (kind === 'full' ? 400 : 80);
    const effortsBudget =
      opts.effortsPerRun ?? (kind === 'full' ? EFFORTS_PER_RUN_FULL : EFFORTS_PER_RUN_INCREMENTAL);
    const weightBackfillDays = opts.weightBackfillDays ?? WEIGHT_BACKFILL_DAYS;
    const incrementalDays = opts.incrementalDays ?? 10;
    const backfillChunks =
      opts.backfillChunksPerRun ?? (kind === 'full' ? BACKFILL_CHUNKS_FULL : BACKFILL_CHUNKS_INCREMENTAL);

    // "Today" in the app's zone, not UTC: for a UTC+2 user a UTC "today" is still yesterday until
    // 02:00 local, which silently skipped a day at the head of every sync.
    const today = todayKey(clock, timeZone);
    const runId = random.token(12);
    const startedAt = clock.now().toISOString();

    let connected = false;
    try {
      connected = (await source.getStatus()).authenticated;
    } catch {
      connected = false;
    }
    if (!connected) {
      await store.startRun({ id: runId, userId, kind, total: 0, startedAt });
      opts.onStart?.(runId);
      await store.updateRun(runId, {
        status: 'failed',
        error: 'garmin_not_connected',
        finishedAt: clock.now().toISOString()
      });
      return (await store.getRun(runId))!;
    }

    const prior = await store.getSyncState(userId, 'garmin');
    /**
     * Freshness window: always re-pulled, both kinds. It reaches back to `incrementalDays` before the
     * LAST run, not just before today — otherwise a fortnight of downtime would leave a permanent
     * hole, since the backwards walk only ever covers days OLDER than the frontier. Capped so a
     * year-long outage cannot turn one run into an unbounded re-pull.
     */
    const priorFrom =
      typeof prior?.cursor?.metricsFrom === 'string' ? String(prior.cursor.metricsFrom) : today;
    const freshStart = maxDay(
      addDays(today, -MAX_FRESH_DAYS),
      minDay(addDays(today, -incrementalDays), addDays(priorFrom, -incrementalDays))
    );
    /** Downtime longer than the freshness cap ⇒ re-walk from the window start so nothing is skipped. */
    const outageOverran = daysBetween(priorFrom, today) > MAX_FRESH_DAYS;
    const freshChunks = Math.max(1, Math.ceil((daysBetween(freshStart, today) + 1) / CHUNK_DAYS));
    const estChunks = freshChunks + backfillChunks;

    const estTotal = MAX_ACTIVITY_PAGES / 8 + streamsBudget + 4 + DAILY_METRICS.length * estChunks;
    await store.startRun({ id: runId, userId, kind, total: Math.round(estTotal), startedAt });
    opts.onStart?.(runId);

    const detail: SyncDetail = {};
    // Live diagnostic log (structural only — never payloads/PII). Capped so the jsonb stays small.
    const LOG_CAP = 250;
    const logEntries: SyncLogEntry[] = [];
    const log = (
      level: SyncLogEntry['level'],
      msg: string,
      extra: Omit<SyncLogEntry, 't' | 'level' | 'msg'> = {}
    ): void => {
      logEntries.push({ t: clock.now().toISOString(), level, msg, ...extra });
      if (logEntries.length > LOG_CAP) logEntries.splice(0, logEntries.length - LOG_CAP);
      detail.log = logEntries;
    };
    /** Log a classified failure with everything the /dane filter needs to sort it. */
    const logFailure = (
      phase: SyncPhase,
      what: string,
      f: PhaseFailure,
      extra: Omit<SyncLogEntry, 't' | 'level' | 'msg'> = {}
    ): void => {
      log('error', `${what}: ${f.text}.`, {
        phase,
        code: f.code,
        retryable: f.retryable,
        ...(f.endpoint ? { endpoint: f.endpoint } : {}),
        ...extra
      });
    };
    let done = 0;
    let lastPersisted = 0;
    // Cooperative cancellation: the UI flips the run's status to `cancelled`; we notice at the next
    // progress write and unwind. Checked on persisted writes only, so it costs no extra queries.
    const bump = async (step: string, by = 1): Promise<void> => {
      done += by;
      if (done - lastPersisted >= 20) {
        lastPersisted = done;
        await store.updateRun(runId, { done, step, detail });
        if ((await store.getRun(runId))?.status === 'cancelled') throw new Cancelled();
      }
    };
    const savePhase = async (step: string): Promise<void> => {
      await store.updateRun(runId, { done, step, detail });
      if ((await store.getRun(runId))?.status === 'cancelled') throw new Cancelled();
    };

    log('info', `Start synchronizacji (${kind}). Świeże dane od ${freshStart}.`, { phase: 'start' });

    try {
      /* ---- 1. activities (paged newest-first; the map/power/activity pages depend on these) ---- */
      try {
        const knownIds = new Set<string>();
        if (kind === 'incremental') {
          for (const a of await store.listActivities(userId, { limit: 400 })) knownIds.add(a.activityId);
        }
        let count = 0;
        let pages = 0;
        log('info', 'Aktywności: pobieranie listy…', { phase: 'activities' });
        for (let page = 0; page < MAX_ACTIVITY_PAGES; page++) {
          const raw = await source.listActivitiesPage(ACTIVITY_PAGE, page * ACTIVITY_PAGE);
          pages++;
          if (raw.length === 0) {
            log('info', `Aktywności: strona ${page + 1} pusta — koniec listy.`, { phase: 'activities' });
            break;
          }
          const normalized = raw
            .map((r) => normalizeActivity(userId, r))
            .filter((a): a is NonNullable<typeof a> => a !== null);
          await store.putActivities(userId, normalized);
          count += normalized.length;
          log(
            'info',
            `Aktywności: strona ${page + 1} — ${raw.length} z API, ${normalized.length} zapisanych.`,
            { phase: 'activities' }
          );
          // Diagnostic: if the API returned rows but none normalized, the field shape differs from
          // what we expect. Log the top-level KEYS (not values) so the mismatch is visible.
          if (raw.length > 0 && normalized.length === 0) {
            const first = raw[0];
            const keys =
              first && typeof first === 'object'
                ? Object.keys(first as Record<string, unknown>)
                    .slice(0, 20)
                    .join(', ')
                : typeof first;
            log(
              'warn',
              `Aktywności: 0 znormalizowanych z ${raw.length}. Klucze pierwszego rekordu: ${keys}`,
              { phase: 'activities' }
            );
          }
          await bump(`activities p${page + 1}`);
          if (
            kind === 'incremental' &&
            normalized.length > 0 &&
            normalized.every((a) => knownIds.has(a.activityId))
          )
            break;
          if (raw.length < ACTIVITY_PAGE) break;
        }
        detail.activities = { pages, count };
        log(count > 0 ? 'info' : 'warn', `Aktywności: gotowe — ${count} zapisanych (${pages} stron).`, {
          phase: 'activities'
        });
      } catch (err) {
        const f = phaseFailure(err);
        detail.activities = {
          pages: detail.activities?.pages ?? 0,
          count: detail.activities?.count ?? 0,
          error: f.text,
          errorCode: f.code,
          retryable: f.retryable
        };
        logFailure('activities', 'Aktywności', f);
      }
      await savePhase('activities');

      /* ---- 2. streams (GPS/HR/power/running dynamics) for activities that need them ---- */
      try {
        let budget = streamsBudget;
        let fetched = 0;
        let repaired = 0;
        const candidates = (await store.listActivities(userId, { limit: 5000 })).filter(wantsStreams);
        // ONE query for every stored row's schema version — never load the blobs just to decide.
        const versions = await store.listStreamVersions(userId);
        const missing = candidates.filter((a) => !versions.has(a.activityId));
        const stale = candidates.filter(
          (a) => (versions.get(a.activityId) ?? 0) < STREAMS_SCHEMA_VERSION && versions.has(a.activityId)
        );
        log(
          'info',
          `Trasy/strumienie: ${missing.length} brakujących, ${stale.length} do odświeżenia (limit pobrań ${streamsBudget}).`,
          { phase: 'streams' }
        );
        // New activities first, repairs with whatever budget is left: a stale row still renders,
        // a missing one does not. The repair backlog therefore drains over successive runs.
        for (const a of [...missing, ...stale]) {
          if (budget <= 0) break;
          const isRepair = versions.has(a.activityId);
          const d = await source.getActivityDetails(a.activityId);
          await store.putStreams(userId, a.activityId, streamsFromDetails(d));
          if (d.gps && d.gps.length > 0 && !a.hasGps)
            await store.putActivities(userId, [{ ...a, hasGps: true }]);
          budget--;
          if (isRepair) repaired++;
          else fetched++;
          await bump(`streams ${a.activityId}`);
        }
        detail.streams = {
          fetched,
          repaired,
          pending: Math.max(0, missing.length + stale.length - fetched - repaired)
        };
        log('info', `Trasy/strumienie: pobrano ${fetched} nowych, odświeżono ${repaired}.`, {
          phase: 'streams'
        });
      } catch (err) {
        const f = phaseFailure(err);
        detail.streams = {
          fetched: detail.streams?.fetched ?? 0,
          error: f.text,
          errorCode: f.code,
          retryable: f.retryable
        };
        logFailure('streams', 'Trasy/strumienie', f);
      }

      /*
       * Best efforts (spec 054) ride along in the streams phase: they are derived FROM the streams
       * above and cost no upstream call, so giving them their own phase would only add a /dane filter
       * for the same work. Its OWN try/catch, though — this is local store work, and classifying a
       * database hiccup as an upstream Garmin failure would misreport why the phase went wrong.
       * Bounded per run and resumable: leftovers are reported, and the next tick picks them up.
       */
      try {
        const efforts = await backfillBestEfforts(store, userId, effortsBudget);
        detail.streams = {
          ...(detail.streams ?? { fetched: 0 }),
          efforts: efforts.computed,
          effortsPending: efforts.pending
        };
        await bump('best efforts', efforts.computed);
        log(
          'info',
          `Najlepsze odcinki: policzono dla ${efforts.computed} aktywności` +
            (efforts.pending > 0 ? `, zostało ${efforts.pending}.` : '.'),
          { phase: 'streams' }
        );
      } catch (err) {
        if (err instanceof Cancelled) throw err;
        log('warn', 'Najlepsze odcinki: nie udało się przeliczyć w tym przebiegu.', {
          phase: 'streams'
        });
        logger.warn('best-efforts derivation failed', { userId });
      }
      await savePhase('streams');

      /* ---- 3. weigh-ins (cheap: one upstream call per chunk) ---- */
      try {
        const weightStart =
          kind === 'incremental' ? addDays(today, -90) : addDays(today, -weightBackfillDays);
        let points = 0;
        let wEnd = today;
        while (daysBetween(weightStart, wEnd) >= 0) {
          const wStart = maxDay(weightStart, addDays(wEnd, -(WEIGHT_CHUNK_DAYS - 1)));
          const pts = await source.getWeightRange(wStart, wEnd);
          if (pts.length > 0) {
            await store.putWeight(
              userId,
              pts.map((p) => ({
                day: p.day,
                weightKg: p.weightKg,
                source: 'garmin' as DataSource,
                raw: p.raw
              }))
            );
            points += pts.length;
          }
          await bump(`weight ${wStart}`);
          wEnd = addDays(wStart, -1);
        }
        detail.weight = { points };
        log('info', `Waga: ${points} pomiarów.`, { phase: 'weight' });
      } catch (err) {
        const f = phaseFailure(err);
        detail.weight = {
          points: detail.weight?.points ?? 0,
          error: f.text,
          errorCode: f.code,
          retryable: f.retryable
        };
        logFailure('weight', 'Waga', f);
      }
      await savePhase('weight');

      /* ---- 4. planned workouts (cheap: one upstream call per calendar month) ---- */
      if (source.getPlannedEvents) {
        try {
          const from = addDays(today, -PLANNED_BEHIND_DAYS);
          const to = addDays(today, PLANNED_AHEAD_DAYS);
          const feed = await source.getPlannedEvents(from, to);
          if (feed.available) {
            // Replace the whole window: a plan the user DELETED in Garmin must disappear here too,
            // which an upsert-only write would never do.
            await store.replacePlannedEvents(
              userId,
              from,
              to,
              feed.events.map((e) => ({ ...e, source: 'garmin' as DataSource }))
            );
          }
          detail.planned = { available: feed.available, count: feed.events.length, from, to };
          log(
            'info',
            feed.available
              ? `Plan treningowy: ${feed.events.length} zaplanowanych pozycji (${from}..${to}).`
              : 'Plan treningowy: Garmin nie udostępnił kalendarza dla tego konta.',
            { phase: 'planned' }
          );
        } catch (err) {
          const f = phaseFailure(err);
          detail.planned = {
            available: false,
            count: 0,
            error: f.text,
            errorCode: f.code,
            retryable: f.retryable
          };
          logFailure('planned', 'Plan treningowy', f);
        }
        await savePhase('planned');
      }

      /* ---- 5. push AUTHORED workouts to Garmin (spec 050) ----
       * The only phase that WRITES upstream, and the only one whose source of truth is local: rows the
       * athlete composed here are projected onto Garmin, never the other way round. Ordered after the
       * calendar read so a freshly pushed session is not immediately re-read as a duplicate plan, and
       * gated twice — by the flag (the endpoints are unverified) and by the source's ability to write.
       */
      if (workoutPushEnabled && source.createWorkout && source.scheduleWorkout) {
        try {
          const nowIso = clock.now().toISOString();
          // Only today onwards: pushing a session for a day that has passed would put a workout on the
          // calendar the athlete can no longer do.
          const candidates = (await store.listWorkouts(userId, { from: today })).filter(
            (w) => w.pushState === 'pending' || w.pushState === 'failed'
          );
          const batch = candidates.slice(0, WORKOUT_PUSH_PER_RUN);
          let pushed = 0;
          let failed = 0;
          let unsupported = 0;
          let stopped: PhaseFailure | null = null;

          for (const w of batch) {
            try {
              // Idempotency: a row that already has a Garmin id is NEVER created again — only its
              // missing schedule is filled in. Without this, a retry after a partial push would leave
              // two copies of the session in the athlete's library.
              let garminWorkoutId = w.garminWorkoutId;
              if (!garminWorkoutId) {
                const created = await source.createWorkout({
                  sport: w.sport,
                  title: w.title,
                  steps: w.steps
                });
                if (!created.supported || !created.workoutId) {
                  await store.updateWorkout(userId, w.id, {
                    pushState: 'unsupported',
                    pushError:
                      created.reason === 'unsupported_sport'
                        ? 'Garmin nie zna tej dyscypliny jako treningu'
                        : 'Garmin nie udostępnia zapisu treningów dla tego konta',
                    updatedAt: nowIso
                  });
                  unsupported += 1;
                  continue;
                }
                garminWorkoutId = created.workoutId;
                // Persisted BEFORE scheduling: if scheduling throws, the id is not lost and the retry
                // skips straight to the schedule step.
                await store.updateWorkout(userId, w.id, { garminWorkoutId, updatedAt: nowIso });
              }

              const scheduled = await source.scheduleWorkout(garminWorkoutId, w.day);
              if (!scheduled.supported) {
                // In the library but not on the calendar — a half-push, reported as such.
                await store.updateWorkout(userId, w.id, {
                  pushState: 'failed',
                  pushError: 'trening zapisany, ale nie trafił do kalendarza',
                  updatedAt: nowIso
                });
                failed += 1;
                continue;
              }
              await store.updateWorkout(userId, w.id, {
                pushState: 'pushed',
                pushError: null,
                garminScheduleId: scheduled.scheduleId,
                updatedAt: nowIso
              });
              pushed += 1;
            } catch (err) {
              // Per-row, so one rejected payload cannot block the rest of the batch. A retryable
              // failure stays `failed` (next tick tries again); a permanent one is parked as
              // `unsupported` rather than retried forever.
              const f = phaseFailure(err);
              await store.updateWorkout(userId, w.id, {
                pushState: f.retryable ? 'failed' : 'unsupported',
                pushError: f.text,
                updatedAt: nowIso
              });
              if (f.retryable) failed += 1;
              else unsupported += 1;
              // Nothing will get through while the sidecar is down or Garmin is throttling — stop the
              // phase instead of burning the whole batch against it.
              if (f.code === 'sidecar_unreachable' || f.code === 'timeout' || f.code === 'rate_limited') {
                stopped = f;
                break;
              }
            }
            await bump(`workoutPush ${w.day}`);
          }

          const stillPending = (await store.listWorkouts(userId, { from: today })).filter(
            (w) => w.pushState === 'pending' || w.pushState === 'failed'
          ).length;
          detail.workoutPush = {
            pushed,
            failed,
            unsupported,
            pending: stillPending,
            ...(stopped ? { error: stopped.text, errorCode: stopped.code, retryable: stopped.retryable } : {})
          };
          // Counts only — a workout's title, note and targets are the athlete's content (AGENTS.md §10).
          log(
            stopped ? 'error' : 'info',
            `Wysyłka treningów: ${pushed} wysłanych, ${failed} nieudanych, ${unsupported} niewspieranych, ${stillPending} w kolejce.`,
            { phase: 'workoutPush', ...(stopped ? { code: stopped.code, retryable: stopped.retryable } : {}) }
          );
        } catch (err) {
          const f = phaseFailure(err);
          detail.workoutPush = {
            pushed: detail.workoutPush?.pushed ?? 0,
            failed: detail.workoutPush?.failed ?? 0,
            unsupported: detail.workoutPush?.unsupported ?? 0,
            pending: detail.workoutPush?.pending ?? 0,
            error: f.text,
            errorCode: f.code,
            retryable: f.retryable
          };
          logFailure('workoutPush', 'Wysyłka treningów', f);
        }
        await savePhase('workoutPush');
      }

      /* ---- 6. daily metrics: freshness window + a budgeted slice of the backwards walk ---- */
      // Depth target: the same horizon as the activity history (the user's explicit decision), with a
      // month of lead-in, clamped by the absolute floor. No activities yet ⇒ a plain 365-day window.
      const coverage = await store.coverage(userId);
      const firstActivityDay = coverage.activities.firstStart
        ? coverage.activities.firstStart.slice(0, 10)
        : null;
      const floorDay = addDays(today, -METRICS_FLOOR_DAYS);
      const requestedTarget =
        opts.metricsBackfillDays != null ? maxDay(floorDay, addDays(today, -opts.metricsBackfillDays)) : null;
      /**
       * The day the walk may not pass. Only an EXPLICIT request narrows it — by default it is the
       * hard floor, so history ends where the DATA ends (an empty streak), never where a guess about
       * how deep the user's history "should" be put it.
       */
      const hardStopDay: DayKey = requestedTarget ?? floorDay;
      /** Reported goal, used for "zostało ~N dni". Walking past it is allowed and expected. */
      const backfillTarget: DayKey = maxDay(
        hardStopDay,
        requestedTarget ??
          (firstActivityDay
            ? addDays(firstActivityDay, -METRICS_PRE_ACTIVITY_DAYS)
            : addDays(today, -METRICS_DEFAULT_TARGET_DAYS))
      );

      const priorFrontier =
        typeof prior?.cursor?.metricsBackfilledTo === 'string'
          ? String(prior.cursor.metricsBackfilledTo)
          : null;
      const priorComplete =
        prior?.cursor?.metricsComplete === true && priorFrontier != null && priorFrontier <= backfillTarget;
      // Frontier = the oldest day already walked. Resuming from it is what makes a deep backfill
      // survive a restart, a cancel, or simply being spread over several nights.
      let frontier: DayKey =
        opts.resetBackfill || outageOverran || !priorFrontier
          ? freshStart
          : minDay(priorFrontier, freshStart);
      let complete = opts.resetBackfill || outageOverran ? false : priorComplete;

      log(
        'info',
        `Metryki dzienne: świeże ${freshStart}..${today}; historia do ${backfillTarget}` +
          (complete ? ' (kompletna).' : `, uzupełniono do ${frontier}.`),
        { phase: 'metrics' }
      );

      /** Persist the depth cursor immediately, so nothing already fetched is ever re-walked. */
      const saveFrontier = async (): Promise<void> => {
        await store.setSyncState(userId, {
          source: 'garmin',
          // Spread the prior cursor: it also carries keys this phase knows nothing about (the
          // spec-027 probe signature), and replacing the whole object would silently drop them.
          cursor: {
            ...(prior?.cursor ?? {}),
            metricsFrom: today,
            metricsBackfilledTo: frontier,
            metricsComplete: complete,
            metricsTarget: backfillTarget
          },
          lastFullSyncAt: prior?.lastFullSyncAt ?? null,
          lastSyncAt: clock.now().toISOString()
        });
      };

      try {
        let chunks = 0;
        let daysWithData = 0;
        let emptyStreak = 0;
        // Held in an object: these are mutated inside `pullChunk`, and a plain `let` would be
        // narrowed back to its initial type by the compiler at the read sites below.
        const failed: { count: number; last: PhaseFailure | null } = { count: 0, last: null };

        /** Fetch every daily metric for one inclusive chunk. Returns true when anything had data. */
        const pullChunk = async (chunkStart: DayKey, chunkEnd: DayKey): Promise<boolean> => {
          let hadData = false;
          for (const metric of DAILY_METRICS) {
            try {
              const range = await source.getMetricRange(metric, chunkStart, chunkEnd);
              const days = range.days.map((d) => ({ day: d.date, data: d.data }));
              await store.putMetricDays(userId, metric, days);
              const present = days.filter((d) => d.data != null).length;
              if (present > 0) {
                hadData = true;
                daysWithData += present;
              }
            } catch (callErr) {
              // One failed/timed-out day-range must not abort the whole phase (spec 019) — record and
              // move on, with the CLASSIFIED reason so /dane can tell a rate limit from a dead token.
              const f = phaseFailure(callErr);
              failed.count++;
              failed.last = f;
              if (failed.count <= 8) {
                log('warn', `Metryki: ${metric} ${chunkStart}..${chunkEnd} — ${f.text}.`, {
                  phase: 'metrics',
                  metric,
                  day: chunkStart,
                  code: f.code,
                  retryable: f.retryable
                });
              }
            }
            await bump(`${metric} ${chunkStart}`);
          }
          chunks++;
          return hadData;
        };

        // (a) freshness window — always, both kinds. Chunked, because after a long outage it spans
        // more than the sidecar's 31-day range cap.
        let freshEnd = today;
        while (daysBetween(freshStart, freshEnd) >= 0) {
          const chunkStart = maxDay(freshStart, addDays(freshEnd, -(CHUNK_DAYS - 1)));
          await pullChunk(chunkStart, freshEnd);
          freshEnd = addDays(chunkStart, -1);
        }
        log('info', `Metryki: świeże ${freshStart}..${today} — ${daysWithData} dni z danymi.`, {
          phase: 'metrics',
          day: freshStart
        });

        // (b) backfill — a bounded number of chunks per run, walking backwards from the frontier.
        let cursorDay = addDays(frontier, -1);
        let budget = backfillChunks;
        while (!complete && budget > 0 && daysBetween(hardStopDay, cursorDay) >= 0) {
          // The chunk is clamped to the HARD STOP, not to the reported target: history that keeps
          // producing data keeps being pulled. Stopping at a guessed horizon is exactly the silent
          // truncation this spec fixes.
          const chunkStart = maxDay(hardStopDay, addDays(cursorDay, -(CHUNK_DAYS - 1)));
          const hadData = await pullChunk(chunkStart, cursorDay);
          frontier = chunkStart;
          cursorDay = addDays(chunkStart, -1);
          budget--;
          emptyStreak = hadData ? 0 : emptyStreak + 1;
          if (daysBetween(hardStopDay, cursorDay) < 0) complete = true;
          if (emptyStreak >= EMPTY_CHUNK_STOP) {
            complete = true;
            log('info', `Metryki: ${EMPTY_CHUNK_STOP} kolejnych bloków bez danych — historia wyczerpana.`, {
              phase: 'metrics'
            });
          }
          // Persist after EVERY chunk: a cancel or a restart then costs at most one chunk of work.
          await saveFrontier();
          log('info', `Metryki: uzupełniono wstecz do ${frontier}.`, { phase: 'metrics', day: frontier });
        }

        const remainingDays = complete ? 0 : Math.max(0, daysBetween(backfillTarget, frontier));
        detail.metrics = {
          chunks,
          days: daysWithData,
          windowStart: frontier,
          backfillTo: frontier,
          backfillTarget,
          remainingDays,
          complete,
          ...(failed.count > 0
            ? {
                error: `${failed.count} zapytań nie powiodło się: ${failed.last?.text ?? 'błąd'}`,
                ...(failed.last ? { errorCode: failed.last.code, retryable: failed.last.retryable } : {})
              }
            : {})
        };
        log(
          'info',
          `Metryki dzienne: gotowe — ${daysWithData} dni, ${chunks} bloków${failed.count ? `, ${failed.count} błędów` : ''}. ` +
            (complete ? 'Historia kompletna.' : `Uzupełniono do ${frontier}, zostało ~${remainingDays} dni.`),
          { phase: 'metrics' }
        );
      } catch (err) {
        const f = phaseFailure(err);
        detail.metrics = {
          chunks: detail.metrics?.chunks ?? 0,
          days: detail.metrics?.days ?? 0,
          windowStart: frontier,
          backfillTo: frontier,
          backfillTarget,
          remainingDays: Math.max(0, daysBetween(backfillTarget, frontier)),
          complete,
          error: f.text,
          errorCode: f.code,
          retryable: f.retryable
        };
        logFailure('metrics', 'Metryki dzienne', f);
      }

      /* ---- persist cursor + finish ---- */
      const finishedAt = clock.now().toISOString();
      await store.setSyncState(userId, {
        source: 'garmin',
        cursor: {
          ...(prior?.cursor ?? {}),
          metricsFrom: today,
          metricsBackfilledTo: frontier,
          metricsComplete: complete,
          metricsTarget: backfillTarget
        },
        lastFullSyncAt: kind === 'full' ? finishedAt : (prior?.lastFullSyncAt ?? null),
        lastSyncAt: finishedAt
      });
      // A run is "failed" only when nothing landed anywhere; otherwise it succeeded with per-phase detail.
      const anyData =
        (detail.activities?.count ?? 0) > 0 ||
        (detail.metrics?.days ?? 0) > 0 ||
        (detail.weight?.points ?? 0) > 0 ||
        (detail.streams?.fetched ?? 0) > 0;
      log(
        anyData ? 'info' : 'error',
        anyData ? 'Synchronizacja zakończona.' : 'Synchronizacja zakończona — brak danych.'
      );
      await store.updateRun(runId, {
        done,
        total: done,
        status: anyData ? 'succeeded' : 'failed',
        step: 'done',
        finishedAt,
        detail,
        ...(anyData ? {} : { error: 'no_data_synced' })
      });
      logger.info?.('sync finished', { userId, kind, ...flatCounts(detail) });
    } catch (err) {
      const finishedAt = clock.now().toISOString();
      if (err instanceof Cancelled) {
        // Whatever the phases already wrote stays in the store — cancelling is not a rollback, and
        // the backfill frontier was persisted per chunk, so the next run resumes where this stopped.
        log('warn', 'Synchronizacja zatrzymana przez użytkownika.', { phase: 'done' });
        await store.updateRun(runId, { status: 'cancelled', step: 'zatrzymano', finishedAt, detail });
        logger.info?.('sync cancelled', { userId, kind, ...flatCounts(detail) });
      } else {
        const message = err instanceof NotConnected ? 'garmin_not_connected' : 'sync_failed';
        const code = err instanceof NotConnected ? err.failure.code : garminFailureOf(err).code;
        log('error', `Synchronizacja przerwana: ${FAILURE_TEXT[code] ?? message}.`, {
          phase: 'done',
          code,
          retryable: false
        });
        await store.updateRun(runId, { status: 'failed', error: message, finishedAt, detail });
        logger.error?.('sync failed', { userId, kind, error: message, code });
      }
    }

    return (await store.getRun(runId))!;
  }

  /**
   * Cheap change signature (spec 027): the newest activities plus today's step count, in two upstream
   * calls. Steps are in it deliberately — they are the metric that moves whenever the wearer does, so
   * "signature unchanged" means "nothing to fetch", not "nothing recorded". `today` is in it too, so a
   * day rollover always syncs.
   *
   * Structural only: ids and counts, never payloads.
   */
  async function probeSignature(userId: string): Promise<string> {
    const source = sourceFor(userId);
    const today = todayKey(clock, timeZone);
    const [page, steps] = await Promise.all([
      source.listActivitiesPage(PROBE_ACTIVITIES, 0),
      source.getMetricRange('steps', today, today)
    ]);
    const newest = page
      .map((r) => normalizeActivity(userId, r))
      .filter((a): a is ActivitySummary => a !== null)
      .map((a) => `${a.activityId}@${a.startTime}`);
    const stepsToday = steps.days
      .map((d) => extractMetricValue({ keys: ['totalSteps'] }, d.data))
      .find((v): v is number => v !== null);
    return `${today}|${page.length}|${newest.join(',')}|${stepsToday ?? 'none'}`;
  }

  async function syncIfChanged(userId: string, opts: SyncOptions): Promise<SyncRun | null> {
    let signature: string | null = null;
    try {
      signature = await probeSignature(userId);
    } catch {
      // FAIL OPEN: a probe we cannot complete (sidecar down, rate limited, token expired) is not
      // evidence that nothing changed. Sync normally and let the run record what actually went wrong.
      logger.info?.('sync probe failed — syncing anyway', { userId });
    }

    const prior = await store.getSyncState(userId, 'garmin');
    const priorSignature =
      typeof prior?.cursor?.probeSignature === 'string' ? String(prior.cursor.probeSignature) : null;
    const checkedAt = clock.now().toISOString();

    if (signature !== null && priorSignature !== null && signature === priorSignature) {
      /*
       * Nothing upstream moved: record the check and stop. No run row, so the sync history keeps
       * showing the last run that actually did something.
       *
       * One exception (spec 054): the best-efforts derivation still gets a small budget here. It is
       * purely LOCAL — stored streams in, effort rows out, no Garmin call — and gating it on upstream
       * change would mean an account that stopped training never finishes its backfill.
       */
      try {
        const efforts = await backfillBestEfforts(store, userId, EFFORTS_PER_UNCHANGED_TICK);
        if (efforts.computed > 0)
          logger.info?.('best efforts derived on an unchanged tick', {
            userId,
            computed: efforts.computed,
            pending: efforts.pending
          });
      } catch {
        logger.warn('best-efforts derivation failed on an unchanged tick', { userId });
      }
      await store.setSyncState(userId, {
        source: 'garmin',
        cursor: {
          ...(prior?.cursor ?? {}),
          probeSignature: signature,
          lastCheckAt: checkedAt,
          lastResult: 'unchanged'
        },
        lastFullSyncAt: prior?.lastFullSyncAt ?? null,
        lastSyncAt: prior?.lastSyncAt ?? null
      });
      logger.info?.('sync skipped — nothing changed upstream', { userId });
      return null;
    }

    const run = await syncUser(userId, opts);
    // Written AFTER the run, because `syncUser` rewrites the cursor for its own bookkeeping. A change
    // that landed DURING the run leaves the signature stale, and the next tick simply syncs again.
    const after = await store.getSyncState(userId, 'garmin');
    await store.setSyncState(userId, {
      source: 'garmin',
      cursor: {
        ...(after?.cursor ?? {}),
        ...(signature !== null ? { probeSignature: signature } : {}),
        lastCheckAt: checkedAt,
        lastResult: 'synced'
      },
      lastFullSyncAt: after?.lastFullSyncAt ?? null,
      lastSyncAt: after?.lastSyncAt ?? null
    });
    return run;
  }

  return { syncUser, syncIfChanged };
}

function flatCounts(d: SyncDetail): Record<string, number> {
  return {
    activities: d.activities?.count ?? 0,
    streams: d.streams?.fetched ?? 0,
    bestEfforts: d.streams?.efforts ?? 0,
    weight: d.weight?.points ?? 0,
    metricDays: d.metrics?.days ?? 0
  };
}
