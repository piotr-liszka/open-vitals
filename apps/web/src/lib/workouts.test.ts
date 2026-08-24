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
  workoutPrescribedAxis,
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

  it('counts the metres a time step covers at its pace/speed target', () => {
    // 10 min at 5:00/km → 2 km; 10 min at 12 km/h → 2 km.
    const paced = [step({ durationValue: 600, target: { type: 'pace', low: 300, high: 300 } })];
    expect(estimateWorkoutDistanceM(paced)).toBe(2000);

    const sped = [step({ durationValue: 600, target: { type: 'speed', low: 12, high: 12 } })];
    expect(estimateWorkoutDistanceM(sped)).toBe(2000);

    // A band uses its middle, exactly as the duration estimate does.
    const band = [step({ durationValue: 600, target: { type: 'pace', low: 350, high: 375 } })];
    expect(estimateWorkoutDistanceM(band)).toBe(Math.round(600 * (1000 / 362.5)));
  });

  it('adds nothing for a time step whose target cannot imply a speed, without nulling the total', () => {
    // HR, cadence and no target at all say nothing about ground covered — so they contribute zero,
    // and the estimate understates. What they must NOT do is throw away the rest of the session.
    for (const target of [
      { type: 'hr', low: 140, high: 150 } as const,
      { type: 'cadence', low: 166, high: 170 } as const,
      null
    ]) {
      const steps = [
        step({ durationValue: 600, target }),
        step({ durationType: 'distance', durationValue: 3000 })
      ];
      expect(estimateWorkoutDistanceM(steps)).toBe(3000);
    }

    // On its own such a step is unknowable, like a lap step.
    expect(estimateWorkoutDistanceM([step({ durationValue: 600, target: null })])).toBeNull();
  });

  it('mixes distance and paced time steps, inside and outside a repeat block', () => {
    const mixed = [
      // 12 min jog at 6:00/km → 2000 m.
      step({ kind: 'warmup', durationValue: 720, target: { type: 'pace', low: 360, high: 360 } }),
      step({
        kind: 'repeat',
        durationType: null,
        durationValue: null,
        repeats: 4,
        steps: [
          // 400 m hard + 90 s at 6:00/km recovery → 400 + 250 = 650 m per rep.
          step({ durationType: 'distance', durationValue: 400 }),
          step({ kind: 'recovery', durationValue: 90, target: { type: 'pace', low: 360, high: 360 } })
        ]
      }),
      // 5 min cooldown with an HR band only → contributes nothing.
      step({ kind: 'cooldown', durationValue: 300, target: { type: 'hr', low: 120, high: 135 } })
    ];

    expect(estimateWorkoutDistanceM(mixed)).toBe(2000 + 4 * 650);
  });

  it('reads "Easy 5 km + kadencja" as about 5 km, not as its middle block alone', () => {
    // The athlete's real session: a 10 min jog, a 2.4 km block and a 6 min jog, all in the easy
    // band (5:50–6:15/km). Counting only the distance step reported 2400 m for a workout titled —
    // and executed as — 5 km, while the duration estimate said ~1830 s, which at that band is 5 km.
    const easy5k = [
      step({ kind: 'warmup', durationValue: 600, target: { type: 'pace', low: 350, high: 375 } }),
      step({
        kind: 'work',
        durationType: 'distance',
        durationValue: 2400,
        target: { type: 'pace', low: 350, high: 375 }
      }),
      step({ kind: 'cooldown', durationValue: 360, target: { type: 'pace', low: 350, high: 375 } })
    ];

    const metres = estimateWorkoutDistanceM(easy5k)!;
    const seconds = estimateWorkoutDurationS(easy5k)!;

    expect(metres).toBeGreaterThan(4800);
    expect(metres).toBeLessThan(5300);
    // And the two estimators now agree with each other: metres ÷ mid-pace speed ≈ seconds.
    expect(Math.abs(metres / (1000 / 362.5) - seconds)).toBeLessThan(2);
  });

  it('leaves a distance-only workout exactly as it was', () => {
    const distanceOnly = [
      step({ durationType: 'distance', durationValue: 1000 }),
      step({
        kind: 'repeat',
        durationType: null,
        durationValue: null,
        repeats: 3,
        steps: [step({ durationType: 'distance', durationValue: 800 })]
      }),
      step({ durationType: 'lap', durationValue: null })
    ];
    expect(estimateWorkoutDistanceM(distanceOnly)).toBe(3400);
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

describe('workoutPrescribedAxis', () => {
  const paced = (type: 'time' | 'distance', value: number): WorkoutStep => ({
    kind: 'work',
    durationType: type,
    durationValue: value,
    // 6:00/km — the athlete's easy band.
    target: { type: 'pace', low: 360, high: 360 },
    repeats: null,
    steps: null,
    note: null
  });

  it('calls a plan written mostly in time a TIME plan, even when it has a distance block', () => {
    // "Easy 5 km + kadencja 166": paced 10 min warm-up, 2400 m, paced 6 min cool-down. The distance
    // block is 870 s of it against 960 s of time blocks, so the session is prescribed in time.
    expect(workoutPrescribedAxis([paced('time', 600), paced('distance', 2400), paced('time', 360)])).toBe(
      'time'
    );
  });

  it('calls a plan written mostly in distance a DISTANCE plan', () => {
    // "Long run 10 km" with a short paced warm-up: the 10 km dwarfs it.
    expect(workoutPrescribedAxis([paced('time', 300), paced('distance', 10_000)])).toBe('distance');
  });

  it('is time for a plan with no distance step at all', () => {
    expect(workoutPrescribedAxis([paced('time', 2700)])).toBe('time');
  });

  it('is distance for a plan with no time step at all', () => {
    expect(workoutPrescribedAxis([paced('distance', 5000)])).toBe('distance');
  });

  it('counts repeat blocks by their repetitions', () => {
    // 5 × (1 km + 2 min jog): 5 × 360 s of distance against 5 × 120 s of time.
    const block: WorkoutStep = {
      kind: 'repeat',
      durationType: null,
      durationValue: null,
      target: null,
      repeats: 5,
      steps: [paced('distance', 1000), paced('time', 120)],
      note: null
    };
    expect(workoutPrescribedAxis([block])).toBe('distance');
  });

  it('falls back to distance when a distance step has no pace to convert', () => {
    const untargeted: WorkoutStep = {
      kind: 'work',
      durationType: 'distance',
      durationValue: 3000,
      target: null,
      repeats: null,
      steps: null,
      note: null
    };
    expect(workoutPrescribedAxis([untargeted, paced('time', 3600)])).toBe('distance');
  });

  it('is null when nothing measurable is prescribed', () => {
    const lap: WorkoutStep = {
      kind: 'work',
      durationType: 'lap',
      durationValue: null,
      target: null,
      repeats: null,
      steps: null,
      note: null
    };
    expect(workoutPrescribedAxis([lap])).toBeNull();
  });
});
