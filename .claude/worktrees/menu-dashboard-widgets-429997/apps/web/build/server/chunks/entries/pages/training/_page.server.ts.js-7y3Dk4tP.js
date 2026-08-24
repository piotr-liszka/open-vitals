import { M as redirect } from '../../../chunks/utils.js-D6eaf5bT.js';
import { b as buildTrainingLoad, a as activityLoad } from '../../../chunks/training-load.js-DHd0MMKR.js';
import { b as buildPowerProfile } from '../../../chunks/power-profile.js-CfSj4S4i.js';
import { l as loadRisk } from '../../../chunks/load-risk.js-Dfmk1QQ7.js';
import { a as activeWeekStreak } from '../../../chunks/streak.js-DeRn_93j.js';
import { t as todayKey, b as addDays, c as toDayKey, m as maxDay, d as daysBetween, s as startOfWeek, h as monthKeyOf, g as formatMonth } from '../../../chunks/date.js-Cf0GyZI8.js';
import { r as resolveRange, D as DEFAULT_RANGE } from '../../../chunks/range.js-VDtVJAwH.js';
import { v as volumeBucket, a as bucketLattice, c as bucketStart } from '../../../chunks/series.js-BlIzPiOH.js';
import { b as sportGroup, e as sportGroupLane, a as sportGroupLabel } from '../../../chunks/sport-labels.js-BKqMzU19.js';
import { S as SPORT_SLUGS } from '../../../chunks/training-nav.js-D-TPJLDl.js';
import { a as weeklyWindowStart, b as weekLattice, w as weeklyVolume } from '../../../chunks/weekly-volume.js-8BKa7ZsC.js';
import { l as loadRange } from '../../../chunks/range-context.js-ulqHhV48.js';

