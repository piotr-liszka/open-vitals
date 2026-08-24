/**
 * Week review (spec 078) — what was planned against what actually happened, in one call.
 *
 * `get_current_week` (spec 073) already compares volume for the LIVE week. This answers the question
 * a review actually asks: session by session, for any week, including one already over.
 *
 * Pure over injected deps (store + clock): no live Garmin, no `Date.now()`, no env.
 */
import type { Clock } from '$lib/server/clock';
import type { LocalStore, TrainingBlock } from '$lib/server/store/types';
import { addDays, startOfWeek, todayKey, toDayKey, type DayKey } from '$lib/date';
import { sportGroup } from '$lib/sport-labels';
import { estimateWorkoutDistanceM, estimateWorkoutDurationS, type WorkoutStep } from '$lib/workouts';
import { weekNumberOf, positionOf } from '$lib/blocks';
import {
  matchWeek,
  type CompletedActivity,
  type MatchResult,
  type PlannedSession
} from './week-review.match';

export interface WeekReviewDeps {
  store: LocalStore;
  clock: Clock;
  /** IANA zone "today" resolves in — a UTC today lags the athlete by up to two hours (spec 018). */
  timeZone?: string;
}

/** The block context a week sits in, when there is one. */
export interface ReviewBlock {
  readonly id: string;
  readonly name: string;
  readonly weekNumber: number;
  readonly weeks: number;
  readonly volumeTargetKm: number | null;
  readonly focus: string | null;
}

export interface WeekReviewData {
  readonly today: DayKey;
  readonly weekStart: DayKey;
  readonly weekEnd: DayKey;
  readonly block: ReviewBlock | null;
  readonly planned: {
    /** The block's own target for this week (spec 073). Null when no block or no target set. */
    readonly volumeTargetKm: number | null;
    /** Sum of the planned SESSIONS' own estimates — a different number from the target. */
    readonly sessionsVolumeKm: number;
    readonly sessions: number;
  };
  readonly actual: {
    readonly volumeKm: number;
    readonly sessions: number;
  };
  readonly match: MatchResult;
  /** RPE logged against a completed activity, keyed by activity id (spec 062). */
  readonly rpeByActivity: Readonly<Record<string, number>>;
  /** True when the week held nothing at all — planned or done. */
  readonly empty: boolean;
}

const round1 = (n: number): number => Math.round(n * 10) / 10;

/** The local calendar day an activity was trained on — `startTimeLocal` is wall clock, not UTC. */
const activityDay = (startTimeLocal: string): DayKey => toDayKey(startTimeLocal.slice(0, 10));

/**
 * Resolve the week under review.
 *
 * Any day inside a week resolves to that week, so a coach asking about "Wednesday" gets the week
 * Wednesday is in rather than an error about Mondays.
 */
export function resolveWeekStart(deps: WeekReviewDeps, weekStart?: string): DayKey {
  const day = weekStart ?? todayKey(deps.clock, deps.timeZone);
  return startOfWeek(toDayKey(day));
}

function blockContext(
  block: TrainingBlock,
  weekNumber: number,
  target: { volumeTargetKm: number | null; focus: string | null } | null
): ReviewBlock {
  return {
    id: block.id,
    name: block.name,
    weekNumber,
    weeks: block.weeks,
    volumeTargetKm: target?.volumeTargetKm ?? null,
    focus: target?.focus ?? null
  };
}

export async function loadWeekReview(
  deps: WeekReviewDeps,
  userId: string,
  weekStart?: string
): Promise<WeekReviewData> {
  const start = resolveWeekStart(deps, weekStart);
  const end = addDays(start, 6);

  const [workouts, activities, block] = await Promise.all([
    deps.store.listWorkouts(userId, { from: start, to: end, limit: 100 }),
    deps.store.listActivities(userId, { from: start, to: end, limit: 500 }),
    // The block covering the MIDDLE of the week, not its Monday: a block that starts mid-week still
    // owns that week, and asking about the Monday would report no block for its first week.
    deps.store.findBlockForDay(userId, addDays(start, 3))
  ]);

  const planned: PlannedSession[] = workouts.map((w) => {
    const steps = w.steps as readonly WorkoutStep[];
    return {
      id: w.id,
      day: toDayKey(w.day),
      family: sportGroup(w.sport),
      title: w.title,
      estimatedDistanceM: estimateWorkoutDistanceM(steps),
      estimatedDurationS: estimateWorkoutDurationS(steps)
    };
  });

  const inWeek = activities.filter((a) => {
    const day = activityDay(a.startTimeLocal);
    return day >= start && day <= end;
  });

  const completed: CompletedActivity[] = inWeek.map((a) => ({
    id: a.activityId,
    day: activityDay(a.startTimeLocal),
    family: sportGroup(a.sport),
    name: a.name,
    distanceM: a.distanceM,
    durationS: a.movingS ?? a.durationS
  }));

  const match = matchWeek(planned, completed);

  // The block's week number and its target, when a block covers this week at all.
  let context: ReviewBlock | null = null;
  if (block && positionOf(block, addDays(start, 3)) === 'live') {
    const weekNumber = weekNumberOf(block, addDays(start, 3));
    const weeks = await deps.store.listBlockWeeks(userId, block.id);
    const target = weeks.find((w) => w.weekNumber === weekNumber) ?? null;
    context = blockContext(block, weekNumber, target);
  }

  // RPE for anything done this week (spec 062) — "was it done" and "what did it cost" are one
  // question to a coach, so the answer should not need a second call.
  const entries = await deps.store.listJournalEntries(userId, { from: start, to: end, limit: 200 });
  const rpeByActivity: Record<string, number> = {};
  for (const e of entries) {
    if (e.activityId && e.rpe !== null) rpeByActivity[e.activityId] = e.rpe;
  }

  const sessionsVolumeKm = round1(planned.reduce((sum, p) => sum + (p.estimatedDistanceM ?? 0), 0) / 1000);
  const volumeKm = round1(inWeek.reduce((sum, a) => sum + (a.distanceM ?? 0), 0) / 1000);

  return {
    today: todayKey(deps.clock, deps.timeZone),
    weekStart: start,
    weekEnd: end,
    block: context,
    planned: {
      volumeTargetKm: context?.volumeTargetKm ?? null,
      sessionsVolumeKm,
      sessions: planned.length
    },
    actual: { volumeKm, sessions: completed.length },
    match,
    rpeByActivity,
    empty: planned.length === 0 && completed.length === 0
  };
}
