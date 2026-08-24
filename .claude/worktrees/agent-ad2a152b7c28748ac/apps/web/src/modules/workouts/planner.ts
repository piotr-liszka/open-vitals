/**
 * Calendar arithmetic for the planner (spec 066). PURE — month in, grid out. No store, no clock, no
 * `Date.now()`.
 *
 * It lives on its own because calendar code is where off-by-one bugs live and they are invisible on
 * the eleven months that happen to look right. Everything here goes through `$lib/date`, so a "day" is
 * always a local calendar key and never a UTC instant (spec 018).
 */
import { addDays, firstDayOf, monthKeyOf, startOfWeek, type DayKey, type MonthKey } from '$lib/date';

/** Weeks in a rendered month grid. Six always, so the grid never changes height between months. */
export const GRID_WEEKS = 6;
const DAYS_PER_WEEK = 7;

/** One cell of the month grid. */
export interface PlannerCell {
  readonly day: DayKey;
  /** False for the leading/trailing days borrowed from the neighbouring months. */
  readonly inMonth: boolean;
}

/**
 * The 6×7 grid a month is drawn on, Monday-first (Polish convention, and what `dayOfWeek` returns).
 *
 * Always six weeks, even when five would fit: a grid that changes height as you page through months
 * makes the whole panel jump, and the next month's first days are useful context anyway.
 */
export function monthGrid(month: MonthKey): PlannerCell[] {
  const first = firstDayOf(month);
  // `startOfWeek` — the canonical helper — rather than arithmetic on `dayOfWeek`, which is 0-based
  // (0 = Monday) and reads like it is 1-based. Doing that subtraction by hand here got it wrong by a
  // day, on exactly the months where the 1st is not a Monday.
  const start = startOfWeek(first);
  const cells: PlannerCell[] = [];
  for (let i = 0; i < GRID_WEEKS * DAYS_PER_WEEK; i++) {
    const day = addDays(start, i);
    cells.push({ day, inMonth: monthKeyOf(day) === month });
  }
  return cells;
}

/** The grid split into weeks, for rendering one `<tr>` per week. */
export function monthWeeks(month: MonthKey): PlannerCell[][] {
  const cells = monthGrid(month);
  const weeks: PlannerCell[][] = [];
  for (let i = 0; i < cells.length; i += DAYS_PER_WEEK) {
    weeks.push(cells.slice(i, i + DAYS_PER_WEEK));
  }
  return weeks;
}

/**
 * The inclusive day bounds the grid actually SHOWS — not the month's own bounds.
 *
 * This is what the loader queries. Reading only `startOfMonth`…`endOfMonth` would leave the leading
 * and trailing cells unmarked, so a session on the 31st of the previous month would render as an empty
 * day the athlete can see. A calendar that is blank where it should not be is worse than no calendar.
 */
export function gridRange(month: MonthKey): { from: DayKey; to: DayKey } {
  const cells = monthGrid(month);
  return { from: cells[0]!.day, to: cells[cells.length - 1]!.day };
}

/**
 * Group anything day-stamped by its day. Generic because the planner draws two unrelated sources —
 * what the athlete authored here and what Garmin already had — and grouping them twice with two
 * near-identical functions is how the two drift apart.
 */
export function groupByDay<T>(items: readonly T[], dayOf: (item: T) => string): Map<DayKey, T[]> {
  const out = new Map<DayKey, T[]>();
  for (const item of items) {
    const day = dayOf(item);
    const bucket = out.get(day);
    if (bucket) bucket.push(item);
    else out.set(day, [item]);
  }
  return out;
}

/**
 * Order sessions within a day: timed ones first in clock order, untimed ("sometime today") after.
 * An untimed session is not an early one, and sorting it to 00:00 would claim it was.
 */
export function byTimeThenTitle<T extends { time: string | null; title: string }>(a: T, b: T): number {
  if (a.time !== null && b.time !== null)
    return a.time.localeCompare(b.time) || a.title.localeCompare(b.title);
  if (a.time !== null) return -1;
  if (b.time !== null) return 1;
  return a.title.localeCompare(b.title);
}
