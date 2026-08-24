import { describe, it, expect } from 'vitest';
import { triggerSync, getSyncStatus, getCoverage, cancelSync, getSidecarLog } from './sync.api';
import { createMemoryStore } from '$lib/server/store/memory';
import { createSyncEngine } from '$lib/server/sync/engine';
import { fixedClock } from '$lib/server/clock';
import { nullLogger } from '$lib/server/logger';
import { sequenceRandom } from '$lib/server/random';
import { GarminUnavailableError, type GarminSyncSource } from '$lib/server/interfaces';

const clock = fixedClock(new Date('2026-08-08T12:00:00Z'));

function source(connected = true): GarminSyncSource {
  return {
    async getStatus() {
      return { authenticated: connected };
    },
    async login() {
      return { outcome: 'success', status: { authenticated: true } };
    },
    async disconnect() {},
    async getMetric() {
      return null;
    },
    async getMetricRange(metric, start, end) {
      return {
        metric,
        start,
        end,
        days: [{ date: end, data: end >= '2026-08-01' ? { totalSteps: 100 } : null }]
      };
    },
    async listActivitiesPage(_l, s) {
      return s > 0
        ? []
        : [
            {
              activityId: 1,
              activityType: { typeKey: 'cycling' },
              startTimeLocal: '2026-08-01 09:00:00',
              distance: 1000
            }
          ];
    },
    async getActivityDetails(activityId) {
      return { activityId };
    },
    async getWeightRange() {
      return [];
    }
  };
}

function deps(connected = true) {
  const store = createMemoryStore();
  const syncEngine = createSyncEngine({
    store,
    sourceFor: () => source(connected),
    clock,
    logger: nullLogger,
    random: sequenceRandom('r')
  });
  return { store, syncEngine };
}

/** triggerSync returns at run-start (non-blocking); let the background run drain to completion. */
async function settle(d: ReturnType<typeof deps>, userId: string, runId: string): Promise<void> {
  for (let i = 0; i < 200; i++) {
    const run = await d.store.getRun(runId);
    if (run && run.status !== 'running') return;
    await new Promise((r) => setTimeout(r, 0));
  }
  void userId;
}

describe('sync api', () => {
  it('triggerSync returns a run id immediately and the run completes in the background', async () => {
    const d = deps();
    const res = await triggerSync(d, 'u1', 'full');
    expect(res.runId).toBeTruthy();
    expect(res.alreadyRunning).toBe(false);

    await settle(d, 'u1', res.runId);
    const status = await getSyncStatus(d, 'u1', res.runId);
    expect(status.run?.status).toBe('succeeded');
    expect(status.progress).toBe(1);
  });

  it('coalesces a concurrent trigger onto the in-flight run', async () => {
    const d = deps();
    // Seed a running run so the guard trips.
    await d.store.startRun({
      id: 'run-live',
      userId: 'u1',
      kind: 'full',
      total: 10,
      startedAt: clock.now().toISOString()
    });
    // Pass the injected clock: `triggerSync` compares against it to decide whether a `running` row is
    // still live or is a stale leftover, and the fixed clock keeps that deterministic.
    const res = await triggerSync(d, 'u1', 'incremental', clock.now());
    expect(res).toEqual({ runId: 'run-live', status: 'running', alreadyRunning: true });
  });

  it('getCoverage reports store contents and the last run', async () => {
    const d = deps();
    const { runId } = await triggerSync(d, 'u1', 'full');
    await settle(d, 'u1', runId);
    const cov = await getCoverage(d, 'u1', '2026-08-16');
    expect(cov.coverage.activities.count).toBe(1);
    expect(cov.lastRun?.id).toBe(runId);
  });

  /*
   * Spec 072. The store answers "newest day I hold data for" but has no clock, so it cannot say how
   * far behind today that is. This handler is where the two halves meet — and the distance is what
   * decides whether /dane tells the user their watch has not uploaded.
   */
  it('getCoverage finishes the freshness answer with today', async () => {
    const d = deps();
    await d.store.putMetricDays('u1', 'steps', [
      { day: '2026-08-14', data: { totalSteps: 9000 }, hasValue: true },
      // Present object, no reading in it — Garmin's answer for a day the watch never uploaded.
      { day: '2026-08-16', data: { calendarDate: '2026-08-16', totalSteps: null }, hasValue: false }
    ]);

    const cov = await getCoverage(d, 'u1', '2026-08-16');

    expect(cov.coverage.freshness).toEqual({ lastDataDay: '2026-08-14', staleDays: 2 });
  });

  it('getCoverage reports an unknown age as null, never as current', async () => {
    const cov = await getCoverage(deps(), 'u1', '2026-08-16');
    expect(cov.coverage.freshness).toEqual({ lastDataDay: null, staleDays: null });
  });

  it("never leaks another user's run", async () => {
    const d = deps();
    await d.store.startRun({
      id: 'other',
      userId: 'someone-else',
      kind: 'full',
      total: 1,
      startedAt: clock.now().toISOString()
    });
    const status = await getSyncStatus(d, 'u1', 'other');
    expect(status.run).toBeNull();
  });

  it('records a failed run when Garmin is not connected', async () => {
    const d = deps(false);
    const { runId } = await triggerSync(d, 'u1', 'full');
    await settle(d, 'u1', runId);
    const status = await getSyncStatus(d, 'u1', runId);
    expect(status.run?.status).toBe('failed');
    expect(status.run?.error).toBe('garmin_not_connected');
  });
});

