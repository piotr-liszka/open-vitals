/**
 * Named workout PRESETS (spec 050) — a session in one call instead of a hand-built step tree.
 * `create_workout` over MCP accepts either, so "4×8 min on the bike Thursday" does not require the
 * assistant to spell out five steps and every unit.
 *
 * Presets are sport-aware but deliberately ZONE-FREE: this app does not know the athlete's
 * threshold, so a preset carries a target only when the caller passes explicit numbers (watts, bpm,
 * s/km). A preset with no target is still a real structured workout — the watch just shows the
 * step's duration rather than a range to hold. Titles are Polish, like the rest of the UI.
 */
import { sportGroup } from './sport-labels';
import {
  WorkoutValidationError,
  type WorkoutStep,
  type WorkoutTarget,
  type WorkoutTargetType
} from './workouts';

export type WorkoutPresetName = 'intervals' | 'tempo' | 'long' | 'easy' | 'ftp_test';

export const WORKOUT_PRESETS: readonly WorkoutPresetName[] = [
  'intervals',
  'tempo',
  'long',
  'easy',
  'ftp_test'
];

export interface WorkoutPresetOptions {
  /** Garmin sport type key the session is for (`running`, `cycling`, …). */
  readonly sport: string;
  /** `intervals`: how many reps. Default 5. */
  readonly repeats?: number | null;
  /** Work-step length in seconds (`intervals`, `tempo`, `long`, `easy`). */
  readonly workS?: number | null;
  /** Work-step length in metres — takes precedence over `workS` when both are given. */
  readonly workM?: number | null;
  /** `intervals`: recovery between reps, seconds. Default: the work length, capped at 3 min. */
  readonly recoveryS?: number | null;
  /** Warmup/cooldown length in seconds. Default 600 (0 removes them). */
  readonly warmupS?: number | null;
  readonly cooldownS?: number | null;
  /** Target for the WORK steps, in the canonical unit for its type (see `WORKOUT_TARGET_UNITS`). */
  readonly targetType?: WorkoutTargetType | null;
  readonly targetLow?: number | null;
  readonly targetHigh?: number | null;
}

/** Build a preset's title + step tree. Throws {@link WorkoutValidationError} on a bad combination. */
export function buildWorkoutPreset(
  preset: WorkoutPresetName,
  options: WorkoutPresetOptions
): { title: string; steps: WorkoutStep[] } {
  const group = sportGroup(options.sport);
  const target = presetTarget(options);
  const warmupS = options.warmupS ?? 600;
  const cooldownS = options.cooldownS ?? 600;

  switch (preset) {
    case 'intervals': {
      const repeats = options.repeats ?? 5;
      const work = workStep(options, target, 'intervals');
      const recoveryS = options.recoveryS ?? Math.min(work.durationValue ?? 120, 180);
      return {
        title: `Interwały ${repeats}×${describeWork(work)}`,
        steps: [
          ...maybeStep('warmup', warmupS),
          {
            kind: 'repeat',
            durationType: null,
            durationValue: null,
            target: null,
            repeats,
            steps: [work, timeStep('recovery', recoveryS)],
            note: null
          },
          ...maybeStep('cooldown', cooldownS)
        ]
      };
    }
    case 'tempo': {
      const work = workStep({ ...options, workS: options.workS ?? 1200 }, target, 'tempo');
      return {
        title: `Tempo ${describeWork(work)}`,
        steps: [...maybeStep('warmup', warmupS), work, ...maybeStep('cooldown', cooldownS)]
      };
    }
    case 'long': {
      const work = workStep({ ...options, workS: options.workS ?? 5400 }, target, 'long');
      return { title: `Długi ${describeWork(work)}`, steps: [work] };
    }
    case 'easy': {
      const work = workStep({ ...options, workS: options.workS ?? 2700 }, target, 'easy');
      return { title: `Spokojnie ${describeWork(work)}`, steps: [work] };
    }
    case 'ftp_test': {
      if (group !== 'ride' && group !== 'run') {
        throw new WorkoutValidationError('the ftp_test preset only applies to a ride or a run');
      }
      const work = workStep({ ...options, workS: options.workS ?? 1200, workM: null }, target, 'ftp_test');
      return {
        title: group === 'ride' ? `Test FTP ${describeWork(work)}` : `Test progu ${describeWork(work)}`,
        steps: [...maybeStep('warmup', options.warmupS ?? 900), work, ...maybeStep('cooldown', cooldownS)]
      };
    }
    default: {
      const exhaustive: never = preset;
      throw new WorkoutValidationError(`unknown preset '${String(exhaustive)}'`);
    }
  }
}

function presetTarget(options: WorkoutPresetOptions): WorkoutTarget | null {
  const type = options.targetType ?? null;
  const low = options.targetLow ?? null;
  const high = options.targetHigh ?? null;
  if (!type || type === 'none') {
    if (low !== null || high !== null) {
      throw new WorkoutValidationError('target values need a targetType (pace, power, hr, …)');
    }
    return null;
  }
  if (low === null && high === null) {
    throw new WorkoutValidationError(`targetType '${type}' needs targetLow and/or targetHigh`);
  }
  return { type, low, high };
}

/** The work step: distance-based when `workM` is given, else time-based. */
function workStep(
  options: WorkoutPresetOptions,
  target: WorkoutTarget | null,
  preset: WorkoutPresetName
): WorkoutStep {
  const metres = options.workM ?? null;
  if (metres !== null) {
    return {
      kind: 'work',
      durationType: 'distance',
      durationValue: metres,
      target,
      repeats: null,
      steps: null,
      note: null
    };
  }
  const seconds = options.workS ?? null;
  if (seconds === null) {
    throw new WorkoutValidationError(`the ${preset} preset needs workS (seconds) or workM (metres)`);
  }
  return {
    kind: 'work',
    durationType: 'time',
    durationValue: seconds,
    target,
    repeats: null,
    steps: null,
    note: null
  };
}

function timeStep(kind: WorkoutStep['kind'], seconds: number): WorkoutStep {
  return {
    kind,
    durationType: 'time',
    durationValue: seconds,
    target: null,
    repeats: null,
    steps: null,
    note: null
  };
}

/** Warmup/cooldown, omitted entirely when the caller passes 0. */
function maybeStep(kind: 'warmup' | 'cooldown', seconds: number): WorkoutStep[] {
  return seconds > 0 ? [timeStep(kind, seconds)] : [];
}

/** "8 min" / "1 km" / "400 m" — the human part of a preset title. */
function describeWork(step: WorkoutStep): string {
  if (step.durationType === 'distance' && step.durationValue) {
    const metres = step.durationValue;
    return metres >= 1000 ? `${trimNumber(metres / 1000)} km` : `${trimNumber(metres)} m`;
  }
  const seconds = step.durationValue ?? 0;
  if (seconds >= 3600 && seconds % 3600 === 0) return `${seconds / 3600} h`;
  if (seconds >= 60) return `${trimNumber(seconds / 60)} min`;
  return `${trimNumber(seconds)} s`;
}

function trimNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1).replace(/\.0$/, '');
}
