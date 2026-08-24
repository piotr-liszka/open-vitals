const STANDARD_DURATIONS = [
  1,
  5,
  10,
  15,
  30,
  60,
  120,
  180,
  300,
  480,
  600,
  900,
  1200,
  1800,
  2700,
  3600,
  5400,
  7200
];
function bestAverageForDuration(power, durationS) {
  const n = power.length;
  if (durationS <= 0 || n < durationS) return null;
  const prefix = new Array(n + 1);
  prefix[0] = 0;
  for (let i = 0; i < n; i++) prefix[i + 1] = prefix[i] + (Number.isFinite(power[i]) ? power[i] : 0);
  let best = -Infinity;
  for (let i = durationS; i <= n; i++) {
    const avg = (prefix[i] - prefix[i - durationS]) / durationS;
    if (avg > best) best = avg;
  }
  return best === -Infinity ? null : best;
}
const yearOf = (day) => Number(day.slice(0, 4));
const ROUND = (n) => Math.round(n);
function curveFor(activities, durations) {
  const points = [];
  for (const d of durations) {
    let best = -Infinity;
    for (const a of activities) {
      if (!a.power || a.power.length < d) continue;
      const avg = bestAverageForDuration(a.power, d);
      if (avg != null && avg > best) best = avg;
    }
    if (best > -Infinity) points.push({ durationS: d, watts: ROUND(best) });
  }
  return points;
}
const RIDER_AXES = [
  { key: "sprint", label: "Sprint (5 s)", durationS: 5 },
  { key: "punch", label: "Punch (1 min)", durationS: 60 },
  { key: "climb", label: "VO2/Podjazd (5 min)", durationS: 300 },
  { key: "tt", label: "Próg/TT (20 min)", durationS: 1200 },
  { key: "endurance", label: "Wytrzymałość (60 min)", durationS: 3600 }
];
function zonesFromFtp(ftp) {
  const spec = [
    { zone: 1, name: "Regeneracja", minPct: 0, maxPct: 0.55 },
    { zone: 2, name: "Wytrzymałość", minPct: 0.56, maxPct: 0.75 },
    { zone: 3, name: "Tempo", minPct: 0.76, maxPct: 0.9 },
    { zone: 4, name: "Próg", minPct: 0.91, maxPct: 1.05 },
    { zone: 5, name: "VO2max", minPct: 1.06, maxPct: 1.2 },
    { zone: 6, name: "Anaerobowa", minPct: 1.21, maxPct: 1.5 },
    { zone: 7, name: "Neuromięśniowa", minPct: 1.51, maxPct: null }
  ];
  return spec.map((z) => ({
    ...z,
    minW: ROUND(z.minPct * ftp),
    maxW: z.maxPct == null ? null : ROUND(z.maxPct * ftp)
  }));
}
function buildPowerProfile(activities, opts) {
  const durations = [...opts.durations ?? STANDARD_DURATIONS];
  const weightKg = opts.weightKg ?? null;
  const withPower = activities.filter(
    (a) => Array.isArray(a.power) && a.power.length > 0
  );
  const wkg = (w) => w != null && weightKg != null && weightKg > 0 ? Math.round(w / weightKg * 100) / 100 : null;
  if (withPower.length === 0) {
    return {
      hasPower: false,
      durations,
      bests: [],
      allTimeCurve: [],
      yearCurves: [],
      years: [],
      ftpWatts: opts.ftpOverride ?? null,
      ftpWattsPerKg: wkg(opts.ftpOverride ?? null),
      ftpSource: opts.ftpOverride != null ? "settings" : null,
      best20MinWatts: null,
      best60MinWatts: null,
      zones: opts.ftpOverride != null ? zonesFromFtp(opts.ftpOverride) : [],
      radar: [],
      weightKg
    };
  }
  const bests = [];
  for (const d of durations) {
    let bestW = -Infinity;
    let bestAct = null;
    for (const a of withPower) {
      const avg = bestAverageForDuration(a.power, d);
      if (avg != null && avg > bestW) {
        bestW = avg;
        bestAct = a;
      }
    }
    if (bestW > -Infinity && bestAct) {
      const watts = ROUND(bestW);
      bests.push({
        durationS: d,
        watts,
        wattsPerKg: wkg(watts),
        activityId: bestAct.activityId,
        day: bestAct.day
      });
    }
  }
  const allTimeCurve = bests.map((b) => ({ durationS: b.durationS, watts: b.watts }));
  const bestAt = (d) => bests.find((b) => b.durationS === d)?.watts ?? null;
  const best20MinWatts = bestAt(1200);
  const best60MinWatts = bestAt(3600);
  const ftpEstimate = best20MinWatts != null ? ROUND(0.95 * best20MinWatts) : null;
  const ftpWatts = opts.ftpOverride ?? ftpEstimate;
  const ftpSource = opts.ftpOverride != null ? "settings" : ftpEstimate != null ? "estimated" : null;
  const byYear = /* @__PURE__ */ new Map();
  for (const a of withPower) {
    const y = yearOf(a.day);
    const list = byYear.get(y);
    if (list) list.push(a);
    else byYear.set(y, [a]);
  }
  const years = [...byYear.keys()].sort((x, y) => y - x);
  const yearCurves = years.map((year) => ({
    year,
    activityCount: byYear.get(year).length,
    points: curveFor(byYear.get(year), durations)
  }));
  const radar = RIDER_AXES.map((axis) => {
    const watts = bestAt(axis.durationS) ?? 0;
    return { key: axis.key, label: axis.label, durationS: axis.durationS, watts, wattsPerKg: wkg(watts) };
  });
  return {
    hasPower: true,
    durations,
    bests,
    allTimeCurve,
    yearCurves,
    years,
    ftpWatts,
    ftpWattsPerKg: wkg(ftpWatts),
    ftpSource,
    best20MinWatts,
    best60MinWatts,
    zones: ftpWatts != null ? zonesFromFtp(ftpWatts) : [],
    radar,
    weightKg
  };
}

export { buildPowerProfile as b };
//# sourceMappingURL=power-profile.js-CfSj4S4i.js.map
