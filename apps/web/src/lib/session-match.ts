/**
 * Matching planned sessions to the activities that fulfilled them (spec 078, hardened by spec 081).
 * Pure, so every rule below is testable against fixtures without a store.
 *
 * The matching IS the feature, and it is where a naive version misleads. A session written for
 * Tuesday and run on Wednesday is not a missed session plus an unplanned one — reporting it that way
 * makes a good week read as chaos, and a coach who sees that once stops trusting the numbers.
 *
 * ## Why this lives in `lib/` and not in `modules/week-review/`
 *
 * Spec 081 gave the planner (`modules/workouts`) the same question the week review already asked:
 * was this session done? Completion is DERIVED on read by both, from this one function, so the two
 * surfaces can never disagree — and AGENTS.md §5 forbids one module reaching into another's folder,
 * so the shared pure rule moved here. It has no store, no clock and no `$lib/server` import.
 */
import { daysBetween, type DayKey } from '$lib/date';

/** At or above this share of what was planned, the session counts as done rather than shortened. */
export const DONE_RATIO = 0.9;

/** How far a session may have moved and still count as the same session. */
export const MAX_DAY_SHIFT = 1;

/** What the matcher needs to know about a planned session. */
export interface PlannedSession {
  readonly id: string;
  readonly day: DayKey;
  /** Sport FAMILY (`run` | `ride` | …), so a planned `running` is fulfilled by a `treadmill_running`. */
  readonly family: string;
  readonly title: string;
  readonly estimatedDistanceM: number | null;
  readonly estimatedDurationS: number | null;
  /**
   * The id Garmin gave this session when it was pushed to the athlete's calendar (spec 081), or
   * null for a session that never reached Garmin. Equal, non-null ids on both sides are the one
   * HARD link between a plan and what was done; everything else here is inference.
   */
  readonly garminWorkoutId: string | null;
  /**
   * The axis this plan was WRITTEN in (`workoutPrescribedAxis`), which is the one its adherence is
   * judged on. Absent = fall back to "distance when there is one".
   *
   * It became load-bearing when `estimateWorkoutDistanceM` learned to count paced time steps: before
   * that a time-prescribed session simply had no distance and was judged on duration by default. Now
   * it has one, and without this a session run for the full prescribed time but slower than the band
   * comes out `shortened` — which is not what happened.
   */
  readonly prescribedAxis?: 'distance' | 'time' | null;
}

/** What the matcher needs to know about something actually done. */
export interface CompletedActivity {
  readonly id: string;
  readonly day: DayKey;
  readonly family: string;
  readonly name: string | null;
  readonly distanceM: number | null;
  readonly durationS: number | null;
  /**
   * Garmin's `workoutId` on the activity — the scheduled workout it was STARTED FROM. Null unless
   * the athlete picked the session off the watch's scheduled list, which is why an id match is an
   * addition to the heuristic below and never a replacement for it.
   */
  readonly garminWorkoutId: string | null;
}

export type Adherence = 'done' | 'shortened';

/**
 * How a pairing was arrived at (spec 081). `workout-id` means the watch itself said this activity
 * was that session; `heuristic` means we inferred it from sport, day and size. A surface that shows
 * the two identically would launder a guess into a fact, so the distinction rides on every match.
 */
export type MatchedBy = 'workout-id' | 'heuristic';

export interface Match {
  readonly planned: PlannedSession;
  readonly completed: CompletedActivity;
  readonly adherence: Adherence;
  readonly matchedBy: MatchedBy;
  /**
   * Actual over planned on the axis the plan used. `null` when the plan had no distance and no
   * duration — a lap-button session, where there is nothing to be a share OF.
   */
  readonly adherenceRatio: number | null;
  /** Days between the planned day and the day it was actually done; 0 when on time. */
  readonly dayShift: number;
}

export interface MatchResult {
  readonly matched: readonly Match[];
  readonly missed: readonly PlannedSession[];
  readonly unplanned: readonly CompletedActivity[];
}

/**
 * The axis a plan is judged on: distance when it has one, else duration. A plan with neither is not
 * judged at all, which is a different answer from judging it as zero.
 */
function ratioOf(planned: PlannedSession, completed: CompletedActivity): number | null {
  if (usesDistance(planned)) {
    return (completed.distanceM ?? 0) / planned.estimatedDistanceM!;
  }
  if (planned.estimatedDurationS && planned.estimatedDurationS > 0) {
    return (completed.durationS ?? 0) / planned.estimatedDurationS;
  }
  // A plan written in distance whose duration is unknown still has its distance to be judged on.
  if (planned.estimatedDistanceM && planned.estimatedDistanceM > 0) {
    return (completed.distanceM ?? 0) / planned.estimatedDistanceM;
  }
  return null;
}

/**
 * Whether to judge this plan on distance. The prescribed axis decides when the plan states one;
 * otherwise it is the old rule — distance when there is a distance.
 */
function usesDistance(planned: PlannedSession): boolean {
  const hasDistance = Boolean(planned.estimatedDistanceM && planned.estimatedDistanceM > 0);
  if (!hasDistance) return false;
  if (planned.prescribedAxis === 'time') return false;
  return true;
}

/** How far this activity is from what the plan asked for, on the plan's own axis. Lower is closer. */
function distanceOnAxis(planned: PlannedSession, completed: CompletedActivity): number {
  if (usesDistance(planned)) {
    return Math.abs((completed.distanceM ?? 0) - planned.estimatedDistanceM!);
  }
  if (planned.estimatedDurationS && planned.estimatedDurationS > 0) {
    return Math.abs((completed.durationS ?? 0) - planned.estimatedDurationS);
  }
  if (planned.estimatedDistanceM && planned.estimatedDistanceM > 0) {
    return Math.abs((completed.distanceM ?? 0) - planned.estimatedDistanceM);
  }
  return 0;
}

