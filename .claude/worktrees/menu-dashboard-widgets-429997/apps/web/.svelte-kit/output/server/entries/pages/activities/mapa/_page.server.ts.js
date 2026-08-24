import { redirect } from "@sveltejs/kit";
const yearOf = (startTimeLocal) => Number(startTimeLocal.slice(0, 4));
const MAX_POINTS_PER_TRACK = 160;
const MAX_TRACKS = 2500;
function downsampleTrack(points, max) {
  if (points.length <= max) return points;
  const step = Math.ceil(points.length / max);
  const out = [];
  for (let i = 0; i < points.length; i += step) out.push(points[i]);
  const last = points[points.length - 1];
  if (out[out.length - 1] !== last) out.push(last);
  return out;
}
async function loadHeatmap(deps, userId, filter = {}) {
  const sport = filter.sport ?? null;
  const year = filter.year ?? null;
  const [gpsTracks, activities, sports] = await Promise.all([
    deps.store.listGpsTracks(userId, { ...sport ? { sport } : {}, ...year ? { year } : {} }),
    deps.store.listActivities(userId, { limit: 1e5 }),
    deps.store.listSports(userId)
  ]);
  const years = [...new Set(activities.map((a) => yearOf(a.startTimeLocal)))].filter((y) => y > 1970).sort((a, b) => b - a);
  const scoped = activities.filter(
    (a) => (!sport || a.sport === sport) && (!year || yearOf(a.startTimeLocal) === year)
  );
  const tracks = gpsTracks.slice(0, MAX_TRACKS).map((t) => ({
    activityId: t.activityId,
    sport: t.sport,
    gps: downsampleTrack(t.gps, MAX_POINTS_PER_TRACK)
  }));
  return {
    tracks,
    count: scoped.length,
    totalDistanceM: scoped.reduce((s, a) => s + (a.distanceM ?? 0), 0),
    sports,
    years,
    sport,
    year
  };
}
const DATA_PROCESSING = "detailed_analytics";
const load = async ({ locals, url }) => {
  const user = locals.user;
  if (!await locals.consent.isEnabled(DATA_PROCESSING)) throw redirect(303, "/");
  const sport = url.searchParams.get("sport");
  const yearParam = url.searchParams.get("year");
  const year = yearParam ? Number(yearParam) : null;
  const data = await loadHeatmap({ store: locals.container.store }, user.id, {
    sport,
    year: year && Number.isFinite(year) ? year : null
  });
  return { heatmap: data };
};
export {
  load
};
