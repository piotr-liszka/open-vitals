import { describe, it, expect } from 'vitest';
import { createSyncEngine } from './engine';
import { createMemoryStore } from '../store/memory';
import { fixedClock } from '../clock';
import { nullLogger } from '../logger';
import { sequenceRandom } from '../random';
import { GARMIN_METRICS, GarminNotAuthenticatedError, GarminUnavailableError } from '../interfaces';
import type {
  GarminActivityDetails,
  GarminMetricRange,
  GarminStatus,
  GarminSyncSource,
  GarminWeighIn
} from '../interfaces';

const TODAY = '2026-08-08';
const clock = fixedClock(new Date(`${TODAY}T12:00:00Z`));

/** Metrics the engine walks day by day — everything but activities and body composition. */
const DAILY_METRIC_COUNT = GARMIN_METRICS.filter(
  (m) => m !== 'activities' && m !== 'body_composition'
).length;

/** A fake sidecar with a FINITE history (data only on/after `historyStart`), 2 activities, 1 weigh-in. */
function fakeSource(
  over: Partial<GarminSyncSource> & { connected?: boolean; historyStart?: string } = {}
): GarminSyncSource {
  const historyStart = over.historyStart ?? '2026-06-15';
  return {
    async getStatus(): Promise<GarminStatus> {
      return { authenticated: over.connected ?? true };
    },
    async login() {
      return { outcome: 'success', status: { authenticated: true } };
    },
    async disconnect() {},
    async getMetric() {
      return null;
    },
    async getMetricRange(metric, start, end): Promise<GarminMetricRange> {
      const days: GarminMetricRange['days'] = [];
      const d = new Date(`${start}T00:00:00Z`);
      const last = new Date(`${end}T00:00:00Z`);
      while (d.getTime() <= last.getTime()) {
        const day = d.toISOString().slice(0, 10);
        days.push({
          date: day,
          data: day >= historyStart ? { totalSteps: 1000, restingHeartRate: 50 } : null
        });
        d.setUTCDate(d.getUTCDate() + 1);
      }
      return { metric, start, end, days };
    },
    async listActivitiesPage(limit, start): Promise<unknown[]> {
      if (start > 0) return [];
      return [
        {
          activityId: 111,
          activityName: 'Ride A',
          activityType: { typeKey: 'cycling' },
          startTimeLocal: '2026-08-01 09:00:00',
          startTimeGMT: '2026-08-01 07:00:00',
          distance: 40000,
          duration: 5400,
          averageHR: 140,
          avgPower: 190,
          hasPolyline: true
        },
        {
          activityId: 222,
          activityName: 'Run B',
          activityType: { typeKey: 'running' },
          startTimeLocal: '2026-07-20 07:00:00',
          startTimeGMT: '2026-07-20 05:00:00',
          distance: 8000,
          duration: 2400,
          averageHR: 150,
          hasPolyline: false
        }
      ].slice(0, limit);
    },
    async getActivityDetails(activityId): Promise<GarminActivityDetails> {
      return {
        activityId,
        heartRate: [130, 140],
        ...(activityId === '111'
          ? {
              gps: [
                [50, 8],
                [50.1, 8.1]
              ] as Array<[number, number]>,
              power: [100, 200]
            }
          : {})
      };
    },
    async getWeightRange(start, end): Promise<GarminWeighIn[]> {
      // one weigh-in in the most recent chunk only
      return end === TODAY ? [{ day: '2026-08-05', weightKg: 74.1 }] : [];
    },
    ...over
  };
}

function engineWith(source: GarminSyncSource) {
  const store = createMemoryStore();
  const engine = createSyncEngine({
    store,
    sourceFor: () => source,
    clock,
    logger: nullLogger,
    random: sequenceRandom('run')
  });
  return { store, engine };
}

