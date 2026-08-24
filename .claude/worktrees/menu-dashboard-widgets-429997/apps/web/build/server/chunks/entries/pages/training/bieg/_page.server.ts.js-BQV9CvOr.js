import { h as hrZones } from '../../../../chunks/activity-power.js-595LPO8p.js';
import { r as runningTotals, a as personalBests, w as weeklyMileage, f as fmtPace } from '../../../../chunks/running-profile.js-BI1N4bvT.js';
import { c as toDayKey, t as todayKey, l as lastMonths, h as monthKeyOf, d as daysBetween, s as startOfWeek, b as addDays } from '../../../../chunks/date.js-Cf0GyZI8.js';
import { m as monthlyEfficiency } from '../../../../chunks/efficiency.js-DJ-LuYeW.js';
import { a as mergeSpeedCurves, s as speedDurationCurve, c as criticalSpeed } from '../../../../chunks/pace-model.js-DDe_pC8X.js';
import { p as predictRaces, w as withPredictionTrend } from '../../../../chunks/race-predictor.js-DIEgT15V.js';
import { E as EFFORT_DISTANCES } from '../../../../chunks/best-efforts.js-D1Is-85D.js';
import { s as sportKeysInGroup } from '../../../../chunks/sport-labels.js-BKqMzU19.js';
import { r as resolveRange, D as DEFAULT_RANGE } from '../../../../chunks/range.js-VDtVJAwH.js';
import { v as volumeBucket, a as bucketLattice, c as bucketStart } from '../../../../chunks/series.js-BlIzPiOH.js';
import { l as loadRange } from '../../../../chunks/range-context.js-ulqHhV48.js';

const AXIS_DEFS = {
  speed: { key: "speed", label: "Szybkość", hint: "Najlepsze 1 km — co masz na krótkim odcinku." },
  tempo: { key: "tempo", label: "Tempo", hint: "Najlepsze 5 km — tempo w okolicach progu." },
  endurance: {
    key: "endurance",
    label: "Wytrzymałość",
    hint: "Najlepszy długi dystans: 10 km, półmaraton, maraton."
  },
  volume: { key: "volume", label: "Objętość", hint: "Średni kilometraż tygodniowy." },
  consistency: { key: "consistency", label: "Regularność", hint: "Jak często i jak równo biegasz." }
};
const PACE_SCALE = {
  "1k": { slow: 450, fast: 155 },
  // 7:30 → 2:35 /km
  "5k": { slow: 480, fast: 165 },
  // 8:00 → 2:45 /km
  "10k": { slow: 510, fast: 170 },
  // 8:30 → 2:50 /km
  half: { slow: 540, fast: 180 },
  // 9:00 → 3:00 /km
  marathon: { slow: 570, fast: 190 }
  // 9:30 → 3:10 /km
};
const VOLUME_TARGET_KM = 80;
const RUNS_PER_WEEK_TARGET = 4;
const MIN_WINDOW_WEEKS = 3;
const DEFAULT_WINDOW_WEEKS = 12;
const ENDURANCE_ORDER = ["marathon", "half", "10k"];
const ARCHETYPES = {
  speedster: {
    key: "speedster",
    label: "Szybkościowiec",
    summary: "Krótkie odcinki wychodzą Ci lepiej niż długie. Najwięcej zyskasz, dorzucając spokojne kilometry — baza podniesie też tempo na 5 i 10 km."
  },
  diesel: {
    key: "diesel",
    label: "Dystansowiec",
    summary: "Trzymasz tempo na długim, krótkie odcinki są słabszą stroną. Jedna sesja szybkich wstawek w tygodniu doda Ci prędkości bez ruszania objętości."
  },
  grinder: {
    key: "grinder",
    label: "Maszyna do kilometrów",
    summary: "Regularność i objętość to Twój fundament — biegasz stale i dużo. To najlepszy możliwy punkt startu do pracy nad tempem."
  },
  allrounder: {
    key: "allrounder",
    label: "Wszechstronny",
    summary: "Żadna oś nie odstaje: masz i szybkość, i dystans, i regularność. Rozwój przyjdzie z wyboru celu, nie z łatania dziur."
  },
  beginner: {
    key: "beginner",
    label: "Na starcie",
    summary: "Baza dopiero rośnie, więc za wcześnie na wyroki. Regularność zrobi teraz więcej niż jakikolwiek trening szybkościowy."
  },
  unknown: {
    key: "unknown",
    label: "Za mało danych",
    summary: "Mamy za mało zsynchronizowanych biegów, żeby nazwać Twój typ. Radar wypełni się sam, kiedy dojdą kolejne treningy i dłuższe dystanse."
  }
};
const clamp01 = (n) => n < 0 ? 0 : n > 1 ? 1 : n;
function paceScore(distanceKey, secPerKm) {
  const scale = PACE_SCALE[distanceKey];
  if (!scale || !Number.isFinite(secPerKm) || secPerKm <= 0) return null;
  return clamp01((scale.slow - secPerKm) / (scale.slow - scale.fast));
}
const oneDecimal = (n) => n.toFixed(1).replace(".", ",");
function axis(def, score, readout, basis, day = null) {
  return { key: def.key, label: def.label, hint: def.hint, score, readout, basis, day };
}
const defOf = (key) => AXIS_DEFS[key];
function meanOf(scores, keys) {
  const values = keys.map((k) => scores.get(k)).filter((v) => v != null);
  if (values.length === 0) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}
