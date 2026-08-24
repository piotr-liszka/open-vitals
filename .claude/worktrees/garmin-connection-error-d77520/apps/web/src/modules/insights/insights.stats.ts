/**
 * Per-metric summary statistics for the Wnioski charts (spec 048).
 *
 * This is the numbers half of the old Analityka page. It is pure and deliberately separate from
 * `insights.api.ts` so the ordering rule below can be tested on its own: **statistics come from the
 * daily series, bucketing happens afterwards.** Reversed, "najlepszy dzień" would report the best
 * *week's mean* as if it were a day, and `avg` would average an already-averaged series.
 */
import { isPresent, type DatedValue, type DayPoint } from '$lib/metric-series';
import { round, type MetricSpec } from '$lib/server/garmin/metric-specs';
import type { MetricChart } from './insights.types';

/** The statistics half of `MetricChart` — everything that is not the plotted series. */
export type MetricStats = Omit<MetricChart, 'days' | 'series'>;

/**
 * Summarize one metric's DAILY points. `days` must be the unbucketed series; pass the bucketed
 * points separately when assembling the chart.
 */
export function summarizeMetric(spec: MetricSpec, days: readonly DayPoint[]): MetricStats {
  const present: DatedValue[] = days.filter(isPresent);
  const base: MetricStats = {
    key: spec.key,
    label: spec.label,
    accent: spec.accent,
    unit: spec.unit,
    format: spec.format,
    goodWhen: spec.goodWhen,
    latest: null,
    min: null,
    max: null,
    avg: null,
    total: null,
    deltaPct: null,
    count: present.length,
    rangeDays: days.length,
    best: null,
    worst: null
  };
  if (present.length === 0) return base;

  const series = present.map((d) => d.value);
  const decimals = spec.format === 'decimal' ? 1 : 0;
  const min = Math.min(...series);
  const max = Math.max(...series);
  const sum = series.reduce((a, b) => a + b, 0);
  const first = series[0]!;
  const last = series[series.length - 1]!;
  const maxPoint = present.find((d) => d.value === max)!;
  const minPoint = present.find((d) => d.value === min)!;

  return {
    ...base,
    latest: last,
    min,
    max,
    avg: round(sum / present.length, decimals),
    total: spec.summable ? sum : null,
    deltaPct: first === 0 ? null : round(((last - first) / Math.abs(first)) * 100),
    // "best" is the HEALTHY extreme, which for a goodWhen:'down' metric (resting HR, stress) is the
    // minimum — not the maximum.
    best: spec.goodWhen === 'up' ? maxPoint : minPoint,
    worst: spec.goodWhen === 'up' ? minPoint : maxPoint
  };
}
