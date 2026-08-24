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
import { createTranslator, formatDecimals, type Locale } from '$lib/i18n';
import type { Clock } from '$lib/server/clock';
import type { LocalStore } from '$lib/server/store/types';
import { monthlyVolume, yearOverYear, type VolumeActivity } from '$lib/server/analytics/volume';
import { firstDayOf, formatDay, formatMonth, toDayKey, todayKey, yearOf } from '$lib/date';
import { sportGroup, sportGroupLabel, sportGroupLane } from '$lib/sport-labels';
import type {
  VolumeData,
  VolumeDay,
  VolumeRequest,
  VolumeSportOption,
  VolumeSportSeries,
  VolumeYearSeries,
  VolumeYearsFor
} from './volume.types';

export interface VolumeDeps {
  store: LocalStore;
  clock: Clock;
}

/** Calendar years the year-over-year chart covers, this one included. */
export const WINDOW_YEARS = 4;
/**
 * Months the loader ships. The period filter (spec 070) can select any calendar year on the
 * year-over-year chart, so the monthly lattice has to reach as far back as that chart does —
 * otherwise picking 2023 would show a year the bars have no data for.
 */
export const WINDOW_MONTHS = WINDOW_YEARS * 12;
/** Slots every year curve is padded to, so 365- and 366-day years share one x lattice. */
export const YEAR_SLOTS = 366;

export async function loadVolume(deps: VolumeDeps, req: VolumeRequest): Promise<VolumeData> {
  const t = createTranslator(req.locale);
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
    label: sportGroupLabel(t, s.group),
    color: sportGroupLane(s.group),
    distanceM: s.distanceM,
    durationS: s.durationS,
    elevationGainM: s.elevationGainM
  }));

  // Pad every year to the same length so one chart can hold them all. A common year gains a `null`
  // at the end rather than at 29 February — aligning by day-of-year shifts a common year one day
  // against a leap year after February, which is the same simplification Strava's YTD chart makes.
  const toYears = (y: (typeof yoy)['years'][number]): VolumeYearSeries => ({
    year: y.year,
    cumulativeKm: padTo(y.cumulativeKm, YEAR_SLOTS),
    totalKm: y.totalKm,
    toDateKm: y.toDateKm,
    partial: y.partial
  });
  const years: VolumeYearSeries[] = yoy.years.map(toYears);

  /*
   * The same comparison per sport family (spec 070). "Am I ahead of last year?" is a different
   * question for a runner who has swapped half his mileage for rides, and the combined curve hides
   * exactly that. Each family reuses the tested `yearOverYear` with its `group` filter rather than
   * re-implementing the roll-up, and all of it runs over rows already in memory.
   */
  const yearsBySport: Record<string, VolumeYearsFor> = {
    all: { years, vsLastYearKm: yoy.vsLastYearKm }
  };
  const sportOptions: VolumeSportOption[] = [{ value: 'all', label: 'Wszystko' }];
  // Only split when there is something to split. For a runner, "Wszystko" and "Bieg" are the same
  // curve drawn twice, and a switch whose options are identical teaches that controls are decorative.
  if (monthly.bySport.length > 1) {
    for (const s of monthly.bySport) {
      const perGroup = yearOverYear(activities, { today, years: WINDOW_YEARS, group: s.group });
      yearsBySport[s.group] = {
        years: perGroup.years.map(toYears),
        vsLastYearKm: perGroup.vsLastYearKm
      };
      sportOptions.push({ value: s.group, label: sportGroupLabel(t, s.group) });
    }
  }

  /*
   * Per-day totals for the consistency grid (specs 046, 070). Built from the SAME rows already in
   * memory, so the grid costs no extra read. The WHOLE window, not just the current year: the period
   * filter can point the grid at any year the year chart offers, and re-reading the store on every
   * switch would be a round trip for data already here. Only days with activity are shipped — the
   * empty ones are the majority and the grid draws them from the span alone.
   */
  const perDay = new Map<string, { km: number; count: number }>();
  for (const a of activities) {
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
      // The distance goes through the locale's own decimal separator rather than a hand-rolled comma
      // swap, and the count through real plural rules (spec 076).
      title: `${formatDay(req.locale, day as never, 'shortYear')}: ${formatDecimals(req.locale, b.km, 1)} km · ${t(
        'common.activities',
        { count: b.count }
      )}`
    }));

  return {
    windowMonths: WINDOW_MONTHS,
    months: monthly.months,
    monthly: monthly.totals,
    bySport,
    years,
    vsLastYearKm: yoy.vsLastYearKm,
    yearsBySport,
    sportOptions,
    throughDayOfYear: yoy.throughDayOfYear,
    dayOfYearLabels: dayOfYearLabels(req.locale),
    gridDays,
    today,
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
function dayOfYearLabels(locale: Locale): string[] {
  const labels = new Array<string>(YEAR_SLOTS).fill('');
  for (let month = 1; month <= 12; month++) {
    const key = `2024-${String(month).padStart(2, '0')}`;
    const index = dayOfYearOfFirst(month);
    if (index < YEAR_SLOTS) labels[index] = formatMonth(locale, key, 'short');
  }
  return labels;
}

/** 0-based day-of-year index of the 1st of `month` in a leap year. */
const LEAP_MONTH_STARTS = [0, 31, 60, 91, 121, 152, 182, 213, 244, 274, 305, 335];
function dayOfYearOfFirst(month: number): number {
  return LEAP_MONTH_STARTS[month - 1] ?? 0;
}
