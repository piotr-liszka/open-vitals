/**
 * Sync + coverage API handlers (spec 015). Pure over injected deps (a LocalStore + SyncEngine),
 * so they're unit-testable with the in-memory fake. `triggerSync` is NON-BLOCKING: it kicks the
 * engine off in the background and returns the run id immediately, so the client can poll
 * `getSyncStatus` to drive a progress bar. A run already in flight for the user is returned as-is
 * rather than starting a second one.
 */
import { daysBetween, type DayKey } from '$lib/date';
import { GarminUnavailableError, garminFailureOf, type GarminSyncSource } from '$lib/server/interfaces';
import type { LocalStore, SyncRun } from '$lib/server/store/types';
import type { SyncEngine, SyncOptions } from '$lib/server/sync/engine';
import type {
  CoverageResponse,
  SidecarLogResponse,
  SyncCheckResult,
  SyncStatusResponse,
  SyncTriggerResponse
} from './sync.types';

export interface SyncDeps {
  store: LocalStore;
  syncEngine: SyncEngine;
  /**
   * The user's raw sidecar source. Only the diagnostics read uses it — it is the one thing the local
   * store cannot answer, because it lives inside the Python process (spec 019).
   */
  garminSync?: GarminSyncSource;
  /**
   * The running background scheduler, when this process has one (spec 027). Read-only here: the
   * status response reports its cadence so the sidebar can count down to the next automatic sync.
   */
  scheduler?: { intervalMs: number; nextRunAt(): Date } | null;
}

const progressOf = (run: SyncRun | null): number => {
  if (!run || run.total <= 0) return run?.status === 'succeeded' ? 1 : 0;
  return Math.max(0, Math.min(1, run.done / run.total));
};

/**
 * A run still marked `running` this long after it started is treated as dead (the process was
 * restarted mid-sync), so it neither shows a phantom progress bar nor blocks new syncs. The bounded
 * engine finishes well inside this even on a full backfill.
 */
const STALE_RUN_MS = 60 * 60_000;

/** Stop the user's in-flight run. The engine notices at its next progress write and unwinds. */
export async function cancelSync(deps: SyncDeps, userId: string, now: Date): Promise<SyncStatusResponse> {
  const latest = await deps.store.getLatestRun(userId);
  if (latest && latest.userId === userId && latest.status === 'running') {
    await deps.store.updateRun(latest.id, {
      status: 'cancelled',
      step: 'zatrzymano',
      finishedAt: now.toISOString()
    });
  }
  return getSyncStatus(deps, userId);
}

export async function triggerSync(
  deps: SyncDeps,
  userId: string,
  kind: 'full' | 'incremental',
  now: Date = new Date()
): Promise<SyncTriggerResponse> {
  const latest = await deps.store.getLatestRun(userId);
  if (latest && latest.status === 'running') {
    const age = now.getTime() - new Date(latest.startedAt).getTime();
    if (age < STALE_RUN_MS) {
      return { runId: latest.id, status: 'running', alreadyRunning: true };
    }
    // Dead run left behind by a restart — heal it so this request can start a fresh sync.
    await deps.store.updateRun(latest.id, {
      status: 'failed',
      error: 'interrupted',
      finishedAt: now.toISOString()
    });
  }

  // Capture the run id the engine mints, then let the run complete in the background.
  let resolveId: (id: string) => void;
  const idReady = new Promise<string>((resolve) => (resolveId = resolve));
  const opts: SyncOptions = { kind, onStart: (id) => resolveId(id) };
  // Fire-and-forget: the adapter-node process outlives the request, so the sync keeps going.
  void deps.syncEngine.syncUser(userId, opts).catch(() => {
    /* failures are recorded on the run row; nothing to do here */
  });
  const runId = await idReady;
  return { runId, status: 'running', alreadyRunning: false };
}

export async function getSyncStatus(
  deps: SyncDeps,
  userId: string,
  runId?: string
): Promise<SyncStatusResponse> {
  const [run, state] = await Promise.all([
    runId ? deps.store.getRun(runId) : deps.store.getLatestRun(userId),
    deps.store.getSyncState(userId, 'garmin')
  ]);
  const scoped = run && run.userId === userId ? run : null; // never leak another user's run
  const scheduler = deps.scheduler ?? null;
  return {
    run: scoped,
    progress: progressOf(scoped),
    lastSyncAt: state?.lastSyncAt ?? null,
    // `lastCheckAt` covers the ticks that fast-returned (spec 027): freshness is "when did we last
    // LOOK", which is what makes a quiet half hour distinguishable from a broken scheduler.
    lastCheckAt: asIso(state?.cursor?.lastCheckAt) ?? state?.lastSyncAt ?? null,
    lastResult: asCheckResult(state?.cursor?.lastResult),
    autoSync: scheduler
      ? { intervalMs: scheduler.intervalMs, nextRunAt: scheduler.nextRunAt().toISOString() }
      : null
  };
}

/** The sync cursor is opaque `jsonb`; narrow before it reaches the response contract. */
function asIso(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function asCheckResult(value: unknown): SyncCheckResult | null {
  return value === 'synced' || value === 'unchanged' ? value : null;
}

/**
 * Read the sidecar's own recent log records for this user (spec 019).
 *
 * The sidecar is internal-only and its buffer is per-user scoped, so this is the only way a user can
 * see WHY Garmin refused them ("rate_limited" vs "token_rejected" vs the container being down).
 * Never throws: an unavailable sidecar is itself an answer, reported as `available: false` plus the
 * classified reason, because "I cannot reach the sidecar" is precisely the diagnosis being asked for.
 */
export async function getSidecarLog(deps: SyncDeps, limit = 100): Promise<SidecarLogResponse> {
  const source = deps.garminSync;
  if (!source?.getDiagnostics) return { available: false, entries: [], reason: 'unsupported' };
  try {
    return { available: true, entries: await source.getDiagnostics(Math.max(1, Math.min(400, limit))) };
  } catch (err) {
    const failure = garminFailureOf(err);
    return {
      available: false,
      entries: [],
      reason: failure.code,
      ...(err instanceof GarminUnavailableError && failure.status ? { status: failure.status } : {})
    };
  }
}

/**
 * Coverage plus the last run. `today` finishes the freshness answer the store can only half-give
 * (spec 072): the store knows the newest day it holds data for, but has no clock, so the distance
 * from today is filled in here — in the app timezone, never UTC.
 */
export async function getCoverage(deps: SyncDeps, userId: string, today: DayKey): Promise<CoverageResponse> {
  const [coverage, lastRun] = await Promise.all([
    deps.store.coverage(userId),
    deps.store.getLatestRun(userId)
  ]);
  const lastDataDay = coverage.freshness.lastDataDay;
  return {
    coverage: {
      ...coverage,
      freshness: {
        lastDataDay,
        // Non-negative: a day dated ahead of today (clock skew) is "current", not "-1 days stale".
        staleDays: lastDataDay === null ? null : Math.max(0, daysBetween(lastDataDay, today))
      }
    },
    lastRun
  };
}