describe('cancel + stale-run healing (spec 019)', () => {
  const noopEngine = { syncUser: async () => ({}) as never, syncIfChanged: async () => null };

  it('cancelSync marks an in-flight run as cancelled', async () => {
    const store = createMemoryStore();
    await store.startRun({
      id: 'r1',
      userId: 'u',
      kind: 'full',
      total: 10,
      startedAt: '2026-08-10T10:00:00.000Z'
    });

    const res = await cancelSync(
      { store, syncEngine: noopEngine },
      'u',
      new Date('2026-08-10T10:05:00.000Z')
    );
    expect(res.run?.status).toBe('cancelled');
    expect(res.run?.finishedAt).toBe('2026-08-10T10:05:00.000Z');
  });

  it('a fresh running run blocks a new sync; a stale one is healed and replaced', async () => {
    const store = createMemoryStore();
    let started = 0;
    const deps = {
      store,
      syncEngine: {
        syncUser: async (userId: string, opts: { onStart?: (id: string) => void }) => {
          started++;
          const id = `new${started}`;
          await store.startRun({ id, userId, kind: 'full', total: 1, startedAt: '2026-08-10T13:00:00.000Z' });
          opts.onStart?.(id);
          return (await store.getRun(id))!;
        },
        // Never reached here: this test drives the manual trigger path, not the scheduled one.
        syncIfChanged: async () => null
      }
    };
    await store.startRun({
      id: 'old',
      userId: 'u',
      kind: 'full',
      total: 10,
      startedAt: '2026-08-10T10:00:00.000Z'
    });

    // 5 minutes in: still considered live -> do not start a second sync.
    const fresh = await triggerSync(deps, 'u', 'full', new Date('2026-08-10T10:05:00.000Z'));
    expect(fresh.alreadyRunning).toBe(true);
    expect(started).toBe(0);

    // 3 hours in: the row is dead (process restarted) -> heal it and start fresh.
    const stale = await triggerSync(deps, 'u', 'full', new Date('2026-08-10T13:00:00.000Z'));
    expect(stale.alreadyRunning).toBe(false);
    expect(started).toBe(1);
    expect((await store.getRun('old'))?.status).toBe('failed');
    expect((await store.getRun('old'))?.error).toBe('interrupted');
  });

  it('failRunningRuns heals orphaned runs only (startup path)', async () => {
    const store = createMemoryStore();
    await store.startRun({
      id: 'a',
      userId: 'u1',
      kind: 'full',
      total: 1,
      startedAt: '2026-08-10T10:00:00.000Z'
    });
    await store.startRun({
      id: 'b',
      userId: 'u2',
      kind: 'incremental',
      total: 1,
      startedAt: '2026-08-10T10:00:00.000Z'
    });
    await store.updateRun('b', { status: 'succeeded' });

    expect(await store.failRunningRuns('interrupted', '2026-08-10T11:00:00.000Z')).toBe(1);
    expect((await store.getRun('a'))?.status).toBe('failed');
    expect((await store.getRun('b'))?.status).toBe('succeeded'); // untouched
  });
});

