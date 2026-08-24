/**
 * Rendering a step tree as text (spec 066), and what happened to it (spec 081). PURE, and
 * client-safe — the day panel, the editor preview and any future summary all read a step the same
 * way, so `5× (1 km + 2 min)` cannot mean two different things in two places.
 *
 * Every function that produces words takes a `Translator` (from `getI18n()` in a component, or
 * `createTranslator(locale)` on the server) rather than assuming Polish — the whole point of spec 076
 * is that switching to English actually changes what these functions print, numbers included.
 */
import { formatNumber, type Translator } from '$lib/i18n';
import type { Adherence, MatchedBy, WorkoutCompletion } from './workouts.types';
import {
  WORKOUT_TARGET_UNITS,
  type WorkoutDurationType,
  type WorkoutStep,
  type WorkoutStepKind,
  type WorkoutTarget,
  type WorkoutTargetType
} from '$lib/workouts';

/** The word for a step kind, in the active locale. */
export function stepKindLabel(t: Translator, kind: WorkoutStepKind): string {
  if (kind === 'repeat') return t('workout.stepKind.repeat');
  return t(`plan.stepKind.${kind}`);
}

/** The word for a duration type, in the active locale. */
export function durationTypeLabel(t: Translator, type: WorkoutDurationType): string {
  switch (type) {
    case 'time':
      return t('timeline.stat.time');
    case 'distance':
      return t('timeline.stat.distance');
    case 'calories':
      return t('metric.calories');
    case 'lap':
      return t('workout.durationType.lap');
  }
}

/**
 * The unit a duration VALUE is entered and shown in, beside the input that collects it.
 *
 * Not language-specific — `s`, `m` and `kcal` are the same symbol in every locale this app ships —
 * so this stays a plain lookup rather than a translated one.
 */
export const DURATION_UNITS: Readonly<Record<WorkoutDurationType, string>> = {
  time: 's',
  distance: 'm',
  calories: 'kcal',
  lap: ''
};

/** What the value field is called for assistive tech, per duration type. */
export function durationValueLabel(t: Translator, type: WorkoutDurationType): string {
  switch (type) {
    case 'time':
      return t('workout.durationValueLabel.time');
    case 'distance':
      return t('workout.durationValueLabel.distance');
    case 'calories':
      return t('metric.calories');
    case 'lap':
      return t('workout.durationValueLabel.lap');
  }
}

/** The word for a target type, in the active locale. */
export function targetTypeLabel(t: Translator, type: WorkoutTargetType): string {
  switch (type) {
    case 'none':
      return t('workout.target.none');
    case 'pace':
      return t('timeline.stat.pace');
    case 'speed':
      return t('workout.target.speed');
    case 'power':
      return t('plan.step.power');
    case 'hr':
      return t('plan.step.hr');
    case 'cadence':
      return t('workout.target.cadence');
  }
}

