import { i as isDayKey, a as todayKey, D as DEFAULT_TIME_ZONE, c as addDays } from "./date.js";
import { b as bucketSeries } from "./series.js";
import { G as GarminUnavailableError, a as GarminNotAuthenticatedError } from "./interfaces.js";
import { i as inner, M as METRICS, p as pick, r as round$1, e as extractMetricValue } from "./metric-specs.js";
import { f as fmtRecovery, a as fmtSleepDuration } from "./condition.format.js";
const MAX_RANGE_DAYS = 31;
const MAX_CONCURRENCY = 4;
function toDayNumber$1(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  const yy = m <= 2 ? y - 1 : y;
  const era = Math.floor((yy >= 0 ? yy : yy - 399) / 400);
  const yoe = yy - era * 400;
  const doy = Math.floor((153 * (m > 2 ? m - 3 : m + 9) + 2) / 5) + d - 1;
  const doe = yoe * 365 + Math.floor(yoe / 4) - Math.floor(yoe / 100) + doy;
  return era * 146097 + doe - 719468;
}
function fromDayNumber(days) {
  const z = days + 719468;
  const era = Math.floor((z >= 0 ? z : z - 146096) / 146097);
  const doe = z - era * 146097;
  const yoe = Math.floor(
    (doe - Math.floor(doe / 1460) + Math.floor(doe / 36524) - Math.floor(doe / 146096)) / 365
  );
  const y = yoe + era * 400;
  const doy = doe - (365 * yoe + Math.floor(yoe / 4) - Math.floor(yoe / 100));
  const mp = Math.floor((5 * doy + 2) / 153);
  const d = doy - Math.floor((153 * mp + 2) / 5) + 1;
  const m = mp < 10 ? mp + 3 : mp - 9;
  const year = m <= 2 ? y + 1 : y;
  return `${String(year).padStart(4, "0")}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}
function chunkRange(start, end, maxDays = MAX_RANGE_DAYS) {
  const endNum = toDayNumber$1(end);
  const chunks = [];
  let cursor = toDayNumber$1(start);
  while (cursor <= endNum) {
    const chunkEnd = Math.min(cursor + maxDays - 1, endNum);
    chunks.push({ start: fromDayNumber(cursor), end: fromDayNumber(chunkEnd) });
    cursor = chunkEnd + 1;
  }
  return chunks;
}
async function mapPool(items, limit, fn) {
  const results = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i], i);
    }
  }
  const workers = Array.from({ length: Math.min(limit, items.length) }, () => worker());
  await Promise.all(workers);
  return results;
}
async function fetchMetricRangeChunked(garmin, name, start, end) {
  const chunks = chunkRange(start, end);
  if (chunks.length === 0) return [];
  const perChunk = await mapPool(chunks, MAX_CONCURRENCY, async (chunk) => {
    const range = await garmin.getMetricRange(name, chunk.start, chunk.end);
    return range.days;
  });
  const byDate = /* @__PURE__ */ new Map();
  for (const days of perChunk) {
    for (const day of days) {
      if (!byDate.has(day.date)) byDate.set(day.date, day);
    }
  }
  return [...byDate.values()];
}
const DEFAULT_INSIGHTS_CONFIG = {
  minBaselineDays: 5,
  stablePct: 3,
  anomalyZ: 2,
  maxAnomalies: 8,
  minCorrN: 8,
  minCorrR: 0.3,
  readinessWeights: {
    body_battery: 0.3,
    sleep: 0.3,
    hrv: 0.25,
    resting_heart_rate: 0.15
  },
  correlationPairs: [
    { a: "sleep", b: "hrv", lag: 0 },
    { a: "sleep", b: "resting_heart_rate", lag: 0 },
    { a: "stress", b: "body_battery", lag: 0 },
    { a: "steps", b: "sleep", lag: 0 }
  ]
};
function round(n, decimals = 0) {
  const f = 10 ** decimals;
  return Math.round(n * f) / f;
}
function round2(n) {
  return round(n, 2);
}
function clamp(n, lo, hi) {
  return Math.min(hi, Math.max(lo, n));
}
function mean$1(values) {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}
function sampleStd(values) {
  const n = values.length;
  if (n < 2) return 0;
  const m = mean$1(values);
  const variance = values.reduce((sum, v) => sum + (v - m) ** 2, 0) / (n - 1);
  return Math.sqrt(variance);
}
function pearson(xs, ys) {
  const n = xs.length;
  if (n === 0 || ys.length !== n) return 0;
  const mx = mean$1(xs);
  const my = mean$1(ys);
  let num2 = 0;
  let dx = 0;
  let dy = 0;
  for (let i = 0; i < n; i++) {
    const a = xs[i] - mx;
    const b = ys[i] - my;
    num2 += a * b;
    dx += a * a;
    dy += b * b;
  }
  const den = Math.sqrt(dx * dy);
  return den === 0 ? 0 : num2 / den;
}
function toDayNumber(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  const yy = m <= 2 ? y - 1 : y;
  const era = Math.floor((yy >= 0 ? yy : yy - 399) / 400);
  const yoe = yy - era * 400;
  const doy = Math.floor((153 * (m > 2 ? m - 3 : m + 9) + 2) / 5) + d - 1;
  const doe = yoe * 365 + Math.floor(yoe / 4) - Math.floor(yoe / 100) + doy;
  return era * 146097 + doe - 719468;
}
function nonNull(days) {
  return days.filter((d) => d.value !== null);
}
function computeReadiness(series, config) {
  const byKey = new Map(series.map((s) => [s.spec.key, s]));
  const contributors = [];
  for (const [key, weight] of Object.entries(config.readinessWeights)) {
    const entry = byKey.get(key);
    if (!entry) continue;
    const present = nonNull(entry.days);
    if (present.length < config.minBaselineDays) continue;
    const values = present.map((p) => p.value);
    const baseline = mean$1(values);
    const std = sampleStd(values);
    const latest = values[values.length - 1];
    const rawZ = std === 0 ? 0 : (latest - baseline) / std;
    const orientedZ = entry.spec.goodWhen === "down" ? -rawZ : rawZ;
    const subscore = clamp(50 + 15 * clamp(orientedZ, -3, 3), 0, 100);
    contributors.push({
      key,
      label: entry.spec.label,
      accent: entry.spec.accent,
      weight,
      subscore,
      rawZ,
      direction: rawZ >= 0 ? "up" : "down",
      basis: present.length
    });
  }
  if (contributors.length < 2) return null;
  const totalWeight = contributors.reduce((sum, c) => sum + c.weight, 0);
  const score = round(contributors.reduce((sum, c) => sum + c.subscore * c.weight, 0) / totalWeight);
  const drivers = contributors.map((c) => ({
    key: c.key,
    label: c.label,
    accent: c.accent,
    z: round2(c.rawZ),
    direction: c.direction,
    contribution: round(c.subscore * (c.weight / totalWeight))
  }));
  const basisDays = Math.min(...contributors.map((c) => c.basis));
  return { score, band: bandFor(score), drivers, basisDays };
}
function bandFor(score) {
  if (score < 40) return "low";
  if (score < 60) return "moderate";
  if (score < 80) return "high";
  return "peak";
}
function computeTrends(series, config) {
  const trends = [];
  for (const { spec, days } of series) {
    const present = nonNull(days);
    if (present.length < 4) continue;
    const n = present.length;
    const recentCount = Math.ceil(n / 2);
    const recentValues = present.slice(n - recentCount).map((p) => p.value);
    const earlierValues = present.slice(0, n - recentCount).map((p) => p.value);
    const recentAvg = mean$1(recentValues);
    const earlierAvg = mean$1(earlierValues);
    const signedMove = recentAvg - earlierAvg;
    const magnitudePct = earlierAvg === 0 ? null : round2(signedMove / Math.abs(earlierAvg) * 100);
    let direction;
    if (magnitudePct === null || Math.abs(magnitudePct) < config.stablePct) {
      direction = "stable";
    } else {
      const improving = spec.goodWhen === "up" ? signedMove > 0 : signedMove < 0;
      direction = improving ? "improving" : "declining";
    }
    trends.push({
      key: spec.key,
      label: spec.label,
      accent: spec.accent,
      unit: spec.unit,
      format: spec.format,
      direction,
      magnitudePct,
      recentAvg: round2(recentAvg),
      earlierAvg: round2(earlierAvg)
    });
  }
  return trends;
}
function computeAnomalies(series, config) {
  const found = [];
  for (const { spec, days } of series) {
    const present = nonNull(days);
    if (present.length < 2) continue;
    const values = present.map((p) => p.value);
    const baseline = mean$1(values);
    const std = sampleStd(values);
    if (std === 0) continue;
    for (const p of present) {
      const z = (p.value - baseline) / std;
      if (Math.abs(z) < config.anomalyZ) continue;
      found.push({
        key: spec.key,
        label: spec.label,
        accent: spec.accent,
        date: p.date,
        value: p.value,
        z: round2(z),
        direction: z > 0 ? "up" : "down",
        severity: Math.abs(z) >= 3 ? "strong" : "moderate"
      });
    }
  }
  found.sort((a, b) => {
    const byZ = Math.abs(b.z) - Math.abs(a.z);
    if (byZ !== 0) return byZ;
    return a.date < b.date ? 1 : a.date > b.date ? -1 : 0;
  });
  return found.slice(0, config.maxAnomalies);
}
function strengthFor(absR) {
  if (absR >= 0.7) return "strong";
  if (absR >= 0.5) return "moderate";
  return "weak";
}
function phraseCorrelation(aLabel, bLabel, r) {
  const dir = r >= 0 ? "wyższym" : "niższym";
  return `Więcej „${aLabel}” zwykle wiąże się z ${dir} „${bLabel}”.`;
}
function computeCorrelations(series, config) {
  const byKey = new Map(series.map((s) => [s.spec.key, s]));
  const out = [];
  for (const pair of config.correlationPairs) {
    const aEntry = byKey.get(pair.a);
    const bEntry = byKey.get(pair.b);
    if (!aEntry || !bEntry) continue;
    const bByDay = /* @__PURE__ */ new Map();
    for (const p of nonNull(bEntry.days)) bByDay.set(toDayNumber(p.date), p.value);
    const xs = [];
    const ys = [];
    for (const p of nonNull(aEntry.days)) {
      const partner = bByDay.get(toDayNumber(p.date) - pair.lag);
      if (partner === void 0) continue;
      xs.push(p.value);
      ys.push(partner);
    }
    const n = xs.length;
    if (n < config.minCorrN) continue;
    const r = round2(pearson(xs, ys));
    if (Math.abs(r) < config.minCorrR) continue;
    out.push({
      a: pair.a,
      b: pair.b,
      aLabel: aEntry.spec.label,
      bLabel: bEntry.spec.label,
      lag: pair.lag,
      r,
      n,
      strength: strengthFor(Math.abs(r)),
      phrasing: phraseCorrelation(aEntry.spec.label, bEntry.spec.label, r)
    });
  }
  return out;
}
function computeInsights(series, config = DEFAULT_INSIGHTS_CONFIG) {
  return {
    readiness: computeReadiness(series, config),
    trends: computeTrends(series, config),
    anomalies: computeAnomalies(series, config),
    correlations: computeCorrelations(series, config)
  };
}
function num(data, keys) {
  for (const k of keys) {
    const v = data[k];
    if (typeof v === "number" && Number.isFinite(v)) return v;
  }
  return null;
}
function str(data, keys) {
  for (const k of keys) {
    const v = data[k];
    if (typeof v === "string" && v.trim() !== "") return v.trim();
  }
  return null;
}
function normaliseLevel(raw) {
  switch (raw?.toUpperCase()) {
    case "PRIME":
      return "prime";
    case "HIGH":
      return "high";
    case "MODERATE":
      return "moderate";
    case "LOW":
      return "low";
    case "POOR":
    case "VERY_LOW":
      return "poor";
    default:
      return "unknown";
  }
}
function levelForScore(score) {
  if (score >= 90) return "prime";
  if (score >= 75) return "high";
  if (score >= 50) return "moderate";
  if (score >= 25) return "low";
  return "poor";
}
function stateForLevel(level) {
  switch (level) {
    case "prime":
    case "high":
      return "rested";
    case "moderate":
      return "steady";
    case "low":
    case "poor":
      return "strained";
    default:
      return "unknown";
  }
}
const FACTORS = [
  {
    key: "sleep",
    label: "Sen",
    accent: "indigo",
    keys: ["sleepScoreFactorPercent", "sleep_score_factor_percent"]
  },
  {
    key: "sleep_history",
    label: "Historia snu",
    accent: "violet",
    keys: ["sleepHistoryFactorPercent", "sleep_history_factor_percent"]
  },
  { key: "hrv", label: "HRV", accent: "green", keys: ["hrvFactorPercent", "hrv_factor_percent"] },
  {
    key: "recovery",
    label: "Regeneracja",
    accent: "cyan",
    keys: ["recoveryTimeFactorPercent", "recovery_time_factor_percent"]
  },
  { key: "load", label: "Obciążenie", accent: "orange", keys: ["acwrFactorPercent", "acwr_factor_percent"] },
  {
    key: "stress",
    label: "Historia stresu",
    accent: "amber",
    keys: ["stressHistoryFactorPercent", "stress_history_factor_percent"]
  }
];
const CHANGE_PHRASE = {
  RECOVERY_TIME_DECREASED: "krótszy niż wczoraj",
  RECOVERY_TIME_INCREASED: "dłuższy niż wczoraj",
  RECOVERY_TIME_NO_CHANGE: "bez zmian",
  RECOVERY_TIME_UNCHANGED: "bez zmian"
};
function parseTrainingReadinessDay(day, rawData) {
  const data = inner(rawData);
  if (!data) return null;
  const score = num(data, ["score", "trainingReadinessScore"]);
  if (score === null || score < 0 || score > 100) return null;
  const payloadDay = str(data, ["calendarDate", "calendar_date"]);
  const reportedDay = payloadDay && isDayKey(payloadDay) ? payloadDay : day;
  const named = normaliseLevel(str(data, ["level", "trainingReadinessLevel"]));
  const level = named === "unknown" ? levelForScore(score) : named;
  const factors = [];
  for (const f of FACTORS) {
    const percent = num(data, f.keys);
    if (percent === null || percent < 0 || percent > 100) continue;
    factors.push({ key: f.key, label: f.label, accent: f.accent, percent: Math.round(percent) });
  }
  const hours = num(data, ["recoveryTime", "recovery_time"]);
  const changeCode = str(data, ["recoveryTimeChangePhrase", "recovery_time_change_phrase"]);
  const recovery = hours === null || hours < 0 ? null : {
    day: reportedDay,
    hours: Math.round(hours),
    change: changeCode ? CHANGE_PHRASE[changeCode.toUpperCase()] ?? null : null
  };
  return {
    day: reportedDay,
    score: Math.round(score),
    level,
    factors,
    hrvWeeklyAvg: num(data, ["hrvWeeklyAverage", "hrv_weekly_average"]),
    acuteLoad: num(data, ["acuteLoad", "acute_load"]),
    recovery
  };
}
function latestTrainingReadiness(raw) {
  for (let i = raw.length - 1; i >= 0; i--) {
    const day = raw[i];
    if (!isDayKey(day.date)) continue;
    const parsed = parseTrainingReadinessDay(day.date, day.data);
    if (parsed) return parsed;
  }
  return null;
}
const LEVEL_HEAD = {
  prime: "Garmin: gotowość szczytowa",
  high: "Garmin: gotowość wysoka",
  moderate: "Garmin: gotowość umiarkowana",
  low: "Garmin: gotowość niska",
  poor: "Garmin: gotowość bardzo niska",
  unknown: "Garmin: gotowość bez oceny"
};
function garminSummary(level, recovery, clauses) {
  const parts = [];
  if (recovery !== null) {
    parts.push(
      recovery.hours <= 0 ? "regeneracja zakończona" : `do pełnej regeneracji ${fmtRecovery(recovery.hours)}`
    );
  }
  parts.push(...clauses);
  return parts.length === 0 ? `${LEVEL_HEAD[level]}.` : `${LEVEL_HEAD[level]} — ${parts.join(", ")}.`;
}
function toGarminReadiness(parsed, clauses) {
  return {
    day: parsed.day,
    score: parsed.score,
    level: parsed.level,
    state: stateForLevel(parsed.level),
    factors: parsed.factors,
    hrvWeeklyAvg: parsed.hrvWeeklyAvg,
    acuteLoad: parsed.acuteLoad,
    summary: garminSummary(parsed.level, parsed.recovery, clauses)
  };
}
const FLAT_PCT = 1.5;
function wallClock(ms) {
  if (ms === null || !Number.isFinite(ms)) return null;
  const at = new Date(ms);
  if (Number.isNaN(at.getTime())) return null;
  return at.toISOString().slice(11, 16);
}
const SLEEP_KEYS = {
  total: ["dailySleepDTO.sleepTimeSeconds", "sleepTimeSeconds"],
  deep: ["dailySleepDTO.deepSleepSeconds", "deepSleepSeconds"],
  light: ["dailySleepDTO.lightSleepSeconds", "lightSleepSeconds"],
  rem: ["dailySleepDTO.remSleepSeconds", "remSleepSeconds"],
  awake: ["dailySleepDTO.awakeSleepSeconds", "awakeSleepSeconds"],
  score: ["dailySleepDTO.sleepScores.overall.value", "sleepScores.overall.value"],
  start: ["dailySleepDTO.sleepStartTimestampLocal", "sleepStartTimestampLocal"],
  end: ["dailySleepDTO.sleepEndTimestampLocal", "sleepEndTimestampLocal"]
};
function sleepEfficiency(totalS, startMs, endMs) {
  if (totalS === null || startMs === null || endMs === null) return null;
  const inBedS = (endMs - startMs) / 1e3;
  if (!Number.isFinite(inBedS) || inBedS <= 0 || totalS <= 0) return null;
  const pct = Math.round(totalS / inBedS * 100);
  return pct > 100 || pct < 1 ? null : pct;
}
function extractSleepNight(raw) {
  for (let i = raw.length - 1; i >= 0; i--) {
    const day = raw[i];
    if (!isDayKey(day.date)) continue;
    const data = inner(day.data);
    if (!data) continue;
    const totalS = pick(data, [...SLEEP_KEYS.total]);
    if (totalS === null || totalS <= 0) continue;
    const startMs = pick(data, [...SLEEP_KEYS.start]);
    const endMs = pick(data, [...SLEEP_KEYS.end]);
    return {
      day: day.date,
      totalS,
      deepS: pick(data, [...SLEEP_KEYS.deep]),
      lightS: pick(data, [...SLEEP_KEYS.light]),
      remS: pick(data, [...SLEEP_KEYS.rem]),
      awakeS: pick(data, [...SLEEP_KEYS.awake]),
      score: pick(data, [...SLEEP_KEYS.score]),
      bedTime: wallClock(startMs),
      wakeTime: wallClock(endMs),
      efficiencyPct: sleepEfficiency(totalS, startMs, endMs)
    };
  }
  return null;
}
function mean(values) {
  return values.length === 0 ? 0 : values.reduce((a, b) => a + b, 0) / values.length;
}
function buildConditionMetric(spec, days) {
  const present = days.filter((d) => d.value !== null);
  if (present.length === 0) return null;
  const latestPoint = present[present.length - 1];
  const earlier = present.slice(0, -1).map((p) => p.value);
  const baseline = earlier.length > 0 ? Math.round(mean(earlier) * 100) / 100 : null;
  let deltaPct = null;
  if (baseline !== null && baseline !== 0) {
    deltaPct = Math.round((latestPoint.value - baseline) / Math.abs(baseline) * 1e3) / 10;
  }
  const direction = deltaPct === null || Math.abs(deltaPct) < FLAT_PCT ? "flat" : deltaPct > 0 ? "up" : "down";
  const favourable = direction === "flat" ? null : direction === spec.goodWhen;
  return {
    key: spec.key,
    label: spec.label,
    accent: spec.accent,
    unit: spec.unit,
    format: spec.format,
    goodWhen: spec.goodWhen,
    day: latestPoint.date,
    latest: latestPoint.value,
    baseline,
    deltaPct,
    direction,
    favourable
  };
}
const BATTERY_DAY_MS = 24 * 60 * 60 * 1e3;
const BATTERY_BUCKET_MS = 15 * 60 * 1e3;
const BATTERY_ROWS = "bodyBatteryValuesArray";
function extractBatteryIntraday(raw) {
  const readings = [];
  for (const day of raw.slice(-3)) {
    const data = inner(day.data);
    const rows = data?.[BATTERY_ROWS];
    if (!Array.isArray(rows)) continue;
    for (const row of rows) {
      if (!Array.isArray(row)) continue;
      const at = row[0];
      const level = row[2];
      if (typeof at !== "number" || !Number.isFinite(at)) continue;
      if (typeof level !== "number" || !Number.isFinite(level)) continue;
      readings.push({ at, value: level });
    }
  }
  if (readings.length === 0) return [];
  readings.sort((a, b) => a.at - b.at);
  const end = readings[readings.length - 1].at;
  const from = Math.max(end - BATTERY_DAY_MS, readings[0].at);
  const byBucket = /* @__PURE__ */ new Map();
  for (const r of readings) {
    if (r.at < from) continue;
    byBucket.set(Math.floor(r.at / BATTERY_BUCKET_MS), r.value);
  }
  const firstBucket = Math.floor(from / BATTERY_BUCKET_MS);
  const lastBucket = Math.floor(end / BATTERY_BUCKET_MS);
  const points = [];
  for (let b = firstBucket; b <= lastBucket; b++) {
    points.push({ at: b * BATTERY_BUCKET_MS, value: byBucket.get(b) ?? null });
  }
  return points;
}
function recoveryStateOf(readiness, channels) {
  if (readiness !== null) {
    if (readiness.band === "peak" || readiness.band === "high") return "rested";
    if (readiness.band === "moderate") return "steady";
    return "strained";
  }
  const moved = channels.filter((c) => c.favourable !== null);
  if (moved.length < 2) return "unknown";
  const good = moved.filter((c) => c.favourable === true).length;
  if (good === moved.length) return "rested";
  if (good === 0) return "strained";
  return "steady";
}
const STATE_HEAD = {
  rested: "Jesteś wypoczęty",
  steady: "Regeneracja idzie swoim torem",
  strained: "Organizm jest obciążony",
  unknown: "Za mało danych, żeby ocenić regenerację"
};
const NUM = new Intl.NumberFormat("pl-PL", { maximumFractionDigits: 0 });
function channelClause(c) {
  const where = c.direction === "up" ? "powyżej bazy" : "poniżej bazy";
  const value = c.format === "duration" ? fmtSleepDuration(c.latest) ?? "—" : NUM.format(Math.round(c.latest));
  const unit = c.format === "duration" || c.unit === "" ? "" : ` ${c.unit}`;
  return `${c.label} ${where} (${value}${unit})`;
}
function summaryClauses(channels, sleep) {
  const movers = channels.filter((c) => c.direction !== "flat" && c.deltaPct !== null).sort((a, b) => Math.abs(b.deltaPct ?? 0) - Math.abs(a.deltaPct ?? 0)).slice(0, 2).map(channelClause);
  const sleepClause = sleep === null ? null : `sen ${fmtSleepDuration(sleep.totalS) ?? "—"}`;
  return [...movers, ...sleepClause ? [sleepClause] : []];
}
function conditionSummary(state, channels, sleep) {
  const head = STATE_HEAD[state];
  if (state === "unknown") return `${head} — synchronizuj zegarek przez kilka dni, a policzymy resztę.`;
  const parts = summaryClauses(channels, sleep);
  return parts.length === 0 ? `${head}.` : `${head} — ${parts.join(", ")}.`;
}
const CONDITION_KEYS = ["body_battery", "hrv", "resting_heart_rate", "stress"];
const SPEC_BY_KEY = new Map(METRICS.map((s) => [s.key, s]));
function computeCondition(series, readiness) {
  const byKey = new Map(series.map((s) => [s.spec.key, s]));
  const sleepSeries = byKey.get("sleep");
  const sleep = sleepSeries ? extractSleepNight(sleepSeries.raw) : null;
  const batterySeries = byKey.get("body_battery");
  const batteryDay = batterySeries ? extractBatteryIntraday(batterySeries.raw) : [];
  const channels = [];
  for (const key of CONDITION_KEYS) {
    const entry = byKey.get(key);
    const spec = entry?.spec ?? SPEC_BY_KEY.get(key);
    if (!entry || !spec) continue;
    const metric = buildConditionMetric(spec, entry.days);
    if (metric) channels.push(metric);
  }
  const sleepSpec = sleepSeries?.spec ?? SPEC_BY_KEY.get("sleep");
  const sleepChannel = sleepSeries && sleepSpec ? buildConditionMetric(sleepSpec, sleepSeries.days) : null;
  const trSeries = byKey.get("training_readiness");
  const parsedGarmin = trSeries ? latestTrainingReadiness(trSeries.raw) : null;
  if (sleep === null && channels.length === 0 && readiness === null && parsedGarmin === null) {
    return null;
  }
  const state = recoveryStateOf(readiness, channels);
  const interpreted = sleepChannel ? [...channels, sleepChannel] : channels;
  const clauses = summaryClauses(interpreted, sleep);
  return {
    day: sleep?.day ?? channels[0]?.day ?? parsedGarmin?.day ?? null,
    readiness,
    sleep,
    sleepTrend: sleepChannel,
    channels,
    batteryDay,
    state,
    summary: conditionSummary(state, interpreted, sleep),
    garmin: parsedGarmin ? toGarminReadiness(parsedGarmin, clauses) : null,
    recovery: parsedGarmin?.recovery ?? null
  };
}
function isPresent(point) {
  return point.value !== null;
}
function summarizeMetric(spec, days) {
  const present = days.filter(isPresent);
  const base = {
    key: spec.key,
    label: spec.label,
    accent: spec.accent,
    unit: spec.unit,
    format: spec.format,
    goodWhen: spec.goodWhen,
    latest: null,
    min: null,
    max: null,
    avg: null,
    total: null,
    deltaPct: null,
    count: present.length,
    rangeDays: days.length,
    best: null,
    worst: null
  };
  if (present.length === 0) return base;
  const series = present.map((d) => d.value);
  const decimals = spec.format === "decimal" ? 1 : 0;
  const min = Math.min(...series);
  const max = Math.max(...series);
  const sum = series.reduce((a, b) => a + b, 0);
  const first = series[0];
  const last = series[series.length - 1];
  const maxPoint = present.find((d) => d.value === max);
  const minPoint = present.find((d) => d.value === min);
  return {
    ...base,
    latest: last,
    min,
    max,
    avg: round$1(sum / present.length, decimals),
    total: spec.summable ? sum : null,
    deltaPct: first === 0 ? null : round$1((last - first) / Math.abs(first) * 100),
    // "best" is the HEALTHY extreme, which for a goodWhen:'down' metric (resting HR, stress) is the
    // minimum — not the maximum.
    best: spec.goodWhen === "up" ? maxPoint : minPoint,
    worst: spec.goodWhen === "up" ? minPoint : maxPoint
  };
}
const DETAILED_ANALYTICS = "detailed_analytics";
const INSIGHT_WINDOWS = [7, 14, 30, 90, 365];
const DEFAULT_WINDOW = 30;
const CONDITION_WINDOW_DAYS = 30;
const MAX_INSIGHT_DAYS = 2200;
class InvalidWindowError extends Error {
  constructor(window) {
    super(`invalid window: ${window} (must be one of ${INSIGHT_WINDOWS.join(", ")})`);
    this.window = window;
    this.name = "InvalidWindowError";
  }
}
function isInsightWindow(value) {
  return INSIGHT_WINDOWS.includes(value);
}
async function fetchSeries(garmin, start, end) {
  return Promise.all(
    METRICS.map(async (spec) => {
      try {
        const days = await fetchMetricRangeChunked(garmin, spec.key, start, end);
        const points = days.map((d) => ({
          date: d.date,
          value: extractMetricValue(spec, d.data)
        }));
        return { spec, days: points, raw: days };
      } catch (err) {
        if (err instanceof GarminUnavailableError || err instanceof GarminNotAuthenticatedError) {
          return { spec, days: [], raw: [] };
        }
        throw err;
      }
    })
  );
}
function bucketPoints(days, bucket) {
  if (bucket === "day") return [...days];
  const { days: keys, values } = bucketSeries(
    days.map((d) => d.date),
    days.map((d) => d.value),
    bucket,
    "mean"
  );
  return keys.map((date, i) => ({ date, value: values[i] ?? null }));
}
async function loadInsights(deps, opts = {}) {
  const today = todayKey(deps.clock, deps.timeZone ?? DEFAULT_TIME_ZONE);
  let window;
  let start;
  let end;
  if (opts.range) {
    window = Math.min(opts.range.days, MAX_INSIGHT_DAYS);
    end = opts.range.end;
    start = addDays(end, -(window - 1));
  } else {
    window = opts.window ?? DEFAULT_WINDOW;
    if (!isInsightWindow(window)) throw new InvalidWindowError(window);
    end = today;
    start = addDays(end, -(window - 1));
  }
  let connected = false;
  try {
    connected = (await deps.garmin.getStatus()).authenticated;
  } catch (err) {
    if (!(err instanceof GarminUnavailableError)) throw err;
  }
  const enabled = await deps.consent.isEnabled(DETAILED_ANALYTICS);
  if (!connected || !enabled) {
    return {
      connected,
      enabled,
      window,
      start,
      end,
      readiness: null,
      trends: [],
      anomalies: [],
      correlations: [],
      charts: [],
      condition: null
    };
  }
  const seriesList = await fetchSeries(deps.garmin, start, end);
  const bucket = opts.range?.bucket ?? "day";
  const charts = seriesList.map(({ spec, days }) => {
    const stats = summarizeMetric(spec, days);
    const drawn = bucketPoints(days, bucket);
    return {
      ...stats,
      days: drawn,
      series: drawn.filter((d) => d.value !== null).map((d) => d.value)
    };
  });
  const computed = computeInsights(seriesList, DEFAULT_INSIGHTS_CONFIG);
  const condition = computeCondition(seriesList, computed.readiness);
  return { connected: true, enabled: true, window, start, end, ...computed, charts, condition };
}
export {
  CONDITION_WINDOW_DAYS as C,
  InvalidWindowError as I,
  loadInsights as l
};
