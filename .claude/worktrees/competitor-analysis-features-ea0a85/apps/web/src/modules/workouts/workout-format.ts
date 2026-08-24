/**
 * Rendering a step tree as Polish text (spec 066). PURE, and client-safe — the day panel, the editor
 * preview and any future summary all read a step the same way, so `5× (1 km + 2 min)` cannot mean two
 * different things in two places.
 */
import {
  WORKOUT_TARGET_UNITS,
  type WorkoutDurationType,
  type WorkoutStep,
  type WorkoutStepKind,
  type WorkoutTarget
} from '$lib/workouts';

export const STEP_KIND_LABELS: Readonly<Record<WorkoutStepKind, string>> = {
  warmup: 'Rozgrzewka',
  work: 'Praca',
  recovery: 'Przerwa',
  rest: 'Odpoczynek',
  cooldown: 'Schłodzenie',
  repeat: 'Powtórz'
};

export const DURATION_TYPE_LABELS: Readonly<Record<WorkoutDurationType, string>> = {
  time: 'Czas',
  distance: 'Dystans',
  lap: 'Przycisk lap',
  calories: 'Kalorie'
};

/**
 * The unit a duration VALUE is entered and shown in, beside the input that collects it.
 *
 * Separate from `DURATION_TYPE_LABELS` because they answer different questions — "what ends this
 * step" versus "what is this number" — and separate from `describeDuration` because that formats a
 * finished value while this labels an empty field. `lap` has no unit: it ends when the athlete says so.
 */
export const DURATION_UNITS: Readonly<Record<WorkoutDurationType, string>> = {
  time: 's',
  distance: 'm',
  calories: 'kcal',
  lap: ''
};

/** What the value field is called for assistive tech, per duration type. */
export const DURATION_VALUE_LABELS: Readonly<Record<WorkoutDurationType, string>> = {
  time: 'Sekundy',
  distance: 'Metry',
  calories: 'Kalorie',
  lap: 'Wartość'
};

export const TARGET_TYPE_LABELS: Readonly<Record<string, string>> = {
  none: 'Bez celu',
  pace: 'Tempo',
  speed: 'Prędkość',
  power: 'Moc',
  hr: 'Tętno',
  cadence: 'Kadencja'
};

const nf = new Intl.NumberFormat('pl-PL', { maximumFractionDigits: 1 });

/** `M:SS` or `H:MM:SS`. Used for both a duration and a pace, which are the same shape. */
export function fmtClock(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const two = (n: number): string => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${two(m)}:${two(sec)}` : `${m}:${two(sec)}`;
}

/** Metres as km when it reads better, else metres. `1 km`, `400 m`, `1,5 km`. */
export function fmtDistance(metres: number): string {
  return metres >= 1000 ? `${nf.format(metres / 1000)} km` : `${nf.format(metres)} m`;
}

/** How a step ENDS, in words. */
export function describeDuration(step: WorkoutStep): string {
  const value = step.durationValue;
  switch (step.durationType) {
    case 'time':
      return value === null ? '—' : fmtClock(value);
    case 'distance':
      return value === null ? '—' : fmtDistance(value);
    case 'calories':
      return value === null ? '—' : `${nf.format(value)} kcal`;
    case 'lap':
      // Not a duration at all: it ends when the athlete decides it does.
      return 'do przycisku lap';
    default:
      return '—';
  }
}

/**
 * What the athlete is asked to HOLD, in the target's own canonical unit (`WORKOUT_TARGET_UNITS`).
 * Pace is the exception worth spelling out: it is stored as seconds per km and must be read as a clock,
 * because "255 s/km" is a number nobody paces by.
 */
export function describeTarget(target: WorkoutTarget | null): string | null {
  if (!target || target.type === 'none') return null;
  const { low, high } = target;
  if (low === null && high === null) return null;

  const unit = WORKOUT_TARGET_UNITS[target.type];
  const one = (v: number): string =>
    target.type === 'pace' ? `${fmtClock(v)}/km` : `${nf.format(v)} ${unit}`;

  if (low !== null && high !== null) {
    // A single-valued range is a point, not a band; printing "200–200 W" reads as a mistake.
    return low === high ? one(low) : `${one(low)}–${one(high)}`;
  }
  return low !== null ? `od ${one(low)}` : `do ${one(high!)}`;
}

/**
 * One line for a step: what it is, how long, and what to hold.
 *
 * A repeat block renders WITH its children inline — `5× (1 km @ 4:10/km + 2:00)` — because the whole
 * point of the block is that those steps belong together, and a summary that hides them makes the
 * reader open the editor to answer "what are the intervals".
 */
export function describeStep(step: WorkoutStep): string {
  if (step.kind === 'repeat') {
    const children = (step.steps ?? []).map(describeStep).join(' + ');
    return `${step.repeats ?? 0}× (${children})`;
  }
  const target = describeTarget(step.target);
  const duration = describeDuration(step);
  return target ? `${duration} @ ${target}` : duration;
}

/** The whole session as one line, for a calendar cell or a list row. */
export function describeSteps(steps: readonly WorkoutStep[]): string {
  return steps.map(describeStep).join(' · ');
}