/** `M:SS` or `H:MM:SS`. Used for both a duration and a pace, which are the same shape. Digits only — no words to translate. */
export function fmtClock(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const two = (n: number): string => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${two(m)}:${two(sec)}` : `${m}:${two(sec)}`;
}

/**
 * Metres as km when it reads better, else metres. `1 km`, `400 m`, `1.5 km` (`1,5 km` in Polish).
 *
 * Units stay metric and untranslated in both languages (spec 076) — only the decimal separator
 * follows the locale.
 */
export function fmtDistance(t: Translator, metres: number): string {
  return metres >= 1000
    ? `${formatNumber(t.locale, metres / 1000, { maximumFractionDigits: 1 })} km`
    : `${formatNumber(t.locale, metres, { maximumFractionDigits: 1 })} m`;
}

/** How a step ENDS, in words. */
export function describeDuration(t: Translator, step: WorkoutStep): string {
  const value = step.durationValue;
  switch (step.durationType) {
    case 'time':
      return value === null ? '—' : fmtClock(value);
    case 'distance':
      return value === null ? '—' : fmtDistance(t, value);
    case 'calories':
      return value === null ? '—' : `${formatNumber(t.locale, value, { maximumFractionDigits: 1 })} kcal`;
    case 'lap':
      // Not a duration at all: it ends when the athlete decides it does.
      return t('workout.lapEnd');
    default:
      return '—';
  }
}

/**
 * What the athlete is asked to HOLD, in the target's own canonical unit (`WORKOUT_TARGET_UNITS`).
 * Pace is the exception worth spelling out: it is stored as seconds per km and must be read as a clock,
 * because "255 s/km" is a number nobody paces by.
 */
export function describeTarget(t: Translator, target: WorkoutTarget | null): string | null {
  if (!target || target.type === 'none') return null;
  const { low, high } = target;
  if (low === null && high === null) return null;

  const unit = WORKOUT_TARGET_UNITS[target.type];
  const one = (v: number): string =>
    target.type === 'pace'
      ? `${fmtClock(v)}/km`
      : `${formatNumber(t.locale, v, { maximumFractionDigits: 1 })} ${unit}`;

  if (low !== null && high !== null) {
    // A single-valued range is a point, not a band; printing "200–200 W" reads as a mistake.
    return low === high ? one(low) : `${one(low)}–${one(high)}`;
  }
  return low !== null ? t('plan.rangeFrom', { value: one(low) }) : t('plan.rangeTo', { value: one(high!) });
}

/**
 * One line for a step: what it is, how long, and what to hold.
 *
 * A repeat block renders WITH its children inline — `5× (1 km @ 4:10/km + 2:00)` — because the whole
 * point of the block is that those steps belong together, and a summary that hides them makes the
 * reader open the editor to answer "what are the intervals".
 */
export function describeStep(t: Translator, step: WorkoutStep): string {
  if (step.kind === 'repeat') {
    const children = (step.steps ?? []).map((s) => describeStep(t, s)).join(' + ');
    return `${step.repeats ?? 0}× (${children})`;
  }
  const target = describeTarget(t, step.target);
  const duration = describeDuration(t, step);
  return target ? `${duration} @ ${target}` : duration;
}

/** The whole session as one line, for a calendar cell or a list row. */
export function describeSteps(t: Translator, steps: readonly WorkoutStep[]): string {
  return steps.map((s) => describeStep(t, s)).join(' · ');
}

/* --------------------------------------------------------------------- *
 * Completion (spec 081)
 * --------------------------------------------------------------------- */

/** The chip on a session that was done. Warning tone is "shortened", not "wrong". */
export function completionBadge(
  t: Translator,
  adherence: Adherence
): { tone: 'success' | 'warning'; label: string } {
  return adherence === 'done'
    ? { tone: 'success', label: t('workout.completionBadge.done') }
    : { tone: 'warning', label: t('workout.completionBadge.shortened') };
}

/**
 * How far off the plan the session landed, as a share — `82 % planu` (`82% of plan` in English).
 *
 * `null` when the plan had no distance and no duration to be a share OF: a lap-button session
 * cannot be 100 % of anything, and printing a number there would invent a judgement.
 */
export function fmtAdherence(t: Translator, ratio: number | null): string | null {
  if (ratio === null || !Number.isFinite(ratio)) return null;
  return t('workout.adherencePct', { pct: Math.round(ratio * 100) });
}

/**
 * "done a day later" — the caveat that belongs in the day panel and nowhere else.
 *
 * `null` when the session was done on its own day, so a caller can simply omit the line. A calendar
 * cell never shows this: a marker that means two things means neither.
 */
export function fmtDayShift(t: Translator, dayShift: number): string | null {
  const n = Math.trunc(dayShift);
  if (n === 0) return null;
  const days = t('common.days', { count: Math.abs(n) });
  return t(n > 0 ? 'workout.dayShift.later' : 'workout.dayShift.earlier', { days });
}

/**
 * Whether this pairing is known or guessed (spec 081).
 *
 * Only the GUESS gets a sentence. A match Garmin itself made needs no disclaimer, and labelling
 * both would turn a meaningful caveat into decoration that stops being read.
 */
export function fmtMatchedBy(t: Translator, matchedBy: MatchedBy): string | null {
  return matchedBy === 'heuristic' ? t('workout.matchedHeuristic') : null;
}

/** The day panel's completion line: ratio, day shift and the caveat, in that order. */
export function completionNotes(t: Translator, completion: WorkoutCompletion): string[] {
  return [
    fmtAdherence(t, completion.adherenceRatio),
    fmtDayShift(t, completion.dayShift),
    fmtMatchedBy(t, completion.matchedBy)
  ].filter((s): s is string => s !== null);
}
