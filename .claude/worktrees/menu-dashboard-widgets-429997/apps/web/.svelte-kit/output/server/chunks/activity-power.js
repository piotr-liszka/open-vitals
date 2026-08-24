const MEAN_MAX_DURATIONS = [5, 10, 30, 60, 120, 300, 600, 1200, 1800, 2700, 3600];
function sampleIntervalS(time) {
  if (!time || time.length < 2) return 1;
  const diffs = [];
  for (let i = 1; i < time.length; i++) {
    const d = time[i] - time[i - 1];
    if (d > 0) diffs.push(d);
  }
  if (diffs.length === 0) return 1;
  diffs.sort((a, b) => a - b);
  const mid = Math.floor(diffs.length / 2);
  const med = diffs.length % 2 === 1 ? diffs[mid] : (diffs[mid - 1] + diffs[mid]) / 2;
  return med > 0 ? med : 1;
}
const mean = (xs) => xs.length === 0 ? 0 : xs.reduce((s, x) => s + x, 0) / xs.length;
function trailingWindowAverages(values, w) {
  if (w <= 1) return [...values];
  if (values.length < w) return [mean(values)];
  const out = [];
  let sum = 0;
  for (let i = 0; i < values.length; i++) {
    sum += values[i];
    if (i >= w) sum -= values[i - w];
    if (i >= w - 1) out.push(sum / w);
  }
  return out;
}
function normalizedPower(power, time) {
  if (!power || power.length === 0) return null;
  const dt = sampleIntervalS(time);
  const window = Math.max(1, Math.round(30 / dt));
  const rolling = trailingWindowAverages(power, window);
  if (rolling.length === 0) return null;
  const mean4 = rolling.reduce((s, x) => s + x ** 4, 0) / rolling.length;
  return Math.round(mean4 ** 0.25);
}
function intensityFactor(np, ftp) {
  if (np == null || !ftp || ftp <= 0) return null;
  return Math.round(np / ftp * 100) / 100;
}
function trainingStressScore(durationS, np, ftp) {
  if (!durationS || durationS <= 0 || np == null || !ftp || ftp <= 0) return null;
  const intensity = np / ftp;
  const tss = durationS * np * intensity / (ftp * 3600) * 100;
  return Math.round(tss);
}
function totalWorkKj(power, time) {
  if (!power || power.length === 0) return null;
  const dt = sampleIntervalS(time);
  const joules = power.reduce((s, w) => s + w * dt, 0);
  return Math.round(joules / 1e3);
}
function meanMaxCurve(power, time) {
  if (!power || power.length === 0) return [];
  const dt = sampleIntervalS(time);
  const n = power.length;
  const prefix = new Array(n + 1).fill(0);
  for (let i = 0; i < n; i++) prefix[i + 1] = prefix[i] + power[i];
  const out = [];
  for (const d of MEAN_MAX_DURATIONS) {
    const w = Math.max(1, Math.round(d / dt));
    if (w > n) continue;
    let best = -Infinity;
    for (let i = w; i <= n; i++) {
      const avg = (prefix[i] - prefix[i - w]) / w;
      if (avg > best) best = avg;
    }
    out.push({ durationS: d, watts: Math.round(best) });
  }
  return out;
}
function estimateFtpFromCurve(curve) {
  const best20 = curve.find((c) => c.durationS === 1200);
  if (!best20) return null;
  return Math.round(0.95 * best20.watts);
}
function powerZoneIndex(pct) {
  if (pct < 55) return 1;
  if (pct < 76) return 2;
  if (pct < 91) return 3;
  if (pct < 106) return 4;
  if (pct < 121) return 5;
  if (pct < 151) return 6;
  return 7;
}
function powerZones(power, ftp, time) {
  if (!power || power.length === 0 || !ftp || ftp <= 0) return [];
  const dt = sampleIntervalS(time);
  const secs = new Array(8).fill(0);
  for (const p of power) {
    const z = powerZoneIndex(p / ftp * 100);
    secs[z] = (secs[z] ?? 0) + dt;
  }
  return toBuckets(secs, 7);
}
function hrZoneIndex(pct) {
  if (pct < 60) return 1;
  if (pct < 70) return 2;
  if (pct < 80) return 3;
  if (pct < 90) return 4;
  return 5;
}
function hrZones(hr, maxHr, time) {
  if (!hr || hr.length === 0 || !maxHr || maxHr <= 0) return [];
  const dt = sampleIntervalS(time);
  const secs = new Array(6).fill(0);
  for (const h of hr) {
    const z = hrZoneIndex(h / maxHr * 100);
    secs[z] = (secs[z] ?? 0) + dt;
  }
  return toBuckets(secs, 5);
}
function toBuckets(secs, zones) {
  const total = secs.reduce((a, b) => a + b, 0);
  const out = [];
  for (let z = 1; z <= zones; z++) {
    out.push({
      zone: z,
      label: `Z${z}`,
      seconds: secs[z] ?? 0,
      pct: total > 0 ? Math.round((secs[z] ?? 0) / total * 1e3) / 10 : 0
    });
  }
  return out;
}
export {
  trainingStressScore as a,
  estimateFtpFromCurve as e,
  hrZones as h,
  intensityFactor as i,
  meanMaxCurve as m,
  normalizedPower as n,
  powerZones as p,
  sampleIntervalS as s,
  totalWorkKj as t
};
