/**
 * Volume by calendar month and by year (spec 037). PURE compute over already-resolved activity
 * summaries — no store, no clock, no Garmin. The module handler resolves the rows and hands them here.
 *
 * The app measured volume in ISO weeks only (`weeklyMileage`, 12 weeks; the training overview's
 * stacked hours). Weeks are the right unit for a training block and the wrong one for the question
 * athletes actually ask — "how far did I run in July?", "am I ahead of last year?". A month cannot be
 * expressed as a whole number of ISO weeks, so no amount of re-slicing the weekly series answers it.
 *
 * TWO RULES CARRY THE HONESTY HERE, and both are about comparing unequal spans:
 *
 * 1. **The current month is partial** and is marked `partial`, so a view never draws August's 40 km
 *    next to July's 180 km as though the trend collapsed.
 * 2. **Year-over-year compares like with like.** A year-to-date curve for a finished year is not
 *    comparable to four months of this one, so every year carries `toDateKm` — its total at the SAME
 *    day of the year the athlete has reached now — alongside `totalKm`. That is the number a view
 *    should headline; `totalKm` is context, not a comparison.
 *
 * Leap years are handled by construction: curves are indexed by day-of-year over `daysInYear`, so
 * 29 February is a real slot in the years that have one and absent in the years that do not.
 */
import {
  addMonths,
  dayOfYear,
  daysInYear,
  isDayKey,
  lastMonths,
  monthKeyOf,
  yearOf,
  type DayKey,
  type MonthKey
} from '$lib/date';
import type { SportGroup } from '$lib/sport-labels';

/** The per-activity facts a volume roll-up needs. The caller maps the sport key to a family. */
export interface VolumeActivity {
  readonly day: string;
  readonly group: SportGroup;
  readonly distanceM: number | null;
  readonly durationS: number | null;
  readonly elevationGainM: number | null;
}

/** One calendar month's totals across every sport. */
export interface MonthVolume {
  readonly month: MonthKey;
  readonly activities: number;
  readonly distanceM: number;
  readonly durationS: number;
  readonly elevationGainM: number;
  /** True for the month the athlete is still in — its totals are not yet comparable to a full one. */
  readonly partial: boolean;
}

/** One sport family's distance per month, index-aligned with `MonthlyVolume.months`. */
export interface MonthSportSeries {
  readonly group: SportGroup;
  readonly distanceM: number[];
  readonly durationS: number[];
  readonly elevationGainM: number[];
}

export interface MonthlyVolume {
  /** Month keys, oldest first — the x lattice every series here is aligned to. */
  readonly months: MonthKey[];
  readonly totals: MonthVolume[];
  /** One entry per family present in the window, busiest (by distance) first. */
  readonly bySport: MonthSportSeries[];
  /** Mean distance per COMPLETE month in the window; `null` when none completed. */
  readonly avgDistanceM: number | null;
  /** The best complete month in the window by distance; `null` when none completed. */
  readonly bestMonth: MonthVolume | null;
}

export interface MonthlyVolumeOptions {
  /** The athlete's today — decides which month is partial and where the window ends. */
  readonly today: DayKey;
  /** How many months the window spans, ending with `today`'s month. */
  readonly months: number;
  /** Restrict to one family; omit for every sport. */
  readonly group?: SportGroup;
}

interface Bucket {
  activities: number;
  distanceM: number;
  durationS: number;
  elevationGainM: number;
}

const emptyBucket = (): Bucket => ({
  activities: 0,
  distanceM: 0,
  durationS: 0,
  elevationGainM: 0
});

function add(b: Bucket, a: VolumeActivity): void {
  b.activities++;
  b.distanceM += a.distanceM ?? 0;
  b.durationS += a.durationS ?? 0;
  b.elevationGainM += a.elevationGainM ?? 0;
}

/** Activities whose day is usable and, when asked, in the requested family. */
function usable(activities: readonly VolumeActivity[], group: SportGroup | undefined): VolumeActivity[] {
  return activities.filter((a) => isDayKey(a.day) && (group === undefined || a.group === group));
}

export function monthlyVolume(
  activities: readonly VolumeActivity[],
  opts: MonthlyVolumeOptions
): MonthlyVolume {
  const currentMonth = monthKeyOf(opts.today);
  const months = lastMonths(currentMonth, Math.max(0, Math.trunc(opts.months)));
  const inWindow = new Set(months);

  const totals = new Map<MonthKey, Bucket>(months.map((m) => [m, emptyBucket()]));
  // family → month → bucket. Only families actually present get an entry, so a view never draws a
  // lane for a sport the athlete does not do.
  const perSport = new Map<SportGroup, Map<MonthKey, Bucket>>();

  for (const a of usable(activities, opts.group)) {
    const month = monthKeyOf(a.day as DayKey);
    if (!inWindow.has(month)) continue;

    const total = totals.get(month);
    if (!total) continue;
    add(total, a);

    let sportMonths = perSport.get(a.group);
    if (!sportMonths) {
      sportMonths = new Map(months.map((m) => [m, emptyBucket()]));
      perSport.set(a.group, sportMonths);
    }
    const bucket = sportMonths.get(month);
    if (bucket) add(bucket, a);
  }

  const monthTotals: MonthVolume[] = months.map((month) => {
    const b = totals.get(month) ?? emptyBucket();
    return {
      month,
      activities: b.activities,
      distanceM: Math.round(b.distanceM),
      durationS: Math.round(b.durationS),
      elevationGainM: Math.round(b.elevationGainM),
      partial: month === currentMonth
    };
  });

  const bySport: MonthSportSeries[] = [...perSport.entries()]
    .map(([group, byMonth]) => ({
      group,
      distanceM: months.map((m) => Math.round(byMonth.get(m)?.distanceM ?? 0)),
      durationS: months.map((m) => Math.round(byMonth.get(m)?.durationS ?? 0)),
      elevationGainM: months.map((m) => Math.round(byMonth.get(m)?.elevationGainM ?? 0))
    }))
    .sort((a, b) => sum(b.distanceM) - sum(a.distanceM));

  // Averages and bests ignore the month in progress: including it drags both down every 1st.
  const complete = monthTotals.filter((m) => !m.partial && m.activities > 0);
  const avgDistanceM =
    complete.length === 0
      ? null
      : Math.round(complete.reduce((s, m) => s + m.distanceM, 0) / complete.length);
  const bestMonth =
    complete.length === 0 ? null : complete.reduce((best, m) => (m.distanceM > best.distanceM ? m : best));

  return { months, totals: monthTotals, bySport, avgDistanceM, bestMonth };
}

