/**
 * Authored-workout MODEL + validation (spec 050) — client-safe, so the MCP tools, the store, the
 * sync push and any future builder UI all share one definition of what a workout is. Lives beside
 * `sport-labels.ts` (outside `$lib/server`) for exactly that reason.
 *
 * The shape is deliberately sport-agnostic: a workout is an ordered list of steps, each with a
 * duration and an optional intensity target, plus `repeat` blocks that wrap child steps so
 * `5 × (1 km hard + 2 min easy)` is ONE node rather than ten. The sidecar maps this onto Garmin's
 * `workoutSegments` / `ExecutableStepDTO` / `RepeatGroupDTO` model; nothing here knows those names.
 *
 * Units are explicit and canonical, because "pace 4:30" is meaningless without one: pace is
 * SECONDS PER KM, speed km/h, power watts, HR bpm, cadence rpm (or spm). The sidecar converts.
 */
import { sportGroup, sportMeta, type SportGroup } from './sport-labels';

/** What a step is for. `repeat` is a block: it carries children, not a duration. */
export type WorkoutStepKind = 'warmup' | 'work' | 'recovery' | 'rest' | 'cooldown' | 'repeat';

/** How a step ends. `lap` = until the athlete presses the lap button. */
export type WorkoutDurationType = 'time' | 'distance' | 'lap' | 'calories';

/** What the athlete is asked to hold during a step. */
export type WorkoutTargetType = 'none' | 'pace' | 'speed' | 'power' | 'hr' | 'cadence';

export const WORKOUT_STEP_KINDS: readonly WorkoutStepKind[] = [
  'warmup',
  'work',
  'recovery',
  'rest',
  'cooldown',
  'repeat'
];
export const WORKOUT_DURATION_TYPES: readonly WorkoutDurationType[] = ['time', 'distance', 'lap', 'calories'];
export const WORKOUT_TARGET_TYPES: readonly WorkoutTargetType[] = [
  'none',
  'pace',
  'speed',
  'power',
  'hr',
  'cadence'
];

/** Canonical unit per target type — what `low`/`high` are always expressed in. */
export const WORKOUT_TARGET_UNITS: Readonly<Record<WorkoutTargetType, string>> = {
  none: '',
  pace: 's_per_km',
  speed: 'kph',
  power: 'w',
  hr: 'bpm',
  cadence: 'rpm'
};

/**
 * Which targets make sense for which sport family. A power target on a walk or a pace target on a
 * strength session is a mistake worth catching while authoring, not on the watch. The sidecar
 * enforces the same table as a last gate before Garmin.
 */
export const WORKOUT_TARGETS_BY_GROUP: Readonly<Record<SportGroup, readonly WorkoutTargetType[]>> = {
  run: ['none', 'pace', 'speed', 'hr', 'cadence'],
  ride: ['none', 'power', 'speed', 'hr', 'cadence'],
  swim: ['none', 'pace', 'hr'],
  walk: ['none', 'pace', 'speed', 'hr'],
  strength: ['none', 'hr'],
  other: ['none', 'hr']
};

export interface WorkoutTarget {
  readonly type: WorkoutTargetType;
  /** Low end in the canonical unit (`WORKOUT_TARGET_UNITS`). At least one of low/high is required. */
  readonly low: number | null;
  readonly high: number | null;
}

export interface WorkoutStep {
  readonly kind: WorkoutStepKind;
  /** Absent for a `repeat` block. */
  readonly durationType: WorkoutDurationType | null;
  /** Seconds / metres / kcal, per `durationType`. Null for `lap` and for `repeat`. */
  readonly durationValue: number | null;
  readonly target: WorkoutTarget | null;
  /** `repeat` only: how many times the children run. */
  readonly repeats: number | null;
  /** `repeat` only: the steps inside the block. */
  readonly steps: readonly WorkoutStep[] | null;
  readonly note: string | null;
}

/** Hard bounds. Not style: they are what keeps a runaway payload out of Garmin. */
export const WORKOUT_LIMITS = {
  maxTitle: 80,
  maxNote: 512,
  maxSteps: 50,
  maxChildSteps: 40,
  maxRepeats: 50,
  /** 24 h in seconds / 500 km in metres — anything past this is a typo, not a session. */
  maxDurationS: 86_400,
  maxDistanceM: 500_000,
  maxCalories: 10_000
} as const;

export class WorkoutValidationError extends Error {}

