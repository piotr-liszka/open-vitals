const RIEGEL_EXPONENT = 1.06;
const MAX_EXTRAPOLATION = 4;
const CONFIDENT_EXTRAPOLATION = 2.5;
const RACE_TARGETS = [
  { key: "5k", label: "5 km", metres: 5e3 },
  { key: "10k", label: "10 km", metres: 1e4 },
  { key: "half", label: "Półmaraton", metres: 21097.5 },
  { key: "marathon", label: "Maraton", metres: 42195 }
];
function riegelTime(sourceTimeS, sourceMetres, targetMetres, exponent = RIEGEL_EXPONENT) {
  if (!(sourceTimeS > 0) || !(sourceMetres > 0) || !(targetMetres > 0)) return null;
  return Math.round(sourceTimeS * (targetMetres / sourceMetres) ** exponent);
}
function criticalSpeedTime(csMps, dPrimeM, targetMetres) {
  if (!isNum(csMps) || csMps <= 0 || !(targetMetres > 0)) return null;
  const reserve = isNum(dPrimeM) && dPrimeM > 0 ? dPrimeM : 0;
  const aerobic = targetMetres - reserve;
  if (aerobic <= 0) return null;
  return Math.round(aerobic / csMps);
}
function predictRaces(bests, opts = {}) {
  const targets = opts.targets ?? RACE_TARGETS;
  const usable = bests.filter((b) => b.metres > 0 && b.timeS > 0);
  const out = [];
  for (const target of targets) {
    const source = closestBest(usable, target.metres);
    const extrapolation = source ? ratio(target.metres, source.metres) : null;
    const withinRange = source !== null && extrapolation !== null && extrapolation <= MAX_EXTRAPOLATION;
    const riegelS = withinRange ? riegelTime(source.timeS, source.metres, target.metres, opts.exponent) : null;
    const criticalSpeedS = criticalSpeedTime(opts.csMps, opts.dPrimeM, target.metres);
    if (riegelS === null && criticalSpeedS === null) continue;
    out.push({
      key: target.key,
      label: target.label,
      metres: target.metres,
      riegelS,
      criticalSpeedS,
      paceSecPerKm: riegelS === null ? null : Math.round(riegelS / (target.metres / 1e3)),
      fromLabel: riegelS === null ? null : source?.label ?? null,
      fromDay: riegelS === null ? null : source?.day ?? null,
      fromBasis: riegelS === null ? null : source?.basis ?? null,
      extrapolation: riegelS === null ? null : round2(extrapolation ?? 1),
      confident: riegelS !== null && extrapolation !== null && extrapolation <= CONFIDENT_EXTRAPOLATION
    });
  }
  return out;
}
function withPredictionTrend(current, previous, sinceDay) {
  const before = /* @__PURE__ */ new Map();
  for (const p of previous) before.set(p.key, p);
  return current.map((p) => {
    const prev = before.get(p.key);
    const previousS = prev?.riegelS ?? null;
    if (p.riegelS === null || previousS === null) return p;
    return { ...p, trend: { deltaS: previousS - p.riegelS, previousS, sinceDay } };
  });
}
function closestBest(bests, targetMetres) {
  let best = null;
  let bestRatio = Infinity;
  for (const b of bests) {
    const r = ratio(targetMetres, b.metres);
    if (r < bestRatio) {
      bestRatio = r;
      best = b;
    }
  }
  return best;
}
function ratio(a, b) {
  if (!(a > 0) || !(b > 0)) return Infinity;
  return a > b ? a / b : b / a;
}
const isNum = (v) => typeof v === "number" && Number.isFinite(v);
function round2(v) {
  return Math.round(v * 100) / 100;
}
export {
  RACE_TARGETS as R,
  predictRaces as p,
  withPredictionTrend as w
};
