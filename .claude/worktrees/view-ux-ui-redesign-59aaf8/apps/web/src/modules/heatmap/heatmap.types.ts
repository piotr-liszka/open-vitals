/** Contracts for the GPS heatmap (spec 015 / PWRX §3). */
import type { ActivityStreams, SportCount } from '$lib/server/store/types';

export type { SportCount };

export interface HeatmapTrack {
  activityId: string;
  sport: string;
  gps: NonNullable<ActivityStreams['gps']>;
}

export interface HeatmapData {
  tracks: HeatmapTrack[];
  /** Activity count matching the current filter (not just GPS ones). */
  count: number;
  totalDistanceM: number;
  /** Sports present with activity counts, most frequent first (drives the filter chips). */
  sports: SportCount[];
  years: number[];
  /** Active filters echoed back. */
  sport: string | null;
  year: number | null;
}

export interface HeatmapFilter {
  sport?: string | null;
  year?: number | null;
}
