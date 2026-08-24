/**
 * Client-safe metric display metadata (label / unit / lane accent). Lives OUTSIDE `$lib/server` so
 * browser components can import it — `metric-specs.ts` (server-only, carries payload extractors)
 * must never be imported into client code. Mirrors the display fields of `metric-specs.METRICS`.
 */
import type { GarminMetricName } from '$lib/server/interfaces';
import type { Lane } from '$modules/metrics-dashboard/dashboard.types';

export interface MetricLabel {
  key: GarminMetricName;
  label: string;
  unit: string;
  accent: Lane;
}

export const METRIC_LABELS: MetricLabel[] = [
  { key: 'steps', label: 'Kroki', unit: '', accent: 'orange' },
  { key: 'resting_heart_rate', label: 'Tętno spoczynkowe', unit: 'bpm', accent: 'red' },
  { key: 'hrv', label: 'HRV', unit: 'ms', accent: 'green' },
  { key: 'body_battery', label: 'Body Battery', unit: '', accent: 'cyan' },
  { key: 'sleep', label: 'Sen', unit: '', accent: 'indigo' },
  { key: 'stress', label: 'Stres', unit: '', accent: 'amber' },
  { key: 'spo2', label: 'SpO₂', unit: '%', accent: 'sky' },
  { key: 'respiration', label: 'Oddech', unit: 'brpm', accent: 'teal' },
  { key: 'calories', label: 'Kalorie', unit: 'kcal', accent: 'lime' }
];

export function metricLabel(key: string): string {
  return METRIC_LABELS.find((m) => m.key === key)?.label ?? key;
}

export function metricMeta(key: string): MetricLabel | undefined {
  return METRIC_LABELS.find((m) => m.key === key);
}
