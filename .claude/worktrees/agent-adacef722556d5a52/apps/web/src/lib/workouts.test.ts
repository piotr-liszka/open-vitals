/**
 * Workout model validation (spec 050). This is the single gate every authoring path goes through, and
 * the last place a nonsense session can be stopped before it is stored and pushed to a watch — so the
 * suite is written around what would actually reach Garmin wrong.
 */
import { describe, it, expect } from 'vitest';
import {
  composeWorkoutDescription,
  countWorkoutSteps,
  estimateWorkoutDistanceM,
  estimateWorkoutDurationS,
  normalizeWorkout,
  WORKOUT_LIMITS,
  WORKOUT_PROVENANCE_LINE,
  WorkoutValidationError,
  type WorkoutStep
} from './workouts';

function step(over: Partial<WorkoutStep> = {}): WorkoutStep {
  return {
    kind: 'work',
    durationType: 'time',
    durationValue: 600,
    target: null,
    repeats: null,
    steps: null,
    note: null,
    ...over
  };
}

const RUN_INTERVALS: WorkoutStep[] = [
  step({ kind: 'warmup' }),
  step({
    kind: 'repeat',
    durationType: null,
    durationValue: null,
    repeats: 5,
    steps: [
      step({ durationType: 'distance', durationValue: 1000, target: { type: 'pace', low: 240, high: 250 } }),
      step({ kind: 'recovery', durationValue: 120 })
    ]
  }),
  step({ kind: 'cooldown' })
];

describe('normalizeWorkout', () => {
  it('accepts a nested run session and returns it canonicalised', () => {
    const result = normalizeWorkout({ sport: 'running', title: '  5x1km  ', steps: RUN_INTERVALS });

    expect(result.title).toBe('5x1km');
    expect(result.sport).toBe('running');
    expect(result.steps[1]?.repeats).toBe(5);
    expect(result.steps[1]?.steps).toHaveLength(2);
    expect(countWorkoutSteps(result.steps)).toBe(5);
  });

  it('defaults a step with no duration type to the lap button, with no value', () => {
    const result = normalizeWorkout({
      sport: 'strength_training',
      title: 'Siła',
      steps: [step({ durationType: null, durationValue: null })]
    });

    expect(result.steps[0]?.durationType).toBe('lap');
    expect(result.steps[0]?.durationValue).toBeNull();
  });

  it('rejects a sport the app does not know', () => {
    expect(() => normalizeWorkout({ sport: 'quidditch', title: 'x', steps: [step()] })).toThrow(
      WorkoutValidationError
    );
  });

  it('rejects a target that does not belong to the sport', () => {
    // The mistake worth catching: a power target on a walk is meaningless on the watch.
    expect(() =>
      normalizeWorkout({
        sport: 'walking',
        title: 'Marsz',
        steps: [step({ target: { type: 'power', low: 200, high: null } })]
      })
    ).toThrow(/does not apply/);

    // …and pace on a strength session.
    expect(() =>
      normalizeWorkout({
        sport: 'strength_training',
        title: 'Siła',
        steps: [step({ target: { type: 'pace', low: 300, high: null } })]
      })
    ).toThrow(/does not apply/);
  });

  it('accepts the targets that DO belong to the sport', () => {
    expect(() =>
      normalizeWorkout({
        sport: 'cycling',
        title: 'Tempo',
        steps: [step({ target: { type: 'power', low: 240, high: 260 } })]
      })
    ).not.toThrow();
    expect(() =>
      normalizeWorkout({
        sport: 'trail_running',
        title: 'Tempo',
        steps: [step({ target: { type: 'hr', low: 150, high: 160 } })]
      })
    ).not.toThrow();
  });

  it('rejects an inverted or empty target range', () => {
    expect(() =>
      normalizeWorkout({
        sport: 'cycling',
        title: 'x',
        steps: [step({ target: { type: 'power', low: 300, high: 200 } })]
      })
    ).toThrow(/low above high/);
    expect(() =>
      normalizeWorkout({
        sport: 'cycling',
        title: 'x',
        steps: [step({ target: { type: 'power', low: null, high: null } })]
      })
    ).toThrow(/needs a low and\/or high/);
  });

  it('rejects a duration that is missing, zero or absurd', () => {
    const bad = (over: Partial<WorkoutStep>) => () =>
      normalizeWorkout({ sport: 'running', title: 'x', steps: [step(over)] });

    expect(bad({ durationValue: null })).toThrow(/positive durationValue/);
    expect(bad({ durationValue: 0 })).toThrow(/positive durationValue/);
    expect(bad({ durationValue: 90_000 })).toThrow(/limit/);
    expect(bad({ durationType: 'distance', durationValue: 900_000 })).toThrow(/limit/);
  });

  it('rejects an unknown step kind and an unknown duration type', () => {
    expect(() =>
      normalizeWorkout({
        sport: 'running',
        title: 'x',
        steps: [step({ kind: 'sprintish' as WorkoutStep['kind'] })]
      })
    ).toThrow(/unknown step kind/);
    expect(() =>
      normalizeWorkout({
        sport: 'running',
        title: 'x',
        steps: [step({ durationType: 'furlongs' as WorkoutStep['durationType'] })]
      })
    ).toThrow(/unknown duration type/);
  });

  it('rejects a broken or nested repeat block', () => {
    const repeat = (over: Partial<WorkoutStep>) => () =>
      normalizeWorkout({
        sport: 'running',
        title: 'x',
        steps: [step({ kind: 'repeat', durationType: null, durationValue: null, repeats: 3, ...over })]
      });

    expect(repeat({ steps: [] })).toThrow(/at least one child/);
    expect(repeat({ repeats: 0, steps: [step()] })).toThrow(/positive whole/);
    expect(repeat({ repeats: 2.5, steps: [step()] })).toThrow(/positive whole/);
    expect(
      repeat({
        steps: [
          step({ kind: 'repeat', durationType: null, durationValue: null, repeats: 2, steps: [step()] })
        ]
      })
    ).toThrow(/cannot be nested/);
  });

  it('requires a title and at least one step', () => {
    expect(() => normalizeWorkout({ sport: 'running', title: '   ', steps: [step()] })).toThrow(
      /title is required/
    );
    expect(() => normalizeWorkout({ sport: 'running', title: 'x', steps: [] })).toThrow(/at least one step/);
  });

  it('drops a blank note and keeps a real one', () => {
    const result = normalizeWorkout({
      sport: 'running',
      title: 'x',
      steps: [step({ note: '  oddech  ' })],
      note: '   '
    });
    expect(result.note).toBeNull();
    expect(result.steps[0]?.note).toBe('oddech');
  });
});

