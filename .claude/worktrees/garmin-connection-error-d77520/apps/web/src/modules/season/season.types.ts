/**
 * Contracts for the season-goals slice (spec 060) — the boundary shared by the API handler, the
 * view, and the MCP tools.
 */
import type { GoalPhase, GoalStatusBand, TaperCheck } from '$lib/server/analytics/season';
import type { GoalKind, GoalPriority, SeasonGoal } from '$lib/server/store/types';
import type { SportGroup } from '$lib/sport-labels';

export type { GoalPhase, GoalStatusBand, TaperCheck } from '$lib/server/analytics/season';
export type { GoalKind, GoalPriority, SeasonGoal } from '$lib/server/store/types';

/**
 * A predicted finish against the wanted one. Only ever present for a `run` race that names a
 * distance — spec 043's models are distance-and-run-specific, and quoting them for a ride would be
 * inventing a number.
 */
export interface GoalPrediction {
  /** Riegel estimate from the athlete's own bests, seconds. */
  readonly riegelS: number | null;
  /** Critical-speed estimate from the speed–duration curve, seconds. */
  readonly criticalSpeedS: number | null;
  /** Which best Riegel extrapolated from, and when it was set. */
  readonly fromLabel: string | null;
  readonly fromDay: string | null;
  /** True when the extrapolation is small enough to trust (spec 043). */
  readonly confident: boolean;
  /**
   * `target − predicted`, seconds. Positive means the target is slower than the prediction, i.e. the
   * athlete is predicted to beat it. `null` without a target time or without a prediction.
   */
  readonly gapS: number | null;
}

/** One goal with everything computed about it. */
export interface GoalStatus {
  readonly goal: SeasonGoal;
  /** Negative once the day has passed. */
  readonly daysOut: number;
  readonly weeksOut: number;
  readonly phase: GoalPhase;
  /** Polish label for the phase, so the view never spells one two ways. */
  readonly phaseLabel: string;
  /** Polish name of the goal's sport family. */
  readonly sportLabel: string;
  /** Lane token for the family, so a goal reads the same colour as its charts. */
  readonly color: string;
  /** This FAMILY's CTL today (spec 039), not the whole athlete's. */
  readonly ctl: number | null;
  /** Where the current ramp lands by the start of the taper. */
  readonly projectedCtl: number | null;
  /** CTL points per week the athlete is actually adding. */
  readonly rampPerWeek: number | null;
  /** CTL points per week the goal needs. */
  readonly requiredRampPerWeek: number | null;
  /** Only inside the taper window; null everywhere else. */
  readonly taper: TaperCheck | null;
  readonly prediction: GoalPrediction | null;
  readonly status: GoalStatusBand;
  /** One Polish sentence: the verdict in words. */
  readonly note: string;
}

/**
 * A future race Garmin already knows about that no goal has adopted yet (spec 024 syncs these).
 * Offered so an athlete whose calendar is already right does not retype it.
 */
export interface GoalSuggestion {
  readonly eventId: string;
  readonly day: string;
  readonly title: string;
  readonly sport: SportGroup;
  readonly sportLabel: string;
  readonly distanceM: number | null;
}

export interface SeasonData {
  readonly today: string;
  /** Future goals soonest-first, then past goals most-recent-first. */
  readonly goals: GoalStatus[];
  readonly suggestions: GoalSuggestion[];
  /** True when there is enough training history for any trajectory at all. */
  readonly hasData: boolean;
  /** Sport families the athlete actually records — the only ones the form offers. */
  readonly sports: readonly { group: SportGroup; label: string }[];
}

export interface SeasonRequest {
  readonly userId: string;
}

/** Accepted body of `POST /api/season/goals`, before validation. */
export interface NewGoalInput {
  readonly day: string;
  readonly sport: SportGroup;
  readonly title: string;
  readonly kind: GoalKind;
  readonly priority: GoalPriority;
  readonly distanceM: number | null;
  readonly targetTimeS: number | null;
  readonly targetCtl: number | null;
  readonly note: string | null;
  /** Set when adopting a synced planned event; the store refuses a second adoption of the same id. */
  readonly garminEventId: string | null;
}

/** Accepted body of `PATCH /api/season/goals/[id]`. Absent keys are left alone. */
export interface GoalPatchInput {
  readonly day?: string;
  readonly sport?: SportGroup;
  readonly title?: string;
  readonly kind?: GoalKind;
  readonly priority?: GoalPriority;
  readonly distanceM?: number | null;
  readonly targetTimeS?: number | null;
  readonly targetCtl?: number | null;
  readonly note?: string | null;
}

/** A validation or lookup failure, ready to be mapped to a status code by the route. */
export interface HandlerError {
  readonly ok: false;
  readonly status: 400 | 404 | 409;
  readonly error: string;
}

export type HandlerResult<T> = ({ readonly ok: true } & T) | HandlerError;
