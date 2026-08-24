/**
 * Volume page handler (spec 037). One bounded store read answers both halves of the page: distance,
 * time and climb per calendar month, and cumulative distance per calendar year measured at the same
 * point in the season.
 *
 * Pure over injected deps (store + clock): no live Garmin, no `Date.now()`, no env.
 *
 * The read reaches back far enough for the year-over-year comparison — the wider of the two windows —
 * because the monthly window is a subset of it. Bulk `listActivities` omits the heavy `raw` blob in
 * both adapters, which is what keeps a multi-year read affordable here.
 */
import type { Clock } from '$lib/server/clock';
import type { LocalStore } from '$lib/server/store/types';
import { monthlyVolume, yearOverYear, type VolumeActivity } from '$lib/server/analytics/volume';
import { firstDayOf, formatDay, formatMonth, toDayKey, todayKey, yearOf } from '$lib/date';
import { sportGroup, sportGroupLabel, sportGroupLane } from '$lib/sport-labels';
import type {
  VolumeData,
  VolumeDay,
  VolumeRequest,
  VolumeSportSeries,
  VolumeYearSeries
} from './volume.types';

export interface VolumeDeps {
  store: LocalStore;
  clock: Clock;
}

/** Months the monthly section covers — two years, so a season repeats and is visibly comparable. */
export const WINDOW_MONTHS = 24;
/** Calendar years the year-over-year chart covers, this one included. */
export const WINDOW_YEARS = 4;
/** Slots every year curve is padded to, so 365- and 366-day years share one x lattice. */
export const YEAR_SLOTS = 366;

export async function loadVolume(deps: VolumeDeps, req: VolumeRequest): Promise<VolumeData> {
  const today = todayKey(deps.clock);
  // The year window is the wider of the two, so it alone bounds the read.
  const from = firstDayOf(`${yearOf(today) - (WINDOW_YEARS - 1)}-01`);

  const rows = await deps.store.listActivities(req.userId, { from, to: today, limit: 20_000 });

  const activities: VolumeActivity[] = rows.map((a) => ({
    day: toDayKey(a.startTimeLocal),
    group: sportGroup(a.sport),
    distanceM: a.distanceM,
    // Moving time is the honest measure of training time; elapsed includes standing at lights.
    durationS: a.movingS ?? a.durationS,
    elevationGainM: a.elevationGainM
  }));

  const monthly = monthlyVolume(activities, { today, months: WINDOW_MONTHS });
  const yoy = yearOverYear(activities, { today, years: WINDOW_YEARS });

  const bySport: VolumeSportSeries[] = monthly.bySport.map((s) => ({
    group: s.group,
    label: sportGroupLabel(s.group),
    color: sportGroupLane(s.group),
    distanceM: s.distanceM,
    durationS: s.durationS,
    elevationGainM: s.elevationGainM
  }));

  // Pad every year to the same length so one chart can hold them all. A common year gains a `null`
  // at the end rather than at 29 February — aligning by day-of-year shifts a common year one day
  // against a leap year after February, which is the same simplification Strava's YTD chart makes.
  const years: VolumeYearSeries[] = yoy.years.map((y) => ({
    year: y.year,
    cumulativeKm: padTo(y.cumulativeKm, YEAR_SLOTS),
    totalKm: y.totalKm,
    toDateKm: y.toDateKm,
    partial: y.partial
  }));

  /*
   * Per-day totals for the consistency grid (spec 046). Built from the SAME rows already in memory, so the
   * grid costs no extra read. Only the current year: a grid per year would be a scrolling wall, and this is
   * the year the athlete is living in.
   */
  const thisYear = yearOf(today);
  const perDay = new Map<string, { km: number; count: number }>();
  for (const a of activities) {
    if (yearOf(a.day as never) !== thisYear) continue;
    const bucket = perDay.get(a.day) ?? { km: 0, count: 0 };
    bucket.km += (a.distanceM ?? 0) / 1000;
    bucket.count++;
    perDay.set(a.day, bucket);
  }
  const gridDays: VolumeDay[] = [...perDay.entries()]
    .sort((x, y) => (x[0] < y[0] ? -1 : 1))
    .map(([day, b]) => ({
      day,
      km: Math.round(b.km * 100) / 100,
      title: `${formatDay(day as never, 'shortYear')}: ${b.km.toFixed(1).replace('.', ',')} km · ${
        b.count === 1 ? '1 aktywność' : `${b.count} aktywności`
      }`
    }));

  return {
    windowMonths: WINDOW_MONTHS,
    months: monthly.months,
    monthly: monthly.totals,
    bySport,
    avgDistanceM: monthly.avgDistanceM,
    bestMonth: monthly.bestMonth,
    years,
    throughDayOfYear: yoy.throughDayOfYear,
    vsLastYearKm: yoy.vsLastYearKm,
    dayOfYearLabels: dayOfYearLabels(),
    gridDays,
    gridYear: thisYear,
    hasData: activities.length > 0
  };
}

function padTo(values: readonly (number | null)[], length: number): (number | null)[] {
  const out = values.slice(0, length) as (number | null)[];
  while (out.length < length) out.push(null);
  return out;
}

/**
 * A month name on the 1st of each month, blank on every other day. `TrendChart` drops empty labels
 * and thins what remains to fit, so this gives the year chart month gridlines without 366 ticks.
 *
 * Built on a leap year so all 366 slots have a label position; in a common year the extra slot is
 * `null` in the data anyway and never reaches the axis.
 */
function dayOfYearLabels(): string[] {
  const labels = new Array<string>(YEAR_SLOTS).fill('');
  for (let month = 1; month <= 12; month++) {
    const key = `2024-${String(month).padStart(2, '0')}`;
    const index = dayOfYearOfFirst(month);
    if (index < YEAR_SLOTS) labels[index] = formatMonth(key, 'short');
  }
  return labels;
}

/** 0-based day-of-year index of the 1st of `month` in a leap year. */
const LEAP_MONTH_STARTS = [0, 31, 60, 91, 121, 152, 182, 213, 244, 274, 305, 335];
function dayOfYearOfFirst(month: number): number {
  return LEAP_MONTH_STARTS[month - 1] ?? 0;
}
