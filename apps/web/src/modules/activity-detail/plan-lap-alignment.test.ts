/**
 * Which lap was which planned step (spec 091).
 *
 * The cases that matter are the ones spec 085 refused to attempt: a clean interval session, the same
 * session with one lap press missed, and a session whose laps have nothing to do with the plan. The
 * third one is the point of the whole file — it has to come back saying so.
 */
import { describe, it, expect } from 'vitest';
import type { WorkoutStep } from '$lib/workouts';
import { flattenWorkoutSteps } from './activity-plan';
import { alignPlanToLaps, type LapEffort } from './plan-lap-alignment';

const step = (over: Partial<WorkoutStep>): WorkoutStep => ({
  kind: 'work',
  durationType: 'time',
  durationValue: 600,
  target: null,
  repeats: null,
  steps: null,
  note: null,
  ...over
});

/** `10 min rozgrzewki + 5 × (1 km + 400 m) + 5 min schłodzenia` — the athlete's normal Tuesday. */
const INTERVALS: WorkoutStep[] = [
  step({ kind: 'warmup', durationType: 'time', durationValue: 600 }),
  step({
    kind: 'repeat',
    durationType: null,
    durationValue: null,
    repeats: 5,
    steps: [
      step({
        kind: 'work',
        durationType: 'distance',
        durationValue: 1000,
        target: { type: 'pace', low: 240, high: 250 }
      }),
      step({ kind: 'recovery', durationType: 'distance', durationValue: 400 })
    ]
  }),
  step({ kind: 'cooldown', durationType: 'time', durationValue: 300 })
];

let nextLap = 1;
const lap = (over: Partial<LapEffort>): LapEffort => ({ index: nextLap++, ...over });
const resetLaps = (): void => {
  nextLap = 1;
};

/** The session above, lap-pressed exactly: one lap per planned step. */
function cleanLaps(): LapEffort[] {
  resetLaps();
  const laps: LapEffort[] = [lap({ durationS: 600, distanceM: 2000 })];
  for (let i = 0; i < 5; i++) {
    laps.push(lap({ durationS: 245, distanceM: 1000, avgHr: 168 }));
    laps.push(lap({ durationS: 168, distanceM: 400, avgHr: 140 }));
  }
  laps.push(lap({ durationS: 300, distanceM: 900 }));
  return laps;
}

