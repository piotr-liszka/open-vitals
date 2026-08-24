/**
 * Per-sport weekly training summary handler (spec 056). One bounded store read answers the whole
 * card: which families the athlete actually trains, what each of them has done week-to-date, and how
 * that compares with the last twelve weeks.
 *
 * Every family is computed server-side in one pass, so switching a chip is instant and costs no
 * round-trip — the payload is twelve numbers per family, not a page per family.
 *
 * Pure over injected deps (store + clock + timezone): no live Garmin, no `Date.now()`, no env.
 */
import type { Clock } from '$lib/server/clock';
import type { LocalStore } from '$lib/server/store/types';
import {
  weekLattice,
  weeklyVolume,
  weeklyWindowStart,
  type WeeklyActivity
} from '$lib/server/analytics/weekly-volume';
import {
  daysBetween,
  formatMonth,
  monthKeyOf,
  startOfWeek,
  toDayKey,
  todayKey,
  type DayKey
} from '$lib/date';
import { sportGroup, sportGroupLabel, sportGroupLane, type SportGroup } from '$lib/sport-labels';
import {
  WEEKLY_SUMMARY_WEEKS,
  type WeeklySummaryData,
  type WeeklySummaryRequest,
  type WeeklySummarySport,
  type WeeklySummaryTotals
} from './weekly-summary.types';

export interface WeeklySummaryDeps {
  /** Narrowed to the one method used, so a test can hand this handler a two-line fake. */
  store: Pick<LocalStore, 'listActivities'>;
  clock: Clock;
  /** IANA zone the athlete's "today" — and therefore their week boundary — resolves in (spec 018). */
  timeZone: string;
}

/**
 * Ceiling on the rows one read may return. Twelve weeks of a very busy athlete is a few hundred
 * activities; the cap exists so a corrupt window can never turn a card into a full-history read.
 */
const MAX_ROWS = 5_000;

export async function loadWeeklySummary(
  deps: WeeklySummaryDeps,
  req: WeeklySummaryRequest
): Promise<WeeklySummaryData> {
  const today = todayKey(deps.clock, deps.timeZone);
  const from = weeklyWindowStart(today, WEEKLY_SUMMARY_WEEKS);
  const weekStarts = weekLattice(today, WEEKLY_SUMMARY_WEEKS);
  const currentWeekStart = startOfWeek(today);

  // Scoped to the authenticated user by the store port (AGENTS.md §2 rule 2) and bounded to the
  // window in the query, so the database does the windowing rather than the page.
  const rows = await deps.store.listActivities(req.userId, { from, to: today, limit: MAX_ROWS });

  /*
   * Families are split in memory rather than by one query per family: `sportKeysInGroup` cannot
   * enumerate `other` (an unmapped Garmin key groups there but is not in the list), so a per-family
   * query would silently drop exactly the sports we know least about.
   */
  const activities: WeeklyActivity[] = rows.map((a) => ({
    day: toDayKey(a.startTimeLocal),
    group: sportGroup(a.sport),
    distanceM: a.distanceM,
    // Moving time is the honest measure of training time; elapsed includes standing at lights.
    durationS: a.movingS ?? a.durationS,
    elevationGainM: a.elevationGainM
  }));

  const groups = new Set<SportGroup>(activities.map((a) => a.group));

  const sports: WeeklySummarySport[] = [...groups]
    .map((group) => {
      const weekly = weeklyVolume(activities, { today, weeks: WEEKLY_SUMMARY_WEEKS, group });
      const current = weekly[weekly.length - 1];
      return {
        group,
        label: sportGroupLabel(group),
        color: sportGroupLane(group),
        thisWeek: totalsOf(current),
        window: weekly.reduce<WeeklySummaryTotals>(
          (acc, w) => ({
            activities: acc.activities + w.activities,
            distanceM: acc.distanceM + w.distanceM,
            durationS: acc.durationS + w.durationS,
            elevationGainM: acc.elevationGainM + w.elevationGainM
          }),
          emptyTotals()
        ),
        weekly: weekly.map((w) => ({
          week: w.week,
          activities: w.activities,
          distanceM: w.distanceM,
          durationS: w.durationS,
          elevationGainM: w.elevationGainM,
          partial: w.partial
        }))
      };
    })
    /*
     * Busiest by TIME first, not by distance: ordering multi-sport families by kilometres would put a
     * rider above a runner whatever they actually trained. Same rule the training overview's sport
     * split already sorts by, so the two pages agree about which sport is "the athlete's".
     */
    .sort(
      (a, b) =>
        b.window.durationS - a.window.durationS ||
        b.window.activities - a.window.activities ||
        a.group.localeCompare(b.group)
    );

  const currentWeek = weekStarts.length > 0 ? weekStarts[weekStarts.length - 1] : currentWeekStart;

  return {
    weeks: WEEKLY_SUMMARY_WEEKS,
    weekStarts,
    monthLabels: monthChangeLabels(weekStarts),
    currentWeekStart: currentWeek ?? currentWeekStart,
    // 1 on a Monday, 7 on a Sunday — what turns "Ten tydzień" into an honest week-to-date caption.
    currentWeekDays: daysBetween(currentWeekStart, today) + 1,
    sports,
    defaultGroup: sports[0]?.group ?? null,
    hasData: sports.length > 0
  };
}

function emptyTotals(): WeeklySummaryTotals {
  return { activities: 0, distanceM: 0, durationS: 0, elevationGainM: 0 };
}

function totalsOf(week: WeeklySummaryTotals | undefined): WeeklySummaryTotals {
  if (week === undefined) return emptyTotals();
  return {
    activities: week.activities,
    distanceM: week.distanceM,
    durationS: week.durationS,
    elevationGainM: week.elevationGainM
  };
}

/**
 * A month name on the first week that falls in a new month, blank elsewhere — the reference card's
 * x axis. Twelve date stamps would be noise; the month is the only unit a 12-week span needs.
 */
function monthChangeLabels(weekStarts: readonly DayKey[]): string[] {
  let previous = '';
  return weekStarts.map((week) => {
    const month = monthKeyOf(week);
    if (month === previous) return '';
    previous = month;
    return formatMonth(month, 'short');
  });
}
