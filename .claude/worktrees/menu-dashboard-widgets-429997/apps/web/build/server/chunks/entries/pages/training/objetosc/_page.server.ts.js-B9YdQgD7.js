import { t as todayKey, k as firstDayOf, y as yearOf, c as toDayKey, i as formatDay, h as monthKeyOf, l as lastMonths, n as dayOfYear, o as daysInYear, g as formatMonth, j as isDayKey } from '../../../../chunks/date.js-Cf0GyZI8.js';
import { b as sportGroup, e as sportGroupLane, a as sportGroupLabel } from '../../../../chunks/sport-labels.js-BKqMzU19.js';

const emptyBucket = () => ({
  activities: 0,
  distanceM: 0,
  durationS: 0,
  elevationGainM: 0
});
function add(b, a) {
  b.activities++;
  b.distanceM += a.distanceM ?? 0;
  b.durationS += a.durationS ?? 0;
  b.elevationGainM += a.elevationGainM ?? 0;
}
function usable(activities, group) {
  return activities.filter((a) => isDayKey(a.day) && (group === void 0 || a.group === group));
}
function monthlyVolume(activities, opts) {
  const currentMonth = monthKeyOf(opts.today);
  const months = lastMonths(currentMonth, Math.max(0, Math.trunc(opts.months)));
  const inWindow = new Set(months);
  const totals = new Map(months.map((m) => [m, emptyBucket()]));
  const perSport = /* @__PURE__ */ new Map();
  for (const a of usable(activities, opts.group)) {
    const month = monthKeyOf(a.day);
    if (!inWindow.has(month)) continue;
    const total = totals.get(month);
    if (!total) continue;
    add(total, a);
    let sportMonths = perSport.get(a.group);
    if (!sportMonths) {
      sportMonths = new Map(months.map((m) => [m, emptyBucket()]));
      perSport.set(a.group, sportMonths);
    }
    const bucket = sportMonths.get(month);
    if (bucket) add(bucket, a);
  }
  const monthTotals = months.map((month) => {
    const b = totals.get(month) ?? emptyBucket();
    return {
      month,
      activities: b.activities,
      distanceM: Math.round(b.distanceM),
      durationS: Math.round(b.durationS),
      elevationGainM: Math.round(b.elevationGainM),
      partial: month === currentMonth
    };
  });
  const bySport = [...perSport.entries()].map(([group, byMonth]) => ({
    group,
    distanceM: months.map((m) => Math.round(byMonth.get(m)?.distanceM ?? 0)),
    durationS: months.map((m) => Math.round(byMonth.get(m)?.durationS ?? 0)),
    elevationGainM: months.map((m) => Math.round(byMonth.get(m)?.elevationGainM ?? 0))
  })).sort((a, b) => sum(b.distanceM) - sum(a.distanceM));
  const complete = monthTotals.filter((m) => !m.partial && m.activities > 0);
  const avgDistanceM = complete.length === 0 ? null : Math.round(complete.reduce((s, m) => s + m.distanceM, 0) / complete.length);
  const bestMonth = complete.length === 0 ? null : complete.reduce((best, m) => m.distanceM > best.distanceM ? m : best);
  return { months, totals: monthTotals, bySport, avgDistanceM, bestMonth };
}
const sum = (xs) => xs.reduce((s, x) => s + x, 0);
function yearOverYear(activities, opts) {
  const thisYear = yearOf(opts.today);
  const cut = dayOfYear(opts.today);
  const oldest = thisYear - Math.max(1, Math.trunc(opts.years)) + 1;
  const byYear = /* @__PURE__ */ new Map();
  for (const a of usable(activities, opts.group)) {
    const day = a.day;
    const year = yearOf(day);
    if (year < oldest || year > thisYear) continue;
    let acc = byYear.get(year);
    if (!acc) {
      acc = {
        daily: new Array(daysInYear(year)).fill(0),
        activities: 0,
        elevationGainM: 0,
        durationS: 0
      };
      byYear.set(year, acc);
    }
    const i = dayOfYear(day) - 1;
    if (i >= 0 && i < acc.daily.length) acc.daily[i] = (acc.daily[i] ?? 0) + (a.distanceM ?? 0) / 1e3;
    acc.activities++;
    acc.elevationGainM += a.elevationGainM ?? 0;
    acc.durationS += a.durationS ?? 0;
  }
  const years = [...byYear.entries()].map(([year, acc]) => {
    const partial = year === thisYear;
    let running = 0;
    const cumulativeKm = acc.daily.map((km, i) => {
      running += km;
      return partial && i + 1 > cut ? null : round2(running);
    });
    return {
      year,
      cumulativeKm,
      totalKm: round2(running),
      toDateKm: round2(acc.daily.slice(0, cut).reduce((s, km) => s + km, 0)),
      activities: acc.activities,
      elevationGainM: Math.round(acc.elevationGainM),
      durationS: Math.round(acc.durationS),
      partial
    };
  }).sort((a, b) => b.year - a.year);
  const current = years.find((y) => y.year === thisYear);
  const previous = years.find((y) => y.year === thisYear - 1);
  const vsLastYearKm = current && previous ? round2(current.toDateKm - previous.toDateKm) : null;
  return { years, throughDayOfYear: cut, vsLastYearKm };
}
function round2(v) {
  return Math.round(v * 100) / 100;
}
const WINDOW_MONTHS = 24;
const WINDOW_YEARS = 4;
const YEAR_SLOTS = 366;
async function loadVolume(deps, req) {
  const today = todayKey(deps.clock);
  const from = firstDayOf(`${yearOf(today) - (WINDOW_YEARS - 1)}-01`);
  const rows = await deps.store.listActivities(req.userId, { from, to: today, limit: 2e4 });
  const activities = rows.map((a) => ({
    day: toDayKey(a.startTimeLocal),
    group: sportGroup(a.sport),
    distanceM: a.distanceM,
    // Moving time is the honest measure of training time; elapsed includes standing at lights.
    durationS: a.movingS ?? a.durationS,
    elevationGainM: a.elevationGainM
  }));
  const monthly = monthlyVolume(activities, { today, months: WINDOW_MONTHS });
  const yoy = yearOverYear(activities, { today, years: WINDOW_YEARS });
  const bySport = monthly.bySport.map((s) => ({
    group: s.group,
    label: sportGroupLabel(s.group),
    color: sportGroupLane(s.group),
    distanceM: s.distanceM,
    durationS: s.durationS,
    elevationGainM: s.elevationGainM
  }));
  const years = yoy.years.map((y) => ({
    year: y.year,
    cumulativeKm: padTo(y.cumulativeKm, YEAR_SLOTS),
    totalKm: y.totalKm,
    toDateKm: y.toDateKm,
    partial: y.partial
  }));
  const thisYear = yearOf(today);
  const perDay = /* @__PURE__ */ new Map();
  for (const a of activities) {
    if (yearOf(a.day) !== thisYear) continue;
    const bucket = perDay.get(a.day) ?? { km: 0, count: 0 };
    bucket.km += (a.distanceM ?? 0) / 1e3;
    bucket.count++;
    perDay.set(a.day, bucket);
  }
  const gridDays = [...perDay.entries()].sort((x, y) => x[0] < y[0] ? -1 : 1).map(([day, b]) => ({
    day,
    km: Math.round(b.km * 100) / 100,
    title: `${formatDay(day, "shortYear")}: ${b.km.toFixed(1).replace(".", ",")} km · ${b.count === 1 ? "1 aktywność" : `${b.count} aktywności`}`
  }));
  return {
    windowMonths: WINDOW_MONTHS,
    months: monthly.months,
    monthly: monthly.totals,
    bySport,
    avgDistanceM: monthly.avgDistanceM,
    bestMonth: monthly.bestMonth,
    years,
    throughDayOfYear: yoy.throughDayOfYear,
    vsLastYearKm: yoy.vsLastYearKm,
    dayOfYearLabels: dayOfYearLabels(),
    gridDays,
    gridYear: thisYear,
    hasData: activities.length > 0
  };
}
function padTo(values, length) {
  const out = values.slice(0, length);
  while (out.length < length) out.push(null);
  return out;
}
function dayOfYearLabels() {
  const labels = new Array(YEAR_SLOTS).fill("");
  for (let month = 1; month <= 12; month++) {
    const key = `2024-${String(month).padStart(2, "0")}`;
    const index = dayOfYearOfFirst(month);
    if (index < YEAR_SLOTS) labels[index] = formatMonth(key, "short");
  }
  return labels;
}
const LEAP_MONTH_STARTS = [0, 31, 60, 91, 121, 152, 182, 213, 244, 274, 305, 335];
function dayOfYearOfFirst(month) {
  return LEAP_MONTH_STARTS[month - 1] ?? 0;
}
const load = async ({ locals }) => {
  const user = locals.user;
  const c = locals.container;
  const volume = await loadVolume({ store: c.store, clock: c.clock }, { userId: user.id });
  return { volume };
};

var _page_server_ts = /*#__PURE__*/Object.freeze({
  __proto__: null,
  load: load
});

export { _page_server_ts as _ };
//# sourceMappingURL=_page.server.ts.js-B9YdQgD7.js.map
