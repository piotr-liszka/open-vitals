/**
 * Activities-list handler (PWRX §1). Queries the local store by sport/search/sort and paginates,
 * returning a typed list plus facets (sports, totals). Pure over an injected `LocalStore` — no live
 * Garmin call. Route thumbnails reuse each activity's stored GPS, downsampled to keep the payload
 * (and the many tiny maps) cheap.
 */
import type { ActivitySummary, ListActivitiesQuery, LocalStore } from '$lib/server/store/types';
import type {
  ActivitiesData,
  ActivitiesQuery,
  ActivityListItem,
  ActivitySort,
  SortDir,
  ThumbnailGps
} from './activities.types';

export interface ActivitiesDeps {
  store: LocalStore;
}

const DEFAULT_PAGE_SIZE = 24;
const MAX_PAGE_SIZE = 60;
const THUMBNAIL_POINTS = 80;

const clamp = (n: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, n));
const isSort = (v: string | null | undefined): v is ActivitySort =>
  v === 'date' || v === 'distance' || v === 'duration';
const isDir = (v: string | null | undefined): v is SortDir => v === 'asc' || v === 'desc';

/** Keep roughly `max` evenly-spaced points so a thumbnail draws fast without warping the shape. */
function downsample(points: ThumbnailGps, max: number): ThumbnailGps {
  if (points.length <= max) return points;
  const step = Math.ceil(points.length / max);
  const out: ThumbnailGps = [];
  for (let i = 0; i < points.length; i += step) out.push(points[i]!);
  const last = points[points.length - 1]!;
  if (out[out.length - 1] !== last) out.push(last);
  return out;
}

function toItem(a: ActivitySummary, gps: ThumbnailGps | null): ActivityListItem {
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

export async function loadActivities(
  deps: ActivitiesDeps,
  userId: string,
  query: ActivitiesQuery = {}
): Promise<ActivitiesData> {
  const sport = query.sport && query.sport.length > 0 ? query.sport : null;
  const search = query.search && query.search.trim().length > 0 ? query.search.trim() : null;
  const sort: ActivitySort = isSort(query.sort) ? query.sort : 'date';
  const dir: SortDir = isDir(query.dir) ? query.dir : 'desc';
  const pageSize = clamp(Math.trunc(query.pageSize ?? DEFAULT_PAGE_SIZE), 1, MAX_PAGE_SIZE);
  const page = Math.max(1, Math.trunc(query.page ?? 1));

  /*
   * The global range narrows the list too (spec 047): "Aktywności" with `7 dni` selected means this
   * week's sessions. Pushed INTO the store query rather than filtered in memory, and combined with the
   * sport/search filters, so the facet totals below describe the same set the rows come from.
   */
  const range = query.range;
  const filter: ListActivitiesQuery = {
    ...(sport ? { sport } : {}),
    ...(search ? { search } : {}),
    ...(range ? { from: range.start, to: range.end } : {}),
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
    pageRows.map(async (a): Promise<ActivityListItem> => {
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
    ...(range ? { range } : {}),
    pageCount
  };
}
