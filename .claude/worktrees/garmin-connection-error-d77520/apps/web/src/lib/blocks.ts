/**
 * Week arithmetic for a training block (spec 073). Pure, so it can be tested against fixed days.
 *
 * Everything here counts in LOCAL CALENDAR DAYS via `$lib/date`, never in 7×86400 seconds. The week
 * a block changes clocks in still has seven days in it, and a plan that quietly slipped a day every
 * spring would be worse than no plan at all.
 *
 * It lives in `lib/` rather than in the module because BOTH sides need it: the module resolves weeks
 * with it, and both store adapters check overlap with it. One span rule, one implementation.
 */
import { addDays, compareDays, daysBetween, startOfWeek, type DayKey } from './date';

/** The span fields every function here needs — structural, so a stored block or a draft both fit. */
export interface BlockSpan {
  readonly startDay: DayKey;
  readonly weeks: number;
}

/** Where a day sits relative to a block's span. */
export type BlockPosition = 'before' | 'live' | 'done';

/** Longest block we accept. A year of one plan is already generous; beyond it, it is a typo. */
export const MAX_BLOCK_WEEKS = 52;

/** Inclusive last day of a block. */
export function blockEndDay(block: BlockSpan): DayKey {
  return addDays(block.startDay, block.weeks * 7 - 1);
}

/** Do two spans share a day? The overlap rule, factored out so store and validator agree. */
export function blocksOverlap(a: BlockSpan, b: BlockSpan): boolean {
  return compareDays(a.startDay, blockEndDay(b)) <= 0 && compareDays(b.startDay, blockEndDay(a)) <= 0;
}

/** Where `day` sits relative to the block. */
export function positionOf(block: BlockSpan, day: DayKey): BlockPosition {
  if (compareDays(day, block.startDay) < 0) return 'before';
  if (compareDays(day, blockEndDay(block)) > 0) return 'done';
  return 'live';
}

/**
 * Which week of the block `day` falls in, 1-based and clamped to the block.
 *
 * A day before the block returns week 1 and a day after returns the last week, on purpose: the
 * caller reports the position separately, and clamping means every other field in the payload is
 * still about a real week rather than about week 0 or week 19 of a 16-week block.
 */
export function weekNumberOf(block: BlockSpan, day: DayKey): number {
  const offset = daysBetween(block.startDay, day);
  const raw = Math.floor(offset / 7) + 1;
  return Math.min(Math.max(raw, 1), block.weeks);
}

/** Inclusive bounds of a 1-based week. */
export function weekBounds(block: BlockSpan, weekNumber: number): { start: DayKey; end: DayKey } {
  const start = addDays(block.startDay, (weekNumber - 1) * 7);
  return { start, end: addDays(start, 6) };
}

/** Days until the block starts; 0 once it has. */
export function startsInDays(block: Pick<BlockSpan, 'startDay'>, day: DayKey): number {
  return Math.max(daysBetween(day, block.startDay), 0);
}

/**
 * Snap a day to the Monday of its week.
 *
 * Blocks always start on a Monday so that week boundaries match the week every other surface in the
 * app already counts in (weekly summary, volume). Rather than reject a Wednesday, we snap it and let
 * the caller see the stored value — an athlete who says "start next Wednesday" means the week.
 */
export function snapToMonday(day: DayKey): DayKey {
  return startOfWeek(day);
}
