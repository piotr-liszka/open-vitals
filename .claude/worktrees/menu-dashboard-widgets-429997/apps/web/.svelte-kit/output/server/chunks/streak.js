import { s as startOfWeek, c as addDays, i as isDayKey, t as toDayKey } from "./date.js";
const MAX_STREAK_WEEKS = 520;
function localDay(a) {
  return isDayKey(a.startTimeLocal.slice(0, 10)) ? toDayKey(a.startTimeLocal) : null;
}
function activeWeekStreak(activities, today) {
  const weeksWith = new Set(
    activities.map(localDay).filter((d) => d !== null).map((d) => startOfWeek(d))
  );
  let streak = 0;
  let cursor = startOfWeek(today);
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
export {
  activeWeekStreak as a
};
