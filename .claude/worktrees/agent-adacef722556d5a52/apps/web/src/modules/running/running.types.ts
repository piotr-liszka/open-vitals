/** Contracts for the Running (Bieg) page (spec 018). Pace-based counterpart to the Power page. */
import type { RunningTotals, WeekMileage } from '$lib/server/analytics/running-profile';
import type { ZoneBucket } from '$lib/server/analytics/activity-power';
import type { RunnerProfile } from '$lib/server/analytics/runner-profile';
import type { ResolvedRange } from '$lib/range';

export type { RunningTotals, WeekMileage };
export type { ZoneBucket };
export type {
  ArchetypeKey,
  RunnerArchetype,
  RunnerAxis,
  RunnerAxisKey,
  RunnerProfile,
  RunnerWindow
} from '$lib/server/analytics/runner-profile';

export type { EfficiencyMonth } from '$lib/analytics/efficiency';
export type { CriticalSpeed, SpeedDurationPoint } from '$lib/analytics/pace-model';
export type { PredictionBasis, RacePrediction, RaceTrend } from '$lib/analytics/race-predictor';
export type { PredictionHistory, PredictionHistoryDistance } from './race-history';

export interface RunningData {
  /** The global range the windowed parts cover (spec 047). `profile` ignores it. */
  range: ResolvedRange;
  totals: RunningTotals;
  /**
   * Mileage per bucket across the range (weekly, or monthly in long ranges).
   *
   * (`bests` used to live here: even-pace projections rendered as "Rekordy życiowe". Spec 054
   * replaced that card with the stored all-time best efforts, so the projections no longer reach the
   * page — they survive only INSIDE the handler, feeding the race predictor and the runner archetype.)
   */
  weekly: WeekMileage[];
  /**
   * Mean aerobic efficiency and cardiac cost per calendar month (spec 038), oldest first. A rising EF
   * or a falling cost at similar intensity is aerobic fitness improving; a month with no runs is
   * `null` rather than `0`. Derived from summaries only — no stream reads.
   */
  efficiency: import('$lib/analytics/efficiency').EfficiencyMonth[];
  /**
   * Best sustained speed at each duration across recent runs (spec 042) — the running twin of the power
   * curve. Empty when no speed streams are stored.
   */
  speedCurve: import('$lib/analytics/pace-model').SpeedDurationPoint[];
  /**
   * The sustainable-pace asymptote of that curve plus the anaerobic capacity above it; `null` when the
   * curve has no two points far enough apart to estimate it from.
   */
  criticalSpeed: import('$lib/analytics/pace-model').CriticalSpeed | null;
  /**
   * Predicted race times (spec 043) from two independent methods — Riegel over the athlete's own bests and
   * the critical-speed model. A distance neither method can speak to is absent, never guessed.
   *
   * Since spec 057 each row also carries `fromBasis` (measured effort vs even-pace projection) and an
   * optional `trend`: the same prediction recomputed from what existed 90 days ago, so the card can say
   * how much faster the athlete has got. `trend` is ABSENT — never zero — when there is nothing to
   * compare against.
   */
  predictions: import('$lib/analytics/race-predictor').RacePrediction[];
  /**
   * The same prediction recomputed for EVERY day of the range (spec 087) — the shape between the two
   * endpoints the `trend` badge compares. One value per day per race distance; `null` on a day with
   * no basis, so the chart draws a gap instead of a line through nothing.
   *
   * `null` — the whole section is absent — when the athlete has no measured effort at all. Built
   * from the record progression and the even-pace projections only: no critical speed, for the same
   * reason the as-of half of `trend` has none.
   */
  predictionHistory: import('./race-history').PredictionHistory | null;
  /** Aggregate HR time-in-zone across runs (empty when no HR streams / no max HR). */
  hrZones: ZoneBucket[];
  /** Max HR used for the zone split (setting or derived). */
  maxHr: number | null;
  /** "Jakim biegaczem jesteś" — five normalised axes + the archetype they add up to (spec 033). */
  profile: RunnerProfile;
  /** True when the user has any run at all, whatever the range. */
  hasData: boolean;
  /** True when the SELECTED range contains at least one run — lets the view blame the right thing. */
  hasWindowData: boolean;
}

export interface RunningRequest {
  userId: string;
  /** The global range for the windowed parts. Defaults to the app default when absent. */
  range?: ResolvedRange;
}
