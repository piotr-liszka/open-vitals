/** Contracts for the activities list (PWRX §1). Shared by the API handler and the UI. */
import type { ResolvedRange } from '$lib/range';
import type { ActivityStreams, SportCount } from '$lib/server/store/types';

export type { SportCount };

export type ActivitySort = 'date' | 'distance' | 'duration';
export type SortDir = 'asc' | 'desc';
export type ViewMode = 'grid' | 'list';

/** A GPS track downsampled for a lightweight route thumbnail. */
export type ThumbnailGps = NonNullable<ActivityStreams['gps']>;

/** One row/card in the activities list — a display projection of `ActivitySummary`. */
export interface ActivityListItem {
  readonly id: string;
  readonly sport: string;
  readonly name: string | null;
  readonly startTimeLocal: string;
  readonly distanceM: number | null;
  readonly durationS: number | null;
  readonly movingS: number | null;
  readonly elevationGainM: number | null;
  readonly avgHr: number | null;
  readonly avgPower: number | null;
  readonly normPower: number | null;
  readonly hasGps: boolean;
  /** Downsampled route for the thumbnail map; `null` when no GPS is stored. */
  readonly gps: ThumbnailGps | null;
}

/** Query the list handler accepts (already parsed/validated from URL search params). */
export interface ActivitiesQuery {
  readonly sport?: string | null;
  readonly search?: string | null;
  readonly sort?: ActivitySort;
  readonly dir?: SortDir;
  readonly page?: number;
  readonly pageSize?: number;
  /**
   * The global range (spec 047). When given, the list, the facet totals and the pagination all cover
   * only that window. Omit to list the whole history — which is what MCP and tests want.
   */
  readonly range?: ResolvedRange;
}

/** Filter facets + aggregate totals over the whole matching set (not just the page). */
export interface ActivitiesFacets {
  /** Sports present for this user with activity counts, most frequent first (drives the chips). */
  readonly sports: SportCount[];
  /** Total activities matching the current filter. */
  readonly total: number;
  readonly totalDistanceM: number;
  readonly totalDurationS: number;
}

/** The echoed, normalized query the UI renders its controls from. */
export interface ActivitiesQueryState {
  readonly sport: string | null;
  readonly search: string | null;
  readonly sort: ActivitySort;
  readonly dir: SortDir;
  readonly page: number;
  readonly pageSize: number;
}

export interface ActivitiesData {
  readonly items: ActivityListItem[];
  readonly facets: ActivitiesFacets;
  readonly query: ActivitiesQueryState;
  /** The global range the list was narrowed to, absent when the whole history was listed. */
  readonly range?: ResolvedRange;
  readonly pageCount: number;
}