const sum = (xs: readonly number[]): number => xs.reduce((s, x) => s + x, 0);

/* --------------------------------------------------------------------- *
 * Year over year
 * --------------------------------------------------------------------- */

export interface YearVolumeCurve {
  readonly year: number;
  /**
   * Cumulative kilometres by day of the year, index 0 = 1 January, length = that year's day count.
   * Monotonic. For the year in progress the entries after today are `null`, so a chart's line simply
   * stops rather than flat-lining to the right edge and implying "no more running this year".
   */
  readonly cumulativeKm: (number | null)[];
  /** Whole-year total. Context — NOT the number to compare a part-year against. */
  readonly totalKm: number;
  /**
   * Total at the same day-of-year the athlete has reached now. THIS is the comparable number: it
   * measures every year at the same point in the season.
   */
  readonly toDateKm: number;
  readonly activities: number;
  readonly elevationGainM: number;
  readonly durationS: number;
  /** True for the year in progress. */
  readonly partial: boolean;
}

export interface YearOverYear {
  /** One curve per year with data, newest first. */
  readonly years: YearVolumeCurve[];
  /** Day of the year "now" is, the cut every `toDateKm` is measured at. */
  readonly throughDayOfYear: number;
  /**
   * This year's `toDateKm` minus last year's at the same cut, in km; `null` when either year is
   * missing. Positive means ahead of last year.
   */
  readonly vsLastYearKm: number | null;
}

export interface YearOverYearOptions {
  readonly today: DayKey;
  /** How many calendar years back to include, this one counted as the first. */
  readonly years: number;
  readonly group?: SportGroup;
}

export function yearOverYear(activities: readonly VolumeActivity[], opts: YearOverYearOptions): YearOverYear {
  const thisYear = yearOf(opts.today);
  const cut = dayOfYear(opts.today);
  const oldest = thisYear - Math.max(1, Math.trunc(opts.years)) + 1;

  interface Acc {
    daily: number[];
    activities: number;
    elevationGainM: number;
    durationS: number;
  }
  const byYear = new Map<number, Acc>();

  for (const a of usable(activities, opts.group)) {
    const day = a.day as DayKey;
    const year = yearOf(day);
    if (year < oldest || year > thisYear) continue;

    let acc = byYear.get(year);
    if (!acc) {
      acc = {
        daily: new Array<number>(daysInYear(year)).fill(0),
        activities: 0,
        elevationGainM: 0,
        durationS: 0
      };
      byYear.set(year, acc);
    }
    const i = dayOfYear(day) - 1;
    if (i >= 0 && i < acc.daily.length) acc.daily[i] = (acc.daily[i] ?? 0) + (a.distanceM ?? 0) / 1000;
    acc.activities++;
    acc.elevationGainM += a.elevationGainM ?? 0;
    acc.durationS += a.durationS ?? 0;
  }

  const years: YearVolumeCurve[] = [...byYear.entries()]
    .map(([year, acc]) => {
      const partial = year === thisYear;
      let running = 0;
      const cumulativeKm = acc.daily.map((km, i) => {
        running += km;
        // The year in progress has no data after today; a null breaks the line instead of lying flat.
        return partial && i + 1 > cut ? null : round2(running);
      });
      return {
        year,
        cumulativeKm,
        totalKm: round2(running),
        toDateKm: round2(acc.daily.slice(0, cut).reduce((s, km) => s + km, 0)),
        activities: acc.activities,
        elevationGainM: Math.round(acc.elevationGainM),
        durationS: Math.round(acc.durationS),
        partial
      };
    })
    .sort((a, b) => b.year - a.year);

  const current = years.find((y) => y.year === thisYear);
  const previous = years.find((y) => y.year === thisYear - 1);
  const vsLastYearKm = current && previous ? round2(current.toDateKm - previous.toDateKm) : null;

  return { years, throughDayOfYear: cut, vsLastYearKm };
}

function round2(v: number): number {
  return Math.round(v * 100) / 100;
}

/** Month keys of a window, for a caller that needs the lattice without the roll-up. */
export function volumeWindowMonths(today: DayKey, months: number): MonthKey[] {
  return lastMonths(monthKeyOf(today), months);
}

/** The month `n` months before the window's end — the store read's lower bound. */
export function volumeWindowStartMonth(today: DayKey, months: number): MonthKey {
  return addMonths(monthKeyOf(today), -(Math.max(1, Math.trunc(months)) - 1));
}
