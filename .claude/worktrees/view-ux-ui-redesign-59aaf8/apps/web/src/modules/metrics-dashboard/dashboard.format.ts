/**
 * Metric value formatting for the dashboard (spec 028).
 *
 * ONE formatter, shared by the API (headline readout) and the UI (chart read-out/tooltip). It used to
 * live privately inside `dashboard.api.ts`, which meant the chart showed a sleep night as `25 500`
 * while the tile above it said `7h 05m` — the same number in two languages.
 */

/** How a metric's raw number is rendered. */
export type MetricFormat = 'int' | 'duration' | 'decimal' | 'plain';

/*
 * The trend window used to live here as `TREND_WINDOWS = [7, 14, 30]` with its own `?trend=` param
 * (spec 028). Spec 035 replaced it with the app-wide range (`$lib/range`), so the dashboard no longer
 * owns a window of its own — it is handed a `ResolvedRange` and reports it back on `DashboardData`.
 */

/** Render a metric value, or `null` when there is nothing to show (the tile prints "—"). */
export function formatMetricValue(n: number | null, format: MetricFormat): string | number | null {
  if (n === null || !Number.isFinite(n)) return null;
  switch (format) {
    case 'int':
      return Math.round(n).toLocaleString('pl-PL');
    case 'decimal':
      return n.toFixed(1);
    case 'duration': {
      const total = Math.max(0, Math.round(n));
      const h = Math.floor(total / 3600);
      const m = Math.floor((total % 3600) / 60);
      return `${h}h ${String(m).padStart(2, '0')}m`;
    }
    default:
      return n;
  }
}

/** Same value, always as a string — what a chart read-out needs. */
export function formatMetricText(n: number, format: MetricFormat): string {
  return String(formatMetricValue(n, format) ?? '—');
}