describe('alignPlanToLaps', () => {
  it('pairs one step with one lap on a cleanly pressed interval session', () => {
    const steps = flattenWorkoutSteps(INTERVALS);
    const result = alignPlanToLaps(steps, cleanLaps());

    expect(result.status).toBe('aligned');
    expect(result.confidentSteps).toBe(12);
    expect(result.steps.map((s) => s.lapIndices)).toEqual([
      [1],
      [2],
      [3],
      [4],
      [5],
      [6],
      [7],
      [8],
      [9],
      [10],
      [11],
      [12]
    ]);
    expect(result.steps.every((s) => s.confidence === 'exact')).toBe(true);
  });

  it('measures each step on its OWN laps, in the units the step was written in', () => {
    const steps = flattenWorkoutSteps(INTERVALS);
    const firstRep = alignPlanToLaps(steps, cleanLaps()).steps[1]!;

    expect(firstRep.distanceM).toBe(1000);
    expect(firstRep.durationS).toBe(245);
    expect(firstRep.paceSecPerKm).toBe(245);
    expect(firstRep.avgHr).toBe(168);
    // Placed on the elapsed axis so the strip can draw it against the charts.
    expect([firstRep.startS, firstRep.endS]).toEqual([600, 845]);
  });

  it('costs a missed lap press ONE step, and does not shift the rest of the session', () => {
    resetLaps();
    // The athlete forgot to press lap after the warm-up, so it and the first rep are one lap.
    const laps: LapEffort[] = [lap({ durationS: 845, distanceM: 3000 })];
    laps.push(lap({ durationS: 168, distanceM: 400 }));
    for (let i = 0; i < 4; i++) {
      laps.push(lap({ durationS: 245, distanceM: 1000 }));
      laps.push(lap({ durationS: 168, distanceM: 400 }));
    }
    laps.push(lap({ durationS: 300, distanceM: 900 }));

    const result = alignPlanToLaps(flattenWorkoutSteps(INTERVALS), laps);

    expect(result.status).toBe('aligned');
    // The merged lap belongs to the warm-up; the rep inside it cannot be told apart and says so.
    expect(result.steps[0]?.lapIndices).toEqual([1]);
    expect(result.steps[0]?.confidence).toBe('approximate');
    expect(result.steps[1]?.confidence).toBe('none');
    expect(result.steps[1]?.lapIndices).toEqual([]);
    // Everything after it still lands on its own lap — no cascade.
    expect(result.steps.slice(2).map((s) => s.lapIndices)).toEqual([
      [2],
      [3],
      [4],
      [5],
      [6],
      [7],
      [8],
      [9],
      [10],
      [11]
    ]);
    expect(result.steps.slice(2).every((s) => s.confidence === 'exact')).toBe(true);
  });

  it('lets one planned step span several laps', () => {
    // `10 min + 10 km + 5 min` run with the watch auto-lapping every kilometre.
    const plan = flattenWorkoutSteps([
      step({ kind: 'warmup', durationType: 'time', durationValue: 600 }),
      step({ kind: 'work', durationType: 'distance', durationValue: 10000 }),
      step({ kind: 'cooldown', durationType: 'time', durationValue: 300 })
    ]);
    resetLaps();
    const laps: LapEffort[] = [lap({ durationS: 600, distanceM: 1800 })];
    for (let i = 0; i < 10; i++) laps.push(lap({ durationS: 300, distanceM: 1000 }));
    laps.push(lap({ durationS: 300, distanceM: 950 }));

    const result = alignPlanToLaps(plan, laps);
    expect(result.status).toBe('aligned');
    expect(result.steps[1]?.lapIndices).toEqual([2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
    expect(result.steps[1]?.distanceM).toBe(10000);
    expect(result.steps[1]?.confidence).toBe('exact');
  });

  it('reports none and pairs nothing when the laps bear no relation to the plan', () => {
    // Three 4 km blocks against a twelve-step interval plan: nothing here is those steps.
    resetLaps();
    const laps = [1, 2, 3].map(() => lap({ durationS: 1200, distanceM: 4000 }));

    const result = alignPlanToLaps(flattenWorkoutSteps(INTERVALS), laps);
    expect(result.status).toBe('unreconciled');
    expect(result.confidentSteps).toBe(0);
    expect(result.steps.every((s) => s.confidence === 'none')).toBe(true);
    expect(result.steps.every((s) => s.lapIndices.length === 0)).toBe(true);
  });

  it('says "no laps" rather than "unreconciled" when the activity has none', () => {
    const result = alignPlanToLaps(flattenWorkoutSteps(INTERVALS), []);
    expect(result.status).toBe('no-laps');
    expect(result.lapCount).toBe(0);
    expect(result.steps).toHaveLength(12);
    expect(result.steps.every((s) => s.confidence === 'none')).toBe(true);
  });

  it('is generous about running long and strict about falling short', () => {
    const rep = flattenWorkoutSteps([step({ kind: 'work', durationType: 'distance', durationValue: 1000 })]);

    resetLaps();
    const over = alignPlanToLaps(rep, [lap({ durationS: 250, distanceM: 1040 })]);
    expect(over.status).toBe('aligned');
    expect(over.steps[0]?.confidence).toBe('exact');

    resetLaps();
    const short = alignPlanToLaps(rep, [lap({ durationS: 100, distanceM: 400 })]);
    expect(short.status).toBe('unreconciled');
  });

  it('takes a lap-terminated step at its word: one lap press is the step', () => {
    const plan = flattenWorkoutSteps([
      step({ kind: 'warmup', durationType: 'lap', durationValue: null }),
      step({ kind: 'work', durationType: 'time', durationValue: 600 })
    ]);
    resetLaps();
    const result = alignPlanToLaps(plan, [
      lap({ durationS: 420, distanceM: 1200 }),
      lap({ durationS: 600, distanceM: 2400 })
    ]);

    expect(result.status).toBe('aligned');
    expect(result.steps.map((s) => s.lapIndices)).toEqual([[1], [2]]);
    expect(result.steps.map((s) => s.confidence)).toEqual(['exact', 'exact']);
  });

  it('places a step whose laps do not record its axis, but never confidently', () => {
    // A treadmill session: laps carry time, the plan asked for metres.
    const plan = flattenWorkoutSteps([step({ kind: 'work', durationType: 'distance', durationValue: 1000 })]);
    resetLaps();
    const result = alignPlanToLaps(plan, [lap({ durationS: 245 })]);
    expect(result.status).toBe('unreconciled');
  });

  it('is deterministic and pairs nothing at all when there is no plan', () => {
    const laps = cleanLaps();
    const a = alignPlanToLaps(flattenWorkoutSteps(INTERVALS), laps);
    const b = alignPlanToLaps(flattenWorkoutSteps(INTERVALS), laps);
    expect(a).toEqual(b);
    expect(alignPlanToLaps([], laps).steps).toEqual([]);
  });
});
