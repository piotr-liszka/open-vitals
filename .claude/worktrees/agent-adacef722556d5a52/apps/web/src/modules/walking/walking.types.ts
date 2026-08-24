/**
 * Contracts for the Walking (Marsz) page (spec 025). Walking and hiking were excluded from every
 * analysis view in the app — this slice gives them a home: volume, elevation, pace and the daily
 * step count that walkers actually judge themselves by.
 */
import type { ResolvedRange } from '$lib/range';
import type { Locale } from '$lib/i18n';

export interface WalkingTotals {
  readonly sessions: number;
  readonly totalKm: number;
  readonly longestKm: number;
  readonly totalTimeS: number;
  readonly totalElevationM: number;
  /** Seconds per km across the whole window, null when distance/time are missing. */
  readonly avgPaceSecPerKm: number | null;
}

/** One charted bucket (Monday, or the 1st of the month in long ranges), oldest first. */
export interface WalkingWeek {
  readonly week: string;
  readonly km: number;
  readonly sessions: number;
  readonly hours: number;
  readonly elevationM: number;
}

/** Longest walks in the window, newest-best first. */
export interface WalkingHighlight {
  readonly activityId: string;
  readonly day: string;
  readonly name: string | null;
  readonly sportLabel: string;
  readonly km: number;
  readonly durationS: number;
  readonly elevationM: number;
}

/** Daily step counts over the window (from the synced `steps` metric, not from activities). */
export interface StepDay {
  readonly day: string;
  /** Null when that day has no synced step payload. */
  readonly steps: number | null;
}

export interface WalkingData {
  /** The global range this page covers (spec 047) — drives the cards' range indicators. */
  readonly range: ResolvedRange;
  readonly totals: WalkingTotals;
  readonly weekly: WalkingWeek[];
  readonly highlights: WalkingHighlight[];
  readonly steps: StepDay[];
  /** Average steps per day across the days that have data, null when none do. */
  readonly avgSteps: number | null;
  /** True when the user has at least one walk/hike in the window. */
  readonly hasData: boolean;
  /** True when at least one day carries a step count. */
  readonly hasSteps: boolean;
}

export interface WalkingRequest {
  readonly userId: string;
  /** Language this request renders in (spec 076) — the loader labels sports with it. */
  readonly locale: Locale;
  /** The global range to cover. Defaults to the app default when absent. */
  readonly range?: ResolvedRange;
}