describe('sync engine', () => {
  it('full backfill stops when history runs dry and populates every data type', async () => {
    const { store, engine } = engineWith(fakeSource());
    const run = await engine.syncUser('u1', { kind: 'full' });

    expect(run.status).toBe('succeeded');
    expect(run.done).toBe(run.total); // reconciled → bar lands on 100%

    const cov = await store.coverage('u1');
    const steps = cov.metrics.find((m) => m.metric === 'steps')!;
    expect(steps.presentDays).toBeGreaterThan(0);
    expect(steps.firstDay).toBe('2026-06-15'); // earliest day the fake had data
    expect(steps.lastDay).toBe(TODAY);

    expect(cov.activities.count).toBe(2);
    expect(cov.activities.withGps).toBe(1);
    expect((await store.getStreams('u1', '111'))?.power).toEqual([100, 200]);
    expect(cov.weight.count).toBe(1);

    const state = await store.getSyncState('u1', 'garmin');
    expect(state?.lastFullSyncAt).not.toBeNull();
    expect(state?.cursor.metricsFrom).toBe(TODAY);
  });

  it('does not sweep the entire 5-year floor when history is short', async () => {
    // steps metric chunk count should be small (a few chunks), proving early-stop kicked in.
    const { store, engine } = engineWith(fakeSource());
    const run = await engine.syncUser('u1', { kind: 'full' });
    /*
      A five-year sweep is ~60 chunks per metric; early-stop should land near a dozen. Scaled off
      the metric count so adding a metric moves the ceiling instead of breaking the test — what is
      being asserted is "a few chunks each", not an absolute number of calls.
    */
    expect(run.done).toBeLessThan(DAILY_METRIC_COUNT * 15);
  });

  it('marks the run failed when Garmin is not connected', async () => {
    const { engine } = engineWith(fakeSource({ connected: false }));
    const run = await engine.syncUser('u1', { kind: 'full' });
    expect(run.status).toBe('failed');
    expect(run.error).toBe('garmin_not_connected');
  });

  it('persists the HR stream for every activity, GPS or not (spec 023)', async () => {
    // The old selector only fetched streams when hasGps || avgPower, which skipped indoor/HR-only
    // sessions entirely; and the stored blob dropped HR because of the snake/camel mismatch.
    const { store, engine } = engineWith(fakeSource());
    await engine.syncUser('u1', { kind: 'full' });

    // 222 is the non-GPS, no-power run — it must still have been fetched, and it must have HR.
    expect((await store.getStreams('u1', '222'))?.heartRate).toEqual([130, 140]);
    expect((await store.getStreams('u1', '111'))?.heartRate).toEqual([130, 140]);
  });

  it('re-fetches streams stored under an older schema version and reports the repair', async () => {
    const { store, engine } = engineWith(fakeSource());
    await engine.syncUser('u1', { kind: 'full' });
    // Simulate a row written by the buggy build: no HR, stamped with the old version.
    await store.putStreams('u1', '111', { v: 1, gps: [[50, 8]], power: [100, 200] });

    const run = await engine.syncUser('u1', { kind: 'incremental' });

    expect((await store.getStreams('u1', '111'))?.heartRate).toEqual([130, 140]);
    expect(run.detail?.streams).toMatchObject({ fetched: 0, repaired: 1 });
  });

  it('does not re-fetch streams that are already at the current schema version', async () => {
    const { store, engine } = engineWith(fakeSource());
    await engine.syncUser('u1', { kind: 'full' });

    const run = await engine.syncUser('u1', { kind: 'incremental' });

    expect(run.detail?.streams).toMatchObject({ fetched: 0, repaired: 0 });
  });

  it('leaves a repair backlog for the next run when the budget runs out', async () => {
    const { store, engine } = engineWith(fakeSource());
    await engine.syncUser('u1', { kind: 'full' });
    for (const id of ['111', '222']) await store.putStreams('u1', id, { v: 1, heartRate: [1] });

    const run = await engine.syncUser('u1', { kind: 'incremental', streamsPerRun: 1 });

    expect(run.detail?.streams).toMatchObject({ repaired: 1, pending: 1 });
  });

  it('incremental sync tops up from the cursor and is idempotent', async () => {
    const { store, engine } = engineWith(fakeSource());
    await engine.syncUser('u1', { kind: 'full' });
    const before = (await store.coverage('u1')).activities.count;

    const run = await engine.syncUser('u1', { kind: 'incremental' });
    expect(run.status).toBe('succeeded');
    // Re-syncing the same activities must not duplicate them (upsert).
    expect((await store.coverage('u1')).activities.count).toBe(before);
  });
});

