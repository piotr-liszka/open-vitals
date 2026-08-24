const METRIC_LABELS = [
  { key: "steps", label: "Kroki", unit: "", accent: "orange" },
  { key: "resting_heart_rate", label: "Tętno spoczynkowe", unit: "bpm", accent: "red" },
  { key: "hrv", label: "HRV", unit: "ms", accent: "green" },
  { key: "body_battery", label: "Body Battery", unit: "", accent: "cyan" },
  { key: "sleep", label: "Sen", unit: "", accent: "indigo" },
  { key: "stress", label: "Stres", unit: "", accent: "amber" },
  { key: "spo2", label: "SpO₂", unit: "%", accent: "sky" },
  { key: "respiration", label: "Oddech", unit: "brpm", accent: "teal" },
  { key: "calories", label: "Kalorie", unit: "kcal", accent: "lime" }
];
function metricLabel(key) {
  return METRIC_LABELS.find((m) => m.key === key)?.label ?? key;
}
function metricMeta(key) {
  return METRIC_LABELS.find((m) => m.key === key);
}
export {
  metricLabel as a,
  metricMeta as m
};
