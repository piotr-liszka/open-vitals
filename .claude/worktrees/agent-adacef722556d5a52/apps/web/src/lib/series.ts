/**
 * Daily-series bucketing (spec 047). The global range reaches 1 year and "cały czas", and a daily
 * series over five years is both unreadable as a chart and thousands of points of payload. This
 * collapses a day-keyed series into weekly or monthly buckets before it crosses the wire.
 *
 * Two rules make the result honest rather than merely smaller:
 *
 *  - **A gap stays a gap.** A bucket with no synced day yields `null`, never `0` — a week you did not
 *    wear the watch is not a week of zero resting heart rate.
 *  - **The aggregation matches the metric's meaning.** `mean` for a level (heart rate, sleep, Body
 *    Battery), `sum` for a count (steps, calories). Averaging steps across a week and calling it the
 *    week's steps would be a different, wrong number.
 *
 * Pure and client-safe: day maths via `$lib/date` integer civil-date arithmetic (spec 018), no
 * `Date` parsing, no I/O.
 */
import { dayRange, formatDay, formatMonth, monthKeyOf, parseDayKey, startOfWeek, type DayKey } from './date';
import type { RangeBucket } from './range';
import type { Locale } from './i18n/locale';
import type { MessageKey } from './i18n/translate';

/** How the days inside one bucket combine. */
export type BucketAggregate = 'mean' | 'sum';

export interface BucketedSeries {
  /** One key per bucket, oldest→newest: the bucket's first day (Monday, or the 1st of the month). */
  days: DayKey[];
  /** One value per bucket; `null` where the bucket held no data at all. */
  values: (number | null)[];
}

/**
 * The day key a bucket starts on — its identity. Exported because several loaders bucket their own
 * per-day maps (training hours per sport, walking kilometres) rather than a plain value series, and
 * they must agree with `bucketSeries` on where a bucket begins.
 */
export function bucketStart(day: DayKey, bucket: RangeBucket): DayKey {
  if (bucket === 'day') return day;
  if (bucket === 'week') return startOfWeek(day);
  const { year, month } = parseDayKey(day);
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-01`;
}

/**
 * Every bucket covering the inclusive span `start`..`end`, oldest→newest — the x-axis lattice a
 * chart is indexed against, so an empty bucket keeps its slot instead of collapsing the ones after it.
 */
export function bucketLattice(start: DayKey, end: DayKey, bucket: RangeBucket): DayKey[] {
  const out: DayKey[] = [];
  let last: DayKey | null = null;
  for (const day of dayRange(start, end)) {
    const key = bucketStart(day, bucket);
    if (key !== last) {
      out.push(key);
      last = key;
    }
  }
  return out;
}

/**
 * Granularity for a *volume* chart over a range (training hours, weekly mileage): weekly while the
 * range is weekly-or-finer, monthly once it is month-bucketed.
 *
 * Volume never goes daily even for a 7-day range — "godziny w tygodniu" is the unit an athlete reads
 * training volume in, and one bar per day would be a different chart, not a narrower one.
 */
export function volumeBucket(range: { bucket: RangeBucket }): RangeBucket {
  return range.bucket === 'month' ? 'month' : 'week';
}

/**
 * Collapse a daily series into `bucket` granularity.
 *
 * `days` and `values` are parallel arrays (as every store read and every chart in this app already
 * shapes them) and must be the same length; extra values are ignored, missing ones read as gaps.
 * Input order is preserved, so a caller passing oldest→newest gets oldest→newest back.
 */
export function bucketSeries(
  days: readonly DayKey[],
  values: readonly (number | null)[],
  bucket: RangeBucket,
  aggregate: BucketAggregate = 'mean'
): BucketedSeries {
  if (bucket === 'day') {
    return { days: [...days], values: days.map((_, i) => normalize(values[i])) };
  }

  const order: DayKey[] = [];
  const totals = new Map<DayKey, { sum: number; count: number }>();

  for (let i = 0; i < days.length; i++) {
    const day = days[i];
    if (day === undefined) continue;
    const key = bucketStart(day, bucket);
    let slot = totals.get(key);
    if (slot === undefined) {
      slot = { sum: 0, count: 0 };
      totals.set(key, slot);
      order.push(key);
    }
    const value = normalize(values[i]);
    if (value === null) continue;
    slot.sum += value;
    slot.count += 1;
  }

  return {
    days: order,
    values: order.map((key) => {
      const slot = totals.get(key);
      // No day in this bucket carried a reading — a gap, not a zero.
      if (slot === undefined || slot.count === 0) return null;
      return aggregate === 'sum' ? slot.sum : slot.sum / slot.count;
    })
  };
}

/** `null`, `undefined` and `NaN`/`Infinity` all mean "no reading" once a series is bucketed. */
function normalize(value: number | null | undefined): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

/**
 * How a bucketed x-axis should be described in copy ("dzień" / "tydzień" / "miesiąc"), so a card can
 * say what one point means once the range stops being daily. Returns the message KEY (spec 076):
 * this runs in loaders, which have no translator, and the word has to follow the reader's language.
 */
export function bucketNounKey(bucket: RangeBucket): MessageKey {
  switch (bucket) {
    case 'week':
      return 'bucket.week';
    case 'month':
      return 'bucket.month';
    default:
      return 'bucket.day';
  }
}

/**
 * Axis label for one bucket. A weekly bucket is labelled by its Monday (the same "03.08" a daily
 * axis uses, so the two read alike); a monthly one drops the day entirely, since "01.03" on a
 * five-year axis invites reading a month as a date.
 *
 * Months go through `formatMonth`, the shared month abstraction, rather than a day style of their
 * own — one way to render a month, not two. The charts already thin colliding ticks, so the extra
 * width of a four-digit year is handled where tick spacing belongs.
 */
export function bucketAxisLabel(locale: Locale, day: DayKey, bucket: RangeBucket): string {
  return bucket === 'month'
    ? formatMonth(locale, monthKeyOf(day), 'shortYear')
    : formatDay(locale, day, 'dayMonth');
}
