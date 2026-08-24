/**
 * Client-safe metric display metadata (unit / lane accent). Lives OUTSIDE `$lib/server` so browser
 * components can import it — `metric-specs.ts` (server-only, carries payload extractors) must never
 * be imported into client code. Mirrors the display fields of `metric-specs.METRICS`.
 *
 * The NAMES live in the message catalog under `metric.<key>` (spec 076); units do not, because
 * `bpm`, `ms`, `kcal` and `%` are the same symbols in both languages.
 */
import type { GarminMetricName } from '$lib/server/interfaces';
import type { Lane } from '$modules/metrics-dashboard/dashboard.types';
import type { MessageKey, Translator } from './i18n/translate';

export interface MetricLabel {
  key: GarminMetricName;
  unit: string;
  accent: Lane;
}

export const METRIC_LABELS: MetricLabel[] = [
  { key: 'steps', unit: '', accent: 'orange' },
  { key: 'resting_heart_rate', unit: 'bpm', accent: 'red' },
  { key: 'hrv', unit: 'ms', accent: 'green' },
  { key: 'body_battery', unit: '', accent: 'cyan' },
  { key: 'sleep', unit: '', accent: 'indigo' },
  { key: 'stress', unit: '', accent: 'amber' },
  { key: 'spo2', unit: '%', accent: 'sky' },
  { key: 'respiration', unit: 'brpm', accent: 'teal' },
  { key: 'calories', unit: 'kcal', accent: 'lime' },
  { key: 'training_readiness', unit: '', accent: 'violet' }
];

/** Message key naming a metric. Unknown keys have none — the caller shows the raw key instead. */
export function metricLabelKey(key: string): MessageKey | null {
  return METRIC_LABELS.some((m) => m.key === key) ? (`metric.${key}` as MessageKey) : null;
}

/** Display name for a daily metric, falling back to the raw key for one we don't know. */
export function metricLabel(t: Translator, key: string): string {
  const messageKey = metricLabelKey(key);
  return messageKey ? t(messageKey) : key;
}

export function metricMeta(key: string): MetricLabel | undefined {
  return METRIC_LABELS.find((m) => m.key === key);
}
