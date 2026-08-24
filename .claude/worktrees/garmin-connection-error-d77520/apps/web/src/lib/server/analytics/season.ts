/**
 * Season goals (spec 060) — the one prospective view in an app that is otherwise entirely
 * retrospective.
 *
 * Everything else here answers "what happened": the PMC (spec 039) says how fast load is being
 * added, the predictor (spec 043) says what could be run today. None of it knows what any of it is
 * FOR. Give it a target — a day, a sport, optionally a distance and a time — and the same machinery
 * answers "am I on track", which is the number athletes actually check.
 *
 * Pure by construction: no store, no clock, no `Date`, no Garmin. Every function takes the day it
 * should reason from. That is what makes the phase boundaries testable either side of the day they
 * turn over, which is the only place this logic can go wrong quietly.
 */
import { daysBetween, type DayKey } from '$lib/date';
import { MIN_HISTORY_DAYS, RAMP_HIGH, type LoadRisk } from './load-risk';
import type { DailyLoadPoint } from './training-load';

/**
 * Where today sits relative to the goal.
 *
 * The boundaries are the ones coaches actually use, and they are named constants rather than inline
 * numbers because every one of them is a judgement call somebody will want to argue with.
 */
export type GoalPhase = 'done' | 'race-week' | 'taper' | 'peak' | 'build' | 'base' | 'far';

/** Race week: the last seven days, when nothing you do can add fitness any more. */
export const RACE_WEEK_DAYS = 7;
/** Taper: load comes down so the work already done can surface. */
export const TAPER_DAYS = 14;
/** Peak: the last hard block — specificity, not volume. */
export const PEAK_DAYS = 28;
/** Build: where the target CTL is actually earned. */
export const BUILD_DAYS = 84;
/** Base: aerobic groundwork; beyond this the goal is too far out to plan against. */
export const BASE_DAYS = 168;

/**
 * How the goal is going.
 *
 * `at-risk` is NOT "worse than behind" on a single axis — it is a different finding. Behind means
 * the trajectory falls short; at-risk means the trajectory is being bought at a ramp rate spec 039
 * classifies as overreaching. They routinely co-occur, and the ordering between them is the whole
 * safety property of this module — see `goalStatus`.
 */
export type GoalStatusBand = 'on-track' | 'ahead' | 'behind' | 'at-risk' | 'unknown';

/** Load actually falling during the taper — the one thing the taper is for. */
export interface TaperCheck {
  /** Mean daily TSS over the last 7 days. */
  readonly recentDailyLoad: number;
  /** Mean daily TSS over the 28 days before those 7. */
  readonly baselineDailyLoad: number;
  /** Recent ÷ baseline. Below 1 means load is coming down. */
  readonly ratio: number;
  /** True when load is falling enough for the taper to be real. */
  readonly tapering: boolean;
}

/**
 * Load must fall to at most this share of the pre-taper baseline. A taper that only trims 5% is a
 * normal week wearing a taper's name.
 */
export const TAPER_MAX_RATIO = 0.8;

/** Days either side of a projection that count as hitting the target rather than missing it. */
export const CTL_TOLERANCE = 3;

const round1 = (n: number): number => Math.round(n * 10) / 10;

/**
 * Which phase a goal `daysOut` days away sits in. Negative days are `done` — the goal is behind the
 * athlete and nothing about a trajectory to it is meaningful any more.
 */
export function goalPhase(daysOut: number): GoalPhase {
  if (daysOut < 0) return 'done';
  if (daysOut < RACE_WEEK_DAYS) return 'race-week';
  if (daysOut < TAPER_DAYS) return 'taper';
  if (daysOut < PEAK_DAYS) return 'peak';
  if (daysOut < BUILD_DAYS) return 'build';
  if (daysOut < BASE_DAYS) return 'base';
  return 'far';
}

/** True while the athlete is inside the window where load is supposed to be coming down. */
export function inTaperWindow(daysOut: number): boolean {
  return daysOut >= 0 && daysOut < TAPER_DAYS;
}

/**
 * CTL gain per week the goal implies, measured to the START of the taper rather than to race day.
 *
 * That distinction is the point. A plan that arrives at its target CTL on race morning has spent the
 * taper still building, which is the opposite of being ready — the fitness has been earned but never
 * allowed to surface. So the build has `daysOut - TAPER_DAYS` to do its work, and a goal already
 * inside the taper has no build left and returns `null` rather than a rate.
 *
 * `null` also when there is no target to aim at, or the athlete is already there.
 */
