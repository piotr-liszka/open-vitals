/**
 * Walking (Marsz) data handler (spec 025). Reads only the local store: walk/hike activities in a
 * bounded window plus the synced daily step counts. The sport-family filter is pushed INTO the
 * store query (`sports`), so this page never loads a full activity history to throw most of it away.
 *
 * Pure over injected deps (store + clock) — no live Garmin, no `Date.now()`.
 */
import type { Clock } from '$lib/server/clock';
import type { LocalStore } from '$lib/server/store/types';
import { METRICS, extractMetricValue } from '$lib/server/garmin/metric-specs';
import { toDayKey, todayKey, type DayKey } from '$lib/date';
import { DEFAULT_RANGE, resolveRange } from '$lib/range';
import { bucketLattice, bucketStart, volumeBucket } from '$lib/series';
import { sportKeysInGroup, sportLabel } from '$lib/sport-labels';
import { createTranslator } from '$lib/i18n';
import type { WalkingData, WalkingHighlight, WalkingRequest, WalkingWeek, StepDay } from './walking.types';

export interface WalkingDeps {
  store: LocalStore;
  clock: Clock;
}

/** Fallback window (in weeks) when no global range is supplied. */
export const WALK_WEEKS = 12;
/** How many longest walks the highlights list shows. */
const HIGHLIGHT_COUNT = 5;

const STEPS_SPEC = METRICS.find((m) => m.key === 'steps');

const round1 = (n: number): number => Math.round(n * 10) / 10;

export async function loadWalking(deps: WalkingDeps, req: WalkingRequest): Promise<WalkingData> {
  const t = createTranslator(req.locale);
  const today = todayKey(deps.clock);
  // The window is the global range (spec 047); `WALK_WEEKS` is only the fallback for a caller that
  // does not pass one. Buckets stay weekly until the range is long enough to want months.
  const range = req.range ?? resolveRange(DEFAULT_RANGE, today);
  const bucket = volumeBucket(range);
  const from = range.start;

  const [activities, stepRange] = await Promise.all([
    deps.store.listActivities(req.userId, {
      sports: sportKeysInGroup('walk'),
      from,
      limit: 5000
    }),
    // Daily steps are the ambient counterpart to logged walks; a walker judges a week by both.
    deps.store.getMetricRange(req.userId, 'steps', from, today)
  ]);

  const weeks: DayKey[] = bucketLattice(from, today, bucket);
  const weekIndex = new Map<DayKey, number>(weeks.map((w, i) => [w, i]));

  const buckets = weeks.map((week) => ({ week, meters: 0, sessions: 0, seconds: 0, elevationM: 0 }));

  let totalM = 0;
  let longestM = 0;
  let totalTimeS = 0;
  let totalElevationM = 0;

  for (const a of activities) {
    const day = toDayKey(a.startTimeLocal);
    const meters = a.distanceM ?? 0;
    const seconds = a.movingS ?? a.durationS ?? 0;
    const elevation = a.elevationGainM ?? 0;

    totalM += meters;
    totalTimeS += seconds;
    totalElevationM += elevation;
    if (meters > longestM) longestM = meters;

    const i = weekIndex.get(bucketStart(day, bucket));
    const slot = i === undefined ? undefined : buckets[i];
    if (slot) {
      slot.meters += meters;
      slot.seconds += seconds;
      slot.elevationM += elevation;
      slot.sessions += 1;
    }
  }

  const weekly: WalkingWeek[] = buckets.map((b) => ({
    week: b.week,
    km: round1(b.meters / 1000),
    sessions: b.sessions,
    hours: round1(b.seconds / 3600),
    elevationM: Math.round(b.elevationM)
  }));

  const highlights: WalkingHighlight[] = [...activities]
    .sort((x, y) => (y.distanceM ?? 0) - (x.distanceM ?? 0) || (x.startTimeLocal < y.startTimeLocal ? 1 : -1))
    .slice(0, HIGHLIGHT_COUNT)
    .map((a) => ({
      activityId: a.activityId,
      day: toDayKey(a.startTimeLocal),
      name: a.name,
      sportLabel: sportLabel(t, a.sport),
      km: round1((a.distanceM ?? 0) / 1000),
      durationS: Math.round(a.movingS ?? a.durationS ?? 0),
      elevationM: Math.round(a.elevationGainM ?? 0)
    }));

  const steps: StepDay[] = stepRange.days.map((d) => ({
    day: d.date,
    steps: STEPS_SPEC ? extractMetricValue(STEPS_SPEC, d.data) : null
  }));
  const known = steps.filter((s): s is { day: string; steps: number } => s.steps !== null);
  const avgSteps =
    known.length > 0 ? Math.round(known.reduce((sum, s) => sum + s.steps, 0) / known.length) : null;

  return {
    range,
    totals: {
      sessions: activities.length,
      totalKm: round1(totalM / 1000),
      longestKm: round1(longestM / 1000),
      totalTimeS: Math.round(totalTimeS),
      totalElevationM: Math.round(totalElevationM),
      avgPaceSecPerKm: totalM > 0 && totalTimeS > 0 ? Math.round(totalTimeS / (totalM / 1000)) : null
    },
    weekly,
    highlights,
    steps,
    avgSteps,
    hasData: activities.length > 0,
    hasSteps: known.length > 0
  };
}
