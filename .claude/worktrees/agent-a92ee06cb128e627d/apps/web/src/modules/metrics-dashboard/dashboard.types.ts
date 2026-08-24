/**
 * Contracts for the metrics dashboard (spec 010, trends reworked in spec 028, window made global in
 * spec 047).
 */
import type { ResolvedRange } from '$lib/range';
import type { MetricFormat } from './dashboard.format';
import type { MessageKey } from '$lib/i18n';

export type { MetricFormat };

export type Lane =
  'orange' | 'red' | 'indigo' | 'cyan' | 'green' | 'amber' | 'sky' | 'teal' | 'violet' | 'lime';

export interface MetricTile {
  key: string;
  /** Message key for the metric's name (spec 076) — the component translates it at render time. */
  labelKey: MessageKey;
  /** Design-system lane colour name (maps to --lane-*). */
  accent: Lane;
  /** Display-ready headline value, or null when unavailable ("—"). */
  value: string | number | null;
  unit: string;
  /** Signed percent change between the first and last day WITH data, or null. */
  delta: number | null;
  /** Which direction is healthy for this metric (drives delta colour). */
  goodWhen: 'up' | 'down';
  /** How the raw numbers render — shared with the chart read-out so the two never disagree. */
  format: MetricFormat;
  /**
   * One entry per bucket in `DashboardData.days`, oldest → newest. `null` is a real gap (no data in
   * that bucket) and stays a gap in the chart; it is never collapsed away, which would shift every
   * later point onto the wrong date.
   *
   * For ranges up to 45 days one bucket is one day. Beyond that the series is the *mean day* of each
   * week or month (spec 047) — comparable with the headline above it, which stays the newest single
   * reading.
   */
  series: (number | null)[];
}

export interface DashboardData {
  connected: boolean;
  /** The snapshot date (YYYY-MM-DD) — always today, whatever the range. */
  date: string;
  /** The global range this payload was built for (spec 047); drives the card's range indicator. */
  range: ResolvedRange;
  /**
   * One key per bucket (YYYY-MM-DD, oldest → newest), index-aligned with every tile's `series`. A
   * daily range keys by day, a weekly one by Monday, a monthly one by the 1st.
   */
  days: string[];
  tiles: MetricTile[];
}
