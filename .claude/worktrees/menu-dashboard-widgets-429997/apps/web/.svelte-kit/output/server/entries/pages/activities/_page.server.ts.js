import { redirect } from "@sveltejs/kit";
import { l as loadRange } from "../../../chunks/range-context.js";
const DEFAULT_PAGE_SIZE = 24;
const MAX_PAGE_SIZE = 60;
const THUMBNAIL_POINTS = 80;
const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));
const isSort$1 = (v) => v === "date" || v === "distance" || v === "duration";
const isDir$1 = (v) => v === "asc" || v === "desc";
function downsample(points, max) {
  if (points.length <= max) return points;
  const step = Math.ceil(points.length / max);
  const out = [];
  for (let i = 0; i < points.length; i += step) out.push(points[i]);
  const last = points[points.length - 1];
  if (out[out.length - 1] !== last) out.push(last);
  return out;
}
function toItem(a, gps) {
  return {
    id: a.activityId,
    sport: a.sport,
    name: a.name,
    startTimeLocal: a.startTimeLocal,
    distanceM: a.distanceM,
    durationS: a.durationS,
    movingS: a.movingS,
    elevationGainM: a.elevationGainM,
    avgHr: a.avgHr,
    avgPower: a.avgPower,
    normPower: a.normPower,
    hasGps: a.hasGps,
    gps
  };
}
async function loadActivities(deps, userId, query = {}) {
  const sport = query.sport && query.sport.length > 0 ? query.sport : null;
  const search = query.search && query.search.trim().length > 0 ? query.search.trim() : null;
  const sort = isSort$1(query.sort) ? query.sort : "date";
  const dir = isDir$1(query.dir) ? query.dir : "desc";
  const pageSize = clamp(Math.trunc(query.pageSize ?? DEFAULT_PAGE_SIZE), 1, MAX_PAGE_SIZE);
  const page = Math.max(1, Math.trunc(query.page ?? 1));
  const range = query.range;
  const filter = {
    ...sport ? { sport } : {},
    ...search ? { search } : {},
    ...range ? { from: range.start, to: range.end } : {},
    sort,
    dir,
    limit: Number.MAX_SAFE_INTEGER
  };
  const [matching, sports] = await Promise.all([
    deps.store.listActivities(userId, filter),
    deps.store.listSports(userId)
  ]);
  const total = matching.length;
  const totalDistanceM = matching.reduce((s, a) => s + (a.distanceM ?? 0), 0);
  const totalDurationS = matching.reduce((s, a) => s + (a.movingS ?? a.durationS ?? 0), 0);
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const offset = (Math.min(page, pageCount) - 1) * pageSize;
  const pageRows = matching.slice(offset, offset + pageSize);
  const items = await Promise.all(
    pageRows.map(async (a) => {
      if (!a.hasGps) return toItem(a, null);
      const streams = await deps.store.getStreams(userId, a.activityId);
      const gps = streams?.gps && streams.gps.length > 0 ? downsample(streams.gps, THUMBNAIL_POINTS) : null;
      return toItem(a, gps);
    })
  );
  return {
    items,
    facets: { sports, total, totalDistanceM, totalDurationS },
    query: { sport, search, sort, dir, page: Math.min(page, pageCount), pageSize },
    ...range ? { range } : {},
    pageCount
  };
}
const DATA_PROCESSING = "detailed_analytics";
const isSort = (v) => v === "date" || v === "distance" || v === "duration";
const isDir = (v) => v === "asc" || v === "desc";
const load = async ({ locals, url }) => {
  const user = locals.user;
  if (!await locals.consent.isEnabled(DATA_PROCESSING)) throw redirect(303, "/");
  const sortParam = url.searchParams.get("sort");
  const dirParam = url.searchParams.get("dir");
  const pageParam = Number(url.searchParams.get("page"));
  const c = locals.container;
  const range = await loadRange(
    { store: c.store, clock: c.clock, timeZone: c.config.appTimeZone },
    user.id,
    url
  );
  const data = await loadActivities({ store: c.store }, user.id, {
    sport: url.searchParams.get("sport"),
    search: url.searchParams.get("search"),
    range,
    ...isSort(sortParam) ? { sort: sortParam } : {},
    ...isDir(dirParam) ? { dir: dirParam } : {},
    ...Number.isFinite(pageParam) && pageParam > 0 ? { page: pageParam } : {}
  });
  return { activities: data };
};
export {
  load
};
