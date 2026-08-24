import { M as redirect, B as error } from '../../../../chunks/utils.js-D6eaf5bT.js';
import { g as getConfig, f as findDashboard } from '../../../../chunks/dashboards.api.js-rpZOmEGy.js';
import { D as DEFAULT_TIME_ZONE, t as todayKey, f as dayRange, j as isDayKey, c as toDayKey } from '../../../../chunks/date.js-Cf0GyZI8.js';
import { M as METRICS, e as extractMetricValue } from '../../../../chunks/metric-specs.js-C1h9oD5N.js';
import { r as resolveRange, D as DEFAULT_RANGE } from '../../../../chunks/range.js-VDtVJAwH.js';
import { b as bucketSeries, v as volumeBucket } from '../../../../chunks/series.js-BlIzPiOH.js';
import { a as activeWeekStreak } from '../../../../chunks/streak.js-DeRn_93j.js';
import { l as loadRange } from '../../../../chunks/range-context.js-ulqHhV48.js';

const localDay = (a) => isDayKey(a.startTimeLocal.slice(0, 10)) ? toDayKey(a.startTimeLocal) : null;
function volumeBuckets(activities, range) {
  const bucket = volumeBucket(range);
  const lattice = dayRange(range.start, range.end);
  const hoursByDay = /* @__PURE__ */ new Map();
  const countByDay = /* @__PURE__ */ new Map();
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
    "sum"
  );
  const counts = bucketSeries(
    lattice,
    lattice.map((d) => countByDay.get(d) ?? 0),
    bucket,
    "sum"
  );
  return hours.days.map((week, i) => ({
    week,
    hours: Math.round((hours.values[i] ?? 0) * 10) / 10,
    activities: counts.values[i] ?? 0
  }));
}
function typeBreakdown(activities) {
  const counts = /* @__PURE__ */ new Map();
  for (const a of activities) counts.set(a.sport, (counts.get(a.sport) ?? 0) + 1);
  return [...counts.entries()].map(([sport, count]) => ({ sport, count })).sort((a, b) => b.count - a.count);
}
const RECENT_COUNT = 8;
async function loadWidgetData(store, userId, clock, timeZone = DEFAULT_TIME_ZONE, range = resolveRange(DEFAULT_RANGE, todayKey(clock, timeZone))) {
  const today = todayKey(clock, timeZone);
  const [coverage, allActivities, windowActivities] = await Promise.all([
    store.coverage(userId),
    // All-time: the streak walks back week by week until it breaks, so it cannot be windowed.
    store.listActivities(userId, { limit: 1e5 }),
    // Window-side query: the sport split, the volume bars and the recent list all come from this.
    store.listActivities(userId, { from: range.start, limit: 1e5, sort: "date", dir: "desc" })
  ]);
  const trendMetrics = ["steps", "hrv", "resting_heart_rate"];
  const metricSeries = {};
  await Promise.all(
    trendMetrics.map(async (name) => {
      const spec = METRICS.find((m) => m.key === name);
      const read = await store.getMetricRange(userId, name, range.start, range.end);
      const dates = read.days.map((d) => d.date);
      const values = read.days.map((d) => spec ? extractMetricValue(spec, d.data) : null);
      const { days: keys, values: bucketed } = bucketSeries(dates, values, range.bucket, "mean");
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
const load = async ({ locals, params, url }) => {
  const user = locals.user;
  if (!await locals.consent.isEnabled("detailed_analytics")) redirect(303, "/");
  const c = locals.container;
  const config = await getConfig(c.repo.settings, user.id);
  const dashboard = findDashboard(config, params.id);
  if (!dashboard) error(404, "Nie ma takiego panelu");
  const range = await loadRange(
    { store: c.store, clock: c.clock, timeZone: c.config.appTimeZone },
    user.id,
    url
  );
  const widgetData = await loadWidgetData(c.store, user.id, c.clock, c.config.appTimeZone, range);
  return { config, dashboard, widgetData };
};

var _page_server_ts = /*#__PURE__*/Object.freeze({
  __proto__: null,
  load: load
});

export { _page_server_ts as _ };
//# sourceMappingURL=_page.server.ts.js-w50-v3Ry.js.map
