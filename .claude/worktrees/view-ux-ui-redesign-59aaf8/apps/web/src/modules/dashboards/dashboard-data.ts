/**
 * Widget data (spec 016). One loader assembles everything the built-in widgets need from the local
 * store, so widgets stay presentational. The bucketing/streak maths are pure + unit-tested; the
 * orchestrator just reads the store. Day maths goes through `$lib/date` (spec 018): keys are
 * calendar days in the user's zone, never UTC instants.
 */
import type { Clock } from '$lib/server/clock';
import {
  DEFAULT_TIME_ZONE,
  addDays,
  dayRange,
  isDayKey,
  startOfWeek,
  toDayKey,
  todayKey,
  type DayKey
} from '$lib/date';
import type { ActivitySummary, CoverageSnapshot, LocalStore } from '$lib/server/store/types';
import { METRICS, extractMetricValue } from '$lib/server/garmin/metric-specs';
import type { GarminMetricName } from '$lib/server/interfaces';
import { DEFAULT_RANGE, resolveRange, type ResolvedRange } from '$lib/range';
import { bucketSeries, volumeBucket } from '$lib/series';
// The streak maths moved to `lib/` when Trening gained the same number (spec 048); re-exported here
// so the widget and its existing tests keep their import path.
import { activeWeekStreak } from '$lib/server/analytics/streak';

export { activeWeekStreak };

export interface WeekVolume {
  /**
   * Start of the bucket, YYYY-MM-DD: the Monday of the ISO week, or the 1st of the month once the
   * range is long enough to bucket monthly (spec 047).
   */
  week: DayKey;
  hours: number;
  activities: number;
}
export interface TypeSlice {
  sport: string;
  count: number;
}
export interface MetricPoint {
  date: string;
  value: number | null;
}
export interface WidgetData {
  /**
   * The global range this bag was assembled for (spec 047). Range-*aware* widgets are windowed by it
   * and say so with a badge; `coverage` and `streakWeeks` are deliberately all-time and are not. Which
   * is which lives in the widget registry, so a user-added widget inherits the right behaviour.
   */
  range: ResolvedRange;
  coverage: CoverageSnapshot;
  recentActivities: ActivitySummary[];
  weeklyVolume: WeekVolume[];
  streakWeeks: number;
  typeBreakdown: TypeSlice[];
  metricSeries: Record<string, MetricPoint[]>;
}

/** Monday of the ISO week containing `day`, as a day key. */
export function mondayOf(day: DayKey): DayKey {
  return startOfWeek(day);
}

/** Last `weeks` Mondays (oldest→newest) ending with the week containing `today`. */
export function recentWeeks(today: DayKey, weeks: number): DayKey[] {
  const thisMonday = startOfWeek(today);
  const out: DayKey[] = [];
  for (let i = weeks - 1; i >= 0; i--) out.push(addDays(thisMonday, -i * 7));
  return out;
}

/**
 * The activity's own local calendar day (Garmin already reports `startTimeLocal` as wall clock).
 * Returns null for a malformed timestamp so one bad row can't blank the whole widget.
 */
const localDay = (a: ActivitySummary): DayKey | null =>
  isDayKey(a.startTimeLocal.slice(0, 10)) ? toDayKey(a.startTimeLocal) : null;

/** Per-week training hours + activity counts over the trailing `weeks` window. */
export function weeklyVolume(activities: ActivitySummary[], today: DayKey, weeks = 8): WeekVolume[] {
  const buckets = new Map<string, { seconds: number; activities: number }>();
  for (const a of activities) {
    const day = localDay(a);
    if (day === null) continue;
    const wk = mondayOf(day);
    const b = buckets.get(wk) ?? { seconds: 0, activities: 0 };
    b.seconds += a.movingS ?? a.durationS ?? 0;
    b.activities += 1;
    buckets.set(wk, b);
  }
  return recentWeeks(today, weeks).map((week) => {
    const b = buckets.get(week);
    return { week, hours: b ? Math.round((b.seconds / 3600) * 10) / 10 : 0, activities: b?.activities ?? 0 };
  });
}

