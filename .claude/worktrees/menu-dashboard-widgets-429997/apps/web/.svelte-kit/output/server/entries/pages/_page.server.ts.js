import { g as getHealth } from "../../chunks/health.api.js";
import { a as todayKey, e as dayRange, D as DEFAULT_TIME_ZONE, f as compareDays, i as isDayKey, c as addDays } from "../../chunks/date.js";
import { r as resolveRange, D as DEFAULT_RANGE } from "../../chunks/range.js";
import { b as bucketSeries } from "../../chunks/series.js";
import { G as GarminUnavailableError, a as GarminNotAuthenticatedError } from "../../chunks/interfaces.js";
import { m as maxOfArray, e as extractMetricValue } from "../../chunks/metric-specs.js";
import { f as formatMetricValue } from "../../chunks/dashboard.format.js";
import { l as listConsent } from "../../chunks/consent.api.js";
import { l as loadInsights, C as CONDITION_WINDOW_DAYS } from "../../chunks/insights.api.js";
import { e as estimateWorkoutDistanceM, a as estimateWorkoutDurationS } from "../../chunks/workouts.js";
import { a as sportGroup, b as sportLabel } from "../../chunks/sport-labels.js";
import { p as paceSecPerKm, f as fmtPace } from "../../chunks/running-profile.js";
import { l as loadRange } from "../../chunks/range-context.js";
import { r as resolveTier, A as ADVANCED_FEATURE } from "../../chunks/tier.js";
const DETAILED_ANALYTICS = "detailed_analytics";
const SNAPSHOT = [
  {
    key: "steps",
    label: "Kroki",
    accent: "orange",
    unit: "",
    format: "int",
    goodWhen: "up",
    keys: ["totalSteps"]
  },
  {
    key: "resting_heart_rate",
    label: "Tętno spoczynkowe",
    accent: "red",
    unit: "bpm",
    format: "int",
    goodWhen: "down",
    keys: ["restingHeartRate"]
  },
  {
    key: "body_battery",
    label: "Body Battery",
    accent: "cyan",
    unit: "",
    format: "int",
    goodWhen: "up",
    keys: [],
    extract: (data) => maxOfArray(data["bodyBatteryValuesArray"], 2)
  },
  {
    key: "sleep",
    label: "Sen",
    accent: "indigo",
    unit: "",
    format: "duration",
    goodWhen: "up",
    keys: ["dailySleepDTO.sleepTimeSeconds"]
  },
  {
    key: "hrv",
    label: "HRV",
    accent: "green",
    unit: "ms",
    format: "int",
    goodWhen: "up",
    keys: ["hrvSummary.lastNightAvg", "hrvSummary.weeklyAvg"]
  },
  {
    key: "stress",
    label: "Stres",
    accent: "amber",
    unit: "",
    format: "int",
    goodWhen: "down",
    keys: ["avgStressLevel"]
  }
];
function deltaPct(series) {
  const defined = series.filter((v) => v !== null);
  if (defined.length < 2) return null;
  const first = defined[0];
  const last = defined[defined.length - 1];
  if (first === 0) return null;
  return Math.round((last - first) / Math.abs(first) * 100);
}
function headlineOf(series) {
  for (let i = series.length - 1; i >= 0; i--) {
    const v = series[i];
    if (v !== null && v !== void 0) return v;
  }
  return null;
}
async function buildTile(garmin, spec, analyticsEnabled, range, dayLattice) {
  const base = {
    key: spec.key,
    label: spec.label,
    accent: spec.accent,
    value: null,
    unit: spec.unit,
    delta: null,
    goodWhen: spec.goodWhen,
    format: spec.format,
    series: []
  };
  try {
    if (analyticsEnabled) {
      const read = await garmin.getMetricRange(spec.key, range.start, range.end);
      const byDay = /* @__PURE__ */ new Map();
      for (const d of read.days) {
        const value = extractMetricValue(spec, d.data);
        if (value !== null) byDay.set(d.date, value);
      }
      const daily = dayLattice.map((day) => byDay.get(day) ?? null);
      const series = bucketSeries(dayLattice, daily, range.bucket, "mean").values;
      return {
        ...base,
        value: formatMetricValue(headlineOf(daily), spec.format),
        series,
        delta: deltaPct(series)
      };
    }
    const raw = await garmin.getMetric(spec.key, range.end);
    return { ...base, value: formatMetricValue(extractMetricValue(spec, raw), spec.format) };
  } catch (err) {
    if (err instanceof GarminUnavailableError || err instanceof GarminNotAuthenticatedError) return base;
    throw err;
  }
}
async function loadDashboard(deps, opts = {}) {
  const { garmin, consent, clock, timeZone = DEFAULT_TIME_ZONE } = deps;
  const today = todayKey(clock, timeZone);
  const range = opts.range ?? resolveRange(DEFAULT_RANGE, today);
  const dayLattice = dayRange(range.start, range.end);
  const days = bucketSeries(dayLattice, [], range.bucket).days;
  let connected = false;
  try {
    connected = (await garmin.getStatus()).authenticated;
  } catch (err) {
    if (!(err instanceof GarminUnavailableError)) throw err;
  }
  const analyticsEnabled = await consent.isEnabled(DETAILED_ANALYTICS);
  if (!connected) {
    return { connected: false, analyticsEnabled, date: today, range, days, tiles: [] };
  }
  const tiles = await Promise.all(
    SNAPSHOT.map((spec) => buildTile(garmin, spec, analyticsEnabled, range, dayLattice))
  );
  return { connected: true, analyticsEnabled, date: today, range, days, tiles };
}
const IMPORTANCE = {
  /** Floor for "you did a workout". */
  activityBase: 38,
  /** Points per hour of moving time, capped. */
  activityPerHour: 12,
  activityDurationCap: 24,
  /** Garmin training load ÷ this, capped. */
  activityLoadDivisor: 12,
  activityLoadCap: 12,
  /** A |z| ≥ 2 outlier. */
  healthModerate: 66,
  /** A |z| ≥ 3 outlier. */
  healthStrong: 88,
  /** Extra points for each z past the 2.0 threshold, capped. */
  healthZBonusPerZ: 7,
  healthZBonusCap: 7,
  milestoneRecord: 84,
  milestoneStreak: 76,
  milestoneNewSport: 72,
  min: 5,
  max: 95
};
const GROUP_IMPORTANCE = {
  run: 4,
  ride: 4,
  swim: 4,
  strength: 2,
  other: 0,
  walk: -8
};
const GROUP_ICON = {
  run: "run",
  ride: "ride",
  swim: "swim",
  walk: "walk",
  strength: "strength",
  other: "activity"
};
const GROUP_LANE = {
  run: "orange",
  ride: "cyan",
  swim: "sky",
  walk: "teal",
  strength: "violet",
  other: "lime"
};
const MILESTONE_MIN_PRIOR_IN_GROUP = 3;
const MILESTONE_MIN_HISTORY = 5;
const STREAK_MIN_DAYS = 7;
const NUM = new Intl.NumberFormat("pl-PL");
const NUM1 = new Intl.NumberFormat("pl-PL", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
function fmtDistance(meters) {
  if (meters == null || !Number.isFinite(meters) || meters <= 0) return null;
  return meters >= 1e3 ? `${NUM1.format(meters / 1e3)} km` : `${NUM.format(Math.round(meters))} m`;
}
function fmtHm(seconds) {
  if (seconds == null || !Number.isFinite(seconds) || seconds <= 0) return null;
  const total = Math.round(seconds);
  if (total < 60) return `${total} s`;
  const minutes = Math.round(total / 60);
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h} h ${String(m).padStart(2, "0")} min` : `${m} min`;
}
function localTimeOf(startTimeLocal) {
  const hhmm = startTimeLocal.slice(11, 16);
  return /^\d{2}:\d{2}$/.test(hhmm) ? hhmm : null;
}
function localDayOf(startTimeLocal) {
  const head = startTimeLocal.slice(0, 10);
  return isDayKey(head) ? head : null;
}
function activityStats(a) {
  const group = sportGroup(a.sport);
  const seconds = a.movingS ?? a.durationS;
  const stats = [];
  const distance = fmtDistance(a.distanceM);
  const duration = fmtHm(seconds);
  if (group === "run") {
    if (distance) stats.push({ label: "Dystans", value: distance });
    const pace = paceSecPerKm(seconds, a.distanceM);
    if (pace !== null) stats.push({ label: "Tempo", value: fmtPace(pace), unit: "/km" });
    if (duration) stats.push({ label: "Czas", value: duration });
  } else if (group === "ride") {
    if (distance) stats.push({ label: "Dystans", value: distance });
    if (a.avgPower != null && a.avgPower > 0) {
      stats.push({ label: "Śr. moc", value: NUM.format(Math.round(a.avgPower)), unit: "W" });
    } else if (a.distanceM != null && seconds != null && seconds > 0) {
      stats.push({
        label: "Śr. prędkość",
        value: NUM1.format(a.distanceM / 1e3 / (seconds / 3600)),
        unit: "km/h"
      });
    }
    if (duration) stats.push({ label: "Czas", value: duration });
  } else if (group === "swim") {
    if (distance) stats.push({ label: "Dystans", value: distance });
    const pace = paceSecPerKm(seconds, a.distanceM);
    if (pace !== null) stats.push({ label: "Tempo", value: fmtPace(pace / 10), unit: "/100 m" });
    if (duration) stats.push({ label: "Czas", value: duration });
  } else {
    if (duration) stats.push({ label: "Czas", value: duration });
    if (distance) stats.push({ label: "Dystans", value: distance });
    if (a.avgHr != null && a.avgHr > 0)
      stats.push({ label: "Śr. tętno", value: NUM.format(Math.round(a.avgHr)), unit: "bpm" });
  }
  if (stats.length < 3 && a.elevationGainM != null && a.elevationGainM >= 100) {
    stats.push({ label: "Przewyższenie", value: NUM.format(Math.round(a.elevationGainM)), unit: "m" });
  }
  return stats.slice(0, 3);
}
const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));
function activityImportance(a) {
  const seconds = a.movingS ?? a.durationS ?? 0;
  const hours = seconds > 0 ? seconds / 3600 : 0;
  const duration = Math.min(IMPORTANCE.activityDurationCap, hours * IMPORTANCE.activityPerHour);
  const load2 = Math.min(
    IMPORTANCE.activityLoadCap,
    Math.max(0, a.trainingLoad ?? 0) / IMPORTANCE.activityLoadDivisor
  );
  const group = GROUP_IMPORTANCE[sportGroup(a.sport)];
  return clamp(Math.round(IMPORTANCE.activityBase + duration + load2 + group), IMPORTANCE.min, IMPORTANCE.max);
}
function healthImportance(signal) {
  const base = signal.severity === "strong" ? IMPORTANCE.healthStrong : IMPORTANCE.healthModerate;
  const past = Math.max(0, Math.abs(signal.z) - 2);
  const bonus = Math.min(IMPORTANCE.healthZBonusCap, past * IMPORTANCE.healthZBonusPerZ);
  return clamp(Math.round(base + bonus), IMPORTANCE.min, IMPORTANCE.max);
}
function buildActivityEvents(history, from, to) {
  const out = [];
  for (const a of history) {
    const day = localDayOf(a.startTimeLocal);
    if (day === null || compareDays(day, from) < 0 || compareDays(day, to) > 0) continue;
    const group = sportGroup(a.sport);
    const label = sportLabel(a.sport);
    const name = a.name?.trim();
    out.push({
      kind: "activity",
      id: `activity:${a.activityId}`,
      day,
      time: localTimeOf(a.startTimeLocal),
      title: name && name.length > 0 ? name : label,
      detail: name && name.length > 0 && name !== label ? label : null,
      stats: activityStats(a),
      icon: GROUP_ICON[group],
      accent: GROUP_LANE[group],
      importance: activityImportance(a),
      primary: false,
      href: `/activities/${a.activityId}`,
      activityId: a.activityId,
      sport: a.sport,
      group,
      distanceM: a.distanceM,
      durationS: a.movingS ?? a.durationS
    });
  }
  return out;
}
const GOOD_WHEN = {
  sleep: "up",
  hrv: "up",
  body_battery: "up",
  steps: "up",
  calories: "up",
  spo2: "up",
  resting_heart_rate: "down",
  stress: "down",
  respiration: "down"
};
function classifySignal(metric, direction) {
  const up = direction === "up";
  switch (metric) {
    case "sleep":
      return up ? { signal: "long_sleep", title: "Wyjątkowo długi sen", icon: "moon" } : { signal: "poor_sleep", title: "Krótki sen", icon: "moon" };
    case "resting_heart_rate":
      return up ? { signal: "elevated_rhr", title: "Podwyższone tętno spoczynkowe", icon: "heart" } : { signal: "low_rhr", title: "Wyjątkowo niskie tętno spoczynkowe", icon: "heart" };
    case "hrv":
      return up ? { signal: "hrv_rise", title: "Skok HRV", icon: "pulse" } : { signal: "hrv_drop", title: "Spadek HRV", icon: "pulse" };
    case "stress":
      return up ? { signal: "high_stress", title: "Dzień z wysokim stresem", icon: "alert" } : { signal: "low_stress", title: "Dzień z niskim stresem", icon: "alert" };
    case "body_battery":
      return up ? { signal: "body_battery_peak", title: "Body Battery na maksimum", icon: "battery" } : { signal: "body_battery_crash", title: "Załamanie Body Battery", icon: "battery" };
    default:
      return { signal: "metric_outlier", title: "Nietypowy odczyt", icon: "activity" };
  }
}
function isUsableSignal(s) {
  return isDayKey(s.date) && Number.isFinite(s.value) && Number.isFinite(s.z) && (s.direction === "up" || s.direction === "down") && (s.severity === "moderate" || s.severity === "strong");
}
function buildHealthEvents(signals, from, to) {
  const out = [];
  for (const s of signals) {
    if (!isUsableSignal(s)) continue;
    if (compareDays(s.date, from) < 0 || compareDays(s.date, to) > 0) continue;
    const copy = classifySignal(s.key, s.direction);
    const goodWhen = GOOD_WHEN[s.key];
    const favourable = goodWhen === void 0 ? false : s.direction === goodWhen;
    out.push({
      kind: "health",
      id: `health:${s.key}:${s.date}`,
      day: s.date,
      time: null,
      title: copy.title,
      detail: `${s.label} ${s.direction === "up" ? "powyżej" : "poniżej"} Twojej zwykłej bazy`,
      stats: [
        { label: s.label, value: NUM1.format(Math.round(s.value * 10) / 10) },
        { label: "Odchylenie", value: `${s.z > 0 ? "+" : "−"}${NUM1.format(Math.abs(s.z))}`, unit: "σ" }
      ],
      icon: copy.icon,
      accent: s.accent,
      importance: healthImportance(s),
      primary: false,
      href: "/insights",
      metric: s.key,
      signal: copy.signal,
      severity: s.severity,
      direction: s.direction,
      value: s.value,
      z: s.z,
      favourable
    });
  }
  return out;
}
function streakLengths(days) {
  const unique = [...new Set(days)].sort((a, b) => compareDays(a, b));
  const lengths = /* @__PURE__ */ new Map();
  let run = 0;
  let previous = null;
  for (const day of unique) {
    run = previous !== null && addDays(previous, 1) === day ? run + 1 : 1;
    lengths.set(day, run);
    previous = day;
  }
  return lengths;
}
function isStreakMilestone(length) {
  return length >= STREAK_MIN_DAYS && (length % 7 === 0 || length % 10 === 0);
}
function buildMilestoneEvents(history, from, to) {
  const dated = history.map((a) => ({ a, day: localDayOf(a.startTimeLocal) })).filter((e) => e.day !== null).sort((x, y) => compareDays(x.day, y.day) || x.a.startTimeLocal.localeCompare(y.a.startTimeLocal));
  const out = [];
  const maxDistance = /* @__PURE__ */ new Map();
  const maxDuration = /* @__PURE__ */ new Map();
  const countInGroup = /* @__PURE__ */ new Map();
  const seenSports = /* @__PURE__ */ new Set();
  const streaks = streakLengths(dated.map((e) => e.day));
  const streakAnnounced = /* @__PURE__ */ new Set();
  let seen = 0;
  for (const { a, day } of dated) {
    const group = sportGroup(a.sport);
    const priorInGroup = countInGroup.get(group) ?? 0;
    const bestDistance = maxDistance.get(group) ?? 0;
    const bestDuration = maxDuration.get(group) ?? 0;
    const duration = a.movingS ?? a.durationS ?? 0;
    const inWindow = compareDays(day, from) >= 0 && compareDays(day, to) <= 0;
    const label = sportLabel(a.sport);
    const time = localTimeOf(a.startTimeLocal);
    const beatsDistance = (a.distanceM ?? 0) > bestDistance && priorInGroup >= MILESTONE_MIN_PRIOR_IN_GROUP;
    const beatsDuration = duration > bestDuration && priorInGroup >= MILESTONE_MIN_PRIOR_IN_GROUP;
    const isNewSport = !seenSports.has(a.sport) && seen >= MILESTONE_MIN_HISTORY;
    if (inWindow && beatsDistance) {
      out.push({
        kind: "milestone",
        id: `milestone:distance:${a.activityId}`,
        day,
        time,
        title: `Najdłuższy dystans — ${label.toLocaleLowerCase("pl-PL")}`,
        detail: `Twój rekord w tej dyscyplinie: ${fmtDistance(a.distanceM) ?? "—"}`,
        stats: [{ label: "Poprzedni rekord", value: fmtDistance(bestDistance) ?? "—" }],
        icon: "trophy",
        accent: "orange",
        importance: IMPORTANCE.milestoneRecord,
        primary: false,
        href: `/activities/${a.activityId}`,
        milestone: "longest_distance",
        activityId: a.activityId
      });
    } else if (inWindow && beatsDuration) {
      out.push({
        kind: "milestone",
        id: `milestone:duration:${a.activityId}`,
        day,
        time,
        title: `Najdłuższy czas — ${label.toLocaleLowerCase("pl-PL")}`,
        detail: `Twój najdłuższy trening w tej dyscyplinie: ${fmtHm(duration) ?? "—"}`,
        stats: [{ label: "Poprzedni rekord", value: fmtHm(bestDuration) ?? "—" }],
        icon: "trophy",
        accent: "orange",
        importance: IMPORTANCE.milestoneRecord,
        primary: false,
        href: `/activities/${a.activityId}`,
        milestone: "longest_duration",
        activityId: a.activityId
      });
    }
    if (inWindow && isNewSport) {
      out.push({
        kind: "milestone",
        id: `milestone:sport:${a.activityId}`,
        day,
        time,
        title: `Nowa dyscyplina: ${label.toLocaleLowerCase("pl-PL")}`,
        detail: "Pierwszy taki trening w Twojej historii",
        stats: [],
        icon: "sparkle",
        accent: "violet",
        importance: IMPORTANCE.milestoneNewSport,
        primary: false,
        href: `/activities/${a.activityId}`,
        milestone: "new_sport",
        activityId: a.activityId
      });
    }
    const streak = streaks.get(day) ?? 0;
    if (inWindow && isStreakMilestone(streak) && !streakAnnounced.has(day)) {
      streakAnnounced.add(day);
      out.push({
        kind: "milestone",
        id: `milestone:streak:${day}`,
        day,
        time: null,
        title: `${streak} dni z rzędu z treningiem`,
        detail: "Seria trwa — każdy z tych dni ma co najmniej jedną aktywność",
        stats: [{ label: "Seria", value: NUM.format(streak), unit: "dni" }],
        icon: "flame",
        accent: "amber",
        importance: IMPORTANCE.milestoneStreak,
        primary: false,
        href: null,
        milestone: "streak",
        activityId: null
      });
    }
    seenSports.add(a.sport);
    countInGroup.set(group, priorInGroup + 1);
    if ((a.distanceM ?? 0) > bestDistance) maxDistance.set(group, a.distanceM ?? 0);
    if (duration > bestDuration) maxDuration.set(group, duration);
    seen += 1;
  }
  return out;
}
const KIND_ORDER = { health: 0, milestone: 1, activity: 2 };
function compareChronological(a, b) {
  const byDay = compareDays(b.day, a.day);
  if (byDay !== 0) return byDay;
  const byTime = (b.time ?? "").localeCompare(a.time ?? "");
  if (byTime !== 0) return byTime;
  const byKind = KIND_ORDER[a.kind] - KIND_ORDER[b.kind];
  if (byKind !== 0) return byKind;
  return a.id.localeCompare(b.id);
}
function compareImportance(a, b) {
  const byScore = b.importance - a.importance;
  if (byScore !== 0) return byScore;
  return compareChronological(a, b);
}
function rank(events, limit) {
  const byImportance = [...events].sort(compareImportance);
  const keep = new Set(byImportance.slice(0, Math.max(0, limit)).map((e) => e.id));
  const marked = events.map((e) => ({ ...e, primary: keep.has(e.id) }));
  marked.sort(compareChronological);
  return { events: marked, primaryCount: keep.size, totalCount: marked.length };
}
function buildTimeline(input) {
  const events = [
    ...buildActivityEvents(input.history, input.from, input.to),
    ...buildHealthEvents(input.signals, input.from, input.to),
    ...buildMilestoneEvents(input.history, input.from, input.to)
  ];
  return rank(events, input.limit);
}
const DEFAULT_PAST_DAYS = 14;
const DEFAULT_FUTURE_DAYS = 7;
const DEFAULT_LIMIT = 8;
const MAX_PAST_DAYS = 400;
const MAX_LIMIT = 60;
function limitForWindow(pastDays) {
  return Math.min(MAX_LIMIT, Math.max(DEFAULT_LIMIT, Math.ceil(pastDays / 14)));
}
const MAX_HISTORY = 2e4;
const clampInt = (value, fallback, lo, hi) => {
  if (value === void 0 || !Number.isFinite(value)) return fallback;
  return Math.min(hi, Math.max(lo, Math.trunc(value)));
};
async function loadPlanned(deps, userId, from, to) {
  const authored = await loadAuthored(deps, userId, from, to);
  if (!deps.plannedWorkouts) {
    return {
      from,
      to,
      status: authored.length > 0 ? "ok" : "not_synced",
      events: authored
    };
  }
  const feed = await deps.plannedWorkouts.listPlanned(userId, from, to);
  if (!feed.available) {
    return { from, to, status: authored.length > 0 ? "ok" : "not_synced", events: authored };
  }
  const inWindow = feed.events.filter((e) => isDayKey(e.day) && e.day >= from && e.day <= to);
  const pushedIds = new Set(authored.map((e) => e.pushedGarminId).filter((id) => id !== null));
  const fromGarmin = inWindow.filter((e) => !pushedIds.has(e.id));
  const sorted = [...fromGarmin, ...authored.map(({ pushedGarminId: _ignored, ...e }) => e)].sort(
    (a, b) => a.day.localeCompare(b.day) || (a.time ?? "").localeCompare(b.time ?? "")
  );
  return { from, to, status: sorted.length > 0 ? "ok" : "empty", events: sorted };
}
async function loadAuthored(deps, userId, from, to) {
  const rows = await deps.store.listWorkouts(userId, { from, to });
  return rows.map((w) => ({
    id: `authored:${w.id}`,
    day: w.day,
    time: w.time,
    kind: "workout",
    title: w.title,
    sport: w.sport,
    description: w.note,
    estimatedDurationS: estimateWorkoutDurationS(w.steps),
    estimatedDistanceM: estimateWorkoutDistanceM(w.steps),
    targetLoad: null,
    source: "garmin",
    authored: true,
    push: w.pushState,
    pushedGarminId: w.garminWorkoutId
  }));
}
async function loadTimeline(deps, req) {
  const pastDays = clampInt(req.pastDays, DEFAULT_PAST_DAYS, 1, MAX_PAST_DAYS);
  const futureDays = clampInt(req.futureDays, DEFAULT_FUTURE_DAYS, 1, 30);
  const limit = clampInt(req.limit, limitForWindow(pastDays), 1, MAX_LIMIT);
  const today = req.today !== void 0 && isDayKey(req.today) ? req.today : todayKey(deps.clock, deps.timeZone ?? DEFAULT_TIME_ZONE);
  const from = addDays(today, -(pastDays - 1));
  const plannedFrom = addDays(today, 1);
  const plannedTo = addDays(today, futureDays);
  const [history, planned] = await Promise.all([
    deps.store.listActivities(req.userId, { sort: "date", dir: "desc", limit: MAX_HISTORY }),
    loadPlanned(deps, req.userId, plannedFrom, plannedTo)
  ]);
  const ranked = buildTimeline({
    history,
    signals: req.signals ?? [],
    from,
    to: today,
    limit
  });
  return {
    today,
    past: {
      from,
      to: today,
      events: ranked.events,
      primaryCount: ranked.primaryCount,
      totalCount: ranked.totalCount
    },
    planned
  };
}
const load = async ({ locals, url }) => {
  if (!locals.user) return { authed: false };
  const { garmin, consent: consentService, container } = locals;
  const tier = await resolveTier(consentService);
  if (tier === "base") {
    const [health2, consent2] = await Promise.all([getHealth(garmin), listConsent(consentService)]);
    return {
      authed: true,
      tier,
      health: health2,
      advancedFeature: consent2.features.find((f) => f.id === ADVANCED_FEATURE) ?? null
    };
  }
  const range = await loadRange(
    { store: container.store, clock: container.clock, timeZone: container.config.appTimeZone },
    locals.user.id,
    url
  );
  const [health, dashboard, consent, insights] = await Promise.all([
    getHealth(garmin),
    loadDashboard(
      {
        garmin,
        consent: consentService,
        clock: container.clock,
        timeZone: container.config.appTimeZone
      },
      { range }
    ),
    listConsent(consentService),
    /*
     * NOT range-driven, deliberately. This read feeds the condition block ("how am I right now") and
     * the timeline's anomaly markers, both of which compare today against a recent baseline. Widening
     * that baseline to a year would answer a different question — so the condition card carries no
     * range badge either (spec 047).
     */
    loadInsights(
      { garmin, consent: consentService, clock: container.clock, timeZone: container.config.appTimeZone },
      { window: CONDITION_WINDOW_DAYS }
    )
  ]);
  const timeline = await loadTimeline(
    { store: container.store, clock: container.clock, timeZone: container.config.appTimeZone },
    { userId: locals.user.id, signals: insights.anomalies, pastDays: range.days }
  );
  return {
    authed: true,
    tier,
    health,
    dashboard,
    timeline,
    advancedFeature: consent.features.find((f) => f.id === ADVANCED_FEATURE) ?? null,
    readiness: {
      data: insights.readiness,
      condition: insights.condition,
      connected: insights.connected,
      enabled: insights.enabled
    }
  };
};
export {
  load
};
