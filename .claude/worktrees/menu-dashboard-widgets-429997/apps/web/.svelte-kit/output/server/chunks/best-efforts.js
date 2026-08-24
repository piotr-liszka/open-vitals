const EFFORT_DISTANCES = [
  { key: "400m", label: "400 m", metres: 400 },
  { key: "1k", label: "1 km", metres: 1e3 },
  { key: "mile", label: "1 mila", metres: 1609 },
  { key: "5k", label: "5 km", metres: 5e3 },
  { key: "10k", label: "10 km", metres: 1e4 },
  { key: "15k", label: "15 km", metres: 15e3 },
  { key: "half", label: "Półmaraton", metres: 21097 },
  { key: "marathon", label: "Maraton", metres: 42195 }
];
function bestEfforts(cumulativeM, elapsedS, distances = EFFORT_DISTANCES) {
  if (!cumulativeM || !elapsedS) return [];
  const n = Math.min(cumulativeM.length, elapsedS.length);
  if (n < 2) return [];
  const total = (cumulativeM[n - 1] ?? 0) - (cumulativeM[0] ?? 0);
  const out = [];
  for (const d of distances) {
    if (!(total >= d.metres)) continue;
    let best = null;
    let j = 0;
    for (let i = 0; i < n; i++) {
      const startM = cumulativeM[i];
      const startT = elapsedS[i];
      if (startM === void 0 || startT === void 0) continue;
      if (j < i) j = i;
      while (j < n && (cumulativeM[j] ?? 0) - startM < d.metres) j++;
      if (j >= n) break;
      const endM = cumulativeM[j];
      const endT = elapsedS[j];
      if (endM === void 0 || endT === void 0) continue;
      const durationS = endT - startT;
      if (!(durationS > 0)) continue;
      const actualM = endM - startM;
      if (best === null || durationS < best.durationS) {
        best = {
          key: d.key,
          label: d.label,
          metres: d.metres,
          durationS: round1(durationS),
          actualM: Math.round(actualM),
          // Paced over what was actually covered, so a coarse sample interval cannot flatter it.
          paceSecPerKm: round1(durationS / (actualM / 1e3)),
          startS: round1(startT),
          samples: j - i + 1
        };
      }
    }
    if (best) out.push(best);
  }
  return out;
}
function round1(v) {
  return Math.round(v * 10) / 10;
}
export {
  EFFORT_DISTANCES as E,
  bestEfforts as b
};
