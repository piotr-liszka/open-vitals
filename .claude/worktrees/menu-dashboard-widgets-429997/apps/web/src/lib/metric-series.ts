/**
 * The vocabulary a dated metric series is described in: how a value is formatted, one day's reading,
 * and a reading tagged with the day it happened on.
 *
 * These lived in `modules/analytics/analytics.types.ts` and were imported across module boundaries by
 * `modules/insights` and `lib/server/garmin/metric-specs` — the sharing AGENTS.md §5 says must go
 * through `lib/`. Spec 048 folded Analityka into Wnioski, so they move here rather than into the
 * surviving module: `metric-specs`, the insights slice and the MCP tools all need them, and none of
 * them should reach into a feature folder for a type.
 *
 * Pure types plus one predicate — no I/O, client-safe.
 */

/** How a metric's numbers are rendered: a count, a one-decimal level, or a duration in seconds. */
export type MetricFormat = 'int' | 'duration' | 'decimal';

/** One day's value in a range. `null` is a gap — a day with no synced reading, never a zero. */
export interface DayPoint {
  date: string;
  value: number | null;
}

/** A single dated reading, used wherever a statistic has to name the day it came from. */
export interface DatedValue {
  date: string;
  value: number;
}

/** Narrow a `DayPoint` to a day that actually has a reading. */
export function isPresent(point: DayPoint): point is DatedValue {
  return point.value !== null;
}