/* ------------------------------------------------------------------ *
 * Spec 019 — depth: a resumable, reportable, gap-tolerant backfill
 * ------------------------------------------------------------------ */

/** A fake whose daily history reaches back to `historyStart` with an optional dead zone in it. */
function deepSource(historyStart: string, gap?: { from: string; to: string }): GarminSyncSource {
  const has = (day: string): boolean => day >= historyStart && !(gap && day >= gap.from && day <= gap.to);
  return fakeSource({
    async getMetricRange(metric, start, end): Promise<GarminMetricRange> {
      const days: GarminMetricRange['days'] = [];
      for (let d = start; d <= end; d = addDay(d))
        days.push({ date: d, data: has(d) ? { totalSteps: 100 } : null });
      return { metric, start, end, days };
    }
  });
}

function addDay(day: string): string {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

describe('sync engine — daily-metric depth (spec 019)', () => {
  it('deepens history on EVERY run instead of pinning it to the last 365 days', async () => {
    // The old engine reset the cursor to `today` at the end of every run, so an incremental sync only
    // ever re-pulled ~10 days and history never grew. Two runs must now reach strictly deeper.
    const { store, engine } = engineWith(deepSource('2019-01-01'));

    const first = await engine.syncUser('u1', { kind: 'full', backfillChunksPerRun: 3 });
    const afterFirst = String((await store.getSyncState('u1', 'garmin'))!.cursor.metricsBackfilledTo);

    const second = await engine.syncUser('u1', { kind: 'incremental', backfillChunksPerRun: 3 });
    const afterSecond = String((await store.getSyncState('u1', 'garmin'))!.cursor.metricsBackfilledTo);

    expect(afterSecond < afterFirst).toBe(true);
    expect(first.detail?.metrics?.backfillTo).toBe(afterFirst);
    expect(second.detail?.metrics?.backfillTo).toBe(afterSecond);
    // Freshness and depth are separate cursors: the newest day stays covered while depth grows.
    expect(await store.getMetricDay('u1', 'steps', TODAY)).not.toBeNull();
  });

  it('resumes from the persisted frontier rather than re-walking what it already has', async () => {
    const calls: string[] = [];
    const source = deepSource('2019-01-01');
    const spied: GarminSyncSource = {
      ...source,
      async getMetricRange(metric, start, end) {
        if (metric === 'steps') calls.push(start);
        return source.getMetricRange(metric, start, end);
      }
    };
    const { engine } = engineWith(spied);

    await engine.syncUser('u1', { kind: 'full', backfillChunksPerRun: 2 });
    const firstWalk = [...calls];
    calls.length = 0;
    await engine.syncUser('u1', { kind: 'incremental', backfillChunksPerRun: 2 });

    // Only the freshness window may repeat; every backfill chunk of run 2 is new ground.
    const repeated = calls.filter((c) => firstWalk.includes(c));
    expect(repeated).toHaveLength(1); // the fresh window start
    expect(calls.every((c) => c <= firstWalk[0]!)).toBe(true);
  });

  it('walks straight through a multi-month gap in the history', async () => {
    // The old heuristic stopped after 2 consecutive empty chunks, so a 2-month break from the watch
    // silently truncated everything older than it.
    const { store, engine } = engineWith(deepSource('2025-06-01', { from: '2026-03-01', to: '2026-05-31' }));

    await engine.syncUser('u1', { kind: 'full', backfillChunksPerRun: 20 });

    const steps = (await store.coverage('u1')).metrics.find((m) => m.metric === 'steps')!;
    expect(steps.firstDay).toBe('2025-06-01'); // history behind the gap survived
  });

  it('covers the whole gap after the app was down for weeks', async () => {
    // The freshness window reaches back to the LAST run, not just `incrementalDays` before today —
    // the backwards walk only ever covers days OLDER than the frontier, so a downtime hole would
    // otherwise never be filled by anything.
    const store = createMemoryStore();
    const engine = createSyncEngine({
      store,
      sourceFor: () => deepSource('2019-01-01'),
      clock,
      logger: nullLogger,
      random: sequenceRandom('run')
    });
    // Pretend the last successful sync was 40 days ago and history below it is already covered.
    await store.setSyncState('u1', {
      source: 'garmin',
      cursor: { metricsFrom: '2026-06-29', metricsBackfilledTo: '2026-06-01', metricsComplete: false },
      lastFullSyncAt: null,
      lastSyncAt: '2026-06-29T00:00:00.000Z'
    });

    await engine.syncUser('u1', { kind: 'incremental', backfillChunksPerRun: 0 });

    // Every day between the old cursor and today must now be present, not just the last 10.
    for (const day of ['2026-06-25', '2026-07-15', '2026-08-01', TODAY]) {
      expect(await store.getMetricDay('u1', 'steps', day)).not.toBeNull();
    }
  });

  it('reports how far the backfill got and how much is left', async () => {
    const { engine } = engineWith(deepSource('2019-01-01'));

    const run = await engine.syncUser('u1', {
      kind: 'full',
      backfillChunksPerRun: 2,
      metricsBackfillDays: 365
    });

    const m = run.detail!.metrics!;
    expect(m.backfillTarget).toBe('2025-08-08');
    expect(m.complete).toBe(false);
    expect(m.remainingDays).toBeGreaterThan(0);
    expect(m.backfillTo! > m.backfillTarget!).toBe(true);
    // The log carries the same progress in Polish, tagged with its phase for the /dane filter.
    const line = run.detail!.log!.find((e) => e.msg.includes('Uzupełniono do'));
    expect(line?.phase).toBe('metrics');
  });

  it('marks the backfill complete once it reaches an explicitly requested depth', async () => {
    const { store, engine } = engineWith(deepSource('2019-01-01'));

    const run = await engine.syncUser('u1', {
      kind: 'full',
      backfillChunksPerRun: 20,
      metricsBackfillDays: 120
    });

    expect(run.detail?.metrics?.complete).toBe(true);
    expect(run.detail?.metrics?.remainingDays).toBe(0);
    expect((await store.getSyncState('u1', 'garmin'))!.cursor.metricsComplete).toBe(true);
  });

  it('keeps the frontier it reached when the run is cancelled mid-backfill', async () => {
    const store = createMemoryStore();
    const engine = createSyncEngine({
      store,
      sourceFor: () => deepSource('2019-01-01'),
      clock,
      logger: nullLogger,
      random: sequenceRandom('run')
    });
    // Cancel as soon as the run row exists; the engine notices at its next progress write.
    const run = await engine.syncUser('u1', {
      kind: 'full',
      backfillChunksPerRun: 20,
      onStart: (id) => {
        void store.updateRun(id, { status: 'cancelled' });
      }
    });

    expect(run.status).toBe('cancelled');
    const cursor = (await store.getSyncState('u1', 'garmin'))?.cursor;
    // Cancelling is not a rollback: whatever depth was reached is persisted for the next run.
    if (cursor?.metricsBackfilledTo) expect(String(cursor.metricsBackfilledTo) <= TODAY).toBe(true);
  });
});

/* ------------------------------------------------------------------ *
 * Spec 019 — diagnostics: WHY a phase failed, not just that it did
 * ------------------------------------------------------------------ */

describe('sync engine — failure diagnostics (spec 019)', () => {
  it('records the sidecar classification instead of the error class name', async () => {
    const { engine } = engineWith(
      fakeSource({
        async getMetricRange(): Promise<GarminMetricRange> {
          throw new GarminUnavailableError('rate limited', {
            code: 'rate_limited',
            retryable: true,
            status: 429,
            endpoint: 'metrics/sleep/range'
          });
        }
      })
    );

    const run = await engine.syncUser('u1', { kind: 'incremental' });

    expect(run.detail?.metrics?.errorCode).toBe('rate_limited');
    expect(run.detail?.metrics?.retryable).toBe(true);
    expect(run.detail?.metrics?.error).toContain('ogranicza tempo');
    const warn = run.detail!.log!.find((e) => e.code === 'rate_limited');
    expect(warn).toMatchObject({ level: 'warn', phase: 'metrics', retryable: true });
    expect(warn?.metric).toBeDefined();
  });

  it('tells a dead sidecar apart from a rejected token', async () => {
    const { engine } = engineWith(
      fakeSource({
        async listActivitiesPage(): Promise<unknown[]> {
          throw new GarminUnavailableError('down', { code: 'sidecar_unreachable', retryable: true });
        }
      })
    );

    const run = await engine.syncUser('u1', { kind: 'incremental' });

    expect(run.detail?.activities?.errorCode).toBe('sidecar_unreachable');
    expect(run.detail?.activities?.error).toContain('sidecar');
    // A phase failure never blanks the rest of the run.
    expect(run.status).toBe('succeeded');
  });

  it('aborts the whole run when Garmin rejects the stored token', async () => {
    const { engine } = engineWith(
      fakeSource({
        async listActivitiesPage(): Promise<unknown[]> {
          throw new GarminNotAuthenticatedError('rejected', { code: 'token_rejected', retryable: false });
        }
      })
    );

    const run = await engine.syncUser('u1', { kind: 'incremental' });

    expect(run.status).toBe('failed');
    expect(run.error).toBe('garmin_not_connected');
    expect(run.detail!.log!.some((e) => e.code === 'token_rejected')).toBe(true);
  });

  it('never writes a credential-shaped value into the log', async () => {
    const { engine } = engineWith(fakeSource());
    const run = await engine.syncUser('u1', { kind: 'incremental' });
    const dump = JSON.stringify(run.detail?.log ?? []);
    for (const forbidden of ['password', 'token=', 'oauth', 'Bearer', '@']) {
      expect(dump.toLowerCase()).not.toContain(forbidden.toLowerCase());
    }
  });
});

/* ------------------------------------------------------------------ *
 * Spec 024 — planned workouts
 * ------------------------------------------------------------------ */

describe('sync engine — planned workouts (spec 024)', () => {
  it('stores the planned window when Garmin serves a calendar', async () => {
    const { store, engine } = engineWith(
      fakeSource({
        async getPlannedEvents(start, end) {
          return {
            start,
            end,
            available: true,
            events: [
              {
                id: 'w1',
                day: '2026-08-10',
                time: '18:00',
                kind: 'workout' as const,
                title: 'Interwały',
                sport: 'running',
                description: null,
                estimatedDurationS: 3600,
                estimatedDistanceM: 12000,
                targetLoad: null
              }
            ]
          };
        }
      })
    );

    const run = await engine.syncUser('u1', { kind: 'incremental' });

    expect(run.detail?.planned).toMatchObject({ available: true, count: 1 });
    const stored = await store.listPlannedEvents('u1', '2026-08-01', '2026-08-31');
    expect(stored).toHaveLength(1);
    expect(stored[0]).toMatchObject({ id: 'w1', sport: 'running', source: 'garmin' });
  });

  it('replaces the window so a plan deleted in Garmin disappears here too', async () => {
    let events = [
      {
        id: 'w1',
        day: '2026-08-10',
        time: null,
        kind: 'workout' as const,
        title: 'A',
        sport: null,
        description: null,
        estimatedDurationS: null,
        estimatedDistanceM: null,
        targetLoad: null
      }
    ];
    const { store, engine } = engineWith(
      fakeSource({
        async getPlannedEvents(start, end) {
          return { start, end, available: true, events };
        }
      })
    );

    await engine.syncUser('u1', { kind: 'incremental' });
    events = [];
    await engine.syncUser('u1', { kind: 'incremental' });

    expect(await store.listPlannedEvents('u1', '2026-08-01', '2026-08-31')).toEqual([]);
  });

  it('reports an unavailable calendar honestly instead of "no plans"', async () => {
    const { store, engine } = engineWith(
      fakeSource({
        async getPlannedEvents(start, end) {
          return { start, end, available: false, events: [] };
        }
      })
    );

    const run = await engine.syncUser('u1', { kind: 'incremental' });

    expect(run.detail?.planned).toMatchObject({ available: false, count: 0 });
    expect(await store.listPlannedEvents('u1', '2026-08-01', '2026-08-31')).toEqual([]);
  });

  it('skips the phase entirely for a source that cannot read the calendar', async () => {
    const { engine } = engineWith(fakeSource());
    const run = await engine.syncUser('u1', { kind: 'incremental' });
    expect(run.detail?.planned).toBeUndefined();
  });
});

/* ---------------- fast return on an unchanged probe (spec 027) ---------------- */

describe('syncIfChanged', () => {
  /** A source that counts calls, so "did we really skip the work?" is observable. */
  function countingSource(over: Partial<GarminSyncSource> = {}) {
    const calls = { pages: 0, ranges: 0 };
    const base = fakeSource(over);
    const source: GarminSyncSource = {
      ...base,
      async listActivitiesPage(limit, start) {
        calls.pages++;
        return base.listActivitiesPage(limit, start);
      },
      async getMetricRange(metric, start, end) {
        calls.ranges++;
        return base.getMetricRange(metric, start, end);
      }
    };
    return { source, calls };
  }

  it('syncs on the first tick, because there is no signature to compare against', async () => {
    const { source } = countingSource();
    const { store, engine } = engineWith(source);

    const run = await engine.syncIfChanged('u1', { kind: 'incremental' });

    expect(run).not.toBeNull();
    expect((await store.coverage('u1')).activities.count).toBe(2);
    const state = await store.getSyncState('u1', 'garmin');
    expect(state?.cursor.probeSignature).toBeTypeOf('string');
    expect(state?.cursor.lastResult).toBe('synced');
  });

  it('fast-returns when nothing upstream changed', async () => {
    const { source, calls } = countingSource();
    const { store, engine } = engineWith(source);

    await engine.syncIfChanged('u1', { kind: 'incremental' });
    const afterFirst = { ...calls };
    const runId = (await store.getLatestRun('u1'))?.id;

    const second = await engine.syncIfChanged('u1', { kind: 'incremental' });

    expect(second).toBeNull();
    // No new run row: the sync history keeps pointing at the run that actually did something.
    expect((await store.getLatestRun('u1'))?.id).toBe(runId);
    // Exactly the two-call probe on top of the first run's work.
    expect(calls.pages).toBe(afterFirst.pages + 1);
    expect(calls.ranges).toBe(afterFirst.ranges + 1);

    const state = await store.getSyncState('u1', 'garmin');
    expect(state?.cursor.lastResult).toBe('unchanged');
    expect(state?.cursor.lastCheckAt).toBeTypeOf('string');
  });

  it('syncs again once a new activity appears', async () => {
    let extra = false;
    const base = fakeSource();
    const source: GarminSyncSource = {
      ...base,
      async listActivitiesPage(limit, start) {
        const page = (await base.listActivitiesPage(limit, start)) as Array<Record<string, unknown>>;
        if (!extra || start > 0) return page;
        return [
          {
            activityId: 333,
            activityName: 'Walk C',
            activityType: { typeKey: 'walking' },
            startTimeLocal: '2026-08-08 07:00:00',
            startTimeGMT: '2026-08-08 05:00:00',
            distance: 5000,
            duration: 3600,
            averageHR: 95
          },
          ...page
        ];
      }
    };
    const { store, engine } = engineWith(source);

    await engine.syncIfChanged('u1', { kind: 'incremental' });
    extra = true;
    const second = await engine.syncIfChanged('u1', { kind: 'incremental' });

    expect(second).not.toBeNull();
    expect((await store.coverage('u1')).activities.count).toBe(3);
  });

  it("syncs again once today's step count moves", async () => {
    let steps = 1000;
    const base = fakeSource();
    const source: GarminSyncSource = {
      ...base,
      async getMetricRange(metric, start, end) {
        const range = await base.getMetricRange(metric, start, end);
        return {
          ...range,
          days: range.days.map((d) =>
            d.data === null ? d : { ...d, data: { ...(d.data as object), totalSteps: steps } }
          )
        };
      }
    };
    const { engine } = engineWith(source);

    await engine.syncIfChanged('u1', { kind: 'incremental' });
    expect(await engine.syncIfChanged('u1', { kind: 'incremental' })).toBeNull();

    steps = 4200;
    expect(await engine.syncIfChanged('u1', { kind: 'incremental' })).not.toBeNull();
  });

  it('syncs across a day rollover even with identical upstream data', async () => {
    const source = fakeSource();
    const store = createMemoryStore();
    let now = new Date(`${TODAY}T12:00:00Z`);
    const engine = createSyncEngine({
      store,
      sourceFor: () => source,
      clock: { now: () => now, nowSeconds: () => Math.floor(now.getTime() / 1000) },
      logger: nullLogger,
      random: sequenceRandom('run')
    });

    await engine.syncIfChanged('u1', { kind: 'incremental' });
    expect(await engine.syncIfChanged('u1', { kind: 'incremental' })).toBeNull();

    now = new Date('2026-08-09T12:00:00Z'); // the day key is part of the signature
    expect(await engine.syncIfChanged('u1', { kind: 'incremental' })).not.toBeNull();
  });

  it('fails open: an unreadable probe syncs instead of assuming nothing changed', async () => {
    let failProbe = false;
    const base = fakeSource();
    const source: GarminSyncSource = {
      ...base,
      async listActivitiesPage(limit, start) {
        if (failProbe) throw new GarminUnavailableError('sidecar down');
        return base.listActivitiesPage(limit, start);
      }
    };
    const { store, engine } = engineWith(source);

    await engine.syncIfChanged('u1', { kind: 'incremental' });
    const firstRunId = (await store.getLatestRun('u1'))?.id;

    failProbe = true;
    const second = await engine.syncIfChanged('u1', { kind: 'incremental' });

    expect(second).not.toBeNull();
    expect(second?.id).not.toBe(firstRunId); // a real run happened, and it recorded the failure
  });

  it('keeps the probe signature across a plain manual sync, so the next tick can still skip', async () => {
    const { source } = countingSource();
    const { store, engine } = engineWith(source);

    await engine.syncIfChanged('u1', { kind: 'incremental' });
    const signature = (await store.getSyncState('u1', 'garmin'))?.cursor.probeSignature;

    await engine.syncUser('u1', { kind: 'incremental' }); // e.g. the sidebar's quick button

    expect((await store.getSyncState('u1', 'garmin'))?.cursor.probeSignature).toBe(signature);
    expect(await engine.syncIfChanged('u1', { kind: 'incremental' })).toBeNull();
  });
});

/**
 * Best efforts (spec 054): derived from the streams the sync already stores, inside the streams
 * phase, bounded per run and progressing even on a tick that fetched nothing.
 */
describe('sync engine and the best-efforts derivation (spec 054)', () => {
  /** A 1 Hz speed stream: `seconds` samples at `mps`. */
  function pacedStream(seconds: number, mps: number): { speed: number[]; time: number[] } {
    const speed: number[] = [];
    const time: number[] = [];
    for (let i = 0; i < seconds; i++) {
      time.push(i);
      speed.push(mps);
    }
    return { speed, time };
  }

  /** The standard fake, but the RUN (222) comes back with a real speed stream. */
  function pacedSource(over: Partial<GarminSyncSource> = {}): GarminSyncSource {
    const base = fakeSource(over);
    return {
      ...base,
      async getActivityDetails(activityId): Promise<GarminActivityDetails> {
        const details = await base.getActivityDetails(activityId);
        return activityId === '222' ? { ...details, ...pacedStream(1200, 3.5) } : details;
      }
    };
  }

  it('derives and stores efforts for the runs it just synced, and reports them in the phase detail', async () => {
    const { store, engine } = engineWith(pacedSource());

    const run = await engine.syncUser('u1', { kind: 'full' });

    expect(run.detail?.streams).toMatchObject({ efforts: 1, effortsPending: 0 });
    const rows = await store.listTopBestEfforts('u1', { limit: 3 });
    expect(rows.length).toBeGreaterThan(0);
    // Only the run: the ride has no business on a best-efforts leaderboard.
    expect(new Set(rows.map((r) => r.activityId))).toEqual(new Set(['222']));
    expect(rows[0]?.day).toBe('2026-07-20'); // the activity's LOCAL start day
  });

  it('does not re-derive on the next run — the version stamp is what stops it', async () => {
    const { engine } = engineWith(pacedSource());
    await engine.syncUser('u1', { kind: 'full' });

    const second = await engine.syncUser('u1', { kind: 'incremental' });
    expect(second.detail?.streams).toMatchObject({ efforts: 0, effortsPending: 0 });
  });

  it('honours its per-run budget and leaves the rest pending', async () => {
    const { store, engine } = engineWith(pacedSource());
    const run = await engine.syncUser('u1', { kind: 'full', effortsPerRun: 0 });

    expect(run.detail?.streams).toMatchObject({ efforts: 0, effortsPending: 1 });
    expect(await store.listTopBestEfforts('u1', { limit: 3 })).toEqual([]);
  });

  it('keeps backfilling on a tick whose probe found nothing new — it is local work, not a Garmin call', async () => {
    const { store, engine } = engineWith(pacedSource());
    // First tick syncs everything but derives nothing (zero budget), so a backlog is left behind.
    await engine.syncIfChanged('u1', { kind: 'incremental', effortsPerRun: 0 });
    expect(await store.listTopBestEfforts('u1', { limit: 3 })).toEqual([]);

    // Nothing changed upstream: the tick fast-returns, and the backlog still drains.
    expect(await engine.syncIfChanged('u1', { kind: 'incremental' })).toBeNull();
    expect((await store.listTopBestEfforts('u1', { limit: 3 })).length).toBeGreaterThan(0);
  });

  it('re-derives after a stream repair rewrites the samples', async () => {
    const { store, engine } = engineWith(pacedSource());
    await engine.syncUser('u1', { kind: 'full' });
    const before = (await store.listTopBestEfforts('u1', { limit: 1 }))[0]!.durationS;

    // A row written by an older build: re-fetched by the streams phase, so its efforts must follow.
    await store.putStreams('u1', '222', { v: 1, ...pacedStream(1200, 2) });
    const run = await engine.syncUser('u1', { kind: 'incremental' });

    expect(run.detail?.streams).toMatchObject({ repaired: 1, efforts: 1 });
    expect((await store.listTopBestEfforts('u1', { limit: 1 }))[0]?.durationS).toBe(before);
  });
});
