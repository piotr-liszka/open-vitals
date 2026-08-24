import { M as METRICS, e as extractMetricValue } from "../../../../chunks/metric-specs.js";
import { a as todayKey, t as toDayKey } from "../../../../chunks/date.js";
import { r as resolveRange, D as DEFAULT_RANGE } from "../../../../chunks/range.js";
import { v as volumeBucket, d as bucketLattice, e as bucketStart } from "../../../../chunks/series.js";
import { s as sportKeysInGroup, b as sportLabel } from "../../../../chunks/sport-labels.js";
import { l as loadRange } from "../../../../chunks/range-context.js";
const HIGHLIGHT_COUNT = 5;
const STEPS_SPEC = METRICS.find((m) => m.key === "steps");
const round1 = (n) => Math.round(n * 10) / 10;
async function loadWalking(deps, req) {
  const today = todayKey(deps.clock);
  const range = req.range ?? resolveRange(DEFAULT_RANGE, today);
  const bucket = volumeBucket(range);
  const from = range.start;
  const [activities, stepRange] = await Promise.all([
    deps.store.listActivities(req.userId, {
      sports: sportKeysInGroup("walk"),
      from,
      limit: 5e3
    }),
    // Daily steps are the ambient counterpart to logged walks; a walker judges a week by both.
    deps.store.getMetricRange(req.userId, "steps", from, today)
  ]);
  const weeks = bucketLattice(from, today, bucket);
  const weekIndex = new Map(weeks.map((w, i) => [w, i]));
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
    const slot = i === void 0 ? void 0 : buckets[i];
    if (slot) {
      slot.meters += meters;
      slot.seconds += seconds;
      slot.elevationM += elevation;
      slot.sessions += 1;
    }
  }
  const weekly = buckets.map((b) => ({
    week: b.week,
    km: round1(b.meters / 1e3),
    sessions: b.sessions,
    hours: round1(b.seconds / 3600),
    elevationM: Math.round(b.elevationM)
  }));
  const highlights = [...activities].sort((x, y) => (y.distanceM ?? 0) - (x.distanceM ?? 0) || (x.startTimeLocal < y.startTimeLocal ? 1 : -1)).slice(0, HIGHLIGHT_COUNT).map((a) => ({
    activityId: a.activityId,
    day: toDayKey(a.startTimeLocal),
    name: a.name,
    sportLabel: sportLabel(a.sport),
    km: round1((a.distanceM ?? 0) / 1e3),
    durationS: Math.round(a.movingS ?? a.durationS ?? 0),
    elevationM: Math.round(a.elevationGainM ?? 0)
  }));
  const steps = stepRange.days.map((d) => ({
    day: d.date,
    steps: STEPS_SPEC ? extractMetricValue(STEPS_SPEC, d.data) : null
  }));
  const known = steps.filter((s) => s.steps !== null);
  const avgSteps = known.length > 0 ? Math.round(known.reduce((sum, s) => sum + s.steps, 0) / known.length) : null;
  return {
    range,
    totals: {
      sessions: activities.length,
      totalKm: round1(totalM / 1e3),
      longestKm: round1(longestM / 1e3),
      totalTimeS: Math.round(totalTimeS),
      totalElevationM: Math.round(totalElevationM),
      avgPaceSecPerKm: totalM > 0 && totalTimeS > 0 ? Math.round(totalTimeS / (totalM / 1e3)) : null
    },
    weekly,
    highlights,
    steps,
    avgSteps,
    hasData: activities.length > 0,
    hasSteps: known.length > 0
  };
}
const load = async ({ locals, url }) => {
  const user = locals.user;
  const c = locals.container;
  const range = await loadRange(
    { store: c.store, clock: c.clock, timeZone: c.config.appTimeZone },
    user.id,
    url
  );
  const walking = await loadWalking({ store: c.store, clock: c.clock }, { userId: user.id, range });
  return { walking };
};
export {
  load
};
