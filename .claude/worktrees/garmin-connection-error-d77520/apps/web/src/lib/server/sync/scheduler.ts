/**
 * Background sync scheduler (spec 015, deepened in spec 019, re-timed in spec 027). On a fixed
 * interval it runs an INCREMENTAL sync for every user so the local store stays fresh without anyone
 * opening the app.
 *
 * "Incremental" is no longer only about freshness: since spec 019 each run also walks a bounded slice
 * of the daily-metric history backwards from the persisted frontier, so a multi-year backfill
 * completes over successive ticks instead of needing the user to sit on /dane. That is why nothing
 * here special-cases a first-time user — the same tick both tops up and deepens.
 *
 * CADENCE (spec 027): the tick used to run once a day, which left the app visibly stale for hours.
 * It now runs every 30 minutes (configurable) and goes through `syncEngine.syncIfChanged`, which
 * probes upstream in two calls and fast-returns when nothing moved — so 48 ticks a day cost roughly
 * what one used to, and the expensive phases only run when there is something new to fetch.
 *
 * The tick logic (`runScheduledSync`) is a pure, awaitable function so it's unit-testable;
 * `startSyncScheduler` is the thin timer around it (unref'd so it never keeps the process alive).
 */
import type { Clock } from '../clock';
import { systemClock } from '../clock';
import type { Logger } from '../logger';
import type { SyncEngine } from './engine';

export interface Scheduler {
  stop(): void;
  /** When the next tick is due — reported to the UI so it can count down (spec 027). */
  nextRunAt(): Date;
  /** The configured cadence, in ms. */
  readonly intervalMs: number;
}

/** Default cadence when config does not say otherwise (spec 027). */
export const DEFAULT_SYNC_INTERVAL_MS = 30 * 60_000;

export interface SchedulerDeps {
  users: { listIds(): Promise<string[]> };
  syncEngine: SyncEngine;
  logger: Logger;
  /** Tick interval; default 30 min. */
  intervalMs?: number;
  /** Injected so `nextRunAt` is testable (AGENTS.md §7 — never `Date.now()` inside a tested unit). */
  clock?: Clock;
  /**
   * Expired-session sweeper (spec 055). Optional: tests and any caller that only wants syncing can
   * leave it out. This timer is the process's only periodic hook, which is why the sweep rides
   * along here rather than owning a second one.
   */
  sessions?: { sweepExpired(): Promise<number> };
  /**
   * Whether background fetching is switched on for a user (spec 071). Optional so tests that only
   * exercise the tick can omit it; absent means "everyone is in", which is the pre-071 behaviour.
   */
  autoSyncEnabledFor?: (userId: string) => Promise<boolean>;
}

/**
 * Run one change-gated incremental sync per user. Never throws — a per-user failure is logged and
 * skipped, so one broken account cannot stop everyone else's tick.
 */
export async function runScheduledSync(deps: SchedulerDeps): Promise<{
  attempted: number;
  skipped: number;
  failed: number;
  /** Users whose "automatyczne pobieranie danych" switch is off (spec 071). */
  optedOut: number;
  sessionsSwept: number;
}> {
  // Housekeeping first, and never fatally: a failed sweep must not cost anyone their sync.
  let sessionsSwept = 0;
  if (deps.sessions) {
    try {
      sessionsSwept = await deps.sessions.sweepExpired();
    } catch {
      deps.logger.warn('expired-session sweep failed');
    }
  }

  const ids = await deps.users.listIds();
  let failed = 0;
  let skipped = 0;
  let optedOut = 0;
  for (const userId of ids) {
    try {
      // Spec 071: the user's own switch decides whether we go near their account in the background.
      // Checked per tick rather than cached, so flipping it off in Settings takes effect on the next
      // tick instead of at the next restart.
      if (deps.autoSyncEnabledFor && !(await deps.autoSyncEnabledFor(userId))) {
        optedOut++;
        continue;
      }
      const run = await deps.syncEngine.syncIfChanged(userId, { kind: 'incremental' });
      if (run === null) skipped++;
      else if (run.status === 'failed') failed++;
    } catch {
      failed++;
      deps.logger.warn('scheduled sync failed for a user');
    }
  }
  deps.logger.info('scheduled sync tick complete', {
    attempted: ids.length,
    skipped,
    optedOut,
    failed,
    sessionsSwept
  });
  return { attempted: ids.length, skipped, failed, optedOut, sessionsSwept };
}

export function startSyncScheduler(deps: SchedulerDeps): Scheduler {
  const intervalMs = deps.intervalMs ?? DEFAULT_SYNC_INTERVAL_MS;
  const clock = deps.clock ?? systemClock;
  // The next tick is tracked rather than derived from a start time, so a restart reports honestly:
  // whatever the process has been through, the UI's countdown matches the timer that actually exists.
  let next = new Date(clock.now().getTime() + intervalMs);
  const timer = setInterval(() => {
    next = new Date(clock.now().getTime() + intervalMs);
    void runScheduledSync(deps);
  }, intervalMs);
  // Don't let the timer alone keep the node process alive.
  (timer as { unref?: () => void }).unref?.();
  return { stop: () => clearInterval(timer), nextRunAt: () => next, intervalMs };
}