function archetypeOf(scores) {
  if (scores.size < 3) return ARCHETYPES.unknown;
  const values = [...scores.values()];
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  if (mean < 0.2) return ARCHETYPES.beginner;
  const speedLean = meanOf(scores, ["speed", "tempo"]);
  const enduranceLean = meanOf(scores, ["endurance", "volume"]);
  if (speedLean != null && enduranceLean != null) {
    if (speedLean - enduranceLean >= 0.12) return ARCHETYPES.speedster;
    if (enduranceLean - speedLean >= 0.12) return ARCHETYPES.diesel;
  }
  const consistency = scores.get("consistency");
  const volume = scores.get("volume");
  if (consistency != null && consistency >= 0.7 && volume != null && volume >= 0.45) {
    return ARCHETYPES.grinder;
  }
  return ARCHETYPES.allrounder;
}
function runnerProfile(runs, opts) {
  const weeks = Math.max(1, opts.weeks ?? DEFAULT_WINDOW_WEEKS);
  const bests = personalBests(runs);
  const bestOf = (key) => bests.find((b) => b.key === key) ?? null;
  const paceAxis = (axisKey, distanceKey, label) => {
    const best = bestOf(distanceKey);
    const def = defOf(axisKey);
    if (!best) return axis(def, null, null, `brak biegu na ${label}`, null);
    return axis(
      def,
      paceScore(distanceKey, best.paceSecPerKm),
      `${fmtPace(best.paceSecPerKm)} /km`,
      `najlepsze ${label}`,
      best.day
    );
  };
  const speed = paceAxis("speed", "1k", "1 km");
  const tempo = paceAxis("tempo", "5k", "5 km");
  const enduranceKey = ENDURANCE_ORDER.find((k) => bestOf(k) !== null) ?? null;
  const endurance = enduranceKey === null ? axis(defOf("endurance"), null, null, "brak biegu od 10 km w górę", null) : paceAxis(
    "endurance",
    enduranceKey,
    enduranceKey === "marathon" ? "maraton" : enduranceKey === "half" ? "półmaraton" : "10 km"
  );
  const firstDay = runs.reduce((min, r) => min === null || r.day < min ? r.day : min, null);
  const historyWeeks = firstDay === null ? 0 : Math.floor(daysBetween(startOfWeek(firstDay), startOfWeek(opts.today)) / 7) + 1;
  const measuredWeeks = Math.min(weeks, historyWeeks);
  const buckets = measuredWeeks > 0 ? weeklyMileage(runs, opts.today, weeks).slice(-measuredWeeks) : [];
  const windowKm = Math.round(buckets.reduce((a, b) => a + b.km, 0) * 10) / 10;
  const windowRuns = buckets.reduce((a, b) => a + b.runs, 0);
  const activeWeeks = buckets.filter((b) => b.runs > 0).length;
  const enoughHistory = measuredWeeks >= MIN_WINDOW_WEEKS;
  const avgKmPerWeek = enoughHistory ? Math.round(windowKm / measuredWeeks * 10) / 10 : null;
  const runsPerWeek = enoughHistory ? Math.round(windowRuns / measuredWeeks * 10) / 10 : null;
  const volume = avgKmPerWeek === null ? axis(defOf("volume"), null, null, `za krótka historia biegania (min. ${MIN_WINDOW_WEEKS} tyg.)`, null) : axis(
    defOf("volume"),
    clamp01(avgKmPerWeek / VOLUME_TARGET_KM),
    `${oneDecimal(avgKmPerWeek)} km/tyg.`,
    `ostatnie ${measuredWeeks} tyg.`,
    null
  );
  const consistency = runsPerWeek === null ? axis(
    defOf("consistency"),
    null,
    null,
    `za krótka historia biegania (min. ${MIN_WINDOW_WEEKS} tyg.)`,
    null
  ) : axis(
    defOf("consistency"),
    clamp01(0.6 * (activeWeeks / measuredWeeks) + 0.4 * clamp01(runsPerWeek / RUNS_PER_WEEK_TARGET)),
    `${oneDecimal(runsPerWeek)} biegu/tyg.`,
    `${activeWeeks} z ${measuredWeeks} tyg. z biegiem`,
    null
  );
  const axes = [speed, tempo, endurance, volume, consistency];
  const scores = /* @__PURE__ */ new Map();
  for (const a of axes) if (a.score != null) scores.set(a.key, a.score);
  let strength = null;
  let weakness = null;
  for (const [key, score] of scores) {
    if (strength === null || score > (scores.get(strength) ?? -1)) strength = key;
    if (weakness === null || score < (scores.get(weakness) ?? 2)) weakness = key;
  }
  if (scores.size < 2) {
    strength = null;
    weakness = null;
  }
  return {
    axes,
    archetype: archetypeOf(scores),
    strength,
    weakness,
    window: {
      weeks: measuredWeeks,
      km: windowKm,
      runs: windowRuns,
      activeWeeks,
      avgKmPerWeek,
      runsPerWeek
    },
    definedCount: scores.size,
    hasProfile: scores.size > 0
  };
}
function trendCutoff(today) {
  return addDays(today, -90);
}
const EFFORT_BY_KEY = new Map(EFFORT_DISTANCES.map((d) => [d.key, d]));
function knownBestsFrom(efforts, projections) {
  const byKey = /* @__PURE__ */ new Map();
  for (const p of projections) {
    if (!(p.meters > 0) || !(p.timeS > 0)) continue;
    byKey.set(p.key, { metres: p.meters, timeS: p.timeS, label: p.label, day: p.day, basis: "projected" });
  }
  for (const e of efforts) {
    const distance = EFFORT_BY_KEY.get(e.key);
    if (!distance) continue;
    if (!(e.actualM > 0) || !(e.durationS > 0)) continue;
    const existing = byKey.get(e.key);
    if (existing?.basis === "measured" && existing.timeS <= e.durationS) continue;
    byKey.set(e.key, {
      metres: e.actualM,
      timeS: e.durationS,
      label: distance.label,
      day: e.day,
      basis: "measured"
    });
  }
  return [...byKey.values()].sort((a, b) => a.metres - b.metres);
}
const HR_STREAM_CAP = 120;
const EFFICIENCY_MONTHS = 24;
const SPEED_STREAM_CAP = 120;
function numberSetting(settings, key) {
  const v = settings[key];
  return typeof v === "number" && Number.isFinite(v) && v > 0 ? v : null;
}
function mergeZones(all) {
  const secs = /* @__PURE__ */ new Map();
  for (const buckets of all) {
    for (const b of buckets) {
      const cur = secs.get(b.zone) ?? { label: b.label, seconds: 0 };
      cur.seconds += b.seconds;
      secs.set(b.zone, cur);
    }
  }
  const total = [...secs.values()].reduce((a, b) => a + b.seconds, 0);
  return [...secs.entries()].sort((a, b) => a[0] - b[0]).map(([zone, v]) => ({
    zone,
    label: v.label,
    seconds: v.seconds,
    pct: total > 0 ? Math.round(v.seconds / total * 1e3) / 10 : 0
  }));
}
function mileageBuckets(runs, range) {
  const bucket = volumeBucket(range);
  const lattice = bucketLattice(range.start, range.end, bucket);
  const totals = /* @__PURE__ */ new Map();
  for (const r of runs) {
    if (!r.distanceM) continue;
    const key = bucketStart(r.day, bucket);
    const slot = totals.get(key) ?? { m: 0, runs: 0 };
    slot.m += r.distanceM;
    slot.runs += 1;
    totals.set(key, slot);
  }
  return lattice.map((week) => {
    const slot = totals.get(week);
    return { week, km: Math.round((slot?.m ?? 0) / 1e3 * 10) / 10, runs: slot?.runs ?? 0 };
  });
}
async function loadRunning(deps, req) {
  const [runsAll, userSettings] = await Promise.all([
    // Sport family from the shared taxonomy (spec 020), applied IN the store query (spec 025) —
    // this page used to read every activity ever synced and drop the non-runs in memory.
    deps.store.listActivities(req.userId, { sports: sportKeysInGroup("run"), limit: 1e5 }),
    deps.settings.get(req.userId)
  ]);
  const runs = runsAll.map((a) => ({
    activityId: a.activityId,
    day: toDayKey(a.startTimeLocal),
    distanceM: a.distanceM,
    durationS: a.durationS,
    movingS: a.movingS
  }));
  const today = todayKey(deps.clock);
  const range = req.range ?? resolveRange(DEFAULT_RANGE, today);
  const windowRuns = runs.filter((r) => r.day >= range.start && r.day <= range.end);
  const totals = runningTotals(windowRuns);
  const bests = personalBests(runs);
  const weekly = mileageBuckets(windowRuns, range);
  const profile = runnerProfile(runs, { today });
  const efficiencySessions = runsAll.map((a) => ({
    day: toDayKey(a.startTimeLocal),
    distanceM: a.distanceM,
    durationS: a.movingS ?? a.durationS,
    avgHr: a.avgHr
  }));
  const efficiency = monthlyEfficiency(efficiencySessions, lastMonths(monthKeyOf(today), EFFICIENCY_MONTHS));
  const maxHr = numberSetting(userSettings, "maxHrBpm") ?? runsAll.reduce((m, a) => Math.max(m ?? 0, a.maxHr ?? a.avgHr ?? 0) || null, null);
  let hrZoneBuckets = [];
  if (maxHr) {
    const windowIds = new Set(windowRuns.map((r) => r.activityId));
    const recent = runsAll.filter((a) => windowIds.has(a.activityId)).sort((a, b) => a.startTimeLocal < b.startTimeLocal ? 1 : -1).slice(0, HR_STREAM_CAP);
    const hrById = await deps.store.getStreamField(
      req.userId,
      recent.map((a) => a.activityId),
      "heartRate"
    );
    const perRun = recent.map((a) => {
      const hr = hrById.get(a.activityId);
      return hr && hr.length > 0 ? hrZones(hr, maxHr) : [];
    });
    hrZoneBuckets = mergeZones(perRun.filter((z) => z.length > 0));
  }
  const curveRuns = [...runsAll].sort((a, b) => a.startTimeLocal < b.startTimeLocal ? 1 : -1).slice(0, SPEED_STREAM_CAP);
  const speedById = await deps.store.getStreamField(
    req.userId,
    curveRuns.map((a) => a.activityId),
    "speed"
  );
  const speedCurve = mergeSpeedCurves(
    curveRuns.flatMap((a) => {
      const speed = speedById.get(a.activityId);
      return speed && speed.length > 0 ? [speedDurationCurve(speed)] : [];
    })
  );
  const critical = criticalSpeed(speedCurve);
  const cutoff = trendCutoff(today);
  const runSports = sportKeysInGroup("run");
  const [effortsNow, effortsThen] = await Promise.all([
    deps.store.listTopBestEfforts(req.userId, { limit: 1, sports: runSports }),
    deps.store.listTopBestEfforts(req.userId, { limit: 1, sports: runSports, until: cutoff })
  ]);
  const currentPredictions = predictRaces(knownBestsFrom(effortsNow, bests), {
    csMps: critical?.speedMps ?? null,
    dPrimeM: critical?.dPrimeM ?? null
  });
  const previousPredictions = predictRaces(
    knownBestsFrom(effortsThen, personalBests(runs.filter((r) => r.day <= cutoff)))
  );
  const predictions = withPredictionTrend(currentPredictions, previousPredictions, cutoff);
  return {
    range,
    totals,
    weekly,
    efficiency,
    speedCurve,
    criticalSpeed: critical,
    predictions,
    hrZones: hrZoneBuckets,
    maxHr,
    profile,
    // "Do I have runs at all" is an all-time question — a range with no runs is an empty window, not
    // an empty account, and the view needs to tell those apart.
    hasData: runs.length > 0,
    hasWindowData: windowRuns.length > 0
  };
}
function faster(a, b) {
  return a.durationS - b.durationS || a.day.localeCompare(b.day) || a.activityId.localeCompare(b.activityId);
}
function rankBestEfforts(rows, topN) {
  if (topN <= 0) return [];
  const byKey = /* @__PURE__ */ new Map();
  for (const row of rows) {
    const bucket = byKey.get(row.key);
    if (bucket) bucket.push(row);
    else byKey.set(row.key, [row]);
  }
  const out = [];
  for (const distance of EFFORT_DISTANCES) {
    const bucket = byKey.get(distance.key);
    if (!bucket || bucket.length === 0) continue;
    const entries = [...bucket].sort(faster).slice(0, topN).map((row, i) => ({ ...row, rank: i + 1 }));
    out.push({
      key: distance.key,
      label: distance.label,
      metres: distance.metres,
      entries
    });
  }
  return out;
}
const BEST_EFFORTS_TOP_N = 3;
const BEST_EFFORTS_DEFAULT_GROUP = "run";
async function loadBestEfforts(deps, req) {
  const topN = req.topN !== void 0 && Number.isInteger(req.topN) && req.topN > 0 ? Math.min(req.topN, 10) : BEST_EFFORTS_TOP_N;
  const group = req.group ?? BEST_EFFORTS_DEFAULT_GROUP;
  const rows = await deps.store.listTopBestEfforts(req.userId, {
    limit: topN,
    sports: sportKeysInGroup(group)
  });
  const distances = rankBestEfforts(rows, topN);
  return { distances, topN, hasData: distances.length > 0 };
}
const load = async ({ locals, url }) => {
  const user = locals.user;
  const c = locals.container;
  const range = await loadRange(
    { store: c.store, clock: c.clock, timeZone: c.config.appTimeZone },
    user.id,
    url
  );
  const [running, bestEfforts] = await Promise.all([
    loadRunning({ store: c.store, settings: c.repo.settings, clock: c.clock }, { userId: user.id, range }),
    loadBestEfforts({ store: c.store }, { userId: user.id, group: "run" })
  ]);
  return { running, bestEfforts };
};

var _page_server_ts = /*#__PURE__*/Object.freeze({
  __proto__: null,
  load: load
});

export { _page_server_ts as _ };
//# sourceMappingURL=_page.server.ts.js-BQV9CvOr.js.map
