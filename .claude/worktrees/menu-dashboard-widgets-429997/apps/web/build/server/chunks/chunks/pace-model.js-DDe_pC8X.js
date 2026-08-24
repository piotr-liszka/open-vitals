const MAX_GRADE_PCT = 35;
const CHEAPEST_GRADE_PCT = -10;
const VERTEX_COST = 5 / 6;
const CURVATURE = (1 - VERTEX_COST) / CHEAPEST_GRADE_PCT ** 2;
function gradeCostFactor(gradePct) {
  if (!Number.isFinite(gradePct)) return 1;
  const g = Math.max(-MAX_GRADE_PCT, Math.min(MAX_GRADE_PCT, gradePct));
  const factor = CURVATURE * (g - CHEAPEST_GRADE_PCT) ** 2 + VERTEX_COST;
  return Math.max(0.5, factor);
}
function gradeAdjustedSpeed(speedMps, gradePct) {
  if (!isNum(speedMps) || speedMps <= 0) return null;
  if (!isNum(gradePct)) return null;
  return round3(speedMps * gradeCostFactor(gradePct));
}
function gradeAdjustedStream(speed, grade) {
  if (!speed || !grade) return void 0;
  const n = Math.min(speed.length, grade.length);
  if (n === 0) return void 0;
  const out = new Array(n);
  for (let i = 0; i < n; i++) {
    out[i] = gradeAdjustedSpeed(speed[i], grade[i]) ?? Number.NaN;
  }
  return out;
}
function meanGradeAdjustedSpeed(speed, grade, elapsedS) {
  const adjusted = gradeAdjustedStream(speed, grade);
  if (!adjusted) return null;
  let weighted = 0;
  let seconds = 0;
  for (let i = 0; i < adjusted.length; i++) {
    const v = adjusted[i];
    if (v === void 0 || !Number.isFinite(v)) continue;
    const dt = elapsedS ? sampleSpan(elapsedS, i) : 1;
    if (dt <= 0) continue;
    weighted += v * dt;
    seconds += dt;
  }
  return seconds > 0 ? round3(weighted / seconds) : null;
}
function sampleSpan(elapsedS, i) {
  const prev = elapsedS[i - 1];
  const here = elapsedS[i];
  if (here === void 0) return 0;
  if (prev === void 0) return 1;
  const dt = here - prev;
  return dt > 0 && dt < 3600 ? dt : 0;
}
const CURVE_DURATIONS = [
  15,
  30,
  60,
  120,
  300,
  600,
  1200,
  1800,
  2700,
  3600,
  5400,
  7200
];
function speedDurationCurve(speed, sampleSeconds = 1, durations = CURVE_DURATIONS) {
  if (!speed || speed.length === 0 || !(sampleSeconds > 0)) return [];
  const prefix = new Array(speed.length + 1).fill(0);
  for (let i = 0; i < speed.length; i++) {
    const v = speed[i];
    prefix[i + 1] = (prefix[i] ?? 0) + (isNum(v) && v > 0 ? v : 0);
  }
  const out = [];
  for (const durationS of durations) {
    const window = Math.round(durationS / sampleSeconds);
    if (window < 1 || window > speed.length) continue;
    let best = 0;
    for (let i = 0; i + window <= speed.length; i++) {
      const mean = ((prefix[i + window] ?? 0) - (prefix[i] ?? 0)) / window;
      if (mean > best) best = mean;
    }
    if (best <= 0) continue;
    out.push({
      durationS,
      speedMps: round3(best),
      paceSecPerKm: Math.round(1e3 / best)
    });
  }
  return out;
}
function mergeSpeedCurves(curves) {
  const best = /* @__PURE__ */ new Map();
  for (const curve of curves) {
    for (const p of curve) {
      const current = best.get(p.durationS);
      if (current === void 0 || p.speedMps > current) best.set(p.durationS, p.speedMps);
    }
  }
  return [...best.entries()].sort((a, b) => a[0] - b[0]).map(([durationS, speedMps]) => ({
    durationS,
    speedMps,
    paceSecPerKm: Math.round(1e3 / speedMps)
  }));
}
const CS_SHORT_S = 180;
const CS_LONG_S = 1200;
function criticalSpeed(curve) {
  if (curve.length < 2) return null;
  const short = nearestPoint(curve, CS_SHORT_S);
  const long = nearestPoint(curve, CS_LONG_S);
  if (!short || !long) return null;
  if (long.durationS <= short.durationS * 2) return null;
  const d1 = short.speedMps * short.durationS;
  const d2 = long.speedMps * long.durationS;
  const cs = (d2 - d1) / (long.durationS - short.durationS);
  if (!(cs > 0)) return null;
  const dPrime = d1 - cs * short.durationS;
  return {
    speedMps: round3(cs),
    paceSecPerKm: Math.round(1e3 / cs),
    // A negative intercept means the two points do not fit the model; report zero rather than nonsense.
    dPrimeM: Math.max(0, Math.round(dPrime)),
    fromDurationsS: [short.durationS, long.durationS]
  };
}
function nearestPoint(curve, targetS) {
  let best;
  let bestGap = Infinity;
  for (const p of curve) {
    const gap = Math.abs(p.durationS - targetS);
    if (gap < bestGap) {
      bestGap = gap;
      best = p;
    }
  }
  return best;
}
const isNum = (v) => typeof v === "number" && Number.isFinite(v);
function round3(v) {
  return Math.round(v * 1e3) / 1e3;
}

export { mergeSpeedCurves as a, criticalSpeed as c, gradeAdjustedStream as g, meanGradeAdjustedSpeed as m, speedDurationCurve as s };
//# sourceMappingURL=pace-model.js-DDe_pC8X.js.map
