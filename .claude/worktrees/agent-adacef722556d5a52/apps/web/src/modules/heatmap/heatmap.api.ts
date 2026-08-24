/**
 * Heatmap data handler (spec 015). Pulls every GPS track (optionally filtered by sport/year) plus
 * summary stats, all from the local store — no live Garmin call. Pure over an injected LocalStore.
 */
import type { LocalStore } from '$lib/server/store/types';
import type { HeatmapData, HeatmapFilter } from './heatmap.types';

export interface HeatmapDeps {
  store: LocalStore;
}

const yearOf = (startTimeLocal: string): number => Number(startTimeLocal.slice(0, 4));

// Bound the payload so the page can't OOM/time out: a heatmap doesn't need full GPS resolution.
const MAX_POINTS_PER_TRACK = 160;
const MAX_TRACKS = 2500;

/** Evenly thin a track to at most `max` points, always keeping the first and last. */
function downsampleTrack<T>(points: T[], max: number): T[] {
  if (points.length <= max) return points;
  const step = Math.ceil(points.length / max);
  const out: T[] = [];
  for (let i = 0; i < points.length; i += step) out.push(points[i]!);
  const last = points[points.length - 1]!;
  if (out[out.length - 1] !== last) out.push(last);
  return out;
}

export async function loadHeatmap(
  deps: HeatmapDeps,
  userId: string,
  filter: HeatmapFilter = {}
): Promise<HeatmapData> {
  const sport = filter.sport ?? null;
  const year = filter.year ?? null;

  const [gpsTracks, activities, sports] = await Promise.all([
    deps.store.listGpsTracks(userId, { ...(sport ? { sport } : {}), ...(year ? { year } : {}) }),
    deps.store.listActivities(userId, { limit: 100000 }),
    deps.store.listSports(userId)
  ]);

  const years = [...new Set(activities.map((a) => yearOf(a.startTimeLocal)))]
    .filter((y) => y > 1970)
    .sort((a, b) => b - a);
  const scoped = activities.filter(
    (a) => (!sport || a.sport === sport) && (!year || yearOf(a.startTimeLocal) === year)
  );

  const tracks = gpsTracks.slice(0, MAX_TRACKS).map((t) => ({
    activityId: t.activityId,
    sport: t.sport,
    gps: downsampleTrack(t.gps!, MAX_POINTS_PER_TRACK)
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
