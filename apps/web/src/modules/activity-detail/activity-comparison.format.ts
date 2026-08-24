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
import type { MessageKey, Translator } from '$lib/i18n';

/** How this session sits against the athlete's recent norm. */
export type ActivityVerdict = 'easy' | 'steady' | 'hard' | 'peak' | 'unknown';

const BAND_LABEL_KEYS: Readonly<Record<TrainingBand, MessageKey>> = {
  fresh: 'verdict.band.fresh',
  optimal: 'verdict.band.optimal',
  neutral: 'verdict.band.neutral',
  fatigued: 'verdict.band.fatigued',
  'very-fatigued': 'verdict.band.veryFatigued'
};

export function bandLabel(t: Translator, band: TrainingBand): string {
  return t(BAND_LABEL_KEYS[band]);
}

const VERDICT_LABEL_KEYS: Readonly<Record<ActivityVerdict, MessageKey>> = {
  easy: 'verdict.easy',
  steady: 'verdict.steady',
  hard: 'verdict.hard',
  peak: 'verdict.peak',
  unknown: 'verdict.unknown'
};

export function verdictLabel(t: Translator, verdict: ActivityVerdict): string {
  return t(VERDICT_LABEL_KEYS[verdict]);
}
