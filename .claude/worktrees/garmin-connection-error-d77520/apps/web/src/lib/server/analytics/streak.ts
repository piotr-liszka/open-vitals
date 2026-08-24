/**
 * Consecutive-week training streak.
 *
 * Lived in `modules/dashboards/dashboard-data.ts` as the `streak` widget's maths. Spec 048 demoted the
 * Panel — every other widget duplicates a page that shows the same thing better, and the streak was
 * the one exception with no other home — so the number now also renders on the Trening overview, and
 * the calculation moved to `lib/` rather than have `modules/training` reach into another module's
 * folder (AGENTS.md §5).
 *
 * Pure: day maths via `$lib/date` integer civil-date arithmetic (spec 018), no `Date` parsing, no I/O.
 */
import { isDayKey, addDays, startOfWeek, toDayKey, type DayKey } from '$lib/date';
import type { ActivitySummary } from '$lib/server/store/types';

/** Ten years of weeks — a guard against a malformed series looping forever, not a real limit. */
const MAX_STREAK_WEEKS = 520;

/**
 * The activity's own local calendar day (Garmin already reports `startTimeLocal` as wall clock).
 * Returns null for a malformed timestamp so one bad row cannot blank the whole number.
 */
function localDay(a: ActivitySummary): DayKey | null {
  return isDayKey(a.startTimeLocal.slice(0, 10)) ? toDayKey(a.startTimeLocal) : null;
}

/** Consecutive weeks (ending with this week) that have at least one activity. */
export function activeWeekStreak(activities: readonly ActivitySummary[], today: DayKey): number {
  const weeksWith = new Set(
    activities
      .map(localDay)
      .filter((d): d is DayKey => d !== null)
      .map((d) => startOfWeek(d))
  );
  let streak = 0;
  let cursor = startOfWeek(today);
  // The current week is allowed to be empty without breaking the streak — it is still in progress,
  // and a Monday-morning reader has not lost anything yet.
  let first = true;
  while (true) {
    if (weeksWith.has(cursor)) {
      streak++;
    } else if (!first) {
      break;
    }
    first = false;
    cursor = addDays(cursor, -7);
    if (streak > MAX_STREAK_WEEKS) break;
  }
  return streak;
}
