/**
 * Contracts for the Training section overview (spec 025) — the multi-sport landing page of
 * `/training`. Shared by the API handler and the view.
 */
import type { DailyLoadPoint, TrainingBand } from '$lib/server/analytics/training-load';
import type { LoadRisk } from '$lib/server/analytics/load-risk';
import type { ResolvedRange } from '$lib/range';
import type { SportGroup } from '$lib/sport-labels';
import type { Locale } from '$lib/i18n';

export type { DailyLoadPoint, TrainingBand } from '$lib/server/analytics/training-load';
export type { LoadRisk, LoadRiskBand } from '$lib/server/analytics/load-risk';
export type {
  BandShare,
  IntensityBand,
  IntensityMix,
  IntensityWeek,
  MixVerdict
} from '$lib/server/analytics/intensity-mix';
export type { SportGroup } from '$lib/sport-labels';

/**
 * One sport family's own fitness/fatigue/form (spec 039). A multisport athlete's whole-athlete CTL
 * hides the case that matters — run fitness sliding while bike fitness climbs — so each family is
 * scored by the same engine over its own sessions.
 */
export interface SportFitness {
  readonly group: SportGroup;
  readonly label: string;
  /** Lane token from the shared taxonomy, so the family reads the same colour everywhere. */
  readonly color: string;
  readonly ctl: number;
  readonly atl: number;
  readonly tsb: number;
  readonly band: TrainingBand;
  /** Ratio + ramp for this family alone; its numbers are `null` under the history floor. */
  readonly risk: LoadRisk;
}

/** One sport family's share of the recent window. */
export interface SportSlice {
  readonly group: SportGroup;
  /** Polish family name, from the shared taxonomy. */
  readonly label: string;
  readonly activities: number;
  readonly durationS: number;
  readonly distanceM: number;
  readonly elevationGainM: number;
  /** Summed training load (TSS) attributed to this family in the window. */
  readonly load: number;
  /** Link to the family's analysis subpage, or null when it has none (swim, gym, other). */
  readonly href: string | null;
}

/** Weekly training hours for one sport family, index-aligned with `TrainingOverviewData.weeks`. */
export interface WeeklyVolumeSeries {
  readonly group: SportGroup;
  readonly label: string;
  readonly hours: number[];
}

/** Window totals across every sport. */
export interface WindowTotals {
  readonly activities: number;
  readonly durationS: number;
  readonly distanceM: number;
  readonly elevationGainM: number;
}

export interface TrainingOverviewData {
  /* ---- whole-athlete form (PMC, every sport) ---- */
  readonly series: DailyLoadPoint[];
  /** Latest fitness (CTL), fatigue (ATL) and form (TSB). */
  readonly ctl: number;
  readonly atl: number;
  readonly tsb: number;
  readonly band: TrainingBand;
  readonly recommendation: string;
  /**
   * How fast load is being added and whether that rate is safe (spec 039). Derived from `series`, so it
   * can never disagree with the chart it sits under.
   */
  readonly risk: LoadRisk;
  /** Per-family fitness, fittest first. Empty until a family produces load. */
  readonly perSport: SportFitness[];
  /**
   * How the window's training time split across easy / moderate / hard (spec 044) — the 80/20 question.
   * `verdict` is `unknown` without a max heart rate, and the card explains that rather than guessing one.
   */
  readonly intensityMix: import('$lib/server/analytics/intensity-mix').IntensityMix;
  /**
   * Weighted intensity minutes per bucket against the WHO's 150 (spec 045), on the same lattice as
   * `weekly` — weekly, or monthly once the global range is long enough (spec 047). Zeros rather than
   * gaps: a week with no training genuinely scored none.
   */
  readonly intensityWeeks: import('$lib/server/analytics/intensity-mix').IntensityWeek[];
  /** True when at least one activity produced training load. */
  readonly hasData: boolean;
  /**
   * Consecutive weeks with at least one activity, ending with this week (spec 048). All-time, not
   * range-scoped — a streak that reset itself whenever you narrowed the window would mean nothing.
   */
  readonly streakWeeks: number;
  /** FTP used for power-based TSS (settings or derived), null when unknown. */
  readonly ftpWatts: number | null;

  /* ---- multi-sport window (follows the global range, spec 047) ---- */
  /** The global range the window half of this payload was built for. */
  readonly range: ResolvedRange;
  /** How many days the sport split and the volume chart cover. */
  readonly windowDays: number;
  readonly totals: WindowTotals;
  /** One entry per sport family present in the window, busiest (by time) first. */
  readonly sports: SportSlice[];
  /**
   * Bucket-start day keys (`YYYY-MM-DD`) of the charted buckets, oldest first: Mondays, or the 1st of
   * each month once the range is long enough to bucket monthly.
   */
  readonly weeks: string[];
  /** Hours per bucket per family — the stacked "what did I actually do" chart. */
  readonly weekly: WeeklyVolumeSeries[];
}

export interface TrainingOverviewRequest {
  readonly userId: string;
  /** Language this request renders in (spec 076) — the loader labels sport families with it. */
  readonly locale: Locale;
  /** The global range for the window half. Defaults to the app default when absent. */
  readonly range?: ResolvedRange;
}