const EASY_CEILING = 0.8;
const HARD_FLOOR = 0.87;
const EASY_TARGET_PCT = 80;
const EASY_TOLERANCE_PCT = 5;
const ADVICE = {
  "on-model": "Rozkład intensywności jest zgodny z modelem spolaryzowanym — większość czasu spokojnie, reszta naprawdę mocno. To najlepiej udokumentowany sposób budowania wytrzymałości.",
  "too-hard": "Zbyt mała część treningu jest spokojna. Najczęstszy błąd samodzielnie trenujących: łatwe biegi robią się średnio szybkie, a mocne przestają być mocne. Zwolnij na spokojnych jednostkach, a nie skracaj ich.",
  "too-easy": "Prawie cały trening jest spokojny. Baza tlenowa rośnie, ale bez regularnych mocnych bodźców tempo na zawodach zwykle stoi w miejscu. Wystarczy jedna–dwie intensywne jednostki w tygodniu.",
  unknown: "Bez maksymalnego tętna nie da się zaklasyfikować intensywności. Ustaw je w ustawieniach lub zsynchronizuj trening z pomiarem tętna."
};
const BAND_ORDER = ["easy", "moderate", "hard"];
function bandFor(avgHr, maxHr) {
  const fraction = avgHr / maxHr;
  if (fraction < EASY_CEILING) return "easy";
  if (fraction < HARD_FLOOR) return "moderate";
  return "hard";
}
function intensityMix(sessions, maxHr) {
  const empty = (band) => ({
    band,
    sessions: 0,
    seconds: 0,
    pct: 0,
    load: 0
  });
  if (!maxHr || !(maxHr > 0)) {
    return {
      bands: BAND_ORDER.map(empty),
      easyPct: null,
      unclassifiedSessions: sessions.length,
      classifiedSessions: 0,
      verdict: "unknown",
      advice: ADVICE.unknown,
      maxHr: null
    };
  }
  const buckets = new Map(
    BAND_ORDER.map((b) => [b, { sessions: 0, seconds: 0, load: 0 }])
  );
  let unclassified = 0;
  let classified = 0;
  let totalSeconds = 0;
  for (const s of sessions) {
    const seconds = isNum(s.durationS) && s.durationS > 0 ? s.durationS : 0;
    if (!isNum(s.avgHr) || s.avgHr <= 0 || seconds === 0) {
      unclassified++;
      continue;
    }
    const bucket = buckets.get(bandFor(s.avgHr, maxHr));
    if (!bucket) continue;
    bucket.sessions++;
    bucket.seconds += seconds;
    bucket.load += isNum(s.trainingLoad) && s.trainingLoad > 0 ? s.trainingLoad : 0;
    classified++;
    totalSeconds += seconds;
  }
  const bands = BAND_ORDER.map((band) => {
    const b = buckets.get(band) ?? { sessions: 0, seconds: 0, load: 0 };
    return {
      band,
      sessions: b.sessions,
      seconds: Math.round(b.seconds),
      // Share of CLASSIFIED time: including unclassified sessions in the denominator would make every
      // strapless session look like a shortfall in easy training.
      pct: totalSeconds > 0 ? round1$1(b.seconds / totalSeconds * 100) : 0,
      load: Math.round(b.load)
    };
  });
  const easyPct = totalSeconds > 0 ? bands.find((b) => b.band === "easy")?.pct ?? 0 : null;
  const verdict = verdictFor(easyPct);
  return {
    bands,
    easyPct,
    unclassifiedSessions: unclassified,
    classifiedSessions: classified,
    verdict,
    advice: ADVICE[verdict],
    maxHr
  };
}
function verdictFor(easyPct) {
  if (easyPct === null) return "unknown";
  if (easyPct < EASY_TARGET_PCT - EASY_TOLERANCE_PCT) return "too-hard";
  if (easyPct > 95) return "too-easy";
  return "on-model";
}
const WEEKLY_TARGET_MINUTES = 150;
function weeklyIntensityMinutes(sessions, weeks, maxHr, mondayOf) {
  const buckets = new Map(
    weeks.map((w) => [w, { moderate: 0, vigorous: 0 }])
  );
  if (maxHr && maxHr > 0) {
    for (const s of sessions) {
      if (!isNum(s.avgHr) || s.avgHr <= 0 || !isNum(s.durationS) || s.durationS <= 0) continue;
      const band = bandFor(s.avgHr, maxHr);
      if (band === "easy") continue;
      const bucket = buckets.get(mondayOf(s.day));
      if (!bucket) continue;
      const minutes = s.durationS / 60;
      if (band === "moderate") bucket.moderate += minutes;
      else bucket.vigorous += minutes;
    }
  }
  return weeks.map((week) => {
    const b = buckets.get(week) ?? { moderate: 0, vigorous: 0 };
    const moderateMinutes = Math.round(b.moderate);
    const vigorousMinutes = Math.round(b.vigorous);
    const weightedMinutes = moderateMinutes + vigorousMinutes * 2;
    return {
      week,
      moderateMinutes,
      vigorousMinutes,
      weightedMinutes,
      metTarget: weightedMinutes >= WEEKLY_TARGET_MINUTES
    };
  });
}
const isNum = (v) => typeof v === "number" && Number.isFinite(v);
function round1$1(v) {
  return Math.round(v * 10) / 10;
}
function numberSetting(settings, key) {
  const v = settings[key];
  return typeof v === "number" && Number.isFinite(v) && v > 0 ? v : null;
}
function emptyAccumulator() {
  return { activities: 0, durationS: 0, distanceM: 0, elevationGainM: 0, load: 0 };
}
function sportHref(group) {
  const slug = SPORT_SLUGS[group];
  return slug === void 0 ? null : `/training/${slug}`;
}
const round1 = (n) => Math.round(n * 10) / 10;
async function loadTrainingOverview(deps, req) {
  const today = todayKey(deps.clock);
  const historyStart = addDays(today, -539);
  const range = req.range ?? resolveRange(DEFAULT_RANGE, today);
  const [activities, userSettings] = await Promise.all([
    // Store-side window instead of reading every activity ever synced and slicing in memory.
    deps.store.listActivities(req.userId, { from: historyStart, limit: 2e4 }),
    deps.settings.get(req.userId)
  ]);
  const needsStream = activities.filter((a) => a.trainingLoad == null || a.trainingLoad <= 0);
  const streamById = await deps.store.getStreamField(
    req.userId,
    needsStream.map((a) => a.activityId),
    "power"
  );
  let ftpWatts = numberSetting(userSettings, "ftpWatts");
  if (ftpWatts == null) {
    const powerActs = needsStream.flatMap((a) => {
      const power = streamById.get(a.activityId);
      return power ? [{ activityId: a.activityId, day: toDayKey(a.startTimeLocal), power }] : [];
    });
    if (powerActs.length > 0) ftpWatts = buildPowerProfile(powerActs, { weightKg: null }).ftpWatts;
  }
  const loadOpts = { ftpWatts, endDay: today };
  const toLoadActivity = (a) => ({
    day: toDayKey(a.startTimeLocal),
    durationS: a.movingS ?? a.durationS,
    trainingLoad: a.trainingLoad,
    avgHr: a.avgHr,
    maxHr: a.maxHr,
    power: a.trainingLoad != null && a.trainingLoad > 0 ? null : streamById.get(a.activityId) ?? null
  });
  const pmc = buildTrainingLoad(activities.map(toLoadActivity), loadOpts);
  const pmcFrom = addDays(today, -364);
  const series = pmc.series.filter((p) => p.day >= pmcFrom);
  const risk = loadRisk(pmc.series);
  const perSportFitness = [];
  const familiesWithLoad = new Set(activities.map((a) => sportGroup(a.sport)));
  for (const group of familiesWithLoad) {
    const own = activities.filter((a) => sportGroup(a.sport) === group);
    const familyPmc = buildTrainingLoad(own.map(toLoadActivity), loadOpts);
    if (!familyPmc.hasData) continue;
    perSportFitness.push({
      group,
      label: sportGroupLabel(group),
      color: sportGroupLane(group),
      ctl: familyPmc.ctl,
      atl: familyPmc.atl,
      tsb: familyPmc.tsb,
      band: familyPmc.band,
      risk: loadRisk(familyPmc.series)
    });
  }
  perSportFitness.sort((a, b) => b.ctl - a.ctl);
  const bucket = volumeBucket(range);
  const windowStart = maxDay(range.start, historyStart);
  const windowDays = daysBetween(windowStart, today) + 1;
  const weeks = bucketLattice(windowStart, today, bucket);
  const maxHrSetting = numberSetting(userSettings, "maxHrBpm");
  const observedMaxHr = activities.reduce(
    (m, a) => Math.max(m ?? 0, a.maxHr ?? a.avgHr ?? 0) || null,
    null
  );
  const mixSessions = activities.filter((a) => toDayKey(a.startTimeLocal) >= windowStart).map((a) => ({
    day: toDayKey(a.startTimeLocal),
    durationS: a.movingS ?? a.durationS,
    avgHr: a.avgHr,
    trainingLoad: a.trainingLoad
  }));
  const effectiveMaxHr = maxHrSetting ?? observedMaxHr;
  const mix = intensityMix(mixSessions, effectiveMaxHr);
  const weekIndex = new Map(weeks.map((w, i) => [w, i]));
  const intensityWeeks = weeklyIntensityMinutes(
    mixSessions,
    weeks,
    effectiveMaxHr,
    (day) => bucketStart(day, bucket)
  );
  const perGroup = /* @__PURE__ */ new Map();
  const hoursByGroup = /* @__PURE__ */ new Map();
  const totals = emptyAccumulator();
  for (const a of activities) {
    const day = toDayKey(a.startTimeLocal);
    if (day < windowStart) continue;
    const group = sportGroup(a.sport);
    const durationS = a.movingS ?? a.durationS ?? 0;
    const acc = perGroup.get(group) ?? emptyAccumulator();
    acc.activities += 1;
    acc.durationS += durationS;
    acc.distanceM += a.distanceM ?? 0;
    acc.elevationGainM += a.elevationGainM ?? 0;
    acc.load += activityLoad(toLoadActivity(a), loadOpts).tss;
    perGroup.set(group, acc);
    totals.activities += 1;
    totals.durationS += durationS;
    totals.distanceM += a.distanceM ?? 0;
    totals.elevationGainM += a.elevationGainM ?? 0;
    const wi = weekIndex.get(bucketStart(day, bucket));
    if (wi !== void 0) {
      const hours = hoursByGroup.get(group) ?? new Array(weeks.length).fill(0);
      hours[wi] = (hours[wi] ?? 0) + durationS / 3600;
      hoursByGroup.set(group, hours);
    }
  }
  const sports = [...perGroup.entries()].map(([group, acc]) => ({
    group,
    label: sportGroupLabel(group),
    activities: acc.activities,
    durationS: Math.round(acc.durationS),
    distanceM: Math.round(acc.distanceM),
    elevationGainM: Math.round(acc.elevationGainM),
    load: Math.round(acc.load),
    href: sportHref(group)
  })).sort(
    (x, y) => y.durationS - x.durationS || y.activities - x.activities || x.group.localeCompare(y.group)
  );
  const weekly = sports.flatMap((s) => {
    const hours = hoursByGroup.get(s.group);
    return hours ? [{ group: s.group, label: s.label, hours: hours.map(round1) }] : [];
  });
  return {
    series,
    ctl: pmc.ctl,
    atl: pmc.atl,
    tsb: pmc.tsb,
    band: pmc.band,
    recommendation: pmc.recommendation,
    risk,
    perSport: perSportFitness,
    intensityMix: mix,
    intensityWeeks,
    hasData: pmc.hasData,
    ftpWatts,
    // Deliberately over the loaded history, not the range: a streak is "how long have I kept this
    // up", which a 7-day window would silently truncate to 1 (spec 048).
    streakWeeks: activeWeekStreak(activities, today),
    range,
    windowDays,
    totals: {
      activities: totals.activities,
      durationS: Math.round(totals.durationS),
      distanceM: Math.round(totals.distanceM),
      elevationGainM: Math.round(totals.elevationGainM)
    },
    sports,
    weeks,
    weekly
  };
}
const WEEKLY_SUMMARY_WEEKS = 12;
const MAX_ROWS = 5e3;
async function loadWeeklySummary(deps, req) {
  const today = todayKey(deps.clock, deps.timeZone);
  const from = weeklyWindowStart(today, WEEKLY_SUMMARY_WEEKS);
  const weekStarts = weekLattice(today, WEEKLY_SUMMARY_WEEKS);
  const currentWeekStart = startOfWeek(today);
  const rows = await deps.store.listActivities(req.userId, { from, to: today, limit: MAX_ROWS });
  const activities = rows.map((a) => ({
    day: toDayKey(a.startTimeLocal),
    group: sportGroup(a.sport),
    distanceM: a.distanceM,
    // Moving time is the honest measure of training time; elapsed includes standing at lights.
    durationS: a.movingS ?? a.durationS,
    elevationGainM: a.elevationGainM
  }));
  const groups = new Set(activities.map((a) => a.group));
  const sports = [...groups].map((group) => {
    const weekly = weeklyVolume(activities, { today, weeks: WEEKLY_SUMMARY_WEEKS, group });
    const current = weekly[weekly.length - 1];
    return {
      group,
      label: sportGroupLabel(group),
      color: sportGroupLane(group),
      thisWeek: totalsOf(current),
      window: weekly.reduce(
        (acc, w) => ({
          activities: acc.activities + w.activities,
          distanceM: acc.distanceM + w.distanceM,
          durationS: acc.durationS + w.durationS,
          elevationGainM: acc.elevationGainM + w.elevationGainM
        }),
        emptyTotals()
      ),
      weekly: weekly.map((w) => ({
        week: w.week,
        activities: w.activities,
        distanceM: w.distanceM,
        durationS: w.durationS,
        elevationGainM: w.elevationGainM,
        partial: w.partial
      }))
    };
  }).sort(
    (a, b) => b.window.durationS - a.window.durationS || b.window.activities - a.window.activities || a.group.localeCompare(b.group)
  );
  const currentWeek = weekStarts.length > 0 ? weekStarts[weekStarts.length - 1] : currentWeekStart;
  return {
    weeks: WEEKLY_SUMMARY_WEEKS,
    weekStarts,
    monthLabels: monthChangeLabels(weekStarts),
    currentWeekStart: currentWeek ?? currentWeekStart,
    // 1 on a Monday, 7 on a Sunday — what turns "Ten tydzień" into an honest week-to-date caption.
    currentWeekDays: daysBetween(currentWeekStart, today) + 1,
    sports,
    defaultGroup: sports[0]?.group ?? null,
    hasData: sports.length > 0
  };
}
function emptyTotals() {
  return { activities: 0, distanceM: 0, durationS: 0, elevationGainM: 0 };
}
function totalsOf(week) {
  if (week === void 0) return emptyTotals();
  return {
    activities: week.activities,
    distanceM: week.distanceM,
    durationS: week.durationS,
    elevationGainM: week.elevationGainM
  };
}
function monthChangeLabels(weekStarts) {
  let previous = "";
  return weekStarts.map((week) => {
    const month = monthKeyOf(week);
    if (month === previous) return "";
    previous = month;
    return formatMonth(month, "short");
  });
}
const LEGACY_SPORT = {
  cycling: SPORT_SLUGS.ride,
  running: SPORT_SLUGS.run
};
const load = async ({ locals, url }) => {
  const legacy = LEGACY_SPORT[url.searchParams.get("sport") ?? ""];
  if (legacy) throw redirect(308, `/training/${legacy}`);
  const user = locals.user;
  const c = locals.container;
  const range = await loadRange(
    { store: c.store, clock: c.clock, timeZone: c.config.appTimeZone },
    user.id,
    url
  );
  const [overview, weekly] = await Promise.all([
    loadTrainingOverview(
      { store: c.store, settings: c.repo.settings, clock: c.clock },
      { userId: user.id, range }
    ),
    loadWeeklySummary({ store: c.store, clock: c.clock, timeZone: c.config.appTimeZone }, { userId: user.id })
  ]);
  return { overview, weekly };
};

var _page_server_ts = /*#__PURE__*/Object.freeze({
  __proto__: null,
  load: load
});

export { _page_server_ts as _ };
//# sourceMappingURL=_page.server.ts.js-7y3Dk4tP.js.map
