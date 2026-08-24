/**
 * Contracts for the volume page (spec 037) — "how much did I do per month, and am I ahead of last
 * year?". Shared by the API handler and the view.
 *
 * The `$lib/server` imports here are **type-only** and therefore erased at build time, which is what
 * lets the same file be the boundary for both halves of the slice (the same trick `training.types.ts`
 * uses).
 */
import type { MonthVolume, YearVolumeCurve } from '$lib/server/analytics/volume';
import type { SportGroup } from '$lib/sport-labels';

export type { MonthVolume, YearVolumeCurve };

/** One sport family's monthly distance/time/climb, index-aligned with `VolumeData.months`. */
export interface VolumeSportSeries {
  readonly group: SportGroup;
  /** Polish family name, from the shared taxonomy. */
  readonly label: string;
  /** Lane token for the family, from the shared taxonomy — the same colour on every chart. */
  readonly color: string;
  readonly distanceM: number[];
  readonly durationS: number[];
  readonly elevationGainM: number[];
}

/**
 * One calendar year's cumulative distance, padded to a uniform 366 slots so every year can be drawn
 * on ONE x lattice. `null` marks both a day the year does not have (29 February in a common year) and
 * every day after today in the year in progress.
 */
export interface VolumeYearSeries {
  readonly year: number;
  readonly cumulativeKm: (number | null)[];
  readonly totalKm: number;
  /** The comparable number: this year's total at the same day of the season as today. */
  readonly toDateKm: number;
  readonly partial: boolean;
}

/** Which measure the monthly chart plots. The view owns the switch; the data carries all three. */
export type VolumeMeasure = 'distance' | 'duration' | 'elevation';

/** One day of the consistency grid (spec 046). */
export interface VolumeDay {
  /** `YYYY-MM-DD`. */
  readonly day: string;
  /** Kilometres that day, summed across sports. */
  readonly km: number;
  /** Pre-formatted tooltip line, e.g. "12,4 km · 2 aktywności". */
  readonly title: string;
}

export interface VolumeData {
  /** How many months the monthly section covers. */
  readonly windowMonths: number;
  /** Month keys (`YYYY-MM`), oldest first — the x lattice of `monthly` and every `bySport` series. */
  readonly months: string[];
  readonly monthly: MonthVolume[];
  /** One entry per family present in the window, busiest (by distance) first. */
  readonly bySport: VolumeSportSeries[];
  /** Mean distance per COMPLETE month; `null` when no month in the window completed. */
  readonly avgDistanceM: number | null;
  /** Best COMPLETE month by distance; `null` when none completed. */
  readonly bestMonth: MonthVolume | null;

  /** One series per year with data, newest first. */
  readonly years: VolumeYearSeries[];
  /** Day-of-year "today" is — the cut every `toDateKm` is measured at. */
  readonly throughDayOfYear: number;
  /** This year minus last year at that cut, in km; `null` when either side is missing. */
  readonly vsLastYearKm: number | null;
  /** Day-of-year labels for the year chart: a month name on each 1st, blank elsewhere. */
  readonly dayOfYearLabels: string[];

  /** Days with activity in `gridYear`, for the consistency grid (spec 046). */
  readonly gridDays: VolumeDay[];
  /** The year the grid covers — the current one. */
  readonly gridYear: number;

  readonly hasData: boolean;
}

export interface VolumeRequest {
  readonly userId: string;
}
