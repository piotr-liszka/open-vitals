/**
 * Composite GarminService (spec 015). READ paths (`getMetric`, `getMetricRange`) resolve from the
 * local synced store — so the dashboard, analytics, insights and MCP all read local data and never
 * hit Garmin at view time. AUTH/STATUS/DISCONNECT delegate to the real sidecar adapter (they are not
 * data reads). This lets every existing reader keep the `GarminService` contract unchanged while the
 * data source flips to local; the sync engine is the only thing that talks to the sidecar for data.
 *
 * `activities` is the one metric name that is NOT a metric-day row: the sync engine normalizes
 * activities into their own table (spec 019) and excludes them from the daily-metric walk, so the
 * generic `synced_metric_days` lookup returns null for every single day. It is resolved from
 * `listActivities` instead — see `activitiesForRange`.
 */
import type {
  GarminLoginInput,
  GarminLoginResult,
  GarminMetricName,
  GarminMetricRange,
  GarminService,
  GarminStatus
} from '../interfaces';
import type { ActivitySummary, LocalStore } from './types';

export interface LocalGarminDeps {
  /** The synced local store (read source). */
  store: LocalStore;
  /** The raw sidecar-backed service (auth/status/disconnect passthrough). */
  sidecar: GarminService;
  userId: string;
}

/**
 * Upper bound on activities read for one metric read. A range read is capped at 31 days upstream and
 * a day holds a handful of sessions, so this is a runaway guard, not a real limit.
 */
const ACTIVITY_READ_LIMIT = 2000;

export function createLocalGarminService(deps: LocalGarminDeps): GarminService {
  const { store, sidecar, userId } = deps;
  return {
    login(input: GarminLoginInput): Promise<GarminLoginResult> {
      return sidecar.login(input);
    },
    getStatus(): Promise<GarminStatus> {
      return sidecar.getStatus();
    },
    disconnect(): Promise<void> {
      return sidecar.disconnect();
    },
    async getMetric(name: GarminMetricName, date?: string): Promise<unknown> {
      // Return the sidecar's `{metric,date,data}` envelope so every reader's contract is unchanged.
      // Callers that omit the date want "today"; the store is keyed by explicit day, so resolve the
      // most recent synced day when no date is given.
      if (name === 'activities') {
        const day = date ?? (await lastActivityDay(store, userId));
        if (!day) return { metric: name, date: date ?? null, data: null };
        const { days } = await activitiesForRange(store, userId, day, day);
        return { metric: name, date: day, data: days[0]?.data ?? null };
      }
      if (date) return { metric: name, date, data: await store.getMetricDay(userId, name, date) };
      return latestMetric(store, userId, name);
    },
    getMetricRange(name: GarminMetricName, start: string, end: string): Promise<GarminMetricRange> {
      if (name === 'activities') return activitiesForRange(store, userId, start, end);
      return store.getMetricRange(userId, name, start, end);
    }
  };
}

/** Most recent non-null day for a metric within the last ~370 days, wrapped like a sidecar read. */
async function latestMetric(store: LocalStore, userId: string, name: GarminMetricName): Promise<unknown> {
  const cov = (await store.coverage(userId)).metrics.find((m) => m.metric === name);
  if (!cov?.lastDay) return { metric: name, date: null, data: null };
  const data = await store.getMetricDay(userId, name, cov.lastDay);
  return { metric: name, date: cov.lastDay, data };
}

/* ---------------- activities ---------------- */

/** The activity payload a metric read exposes: normalized fields, minus internal/bulk columns. */
type ActivityDayEntry = Omit<ActivitySummary, 'userId' | 'raw'>;

/** Drops `userId` (the caller already scoped it) and `raw` (the heavy blob bulk reads never load). */
function forWire(a: ActivitySummary): ActivityDayEntry {
  const { userId: _userId, raw: _raw, ...rest } = a;
  return rest;
}

/** Local training day of an activity (`start_time_local` is `YYYY-MM-DD HH:MM:SS`). */
function localDay(a: ActivitySummary): string {
  return a.startTimeLocal.slice(0, 10);
}

/** Newest local day the user has an activity on, or null when they have none at all. */
async function lastActivityDay(store: LocalStore, userId: string): Promise<string | null> {
  const [newest] = await store.listActivities(userId, { sort: 'date', dir: 'desc', limit: 1 });
  return newest ? localDay(newest) : null;
}

/**
 * Activities per local day across an inclusive range, in the `GarminMetricRange` shape.
 *
 * A day inside the synced activity history with no session is `[]` (a rest day — real data), while a
 * day outside it stays `null` (unknown/not synced). Collapsing both to null is what made a 31-day
 * read indistinguishable from a broken feed.
 */
async function activitiesForRange(
  store: LocalStore,
  userId: string,
  start: string,
  end: string
): Promise<GarminMetricRange> {
  const metric: GarminMetricName = 'activities';
  const [inWindow, [oldest], [newest]] = await Promise.all([
    store.listActivities(userId, {
      from: start,
      to: end,
      sort: 'date',
      dir: 'asc',
      limit: ACTIVITY_READ_LIMIT
    }),
    store.listActivities(userId, { sort: 'date', dir: 'asc', limit: 1 }),
    store.listActivities(userId, { sort: 'date', dir: 'desc', limit: 1 })
  ]);

  const byDay = new Map<string, ActivityDayEntry[]>();
  for (const a of inWindow) {
    const day = localDay(a);
    const bucket = byDay.get(day);
    if (bucket) bucket.push(forWire(a));
    else byDay.set(day, [forWire(a)]);
  }

  // Bounds of the synced history, which decide rest-day (`[]`) vs not-synced (`null`).
  const first = oldest ? localDay(oldest) : null;
  const last = newest ? localDay(newest) : null;

  const days: GarminMetricRange['days'] = [];
  const cursor = new Date(`${start}T00:00:00Z`);
  const stop = new Date(`${end}T00:00:00Z`);
  while (cursor.getTime() <= stop.getTime()) {
    const stamp = cursor.toISOString().slice(0, 10);
    const found = byDay.get(stamp);
    const covered = first !== null && last !== null && stamp >= first && stamp <= last;
    days.push({ date: stamp, data: found ?? (covered ? [] : null) });
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return { metric, start, end, days };
}