export interface WorkoutInput {
  readonly sport: string;
  readonly title: string;
  readonly steps: readonly WorkoutStep[];
  readonly note?: string | null;
}

/**
 * Validate + normalise an authored workout. Returns the canonical form (defaults filled, numbers
 * coerced, blank notes dropped); throws {@link WorkoutValidationError} with a human-readable reason
 * otherwise. Every entry point — MCP tool, API handler, future UI — goes through this, so there is
 * exactly one definition of a valid workout.
 */
export function normalizeWorkout(input: WorkoutInput): {
  sport: string;
  title: string;
  steps: WorkoutStep[];
  note: string | null;
} {
  const sport = (input.sport ?? '').trim();
  if (!sportMeta(sport)) {
    throw new WorkoutValidationError(
      `unknown sport '${sport}' — use a Garmin type key such as running, cycling, walking`
    );
  }
  const title = (input.title ?? '').trim();
  if (!title) throw new WorkoutValidationError('title is required');
  if (title.length > WORKOUT_LIMITS.maxTitle) {
    throw new WorkoutValidationError(`title is longer than ${WORKOUT_LIMITS.maxTitle} characters`);
  }
  const steps = input.steps ?? [];
  if (steps.length === 0) throw new WorkoutValidationError('a workout needs at least one step');
  if (steps.length > WORKOUT_LIMITS.maxSteps) {
    throw new WorkoutValidationError(`a workout cannot have more than ${WORKOUT_LIMITS.maxSteps} steps`);
  }
  const group = sportGroup(sport);
  return {
    sport,
    title,
    steps: steps.map((step) => normalizeStep(step, group, 0)),
    note: cleanNote(input.note)
  };
}

function normalizeStep(step: WorkoutStep, group: SportGroup, depth: number): WorkoutStep {
  if (!step || typeof step !== 'object') throw new WorkoutValidationError('each step must be an object');
  const kind = step.kind;
  if (!WORKOUT_STEP_KINDS.includes(kind)) {
    throw new WorkoutValidationError(`unknown step kind '${kind}' — use ${WORKOUT_STEP_KINDS.join(', ')}`);
  }
  if (kind === 'repeat') return normalizeRepeat(step, group, depth);

  const durationType = step.durationType ?? 'lap';
  if (!WORKOUT_DURATION_TYPES.includes(durationType)) {
    throw new WorkoutValidationError(
      `unknown duration type '${durationType}' — use ${WORKOUT_DURATION_TYPES.join(', ')}`
    );
  }
  let durationValue: number | null = null;
  if (durationType !== 'lap') {
    const value = numberOrNull(step.durationValue);
    if (value === null || value <= 0) {
      throw new WorkoutValidationError(`a ${durationType} step needs a positive durationValue`);
    }
    const max =
      durationType === 'time'
        ? WORKOUT_LIMITS.maxDurationS
        : durationType === 'distance'
          ? WORKOUT_LIMITS.maxDistanceM
          : WORKOUT_LIMITS.maxCalories;
    if (value > max) {
      throw new WorkoutValidationError(`${durationType} step value ${value} is beyond the ${max} limit`);
    }
    durationValue = value;
  }
  return {
    kind,
    durationType,
    durationValue,
    target: normalizeTarget(step.target, group),
    repeats: null,
    steps: null,
    note: cleanNote(step.note)
  };
}

function normalizeRepeat(step: WorkoutStep, group: SportGroup, depth: number): WorkoutStep {
  if (depth > 0) {
    // Garmin's own editor allows one level; refusing deeper nesting here beats sending a tree the
    // watch cannot execute.
    throw new WorkoutValidationError('repeat blocks cannot be nested');
  }
  const repeats = numberOrNull(step.repeats);
  if (repeats === null || !Number.isInteger(repeats) || repeats < 1) {
    throw new WorkoutValidationError('a repeat block needs a positive whole "repeats"');
  }
  if (repeats > WORKOUT_LIMITS.maxRepeats) {
    throw new WorkoutValidationError(
      `a repeat block cannot repeat more than ${WORKOUT_LIMITS.maxRepeats} times`
    );
  }
  const children = step.steps ?? [];
  if (children.length === 0) {
    throw new WorkoutValidationError('a repeat block needs at least one child step');
  }
  if (children.length > WORKOUT_LIMITS.maxChildSteps) {
    throw new WorkoutValidationError(
      `a repeat block cannot hold more than ${WORKOUT_LIMITS.maxChildSteps} steps`
    );
  }
  return {
    kind: 'repeat',
    durationType: null,
    durationValue: null,
    target: null,
    repeats,
    steps: children.map((child) => normalizeStep(child, group, depth + 1)),
    note: cleanNote(step.note)
  };
}

