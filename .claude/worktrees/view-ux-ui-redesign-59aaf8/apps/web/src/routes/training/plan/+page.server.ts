/**
 * The planner's month (spec 066).
 *
 * The month and the selected day are URL params, so a view is linkable and the browser's back button
 * pages through months the way it should. Both are sanitized here — a hand-typed `?month=lol` must
 * fall back to today's month, never reach `firstDayOf`.
 *
 * The window read is the GRID's bounds, not the month's: the grid draws the leading and trailing days
 * of the neighbouring months, and reading only the month would render those cells empty when they are
 * not.
 */
import type { PageServerLoad } from './$types';
import { loadPlanner } from '$modules/workouts/workouts.api';
import { gridRange } from '$modules/workouts/planner';
import { isDayKey, isMonthKey, monthKeyOf, todayKey, type MonthKey } from '$lib/date';

export const load: PageServerLoad = async ({ locals, url }) => {
  const user = locals.user!;
  const c = locals.container;

  const today = todayKey(c.clock, c.config.appTimeZone);
  const monthParam = url.searchParams.get('month');
  const month: MonthKey = isMonthKey(monthParam) ? monthParam : monthKeyOf(today);

  const dayParam = url.searchParams.get('day');
  // A selected day outside the visible grid would highlight nothing; fall back rather than confuse.
  const { from, to } = gridRange(month);
  const selected = isDayKey(dayParam) && dayParam >= from && dayParam <= to ? dayParam : null;

  const planner = await loadPlanner(
    { store: c.store, clock: c.clock, random: c.random, features: locals.features },
    user.id,
    from,
    to
  );

  return { planner, month, today, selected };
};
