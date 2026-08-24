/**
 * Volume per ISO week, for any sport family (spec 056). PURE compute over already-resolved activity
 * summaries — no store, no clock, no Garmin. The module handler resolves the rows and hands them here.
 *
 * This is the generalisation of `running-profile.weeklyMileage`, which bucketed the same way but knew
 * only about runs and only about kilometres. A multi-sport athlete needs the same twelve buckets for
 * the ride and the walk, and needs climb and time in them — so the bucketing lives here ONCE and
 * `weeklyMileage` is now a thin run-shaped view of it (see that file). Two copies of "which Monday is
 * this day in" is exactly how two pages start disagreeing about what a week is.
 *
 * Two rules carry the honesty here, and both are about the week the athlete is standing in:
 *
 * 1. **A week with no training is `0`, not a gap.** Unlike a sensor series (see `$lib/series`), a week
 *    without a session genuinely has zero kilometres — the athlete did not train, the watch did not
 *    fail. Every bucket in the window exists, so the x lattice never collapses.
 * 2. **The current week is `partial`** and carries `daysElapsed`, so a view can say "week to date"
 *    rather than drawing Wednesday's 20 km next to last week's finished 60 and implying a collapse.
 *
 * Week maths is `$lib/date` integer civil-date arithmetic (spec 018): Monday-start ISO weeks resolved
 * from a day key the caller already resolved in the app timezone. No `Date` is constructed here, so a
 * week boundary cannot drift by a timezone or a DST change.
 */
import { addDays, daysBetween, isDayKey, startOfWeek, type DayKey } from '$lib/date';
import type { SportGroup } from '$lib/sport-labels';

/** The per-activity facts a weekly roll-up needs. The caller maps the sport key to a family. */
export interface WeeklyActivity {
  /** Local day the athlete trained, `YYYY-MM-DD`. */
  readonly day: string;
  readonly group: SportGroup;
  readonly distanceM: number | null;
  readonly durationS: number | null;
  readonly elevationGainM: number | null;
}

/** One ISO week's totals. */
export interface WeekVolume {
  /** Monday of the week, `YYYY-MM-DD` — the bucket's identity and its x-axis key. */
  readonly week: DayKey;
  readonly activities: number;
  readonly distanceM: number;
  readonly durationS: number;
  readonly elevationGainM: number;
  /** True for the week `today` falls in — its totals are week-to-date, not a finished week. */
  readonly partial: boolean;
  /** Days of this week already lived through, 1–7. Always 7 for a completed week. */
  readonly daysElapsed: number;
}

export interface WeeklyVolumeOptions {
  /** The athlete's today (already resolved in their timezone) — the window's last week. */
  readonly today: DayKey;
  /** How many weeks the window spans, ending with `today`'s week. */
  readonly weeks: number;
  /** Restrict to one family; omit for every sport. */
  readonly group?: SportGroup;
}

interface Bucket {
  activities: number;
  distanceM: number;
  durationS: number;
  elevationGainM: number;
}

const emptyBucket = (): Bucket => ({ activities: 0, distanceM: 0, durationS: 0, elevationGainM: 0 });

/** Never negative, never fractional — a window is a whole number of weeks. */
function weekCount(weeks: number): number {
  return Math.max(0, Math.trunc(weeks));
}

/**
 * The Mondays of a trailing window, oldest first — the x lattice every weekly series is indexed
 * against, so an empty week keeps its slot instead of collapsing the ones after it.
 */
export function weekLattice(today: DayKey, weeks: number): DayKey[] {
  const count = weekCount(weeks);
  if (count === 0) return [];
  const thisMonday = startOfWeek(today);
  const out: DayKey[] = [];
  for (let i = count - 1; i >= 0; i--) out.push(addDays(thisMonday, -i * 7));
  return out;
}

/**
 * First day the window covers — the lower bound of the store read, so a loader never asks the
 * database for history the chart cannot show.
 */
export function weeklyWindowStart(today: DayKey, weeks: number): DayKey {
  const lattice = weekLattice(today, weeks);
  return lattice[0] ?? startOfWeek(today);
}

/** Totals per ISO week over the trailing window, oldest first. */
export function weeklyVolume(activities: readonly WeeklyActivity[], opts: WeeklyVolumeOptions): WeekVolume[] {
  const lattice = weekLattice(opts.today, opts.weeks);
  const buckets = new Map<DayKey, Bucket>(lattice.map((w) => [w, emptyBucket()]));
  const currentWeek = startOfWeek(opts.today);

  for (const a of activities) {
    // Untrusted input: a malformed day would otherwise throw out of `startOfWeek` and take the whole
    // card down for one bad row.
    if (!isDayKey(a.day)) continue;
    if (opts.group !== undefined && a.group !== opts.group) continue;
    const bucket = buckets.get(startOfWeek(a.day));
    if (bucket === undefined) continue;
    bucket.activities += 1;
    bucket.distanceM += a.distanceM ?? 0;
    bucket.durationS += a.durationS ?? 0;
    bucket.elevationGainM += a.elevationGainM ?? 0;
  }

  return lattice.map((week) => {
    const b = buckets.get(week) ?? emptyBucket();
    const partial = week === currentWeek;
    return {
      week,
      activities: b.activities,
      distanceM: Math.round(b.distanceM),
      durationS: Math.round(b.durationS),
      elevationGainM: Math.round(b.elevationGainM),
      partial,
      daysElapsed: partial ? daysBetween(week, opts.today) + 1 : 7
    };
  });
}
