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
import type { Locale } from '$lib/i18n';

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

/** Year-over-year sport filter (spec 070). `all` is every family combined. */
export type VolumeSportFilter = 'all' | SportGroup;

/** One option on that filter, in the order the view should render it. */
export interface VolumeSportOption {
  readonly value: VolumeSportFilter;
  /** Polish family name from the shared taxonomy, or `Wszystko` for the combined view. */
  readonly label: string;
}

/**
 * The year-over-year answer for ONE sport filter.
 *
 * Computed per family up front rather than fetched per click: the loader already holds every
 * activity in the window, so a second read to answer "and what about only the rides?" would be a
 * round trip for arithmetic we can do once. A multi-sport athlete has at most a handful of families,
 * and each curve is the same 366 slots the combined one already costs.
 */
export interface VolumeYearsFor {
  /** One series per year with data, newest first. */
  readonly years: VolumeYearSeries[];
  /** This year minus last year at the same day-of-year, in km; null when either side is missing. */
  readonly vsLastYearKm: number | null;
}

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
  /** How many months the loader ships — the widest span the period filter can slice (spec 070). */
  readonly windowMonths: number;
  /** Month keys (`YYYY-MM`), oldest first — the x lattice of `monthly` and every `bySport` series. */
  readonly months: string[];
  readonly monthly: MonthVolume[];
  /** One entry per family present in the window, busiest (by distance) first. */
  readonly bySport: VolumeSportSeries[];

  /** The combined, every-sport year curves. Identical to `yearsBySport.all`. */
  readonly years: VolumeYearSeries[];
  /** This year minus last year at the same day-of-year, in km; `null` when either side is missing. */
  readonly vsLastYearKm: number | null;
  /** Year curves per sport filter, keyed by `VolumeSportFilter`; always carries `all` (spec 070). */
  readonly yearsBySport: Record<string, VolumeYearsFor>;
  /**
   * Options for the year-over-year sport filter, `all` first. Holds a single entry when the athlete
   * does one sport — the view then renders no switch, because a control with one choice is furniture.
   */
  readonly sportOptions: VolumeSportOption[];
  /** Day-of-year "today" is — the cut every `toDateKm` is measured at. */
  readonly throughDayOfYear: number;
  /** Day-of-year labels for the year chart: a month name on each 1st, blank elsewhere. */
  readonly dayOfYearLabels: string[];

  /** Every day with activity in the whole window, for the consistency grid (specs 046, 070). */
  readonly gridDays: VolumeDay[];
  /** The athlete's today (`YYYY-MM-DD`) — the right-hand edge of any period the grid draws. */
  readonly today: string;

  readonly hasData: boolean;
}

export interface VolumeRequest {
  readonly userId: string;
  /** Language this request renders in (spec 076) — the loader labels sports and months with it. */
  readonly locale: Locale;
}