describe('sidecar diagnostics tail (spec 019)', () => {
  const base = deps();

  it('returns the sidecar log for the current user', async () => {
    const entries = [
      {
        t: 1786434000,
        level: 'warning',
        logger: 'garmin-sidecar.metrics',
        msg: 'Upstream call failed (rate_limited).',
        code: 'rate_limited'
      }
    ];
    const res = await getSidecarLog({
      ...base,
      garminSync: { ...source(), getDiagnostics: async () => entries }
    });

    expect(res).toEqual({ available: true, entries });
  });

  it('reports "unsupported" when the wired source cannot read the sidecar (mock adapter)', async () => {
    const res = await getSidecarLog({ ...base, garminSync: source() });
    expect(res).toEqual({ available: false, entries: [], reason: 'unsupported' });
  });

  it('turns an unreachable sidecar into the diagnosis rather than an exception', async () => {
    const res = await getSidecarLog({
      ...base,
      garminSync: {
        ...source(),
        getDiagnostics: async () => {
          throw new GarminUnavailableError('down', { code: 'sidecar_unreachable', retryable: true });
        }
      }
    });

    expect(res).toMatchObject({ available: false, entries: [], reason: 'sidecar_unreachable' });
  });

  it('clamps the requested size so a caller cannot ask for an unbounded dump', async () => {
    const asked: number[] = [];
    await getSidecarLog(
      {
        ...base,
        garminSync: { ...source(), getDiagnostics: async (n?: number) => (asked.push(n ?? -1), []) }
      },
      100_000
    );
    expect(asked).toEqual([400]);
  });
});

/* ---------------- freshness + auto-sync reporting (spec 027) ---------------- */

describe('getSyncStatus freshness (spec 027)', () => {
  it('reports the last sync, the last check and the scheduler cadence', async () => {
    const d = deps();
    const { runId } = await triggerSync(d, 'u1', 'incremental');
    await settle(d, 'u1', runId);

    const scheduler = {
      intervalMs: 30 * 60_000,
      nextRunAt: () => new Date('2026-08-08T12:30:00.000Z')
    };
    const status = await getSyncStatus({ ...d, scheduler }, 'u1');

    expect(status.lastSyncAt).toBe('2026-08-08T12:00:00.000Z'); // the fixed clock's instant
    expect(status.lastCheckAt).toBe(status.lastSyncAt); // no probe yet → falls back to the sync
    expect(status.autoSync).toEqual({
      intervalMs: 30 * 60_000,
      nextRunAt: '2026-08-08T12:30:00.000Z'
    });
  });

  it('reports a fast-returned tick as a later check with an unchanged result', async () => {
    const d = deps();
    await d.store.setSyncState('u1', {
      source: 'garmin',
      cursor: { lastCheckAt: '2026-08-08T13:30:00.000Z', lastResult: 'unchanged' },
      lastFullSyncAt: null,
      lastSyncAt: '2026-08-08T12:00:00.000Z'
    });

    const status = await getSyncStatus(d, 'u1');

    expect(status.lastSyncAt).toBe('2026-08-08T12:00:00.000Z');
    expect(status.lastCheckAt).toBe('2026-08-08T13:30:00.000Z');
    expect(status.lastResult).toBe('unchanged');
  });

  it('reports no cadence and no freshness for a fresh user with no scheduler', async () => {
    const d = deps();
    const status = await getSyncStatus(d, 'u1');
    expect(status).toMatchObject({
      run: null,
      lastSyncAt: null,
      lastCheckAt: null,
      lastResult: null,
      autoSync: null
    });
  });

  it('ignores a junk cursor rather than passing it through the contract', async () => {
    const d = deps();
    await d.store.setSyncState('u1', {
      source: 'garmin',
      cursor: { lastCheckAt: 42, lastResult: 'whatever' },
      lastFullSyncAt: null,
      lastSyncAt: null
    });
    const status = await getSyncStatus(d, 'u1');
    expect(status.lastCheckAt).toBeNull();
    expect(status.lastResult).toBeNull();
  });
});