export function requiredRamp(
  currentCtl: number | null,
  targetCtl: number | null,
  daysOut: number
): number | null {
  if (currentCtl === null || targetCtl === null) return null;
  if (!Number.isFinite(currentCtl) || !Number.isFinite(targetCtl)) return null;
  const buildDays = daysOut - TAPER_DAYS;
  if (buildDays <= 0) return null;
  const gap = targetCtl - currentCtl;
  if (gap <= 0) return 0;
  return round1((gap / buildDays) * 7);
}

/**
 * Where the CURRENT ramp actually lands by the start of the taper.
 *
 * The verdict and the number on screen are both read off this, so the two can never disagree — the
 * failure mode where a card says "on track" above a projection that misses is impossible by
 * construction.
 */
export function projectCtl(
  currentCtl: number | null,
  rampPerWeek: number | null,
  daysOut: number
): number | null {
  if (currentCtl === null || !Number.isFinite(currentCtl)) return null;
  const buildDays = Math.max(0, daysOut - TAPER_DAYS);
  const ramp = rampPerWeek ?? 0;
  if (!Number.isFinite(ramp)) return null;
  // CTL cannot go negative, and a detraining ramp extrapolated over sixteen weeks otherwise would.
  return round1(Math.max(0, currentCtl + (ramp * buildDays) / 7));
}

/**
 * Is load actually coming down? Compares the last 7 days against the 28 before them, both as mean
 * daily TSS so the two windows are directly comparable despite their different lengths.
 *
 * `null` outside the taper window (the question does not apply), and `null` without enough series to
 * form the baseline — an athlete who synced last week gets no verdict rather than a false one.
 */
export function taperCheck(
  series: readonly DailyLoadPoint[],
  daysOut: number,
  today: DayKey
): TaperCheck | null {
  if (!inTaperWindow(daysOut)) return null;

  const upTo = series.filter((p) => p.day <= today);
  if (upTo.length < 35) return null;

  const recent = upTo.slice(-7);
  const baseline = upTo.slice(-35, -7);
  if (recent.length < 7 || baseline.length < 28) return null;

  const mean = (points: readonly DailyLoadPoint[]): number =>
    points.reduce((sum, p) => sum + p.tss, 0) / points.length;

  const recentDailyLoad = round1(mean(recent));
  const baselineDailyLoad = round1(mean(baseline));

  // A baseline of zero means there was nothing to taper FROM; calling that a successful taper would
  // congratulate an athlete for resting after a month off.
  if (baselineDailyLoad <= 0) return null;

  const ratio = round1(recentDailyLoad / baselineDailyLoad);
  return {
    recentDailyLoad,
    baselineDailyLoad,
    ratio,
    tapering: ratio <= TAPER_MAX_RATIO
  };
}

export interface GoalStatusInput {
  readonly daysOut: number;
  readonly currentCtl: number | null;
  readonly targetCtl: number | null;
  readonly projectedCtl: number | null;
  /** This sport family's own risk numbers (spec 039), not the whole athlete's. */
  readonly risk: LoadRisk | null;
}

/**
 * The verdict.
 *
 * The ordering rule that matters: **`at-risk` outranks `behind`**. The obvious implementation picks
 * whichever gap is larger, and it produces exactly the advice that hurts the athlete — an athlete
 * told only "behind" responds by training harder, and an athlete who is behind *because* they are
 * already ramping past `RAMP_HIGH` is the one for whom that response ends the season. So a ramp spec
 * 039 calls overreaching wins the verdict whatever the projection says, and the projection gap is
 * reported alongside rather than instead.
 */
export function goalStatus(input: GoalStatusInput): GoalStatusBand {
  const { daysOut, currentCtl, targetCtl, projectedCtl, risk } = input;

  if (daysOut < 0) return 'unknown';
  // Too little continuous history for CTL to mean anything — spec 039 already encodes that floor,
  // and a verdict built under it is a scary number from three sessions.
  if (currentCtl === null || risk === null || risk.historyDays < MIN_HISTORY_DAYS) return 'unknown';

  // Ramping past the safe rate is a finding on its own — it does not need a target to be true, and
  // it is checked BEFORE the projection for the reason in the doc comment above.
  const ramp = risk.rampRatePerWeek;
  if (ramp !== null && ramp > RAMP_HIGH) return 'at-risk';

  // No target set: countdown and phase are still useful, but there is no trajectory to judge.
  if (targetCtl === null || projectedCtl === null) return 'unknown';

  if (projectedCtl >= targetCtl + CTL_TOLERANCE) return 'ahead';
  if (projectedCtl >= targetCtl - CTL_TOLERANCE) return 'on-track';
  return 'behind';
}

/** Days from `today` to the goal. Negative once the day has passed. */
export function daysOutTo(today: DayKey, day: DayKey): number {
  return daysBetween(today, day);
}
