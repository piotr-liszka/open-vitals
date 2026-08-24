import { w as weeklyVolume } from './weekly-volume.js-8BKa7ZsC.js';

const RUN_DISTANCES = [
  { key: "1k", label: "1 km", meters: 1e3 },
  { key: "5k", label: "5 km", meters: 5e3 },
  { key: "10k", label: "10 km", meters: 1e4 },
  { key: "half", label: "Półmaraton", meters: 21097.5 },
  { key: "marathon", label: "Maraton", meters: 42195 }
];
function paceSecPerKm(durationS, distanceM) {
  if (!durationS || !distanceM || distanceM <= 0) return null;
  return durationS / (distanceM / 1e3);
}
function personalBests(runs) {
  const out = [];
  for (const d of RUN_DISTANCES) {
    let best = null;
    for (const r of runs) {
      if (!r.distanceM || !r.durationS || r.distanceM < d.meters * 0.995) continue;
      const projected = r.durationS * (d.meters / r.distanceM);
      if (best === null || projected < best.timeS) {
        best = {
          key: d.key,
          label: d.label,
          meters: d.meters,
          timeS: projected,
          paceSecPerKm: projected / (d.meters / 1e3),
          activityId: r.activityId,
          day: r.day
        };
      }
    }
    if (best) out.push(best);
  }
  return out;
}
function weeklyMileage(runs, today, weeks = 12) {
  const measured = runs.filter((r) => !!r.distanceM);
  return weeklyVolume(
    measured.map((r) => ({
      day: r.day,
      group: "run",
      distanceM: r.distanceM,
      durationS: r.durationS,
      elevationGainM: null
    })),
    { today, weeks }
  ).map((w) => ({ week: w.week, km: Math.round(w.distanceM / 1e3 * 10) / 10, runs: w.activities }));
}
function runningTotals(runs) {
  let totalM = 0;
  let longestM = 0;
  let totalTimeS = 0;
  for (const r of runs) {
    if (r.distanceM) {
      totalM += r.distanceM;
      longestM = Math.max(longestM, r.distanceM);
    }
    if (r.durationS) totalTimeS += r.durationS;
  }
  return {
    runs: runs.length,
    totalKm: Math.round(totalM / 1e3 * 10) / 10,
    longestKm: Math.round(longestM / 1e3 * 10) / 10,
    totalTimeS,
    avgPaceSecPerKm: totalM > 0 ? totalTimeS / (totalM / 1e3) : null
  };
}
function fmtPace(secPerKm) {
  if (secPerKm == null || !Number.isFinite(secPerKm)) return "—";
  const t = Math.round(secPerKm);
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, "0")}`;
}

export { personalBests as a, fmtPace as f, paceSecPerKm as p, runningTotals as r, weeklyMileage as w };
//# sourceMappingURL=running-profile.js-BI1N4bvT.js.map