/**
 * Training volume per bucket across a resolved range (spec 047) — the range-aware generalisation of
 * `weeklyVolume`. Weekly while the range is weekly-or-finer, monthly once it is month-bucketed, so a
 * "cały czas" window is ~60 bars rather than ~280.
 *
 * Empty buckets are real zeros here, not gaps: a week with no training IS zero hours, unlike a metric
 * you simply did not record.
 */
export function volumeBuckets(activities: ActivitySummary[], range: ResolvedRange): WeekVolume[] {
  const bucket = volumeBucket(range);
  const lattice = dayRange(range.start, range.end);

  const hoursByDay = new Map<DayKey, number>();
  const countByDay = new Map<DayKey, number>();
  for (const a of activities) {
    const day = localDay(a);
    if (day === null || day < range.start || day > range.end) continue;
    hoursByDay.set(day, (hoursByDay.get(day) ?? 0) + (a.movingS ?? a.durationS ?? 0) / 3600);
    countByDay.set(day, (countByDay.get(day) ?? 0) + 1);
  }

  const hours = bucketSeries(
    lattice,
    lattice.map((d) => hoursByDay.get(d) ?? 0),
    bucket,
    'sum'
  );
  const counts = bucketSeries(
    lattice,
    lattice.map((d) => countByDay.get(d) ?? 0),
    bucket,
    'sum'
  );

  return hours.days.map((week, i) => ({
    week,
    hours: Math.round((hours.values[i] ?? 0) * 10) / 10,
    activities: counts.values[i] ?? 0
  }));
}

/** Activity count per sport, most frequent first. */
export function typeBreakdown(activities: ActivitySummary[]): TypeSlice[] {
  const counts = new Map<string, number>();
  for (const a of activities) counts.set(a.sport, (counts.get(a.sport) ?? 0) + 1);
  return [...counts.entries()].map(([sport, count]) => ({ sport, count })).sort((a, b) => b.count - a.count);
}

/** How many recent activities the "latest sessions" widget lists. */
const RECENT_COUNT = 8;

/**
 * Assemble the full widget data bag from the store (all reads local).
 *
 * `range` (spec 047) windows the range-aware parts: weekly volume covers the window's weeks, the sport
 * split and the recent list are confined to it, and each metric series is read over it and bucketed to
 * the range's granularity. Coverage and the active-week streak stay all-time on purpose — "how much
 * data do I hold" and "how long is my streak" are not questions a window can narrow.
 */
export async function loadWidgetData(
  store: LocalStore,
  userId: string,
  clock: Clock,
  timeZone: string = DEFAULT_TIME_ZONE,
  range: ResolvedRange = resolveRange(DEFAULT_RANGE, todayKey(clock, timeZone))
): Promise<WidgetData> {
  const today = todayKey(clock, timeZone);

  const [coverage, allActivities, windowActivities] = await Promise.all([
    store.coverage(userId),
    // All-time: the streak walks back week by week until it breaks, so it cannot be windowed.
    store.listActivities(userId, { limit: 100000 }),
    // Window-side query: the sport split, the volume bars and the recent list all come from this.
    store.listActivities(userId, { from: range.start, limit: 100000, sort: 'date', dir: 'desc' })
  ]);

  const trendMetrics: GarminMetricName[] = ['steps', 'hrv', 'resting_heart_rate'];
  const metricSeries: Record<string, MetricPoint[]> = {};
  await Promise.all(
    trendMetrics.map(async (name) => {
      const spec = METRICS.find((m) => m.key === name);
      const read = await store.getMetricRange(userId, name, range.start, range.end);
      const dates = read.days.map((d) => d.date);
      const values = read.days.map((d) => (spec ? extractMetricValue(spec, d.data) : null));
      // A widget sparkline is ~100px wide: a year of daily points there is a smudge, not a trend.
      const { days: keys, values: bucketed } = bucketSeries(dates, values, range.bucket, 'mean');
      metricSeries[name] = keys.map((date, i) => ({ date, value: bucketed[i] ?? null }));
    })
  );

  return {
    range,
    coverage,
    recentActivities: windowActivities.slice(0, RECENT_COUNT),
    weeklyVolume: volumeBuckets(windowActivities, range),
    streakWeeks: activeWeekStreak(allActivities, today),
    typeBreakdown: typeBreakdown(windowActivities),
    metricSeries
  };
}
