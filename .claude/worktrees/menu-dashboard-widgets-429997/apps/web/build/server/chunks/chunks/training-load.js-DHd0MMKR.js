const DAY_MS = 864e5;
const NP_WINDOW = 30;
function ewma(values, days) {
  const alpha = 1 - Math.exp(-1 / days);
  const out = [];
  let prev = 0;
  for (const v of values) {
    prev = prev + alpha * (v - prev);
    out.push(prev);
  }
  return out;
}
function rollingAverage(samples, window) {
  if (window <= 1) return samples.slice();
  const out = [];
  let sum = 0;
  for (let i = 0; i < samples.length; i++) {
    sum += samples[i];
    if (i >= window) sum -= samples[i - window];
    const count = Math.min(i + 1, window);
    out.push(sum / count);
  }
  return out;
}
function normalizedPower(power) {
  const clean = power.filter((p) => Number.isFinite(p) && p >= 0);
  if (clean.length === 0) return null;
  const roll = rollingAverage(clean, Math.min(NP_WINDOW, clean.length));
  const meanFourth = roll.reduce((a, p) => a + p ** 4, 0) / roll.length;
  return meanFourth ** 0.25;
}
function powerTss(normPower, ftpWatts, durationS) {
  if (ftpWatts <= 0 || durationS <= 0) return 0;
  const intensity = normPower / ftpWatts;
  return intensity * intensity * (durationS / 3600) * 100;
}
function hrTrimp(durationS, avgHr, hrRest, hrMax) {
  if (durationS <= 0 || hrMax <= hrRest) return 0;
  const reserve = (avgHr - hrRest) / (hrMax - hrRest);
  if (reserve <= 0) return 0;
  const clamped = Math.min(reserve, 1);
  const minutes = durationS / 60;
  return minutes * clamped * 0.64 * Math.exp(1.92 * clamped);
}
function activityLoad(a, opts) {
  if (a.trainingLoad != null && a.trainingLoad > 0) return { tss: a.trainingLoad, method: "garmin" };
  const durationS = a.durationS ?? (a.power ? a.power.length : 0);
  if (opts.ftpWatts != null && opts.ftpWatts > 0 && a.power && a.power.length > 0) {
    const np = normalizedPower(a.power);
    if (np != null) return { tss: powerTss(np, opts.ftpWatts, durationS), method: "power" };
  }
  if (a.avgHr != null && a.avgHr > 0 && durationS > 0) {
    const hrRest = opts.hrRest ?? 60;
    const hrMax = opts.hrMax ?? a.maxHr ?? 190;
    const trimp = hrTrimp(durationS, a.avgHr, hrRest, hrMax);
    if (trimp > 0) return { tss: trimp, method: "hr" };
  }
  return { tss: 0, method: "none" };
}
function bandForTsb(tsb) {
  if (tsb > 25) return "fresh";
  if (tsb >= 5) return "optimal";
  if (tsb >= -10) return "neutral";
  if (tsb >= -30) return "fatigued";
  return "very-fatigued";
}
const RECOMMENDATIONS = {
  fresh: "Jesteś wypoczęty — dobry moment na mocny trening lub start w zawodach.",
  optimal: "Forma optymalna — utrzymuj obecne obciążenie treningowe.",
  neutral: "Równowaga między zmęczeniem a formą — kontynuuj bieżący plan.",
  fatigued: "Wyraźne zmęczenie — rozważ dzień regeneracji lub lżejszy trening.",
  "very-fatigued": "Bardzo duże zmęczenie — zaplanuj odpoczynek, aby uniknąć przetrenowania."
};
const NO_DATA_RECOMMENDATION = "Za mało danych, aby ocenić formę. Zsynchronizuj więcej treningów z pomiarem mocy lub tętna.";
function addDays(day, n) {
  const d = (/* @__PURE__ */ new Date(`${day}T00:00:00Z`)).getTime() + n * DAY_MS;
  return new Date(d).toISOString().slice(0, 10);
}
function daysBetween(start, end) {
  return Math.round(
    ((/* @__PURE__ */ new Date(`${end}T00:00:00Z`)).getTime() - (/* @__PURE__ */ new Date(`${start}T00:00:00Z`)).getTime()) / DAY_MS
  );
}
function buildTrainingLoad(activities, opts) {
  const perDay = /* @__PURE__ */ new Map();
  let hasData = false;
  for (const a of activities) {
    const { tss } = activityLoad(a, opts);
    if (tss > 0) hasData = true;
    perDay.set(a.day, (perDay.get(a.day) ?? 0) + tss);
  }
  if (perDay.size === 0) {
    return {
      series: [],
      ctl: 0,
      atl: 0,
      tsb: 0,
      band: "neutral",
      recommendation: NO_DATA_RECOMMENDATION,
      hasData: false
    };
  }
  const days = [...perDay.keys()].sort();
  const startDay = days[0];
  const lastActivity = days[days.length - 1];
  const endDay = opts.endDay > lastActivity ? opts.endDay : lastActivity;
  const span = Math.max(0, daysBetween(startDay, endDay));
  const dayList = [];
  const tssSeries = [];
  for (let i = 0; i <= span; i++) {
    const day = addDays(startDay, i);
    dayList.push(day);
    tssSeries.push(perDay.get(day) ?? 0);
  }
  const ctl = ewma(tssSeries, 42);
  const atl = ewma(tssSeries, 7);
  const series = dayList.map((day, i) => ({
    day,
    tss: tssSeries[i],
    ctl: ctl[i],
    atl: atl[i],
    // TSB uses the PREVIOUS day's fitness/fatigue; day 0 seeds from 0.
    tsb: (i === 0 ? 0 : ctl[i - 1]) - (i === 0 ? 0 : atl[i - 1])
  }));
  const latest = series[series.length - 1];
  const band = bandForTsb(latest.tsb);
  return {
    series,
    ctl: latest.ctl,
    atl: latest.atl,
    tsb: latest.tsb,
    band,
    recommendation: hasData ? RECOMMENDATIONS[band] : NO_DATA_RECOMMENDATION,
    hasData
  };
}

export { activityLoad as a, buildTrainingLoad as b };
//# sourceMappingURL=training-load.js-DHd0MMKR.js.map
