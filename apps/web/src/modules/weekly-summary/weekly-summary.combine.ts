/**
 * Folding the per-family weeks into one "every sport" series (spec 089). PURE: no store, no clock,
 * no locale — it takes the families the handler has already computed and adds them up.
 *
 * The fold is deliberately over `sports[].weekly` rather than a second `weeklyVolume()` pass over the
 * activities. Those arrays are already index-aligned on `WeeklySummaryData.weekStarts`, so summing
 * them cannot disagree with the per-sport chips the reader is one click away from — a second read
 * could, and the day it did, the card would be quietly lying in two places at once.
 */
import type {
  WeeklySummaryCombined,
  WeeklySummarySport,
  WeeklySummaryTotals,
  WeeklySummaryWeek
} from './weekly-summary.types';

export function emptyTotals(): WeeklySummaryTotals {
  return { activities: 0, distanceM: 0, durationS: 0, elevationGainM: 0 };
}

/** Field-wise sum of two spans. The only way totals are ever combined in this module. */
export function addTotals(a: WeeklySummaryTotals, b: WeeklySummaryTotals): WeeklySummaryTotals {
  return {
    activities: a.activities + b.activities,
    distanceM: a.distanceM + b.distanceM,
    durationS: a.durationS + b.durationS,
    elevationGainM: a.elevationGainM + b.elevationGainM
  };
}

/**
 * Every family added together, or `null` when there are fewer than two.
 *
 * The `null` matters as much as the sum: with one family, "Wszystko" is a second name for the only
 * tab there is, and a chip that changes nothing is worse than no chip. The distance total is summed
 * anyway — `WeeklySummaryTotals` is one shape — and the card is what refuses to render it.
 */
export function combineSports(sports: readonly WeeklySummarySport[]): WeeklySummaryCombined | null {
  const first = sports[0];
  if (sports.length < 2 || first === undefined) return null;

  /*
   * `first.weekly` supplies the lattice: every family carries exactly one entry per week in the
   * window, so index i is the same Monday in all of them. A family shorter than the lattice (which
   * the handler cannot produce) contributes zeroes rather than shifting the series.
   */
  const weekly: WeeklySummaryWeek[] = first.weekly.map((week, index) => {
    const totals = sports.reduce<WeeklySummaryTotals>(
      (acc, sport) => addTotals(acc, sport.weekly[index] ?? emptyTotals()),
      emptyTotals()
    );
    return {
      week: week.week,
      ...totals,
      // OR, not AND: a week in progress is in progress for every sport in it.
      partial: sports.some((sport) => sport.weekly[index]?.partial === true)
    };
  });

  return {
    // Summed from the same per-family totals the sport tiles show, so the two can never drift.
    thisWeek: sports.reduce<WeeklySummaryTotals>((acc, s) => addTotals(acc, s.thisWeek), emptyTotals()),
    window: sports.reduce<WeeklySummaryTotals>((acc, s) => addTotals(acc, s.window), emptyTotals()),
    weekly
  };
}
