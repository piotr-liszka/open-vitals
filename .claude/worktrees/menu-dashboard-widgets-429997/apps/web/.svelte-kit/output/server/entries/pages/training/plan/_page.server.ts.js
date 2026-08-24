import { f as loadPlanner } from "../../../../chunks/workouts.api.js";
import { g as gridRange } from "../../../../chunks/planner.js";
import { a as todayKey, u as isMonthKey, k as monthKeyOf, i as isDayKey } from "../../../../chunks/date.js";
const load = async ({ locals, url }) => {
  const user = locals.user;
  const c = locals.container;
  const today = todayKey(c.clock, c.config.appTimeZone);
  const monthParam = url.searchParams.get("month");
  const month = isMonthKey(monthParam) ? monthParam : monthKeyOf(today);
  const dayParam = url.searchParams.get("day");
  const { from, to } = gridRange(month);
  const selected = isDayKey(dayParam) && dayParam >= from && dayParam <= to ? dayParam : null;
  const planner = await loadPlanner(
    { store: c.store, clock: c.clock, random: c.random, consent: locals.consent },
    user.id,
    from,
    to
  );
  return { planner, month, today, selected };
};
export {
  load
};
