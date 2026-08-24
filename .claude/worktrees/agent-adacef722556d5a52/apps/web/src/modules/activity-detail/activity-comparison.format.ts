/**
 * Client-safe display helpers for the training verdict (spec 026).
 *
 * Separate from `activity-comparison.ts` on purpose: that module imports
 * `$lib/server/analytics/training-load` for `activityLoad`/`buildTrainingLoad`, and SvelteKit's
 * server-guard refuses any `$lib/server` module reachable from browser code. `TrainingVerdict.svelte`
 * only needs the two label lookups, so they live here where a component may import them. Same split,
 * and for the same reason, as `insights.condition.ts` / `condition.format.ts`.
 *
 * Nothing in this file may import from `$lib/server`.
 */
import type { TrainingBand } from '$lib/server/analytics/training-load';

/** How this session sits against the athlete's recent norm. */
export type ActivityVerdict = 'easy' | 'steady' | 'hard' | 'peak' | 'unknown';

const BAND_LABELS: Readonly<Record<TrainingBand, string>> = {
  fresh: 'świeżość',
  optimal: 'forma optymalna',
  neutral: 'równowaga',
  fatigued: 'zmęczenie',
  'very-fatigued': 'duże zmęczenie'
};

export function bandLabel(band: TrainingBand): string {
  return BAND_LABELS[band];
}

const VERDICT_LABELS: Readonly<Record<ActivityVerdict, string>> = {
  easy: 'Lżejszy niż zwykle',
  steady: 'Typowa sesja',
  hard: 'Mocniejszy niż zwykle',
  peak: 'Najmocniejszy od tygodni',
  unknown: 'Brak porównania'
};

export function verdictLabel(verdict: ActivityVerdict): string {
  return VERDICT_LABELS[verdict];
}
