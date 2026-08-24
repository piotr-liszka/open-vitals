const COUPLED_LIMIT_PCT = 5;
const MIN_HALF_SAMPLES = 60;
const MOVING_MPS = 0.5;
const LIVE_HR_BPM = 60;
function usablePairs(output, hr, minOutput) {
  const n = Math.min(output.length, hr.length);
  const out = [];
  for (let i = 0; i < n; i++) {
    const o = output[i];
    const h = hr[i];
    if (o === void 0 || h === void 0) continue;
    if (!Number.isFinite(o) || !Number.isFinite(h)) continue;
    if (o < minOutput || h < LIVE_HR_BPM) continue;
    out.push({ output: o, hr: h });
  }
  return out;
}
function meanRatio(pairs) {
  if (pairs.length === 0) return null;
  let output = 0;
  let hr = 0;
  for (const p of pairs) {
    output += p.output;
    hr += p.hr;
  }
  return hr > 0 ? output / hr : null;
}
function aerobicDecoupling(output, hr, basis = "pace") {
  if (!output || !hr) return null;
  const pairs = usablePairs(output, hr, basis === "power" ? 1 : MOVING_MPS);
  const half = Math.floor(pairs.length / 2);
  if (half < MIN_HALF_SAMPLES) return null;
  const firstRatio = meanRatio(pairs.slice(0, half));
  const secondRatio = meanRatio(pairs.slice(half, half * 2));
  if (firstRatio === null || secondRatio === null || firstRatio <= 0) return null;
  const pct = round1((firstRatio - secondRatio) / firstRatio * 100);
  return {
    pct,
    basis,
    firstRatio: round3(firstRatio),
    secondRatio: round3(secondRatio),
    samples: half,
    coupled: Math.abs(pct) <= COUPLED_LIMIT_PCT
  };
}
function efficiencyFactor(avgSpeedMps, avgHr) {
  if (!isNum(avgSpeedMps) || !isNum(avgHr)) return null;
  if (avgSpeedMps <= 0 || avgHr < LIVE_HR_BPM) return null;
  return round3(avgSpeedMps * 60 / avgHr);
}
function powerEfficiencyFactor(normPower, avgHr) {
  if (!isNum(normPower) || !isNum(avgHr)) return null;
  if (normPower <= 0 || avgHr < LIVE_HR_BPM) return null;
  return round3(normPower / avgHr);
}
function cardiacCost(distanceM, durationS, avgHr) {
  if (!isNum(distanceM) || !isNum(durationS) || !isNum(avgHr)) return null;
  if (distanceM < 400 || durationS <= 0 || avgHr < LIVE_HR_BPM) return null;
  const beats = avgHr * (durationS / 60);
  return Math.round(beats / (distanceM / 1e3));
}
function cardiacCostStream(speed, hr) {
  if (!speed || !hr) return void 0;
  const n = Math.min(speed.length, hr.length);
  if (n === 0) return void 0;
  const out = new Array(n);
  for (let i = 0; i < n; i++) {
    const v = speed[i];
    const h = hr[i];
    out[i] = v === void 0 || h === void 0 || !Number.isFinite(v) || !Number.isFinite(h) || v < MOVING_MPS || h < LIVE_HR_BPM ? Number.NaN : (
      // beats per km = (bpm / 60) beats per second ÷ (v / 1000) km per second
      h / 60 / (v / 1e3)
    );
  }
  return out;
}
function monthlyEfficiency(sessions, months) {
  const buckets = new Map(
    months.map((m) => [m, { ef: [], cost: [] }])
  );
  for (const s of sessions) {
    const bucket = buckets.get(s.day.slice(0, 7));
    if (!bucket) continue;
    const speed = isNum(s.distanceM) && isNum(s.durationS) && s.durationS > 0 ? s.distanceM / s.durationS : null;
    const ef = efficiencyFactor(speed, s.avgHr);
    const cost = cardiacCost(s.distanceM, s.durationS, s.avgHr);
    if (ef !== null) bucket.ef.push(ef);
    if (cost !== null) bucket.cost.push(cost);
  }
  return months.map((month) => {
    const b = buckets.get(month) ?? { ef: [], cost: [] };
    return {
      month,
      ef: b.ef.length === 0 ? null : round3(mean(b.ef)),
      cardiacCost: b.cost.length === 0 ? null : Math.round(mean(b.cost)),
      sessions: Math.max(b.ef.length, b.cost.length)
    };
  });
}
function mean(xs) {
  return xs.reduce((s, x) => s + x, 0) / xs.length;
}
const isNum = (v) => typeof v === "number" && Number.isFinite(v);
function round1(v) {
  return Math.round(v * 10) / 10;
}
function round3(v) {
  return Math.round(v * 1e3) / 1e3;
}
export {
  COUPLED_LIMIT_PCT as C,
  aerobicDecoupling as a,
  cardiacCostStream as b,
  cardiacCost as c,
  efficiencyFactor as e,
  monthlyEfficiency as m,
  powerEfficiencyFactor as p
};
