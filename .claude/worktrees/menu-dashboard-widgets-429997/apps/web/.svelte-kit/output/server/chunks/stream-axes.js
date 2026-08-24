const NUMERIC_STREAM_KEYS = [
  "time",
  "heartRate",
  "power",
  "cadence",
  "speed",
  "elevation",
  "grade",
  "temperature",
  "respirationRate",
  "verticalRatio",
  "verticalOscillation",
  "groundContactTime",
  "groundContactBalance",
  "strideLength",
  "stamina",
  "staminaPotential",
  "performanceCondition",
  "moving"
];
function streamLength(streams) {
  let n = 0;
  for (const key of NUMERIC_STREAM_KEYS) {
    const arr = streams[key];
    if (Array.isArray(arr) && arr.length > n) n = arr.length;
  }
  return n;
}
function elapsedSeconds(streams, n) {
  const time = streams.time;
  const out = [];
  let last = 0;
  for (let i = 0; i < n; i++) {
    const t = time?.[i];
    last = typeof t === "number" && Number.isFinite(t) && t >= last ? t : time ? last : i;
    out.push(last);
  }
  return out;
}
function cumulativeDistance(streams, elapsed) {
  const speed = streams.speed;
  if (!speed || speed.length < 2) return null;
  const out = [];
  let total = 0;
  for (let i = 0; i < elapsed.length; i++) {
    if (i > 0) {
      const dt = (elapsed[i] ?? 0) - (elapsed[i - 1] ?? 0);
      const v = speed[i];
      if (dt > 0 && typeof v === "number" && Number.isFinite(v) && v > 0) total += v * dt;
    }
    out.push(total);
  }
  return total > 0 ? out : null;
}
export {
  cumulativeDistance as c,
  elapsedSeconds as e,
  streamLength as s
};
