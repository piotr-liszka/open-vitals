import { describe, it, expect, vi } from 'vitest';
import { DEFAULT_SYNC_INTERVAL_MS, runScheduledSync, startSyncScheduler } from './scheduler';
import { nullLogger } from '../logger';
import { fixedClock } from '../clock';
import type { SyncEngine } from './engine';
import type { SyncRun } from '../store/types';

function run(status: SyncRun['status']): SyncRun {
  return {
    id: 'r',
    userId: 'u',
    kind: 'incremental',
    status,
    startedAt: '',
    finishedAt: null,
    total: 1,
    done: 1,
    step: null,
    error: null,
    detail: null
  };
}

/** A SyncEngine whose scheduled path is scripted; `syncUser` must never be reached by a tick. */
function engine(
  syncIfChanged: SyncEngine['syncIfChanged'],
  syncUser: SyncEngine['syncUser'] = vi.fn()
): SyncEngine {
  return { syncUser, syncIfChanged };
}

describe('runScheduledSync', () => {
  it('runs one change-gated incremental sync per user and counts failures', async () => {
    const seen: Array<{ userId: string; kind: string }> = [];
    const syncEngine = engine(async (userId, opts) => {
      seen.push({ userId, kind: opts.kind });
      return run(userId === 'bad' ? 'failed' : 'succeeded');
    });
    const res = await runScheduledSync({
      users: { listIds: async () => ['a', 'bad', 'c'] },
      syncEngine,
      logger: nullLogger
    });
    expect(seen).toEqual([
      { userId: 'a', kind: 'incremental' },
      { userId: 'bad', kind: 'incremental' },
      { userId: 'c', kind: 'incremental' }
    ]);
    expect(res).toEqual({ attempted: 3, skipped: 0, failed: 1, sessionsSwept: 0 });
  });

  it('counts a fast-returned tick as skipped, not as work (spec 027)', async () => {
    const syncEngine = engine(async (userId) => (userId === 'quiet' ? null : run('succeeded')));
    const res = await runScheduledSync({
      users: { listIds: async () => ['quiet', 'busy'] },
      syncEngine,
      logger: nullLogger
    });
    expect(res).toEqual({ attempted: 2, skipped: 1, failed: 0, sessionsSwept: 0 });
  });

  it('never reaches the unconditional sync path', async () => {
    const syncUser = vi.fn();
    const syncEngine = engine(async () => null, syncUser);
    await runScheduledSync({
      users: { listIds: async () => ['a'] },
      syncEngine,
      logger: nullLogger
    });
    expect(syncUser).not.toHaveBeenCalled();
  });

  it('isolates a thrown per-user error', async () => {
    const syncEngine = engine(vi.fn().mockRejectedValue(new Error('boom')));
    const res = await runScheduledSync({
      users: { listIds: async () => ['x'] },
      syncEngine,
      logger: nullLogger
    });
    expect(res).toEqual({ attempted: 1, skipped: 0, failed: 1, sessionsSwept: 0 });
  });

  describe('expired-session sweep (spec 055)', () => {
    it('sweeps once per tick and reports the count', async () => {
      const sweepExpired = vi.fn().mockResolvedValue(4);
      const res = await runScheduledSync({
        users: { listIds: async () => ['a', 'b'] },
        syncEngine: engine(async () => run('succeeded')),
        logger: nullLogger,
        sessions: { sweepExpired }
      });
      expect(sweepExpired).toHaveBeenCalledTimes(1);
      expect(res.sessionsSwept).toBe(4);
    });

    it('does not let a failed sweep cost anyone their sync', async () => {
      const seen: string[] = [];
      const res = await runScheduledSync({
        users: { listIds: async () => ['a', 'b'] },
        syncEngine: engine(async (userId) => {
          seen.push(userId);
          return run('succeeded');
        }),
        logger: nullLogger,
        sessions: { sweepExpired: vi.fn().mockRejectedValue(new Error('db down')) }
      });
      expect(seen).toEqual(['a', 'b']);
      expect(res).toEqual({ attempted: 2, skipped: 0, failed: 0, sessionsSwept: 0 });
    });
  });
});

describe('startSyncScheduler', () => {
  const deps = {
    users: { listIds: async () => [] },
    syncEngine: engine(async () => null),
    logger: nullLogger
  };

  it('defaults to a 30-minute cadence and reports when the next tick is due', () => {
    const clock = fixedClock(new Date('2026-08-11T12:00:00.000Z'));
    const scheduler = startSyncScheduler({ ...deps, clock });
    try {
      expect(scheduler.intervalMs).toBe(DEFAULT_SYNC_INTERVAL_MS);
      expect(scheduler.intervalMs).toBe(30 * 60_000);
      expect(scheduler.nextRunAt().toISOString()).toBe('2026-08-11T12:30:00.000Z');
    } finally {
      scheduler.stop();
    }
  });

  it('honours a configured interval', () => {
    const clock = fixedClock(new Date('2026-08-11T12:00:00.000Z'));
    const scheduler = startSyncScheduler({ ...deps, clock, intervalMs: 5 * 60_000 });
    try {
      expect(scheduler.nextRunAt().toISOString()).toBe('2026-08-11T12:05:00.000Z');
    } finally {
      scheduler.stop();
    }
  });

  it('advances the due time on every tick', async () => {
    vi.useFakeTimers();
    try {
      let now = new Date('2026-08-11T12:00:00.000Z');
      const scheduler = startSyncScheduler({
        ...deps,
        clock: { now: () => now, nowSeconds: () => Math.floor(now.getTime() / 1000) },
        intervalMs: 60_000
      });
      now = new Date('2026-08-11T12:01:00.000Z');
      await vi.advanceTimersByTimeAsync(60_000);
      expect(scheduler.nextRunAt().toISOString()).toBe('2026-08-11T12:02:00.000Z');
      scheduler.stop();
    } finally {
      vi.useRealTimers();
    }
  });
});