describe('workout estimates', () => {
  it('adds up time steps and repeat blocks', () => {
    // 600 warmup + 5 × (1 km at ~4:05/km + 120 recovery) + 600 cooldown
    const seconds = estimateWorkoutDurationS(RUN_INTERVALS)!;
    const perRep = 1000 / (1000 / 245) + 120;
    expect(seconds).toBe(Math.round(600 + 5 * perRep + 600));
    expect(estimateWorkoutDistanceM(RUN_INTERVALS)).toBe(5000);
  });

  it('returns null rather than a confident guess when nothing is knowable', () => {
    const lapOnly = [step({ durationType: 'lap', durationValue: null })];
    expect(estimateWorkoutDurationS(lapOnly)).toBeNull();
    expect(estimateWorkoutDistanceM(lapOnly)).toBeNull();
  });

  it('ignores a distance step with no pace/speed target when timing the session', () => {
    const noTarget = [step({ durationType: 'distance', durationValue: 5000 })];
    expect(estimateWorkoutDurationS(noTarget)).toBeNull();
    expect(estimateWorkoutDistanceM(noTarget)).toBe(5000);
  });
});

describe('composeWorkoutDescription (spec 082)', () => {
  it('puts the note above the provenance line, separated by a blank line', () => {
    expect(composeWorkoutDescription('Easy Z2, HR <=143')).toBe(
      `Easy Z2, HR <=143\n\n${WORKOUT_PROVENANCE_LINE}`
    );
  });

  it('sends the provenance line alone when there is no note', () => {
    // Not an empty string: a session with no note is still recognisably ours in Connect.
    for (const empty of [null, undefined, '', '   \n ']) {
      expect(composeWorkoutDescription(empty)).toBe(WORKOUT_PROVENANCE_LINE);
    }
  });

  it('trims the note rather than passing the athlete’s stray whitespace through', () => {
    expect(composeWorkoutDescription('  progi  ')).toBe(`progi\n\n${WORKOUT_PROVENANCE_LINE}`);
  });

  it('truncates the NOTE and keeps the provenance line, never the other way round', () => {
    const composed = composeWorkoutDescription('x'.repeat(WORKOUT_LIMITS.maxDescription * 2));

    expect(composed.length).toBeLessThanOrEqual(WORKOUT_LIMITS.maxDescription);
    expect(composed.endsWith(WORKOUT_PROVENANCE_LINE)).toBe(true);
    expect(composed).toContain('…');
  });

  it('stays inside the sidecar’s own bound for the longest note the editor allows', () => {
    // maxNote is what the editor caps at; if these two ever drift, the push 422s instead of landing.
    const longest = composeWorkoutDescription('n'.repeat(WORKOUT_LIMITS.maxNote));

    expect(longest.length).toBeLessThanOrEqual(WORKOUT_LIMITS.maxDescription);
    expect(longest).not.toContain('…');
  });
});
