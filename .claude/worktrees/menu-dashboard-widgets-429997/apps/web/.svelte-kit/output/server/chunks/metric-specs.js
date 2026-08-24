const METRICS = [
  {
    key: "steps",
    label: "Kroki",
    accent: "orange",
    unit: "",
    format: "int",
    goodWhen: "up",
    summable: true,
    // Sourced from the daily summary (the sidecar routes `steps` there).
    keys: ["totalSteps"]
  },
  {
    key: "resting_heart_rate",
    label: "Tętno spoczynkowe",
    accent: "red",
    unit: "bpm",
    format: "int",
    goodWhen: "down",
    summable: false,
    keys: ["restingHeartRate"]
  },
  {
    key: "hrv",
    label: "HRV",
    accent: "green",
    unit: "ms",
    format: "int",
    goodWhen: "up",
    summable: false,
    keys: ["hrvSummary.lastNightAvg", "hrvSummary.weeklyAvg"]
  },
  {
    key: "body_battery",
    label: "Body Battery",
    accent: "cyan",
    unit: "",
    format: "int",
    goodWhen: "up",
    summable: false,
    // Body Battery is a per-reading array over the day; the daily representative
    // is the peak charge reached. Rows are [epochMs, status, level, ...].
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
    summable: false,
    keys: ["dailySleepDTO.sleepTimeSeconds"]
  },
  {
    key: "stress",
    label: "Stres",
    accent: "amber",
    unit: "",
    format: "int",
    goodWhen: "down",
    summable: false,
    keys: ["avgStressLevel"]
  },
  {
    key: "spo2",
    label: "SpO₂",
    accent: "sky",
    unit: "%",
    format: "int",
    goodWhen: "up",
    summable: false,
    // Sourced from the daily summary (garmy has no standalone spo2 metric).
    keys: ["averageSpo2"]
  },
  {
    key: "respiration",
    label: "Oddech",
    accent: "teal",
    unit: "brpm",
    format: "int",
    goodWhen: "down",
    summable: false,
    keys: ["avgWakingRespirationValue", "avgSleepRespirationValue"]
  },
  {
    key: "calories",
    label: "Kalorie",
    accent: "lime",
    unit: "kcal",
    format: "int",
    goodWhen: "up",
    summable: true,
    keys: ["totalKilocalories"]
  },
  {
    key: "training_readiness",
    label: "Gotowość (Garmin)",
    accent: "violet",
    unit: "",
    format: "int",
    goodWhen: "up",
    summable: false,
    // Garmin's own 0–100 verdict (spec 059). Deliberately NOT a contributor to our
    // readiness weights: folding one composite into another would double-count the
    // channels both are already built from, and make neither number explainable.
    keys: ["score"]
  }
];
function inner(raw) {
  if (raw && typeof raw === "object") {
    const obj = raw;
    if ("data" in obj && obj.data && typeof obj.data === "object") return obj.data;
    return obj;
  }
  return null;
}
function readPath(data, path) {
  if (!path.includes(".")) return data[path];
  let cur = data;
  for (const seg of path.split(".")) {
    if (cur == null || typeof cur !== "object") return void 0;
    cur = cur[seg];
  }
  return cur;
}
function pick(data, keys) {
  if (!data) return null;
  for (const k of keys) {
    const v = readPath(data, k);
    if (typeof v === "number" && Number.isFinite(v)) return v;
  }
  return null;
}
function maxOfArray(arr, col) {
  if (!Array.isArray(arr)) return null;
  let max = null;
  for (const row of arr) {
    const v = Array.isArray(row) ? row[col] : void 0;
    if (typeof v === "number" && Number.isFinite(v)) max = max === null ? v : Math.max(max, v);
  }
  return max;
}
function extractMetricValue(spec, rawDayData) {
  const data = inner(rawDayData);
  if (!data) return null;
  return spec.extract ? spec.extract(data) : pick(data, spec.keys);
}
function round(n, decimals = 0) {
  const f = 10 ** decimals;
  return Math.round(n * f) / f;
}
export {
  METRICS as M,
  extractMetricValue as e,
  inner as i,
  maxOfArray as m,
  pick as p,
  round as r
};