function makeMatch(planned: PlannedSession, completed: CompletedActivity, matchedBy: MatchedBy): Match {
  const ratio = ratioOf(planned, completed);
  return {
    planned,
    completed,
    matchedBy,
    // A plan with no axis reports `done` rather than inventing a judgement it has no basis for.
    adherence: ratio === null || ratio >= DONE_RATIO ? 'done' : 'shortened',
    adherenceRatio: ratio === null ? null : Math.round(ratio * 100) / 100,
    dayShift: daysBetween(planned.day, completed.day)
  };
}

/**
 * Best unused candidate for one planned session within `maxShift` days, or null.
 *
 * Ties break towards the SMALLER day shift first and only then towards the closer size: a session
 * done on its own day is a better match than a closer-sized one done the day after.
 */
function bestCandidate(
  planned: PlannedSession,
  activities: readonly CompletedActivity[],
  used: ReadonlySet<string>,
  maxShift: number
): CompletedActivity | null {
  let best: CompletedActivity | null = null;
  let bestKey: [number, number] = [Infinity, Infinity];

  for (const activity of activities) {
    if (used.has(activity.id)) continue;
    if (activity.family !== planned.family) continue;
    const shift = Math.abs(daysBetween(planned.day, activity.day));
    if (shift > maxShift) continue;

    const key: [number, number] = [shift, distanceOnAxis(planned, activity)];
    if (key[0] < bestKey[0] || (key[0] === bestKey[0] && key[1] < bestKey[1])) {
      best = activity;
      bestKey = key;
    }
  }
  return best;
}

/**
 * The activity the WATCH says fulfilled this session (spec 081): equal, non-null `garminWorkoutId`.
 *
 * Deliberately unconstrained by `MAX_DAY_SHIFT` and by sport family. If the athlete started this
 * exact scheduled workout three days late, it is still that session and the real `dayShift` is
 * reported; second-guessing a hard identifier with a heuristic's tolerances is how a fact gets
 * downgraded to a guess.
 *
 * Where the same id appears twice — the scheduled session was started, abandoned and run again —
 * the one nearest the planned day wins, ties break towards the closer size and then on the activity
 * id so the result never depends on input order. The loser is simply left unused: it is a candidate
 * for the passes below like any other activity, and lands in `unplanned[]` if nothing claims it.
 */
function idCandidate(
  planned: PlannedSession,
  activities: readonly CompletedActivity[],
  used: ReadonlySet<string>
): CompletedActivity | null {
  const wanted = planned.garminWorkoutId;
  if (wanted === null) return null;

  let best: CompletedActivity | null = null;
  let bestKey: [number, number, string] = [Infinity, Infinity, ''];

  for (const activity of activities) {
    if (used.has(activity.id)) continue;
    if (activity.garminWorkoutId === null || activity.garminWorkoutId !== wanted) continue;

    const key: [number, number, string] = [
      Math.abs(daysBetween(planned.day, activity.day)),
      distanceOnAxis(planned, activity),
      activity.id
    ];
    if (
      key[0] < bestKey[0] ||
      (key[0] === bestKey[0] && key[1] < bestKey[1]) ||
      (key[0] === bestKey[0] && key[1] === bestKey[1] && key[2] < bestKey[2])
    ) {
      best = activity;
      bestKey = key;
    }
  }
  return best;
}

/**
 * Match a week's planned sessions to what was actually done.
 *
 * Three passes, and the order is load-bearing:
 *  - **0.** what the watch itself linked (spec 081) — known, not inferred, and claimed first so a
 *    same-day lookalike can never steal an activity away from the session it demonstrably was;
 *  - **1.** same day, same sport family;
 *  - **2.** whatever is left, allowing the session to have moved by a day.
 *
 * EVERY same-day match is made before any shifted one is considered. Matching greedily in one pass
 * would let Monday's session claim Tuesday's activity while Tuesday's own session — the one that
 * activity actually was — goes to `missed`.
 *
 * With no ids on either side (nothing pushed to Garmin, or Garmin not stamping them) pass 0 claims
 * nothing and the result is bit-for-bit what spec 078 produced.
 */
export function matchWeek(
  planned: readonly PlannedSession[],
  activities: readonly CompletedActivity[]
): MatchResult {
  const used = new Set<string>();
  const matched: Match[] = [];

  // Pass 0: the hard link. Everything it does not claim falls through to the heuristic below.
  const pending: PlannedSession[] = [];
  for (const session of planned) {
    const found = idCandidate(session, activities, used);
    if (found) {
      used.add(found.id);
      matched.push(makeMatch(session, found, 'workout-id'));
    } else {
      pending.push(session);
    }
  }

  // Pass 1: same day only.
  const shifted: PlannedSession[] = [];
  for (const session of pending) {
    const found = bestCandidate(session, activities, used, 0);
    if (found) {
      used.add(found.id);
      matched.push(makeMatch(session, found, 'heuristic'));
    } else {
      shifted.push(session);
    }
  }

  // Pass 2: whatever is left, allowing the session to have moved by a day.
  const missed: PlannedSession[] = [];
  for (const session of shifted) {
    const found = bestCandidate(session, activities, used, MAX_DAY_SHIFT);
    if (found) {
      used.add(found.id);
      matched.push(makeMatch(session, found, 'heuristic'));
    } else {
      missed.push(session);
    }
  }

  matched.sort((a, b) => a.planned.day.localeCompare(b.planned.day));

  return {
    matched,
    missed,
    unplanned: activities.filter((a) => !used.has(a.id))
  };
}
