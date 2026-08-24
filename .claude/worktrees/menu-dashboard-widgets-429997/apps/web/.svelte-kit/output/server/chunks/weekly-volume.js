import { s as startOfWeek, c as addDays, i as isDayKey, d as daysBetween } from "./date.js";
const emptyBucket = () => ({ activities: 0, distanceM: 0, durationS: 0, elevationGainM: 0 });
function weekCount(weeks) {
  return Math.max(0, Math.trunc(weeks));
}
function weekLattice(today, weeks) {
  const count = weekCount(weeks);
  if (count === 0) return [];
  const thisMonday = startOfWeek(today);
  const out = [];
  for (let i = count - 1; i >= 0; i--) out.push(addDays(thisMonday, -i * 7));
  return out;
}
function weeklyWindowStart(today, weeks) {
  const lattice = weekLattice(today, weeks);
  return lattice[0] ?? startOfWeek(today);
}
function weeklyVolume(activities, opts) {
  const lattice = weekLattice(opts.today, opts.weeks);
  const buckets = new Map(lattice.map((w) => [w, emptyBucket()]));
  const currentWeek = startOfWeek(opts.today);
  for (const a of activities) {
    if (!isDayKey(a.day)) continue;
    if (opts.group !== void 0 && a.group !== opts.group) continue;
    const bucket = buckets.get(startOfWeek(a.day));
    if (bucket === void 0) continue;
    bucket.activities += 1;
    bucket.distanceM += a.distanceM ?? 0;
    bucket.durationS += a.durationS ?? 0;
    bucket.elevationGainM += a.elevationGainM ?? 0;
  }
  return lattice.map((week) => {
    const b = buckets.get(week) ?? emptyBucket();
    const partial = week === currentWeek;
    return {
      week,
      activities: b.activities,
      distanceM: Math.round(b.distanceM),
      durationS: Math.round(b.durationS),
      elevationGainM: Math.round(b.elevationGainM),
      partial,
      daysElapsed: partial ? daysBetween(week, opts.today) + 1 : 7
    };
  });
}
export {
  weeklyWindowStart as a,
  weekLattice as b,
  weeklyVolume as w
};