function normalizeTarget(target: WorkoutTarget | null | undefined, group: SportGroup): WorkoutTarget | null {
  if (!target) return null;
  const type = target.type ?? 'none';
  if (!WORKOUT_TARGET_TYPES.includes(type)) {
    throw new WorkoutValidationError(
      `unknown target type '${type}' — use ${WORKOUT_TARGET_TYPES.join(', ')}`
    );
  }
  if (type === 'none') return null;
  const allowed = WORKOUT_TARGETS_BY_GROUP[group];
  if (!allowed.includes(type)) {
    throw new WorkoutValidationError(
      `target '${type}' does not apply to this sport — allowed: ${allowed.filter((t) => t !== 'none').join(', ')}`
    );
  }
  const low = positiveOrNull(target.low);
  const high = positiveOrNull(target.high);
  if (low === null && high === null) {
    throw new WorkoutValidationError(
      `target '${type}' needs a low and/or high value in ${WORKOUT_TARGET_UNITS[type]}`
    );
  }
  if (low !== null && high !== null && low > high) {
    throw new WorkoutValidationError(`target '${type}' has low above high`);
  }
  return { type, low, high };
}

function cleanNote(note: string | null | undefined): string | null {
  if (typeof note !== 'string') return null;
  const text = note.trim();
  if (!text) return null;
  if (text.length > WORKOUT_LIMITS.maxNote) {
    throw new WorkoutValidationError(`a note is longer than ${WORKOUT_LIMITS.maxNote} characters`);
  }
  return text;
}

function numberOrNull(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function positiveOrNull(value: unknown): number | null {
  const number = numberOrNull(value);
  return number !== null && number > 0 ? number : null;
}

/** Total step count including repeat children — for compact, content-free summaries and logs. */
export function countWorkoutSteps(steps: readonly WorkoutStep[]): number {
  return steps.reduce((total, step) => total + 1 + (step.steps?.length ?? 0), 0);
}

/**
 * Planned duration in seconds, as far as it can be known: time steps count directly, distance steps
 * count only when a pace/speed target pins them down, `lap` steps cannot be known at all. Returns
 * null when nothing is knowable, so a caller never shows a confidently wrong number.
 */
export function estimateWorkoutDurationS(steps: readonly WorkoutStep[]): number | null {
  let total = 0;
  let known = false;
  for (const step of steps) {
    if (step.kind === 'repeat') {
      const inner = estimateWorkoutDurationS(step.steps ?? []);
      if (inner !== null) {
        total += inner * (step.repeats ?? 1);
        known = true;
      }
      continue;
    }
    if (step.durationType === 'time' && step.durationValue) {
      total += step.durationValue;
      known = true;
      continue;
    }
    if (step.durationType === 'distance' && step.durationValue && step.target) {
      const speed = targetSpeedMs(step.target);
      if (speed) {
        total += step.durationValue / speed;
        known = true;
      }
    }
  }
  return known ? Math.round(total) : null;
}

/** Planned distance in metres from the distance steps, or null when none are set. */
export function estimateWorkoutDistanceM(steps: readonly WorkoutStep[]): number | null {
  let total = 0;
  let known = false;
  for (const step of steps) {
    if (step.kind === 'repeat') {
      const inner = estimateWorkoutDistanceM(step.steps ?? []);
      if (inner !== null) {
        total += inner * (step.repeats ?? 1);
        known = true;
      }
      continue;
    }
    if (step.durationType === 'distance' && step.durationValue) {
      total += step.durationValue;
      known = true;
    }
  }
  return known ? Math.round(total) : null;
}

/** Mid-range speed in m/s implied by a pace/speed target, else null. */
function targetSpeedMs(target: WorkoutTarget): number | null {
  const values = [target.low, target.high].filter((v): v is number => typeof v === 'number' && v > 0);
  if (values.length === 0) return null;
  const mid = values.reduce((a, b) => a + b, 0) / values.length;
  if (target.type === 'pace') return 1000 / mid; // s/km → m/s
  if (target.type === 'speed') return mid / 3.6; // km/h → m/s
  return null;
}
