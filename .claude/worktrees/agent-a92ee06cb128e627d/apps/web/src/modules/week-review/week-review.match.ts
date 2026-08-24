/**
 * Matching planned sessions to the activities that fulfilled them (spec 078). Pure, so every rule
 * below is testable against fixtures without a store.
 *
 * The matching IS the feature, and it is where a naive version misleads. A session written for
 * Tuesday and run on Wednesday is not a missed session plus an unplanned one — reporting it that way
 * makes a good week read as chaos, and a coach who sees that once stops trusting the numbers.
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
}

/** What the matcher needs to know about something actually done. */
export interface CompletedActivity {
  readonly id: string;
  readonly day: DayKey;
  readonly family: string;
  readonly name: string | null;
  readonly distanceM: number | null;
  readonly durationS: number | null;
}

export type Adherence = 'done' | 'shortened';

export interface Match {
  readonly planned: PlannedSession;
  readonly completed: CompletedActivity;
  readonly adherence: Adherence;
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
  if (planned.estimatedDistanceM && planned.estimatedDistanceM > 0) {
    return (completed.distanceM ?? 0) / planned.estimatedDistanceM;
  }
  if (planned.estimatedDurationS && planned.estimatedDurationS > 0) {
    return (completed.durationS ?? 0) / planned.estimatedDurationS;
  }
  return null;
}

/** How far this activity is from what the plan asked for, on the plan's own axis. Lower is closer. */
function distanceOnAxis(planned: PlannedSession, completed: CompletedActivity): number {
  if (planned.estimatedDistanceM && planned.estimatedDistanceM > 0) {
    return Math.abs((completed.distanceM ?? 0) - planned.estimatedDistanceM);
  }
  if (planned.estimatedDurationS && planned.estimatedDurationS > 0) {
    return Math.abs((completed.durationS ?? 0) - planned.estimatedDurationS);
  }
  return 0;
}

function makeMatch(planned: PlannedSession, completed: CompletedActivity): Match {
  const ratio = ratioOf(planned, completed);
  return {
    planned,
    completed,
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
 * Match a week's planned sessions to what was actually done.
 *
 * Two passes, and the order is load-bearing: EVERY same-day match is made before any shifted one is
 * considered. Matching greedily in one pass would let Monday's session claim Tuesday's activity
 * while Tuesday's own session — the one that activity actually was — goes to `missed`.
 */
export function matchWeek(
  planned: readonly PlannedSession[],
  activities: readonly CompletedActivity[]
): MatchResult {
  const used = new Set<string>();
  const matched: Match[] = [];
  const pending: PlannedSession[] = [];

  // Pass 1: same day only.
  for (const session of planned) {
    const found = bestCandidate(session, activities, used, 0);
    if (found) {
      used.add(found.id);
      matched.push(makeMatch(session, found));
    } else {
      pending.push(session);
    }
  }

  // Pass 2: whatever is left, allowing the session to have moved by a day.
  const missed: PlannedSession[] = [];
  for (const session of pending) {
    const found = bestCandidate(session, activities, used, MAX_DAY_SHIFT);
    if (found) {
      used.add(found.id);
      matched.push(makeMatch(session, found));
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
