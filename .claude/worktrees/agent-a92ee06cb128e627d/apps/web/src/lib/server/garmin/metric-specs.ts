/**
 * Single source of truth for the per-metric table + payload extraction helpers shared by the
 * analytics slice (spec 007) and the insights engine (spec 013). Moved out of `analytics.api.ts`
 * so both surfaces agree on keys, accents, orientation, and summability.
 *
 * Payload field names are best-guess (the sidecar flags them as assumptions): extraction tries
 * candidate keys in order and degrades to `null` — a missing field yields a gap, never a throw.
 */
import type { GarminMetricName } from '$lib/server/interfaces';
import type { Lane } from '$modules/metrics-dashboard/dashboard.types';
import type { MetricFormat } from '$lib/metric-series';

export interface MetricSpec {
  key: GarminMetricName;
  label: string;
  accent: Lane;
  unit: string;
  format: MetricFormat;
  goodWhen: 'up' | 'down';
  /** Whether a sum across days is meaningful (counters like steps/calories). */
  summable: boolean;
  /**
   * Candidate paths within the metric's `data` payload, most-preferred first.
   * Supports dotted paths for nested fields (e.g. `hrvSummary.lastNightAvg`).
   */
  keys: string[];
  /**
   * Custom reducer for payloads that aren't a simple scalar lookup (e.g. Body
   * Battery's per-reading array). Takes precedence over `keys` when present.
   */
  extract?: (data: Record<string, unknown>) => number | null;
}

export const METRICS: MetricSpec[] = [
  {
    key: 'steps',
    label: 'Kroki',
    accent: 'orange',
    unit: '',
    format: 'int',
    goodWhen: 'up',
    summable: true,
    // Sourced from the daily summary (the sidecar routes `steps` there).
    keys: ['totalSteps']
  },
  {
    key: 'resting_heart_rate',
    label: 'Tętno spoczynkowe',
    accent: 'red',
    unit: 'bpm',
    format: 'int',
    goodWhen: 'down',
    summable: false,
    keys: ['restingHeartRate']
  },
  {
    key: 'hrv',
    label: 'HRV',
    accent: 'green',
    unit: 'ms',
    format: 'int',
    goodWhen: 'up',
    summable: false,
    keys: ['hrvSummary.lastNightAvg', 'hrvSummary.weeklyAvg']
  },
  {
    key: 'body_battery',
    label: 'Body Battery',
    accent: 'cyan',
    unit: '',
    format: 'int',
    goodWhen: 'up',
    summable: false,
    // Body Battery is a per-reading array over the day; the daily representative
    // is the peak charge reached. Rows are [epochMs, status, level, ...].
    keys: [],
    extract: (data) => maxOfArray(data['bodyBatteryValuesArray'], 2)
  },
  {
    key: 'sleep',
    label: 'Sen',
    accent: 'indigo',
    unit: '',
    format: 'duration',
    goodWhen: 'up',
    summable: false,
    keys: ['dailySleepDTO.sleepTimeSeconds']
  },
  {
    key: 'stress',
    label: 'Stres',
    accent: 'amber',
    unit: '',
    format: 'int',
    goodWhen: 'down',
    summable: false,
    keys: ['avgStressLevel']
  },
  {
    key: 'spo2',
    label: 'SpO₂',
    accent: 'sky',
    unit: '%',
    format: 'int',
    goodWhen: 'up',
    summable: false,
    // Sourced from the daily summary (garmy has no standalone spo2 metric).
    keys: ['averageSpo2']
  },
  {
    key: 'respiration',
    label: 'Oddech',
    accent: 'teal',
    unit: 'brpm',
    format: 'int',
    goodWhen: 'down',
    summable: false,
    keys: ['avgWakingRespirationValue', 'avgSleepRespirationValue']
  },
  {
    key: 'calories',
    label: 'Kalorie',
    accent: 'lime',
    unit: 'kcal',
    format: 'int',
    goodWhen: 'up',
    summable: true,
    keys: ['totalKilocalories']
  },
  {
    key: 'training_readiness',
    label: 'Gotowość (Garmin)',
    accent: 'violet',
    unit: '',
    format: 'int',
    goodWhen: 'up',
    summable: false,
    // Garmin's own 0–100 verdict (spec 059). Deliberately NOT a contributor to our
    // readiness weights: folding one composite into another would double-count the
    // channels both are already built from, and make neither number explainable.
    keys: ['score']
  }
];

/** Unwrap `{metric,date,data}` if present, else treat the value as the inner payload. */
export function inner(raw: unknown): Record<string, unknown> | null {
  if (raw && typeof raw === 'object') {
    const obj = raw as Record<string, unknown>;
    if ('data' in obj && obj.data && typeof obj.data === 'object') return obj.data as Record<string, unknown>;
    return obj;
  }
  return null;
}

/** Read a possibly-dotted path (`a.b.c`) out of a payload; `undefined` if absent. */
function readPath(data: Record<string, unknown>, path: string): unknown {
  if (!path.includes('.')) return data[path];
  let cur: unknown = data;
  for (const seg of path.split('.')) {
    if (cur == null || typeof cur !== 'object') return undefined;
    cur = (cur as Record<string, unknown>)[seg];
  }
  return cur;
}

/** First finite number found under any of `keys` (each a flat or dotted path), or null. */
export function pick(data: Record<string, unknown> | null, keys: string[]): number | null {
  if (!data) return null;
  for (const k of keys) {
    const v = readPath(data, k);
    if (typeof v === 'number' && Number.isFinite(v)) return v;
  }
  return null;
}

/** Max of a numeric column in a row-array payload (e.g. Body Battery levels), or null. */
export function maxOfArray(arr: unknown, col: number): number | null {
  if (!Array.isArray(arr)) return null;
  let max: number | null = null;
  for (const row of arr) {
    const v = Array.isArray(row) ? row[col] : undefined;
    if (typeof v === 'number' && Number.isFinite(v)) max = max === null ? v : Math.max(max, v);
  }
  return max;
}

/** Extract a single day's numeric value for a metric from the sidecar `data` payload. */
export function extractMetricValue(
  spec: { keys: string[]; extract?: (data: Record<string, unknown>) => number | null },
  rawDayData: unknown
): number | null {
  const data = inner(rawDayData);
  if (!data) return null;
  return spec.extract ? spec.extract(data) : pick(data, spec.keys);
}

/**
 * Whether a day's payload actually holds something (spec 072).
 *
 * `data != null` is NOT the same question. Garmin answers a day it has no wellness data for with a
 * *present* daily-summary object in which every field is null — `includesWellnessData: false`,
 * `lastSyncTimestampGMT: null`, `totalSteps: null`. Counting those as data is how "106 dni z danymi"
 * and "Historia metryk dziennych jest kompletna" were reported on a day Garmin held nothing, while
 * the start page showed a two-day-old readiness as if it were this morning's.
 *
 * A metric with no spec (there is one per daily metric today, but the list is data) falls back to
 * "the payload exists" rather than declaring the day empty — an unknown shape is not evidence of
 * absence.
 */
export function hasMetricValue(metric: GarminMetricName, rawDayData: unknown): boolean {
  if (rawDayData == null) return false;
  const spec = METRICS.find((s) => s.key === metric);
  if (!spec) return true;
  return extractMetricValue(spec, rawDayData) !== null;
}

/** Round to `decimals` places (banker's-rounding-free, matches the analytics view). */
export function round(n: number, decimals = 0): number {
  const f = 10 ** decimals;
  return Math.round(n * f) / f;
}
