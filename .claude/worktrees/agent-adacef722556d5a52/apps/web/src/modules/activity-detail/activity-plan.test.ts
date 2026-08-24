/**
 * The planned side of the activity verdict (spec 026, widened by spec 085): matching, flattening,
 * scoring against target bands, and the guidance that comes out of a miss.
 */
import { describe, it, expect } from 'vitest';
import type { WorkoutStep } from '$lib/workouts';
import {
  buildPlanStrip,
  buildPlannedComparison,
  complianceOf,
  flattenWorkoutSteps,
  insideBand,
  matchPlanned,
  planStepDeviation,
  planTakeaways,
  workIntensityBands,
  type ActualEffort,
  type PlannedCandidate,
  type PlannedStepComparison
} from './activity-plan';

/** A planned cycling hour: 40 km, load 100 — the yardstick every plan test bends. */
const plan = (over: Partial<PlannedCandidate>): PlannedCandidate => ({
  id: 'p1',
  day: '2026-05-01',
  kind: 'workout',
  origin: 'garmin',
  title: 'Interwały 4×8',
  sport: 'cycling',
  description: null,
  estimatedDurationS: 3600,
  estimatedDistanceM: 40000,
  targetLoad: 100,
  steps: null,
  ...over
});

const did = (over: Partial<ActualEffort>): ActualEffort => ({
  durationS: null,
  distanceM: null,
  load: null,
  paceSecPerKm: null,
  normPower: null,
  avgHr: null,
  ...over
});

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

const scalar = (over: Partial<PlannedStepComparison>): PlannedStepComparison => ({
  key: 'duration',
  target: 3600,
  targetLow: null,
  targetHigh: null,
  actual: 3600,
  met: true,
  ...over
});

describe('matchPlanned', () => {
  it('ignores a plan for a different sport family on the same day', () => {
    expect(matchPlanned([plan({ sport: 'running' })], 'cycling')).toBeNull();
    expect(matchPlanned([plan({ sport: 'gravel_cycling' })], 'cycling')?.id).toBe('p1');
  });

  it('accepts a plan that names no sport at all', () => {
    expect(matchPlanned([plan({ sport: null })], 'cycling')?.id).toBe('p1');
  });

  it('prefers a workout over a race, and the most specific target over the vaguest', () => {
    const race = plan({ id: 'race', kind: 'race' });
    const workout = plan({ id: 'workout', kind: 'workout' });
    expect(matchPlanned([race, workout], 'cycling')?.id).toBe('workout');

    const vague = plan({ id: 'vague', estimatedDistanceM: null, targetLoad: null });
    const specific = plan({ id: 'specific' });
    expect(matchPlanned([vague, specific], 'cycling')?.id).toBe('specific');
  });

  it('prefers the athlete’s own authored session over Garmin’s calendar entry (spec 085)', () => {
    const garmin = plan({ id: 'g', origin: 'garmin' });
    const authored = plan({ id: 'a', origin: 'authored', steps: [step({})] });
    expect(matchPlanned([garmin, authored], 'cycling')?.id).toBe('a');
    expect(matchPlanned([authored, garmin], 'cycling')?.id).toBe('a');
  });

  it('lets origin outrank kind — an authored workout beats a Garmin workout with more targets', () => {
    const garmin = plan({ id: 'g', origin: 'garmin' });
    const authored = plan({
      id: 'a',
      origin: 'authored',
      estimatedDistanceM: null,
      targetLoad: null,
      steps: [step({})]
    });
    expect(matchPlanned([garmin, authored], 'cycling')?.id).toBe('a');
  });

  it('still refuses an authored plan for another sport', () => {
    const authored = plan({ id: 'a', origin: 'authored', sport: 'lap_swimming' });
    expect(matchPlanned([authored], 'cycling')).toBeNull();
  });
});

describe('flattenWorkoutSteps', () => {
  it('expands a repeat block into its repetitions, in order', () => {
    const flat = flattenWorkoutSteps([
      step({ kind: 'warmup', durationValue: 900 }),
      step({
        kind: 'repeat',
        durationType: null,
        durationValue: null,
        repeats: 3,
        steps: [step({ kind: 'work', durationValue: 480 }), step({ kind: 'recovery', durationValue: 120 })]
      }),
      step({ kind: 'cooldown', durationValue: 600 })
    ]);

    expect(flat.map((s) => s.kind)).toEqual([
      'warmup',
      'work',
      'recovery',
      'work',
      'recovery',
      'work',
      'recovery',
      'cooldown'
    ]);
    expect(flat.map((s) => s.index)).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
    // Each expanded step knows which repetition it belongs to; top-level steps do not.
    expect(flat.map((s) => s.repeatIndex)).toEqual([null, 1, 1, 2, 2, 3, 3, null]);
    expect(flat[1]?.repeatTotal).toBe(3);
  });

  it('resolves the extent of a step as far as it can be known, and no further', () => {
    const flat = flattenWorkoutSteps([
      step({ durationType: 'time', durationValue: 600 }),
      // 1 km at 5:00/km → a knowable 300 s.
      step({
        durationType: 'distance',
        durationValue: 1000,
        target: { type: 'pace', low: 300, high: 300 }
      }),
      // 1 km with no pace target → distance known, time not.
      step({ durationType: 'distance', durationValue: 1000, target: null }),
      step({ durationType: 'lap', durationValue: null })
    ]);

    expect(flat.map((s) => s.plannedS)).toEqual([600, 300, null, null]);
    expect(flat.map((s) => s.plannedM)).toEqual([null, 1000, 1000, null]);
  });
});

describe('workIntensityBands', () => {
  it('reads the band off the WORK steps only', () => {
    const bands = workIntensityBands([
      step({ kind: 'warmup', target: { type: 'hr', low: 100, high: 120 } }),
      step({ kind: 'work', target: { type: 'hr', low: 160, high: 175 } }),
      step({ kind: 'recovery', target: { type: 'hr', low: 110, high: 130 } })
    ]);
    expect(bands).toEqual([{ type: 'hr', low: 160, high: 175 }]);
  });

  it('collapses several work steps into the widest band per target type', () => {
    const bands = workIntensityBands([
      step({ kind: 'work', target: { type: 'power', low: 250, high: 270 } }),
      step({ kind: 'work', target: { type: 'power', low: 240, high: 300 } }),
      step({ kind: 'work', target: { type: 'hr', low: 150, high: null } })
    ]);
    expect(bands).toEqual([
      { type: 'power', low: 240, high: 300 },
      { type: 'hr', low: 150, high: null }
    ]);
  });

  it('sees through a repeat block', () => {
    const bands = workIntensityBands([
      step({
        kind: 'repeat',
        durationType: null,
        durationValue: null,
        repeats: 4,
        steps: [
          step({ kind: 'work', target: { type: 'pace', low: 240, high: 250 } }),
          step({ kind: 'recovery', target: { type: 'pace', low: 400, high: 420 } })
        ]
      })
    ]);
    expect(bands).toEqual([{ type: 'pace', low: 240, high: 250 }]);
  });

  it('contributes nothing for a step with no target', () => {
    expect(workIntensityBands([step({ kind: 'work', target: null })])).toEqual([]);
  });
});

describe('buildPlanStrip', () => {
  const flat = (steps: WorkoutStep[]) => flattenWorkoutSteps(steps);

  it('lays the blocks end to end on the elapsed axis', () => {
    const strip = buildPlanStrip(
      flat([
        step({ kind: 'warmup', durationValue: 600 }),
        step({ kind: 'work', durationValue: 300 }),
        step({ kind: 'cooldown', durationValue: 300 })
      ])
    );
    expect(strip?.blocks.map((b) => [b.startS, b.endS])).toEqual([
      [0, 600],
      [600, 900],
      [900, 1200]
    ]);
    expect(strip?.totalS).toBe(1200);
    expect(strip?.markers).toEqual([]);
  });

  it('draws a lap-terminated step as a marker, never as a block of invented width', () => {
    const strip = buildPlanStrip(
      flat([
        step({ kind: 'warmup', durationValue: 600 }),
        step({ kind: 'work', durationType: 'lap', durationValue: null }),
        step({ kind: 'cooldown', durationValue: 300 })
      ])
    );
    expect(strip?.blocks).toHaveLength(2);
    expect(strip?.markers).toEqual([{ index: 1, kind: 'work', atS: 600, durationType: 'lap', target: null }]);
    // The marker consumes no time, so the cool-down still starts where the warm-up ended.
    expect(strip?.blocks[1]?.startS).toBe(600);
  });

  it('is null when nothing in the plan has a knowable extent', () => {
    expect(buildPlanStrip(flat([step({ durationType: 'lap', durationValue: null })]))).toBeNull();
    expect(buildPlanStrip([])).toBeNull();
  });
});

describe('band scoring', () => {
  it('counts the band edges as inside it', () => {
    expect(insideBand(250, 250, 270)).toBe(true);
    expect(insideBand(270, 250, 270)).toBe(true);
    expect(insideBand(249, 250, 270)).toBe(false);
    expect(insideBand(271, 250, 270)).toBe(false);
  });

  it('leaves an open end open', () => {
    expect(insideBand(9000, 250, null)).toBe(true);
    expect(insideBand(1, null, 270)).toBe(true);
  });

  it('scores an intensity step inside the band as fully on plan', () => {
    const authored = plan({
      origin: 'authored',
      estimatedDurationS: null,
      estimatedDistanceM: null,
      targetLoad: null,
      steps: [step({ kind: 'work', target: { type: 'power', low: 250, high: 270 } })]
    });
    const result = buildPlannedComparison(authored, did({ normPower: 268 }));
    const power = result.steps.find((s) => s.key === 'power');
    expect(power?.met).toBe(true);
    expect(power?.targetLow).toBe(250);
    expect(power?.targetHigh).toBe(270);
    expect(result.compliancePct).toBe(100);
  });

  it('does NOT apply the ±10% rule on top of a band', () => {
    const authored = plan({
      origin: 'authored',
      estimatedDurationS: null,
      estimatedDistanceM: null,
      targetLoad: null,
      steps: [step({ kind: 'work', target: { type: 'power', low: 250, high: 270 } })]
    });
    // 275 W is 1.9% over the top of the band — inside a ±10% tolerance, outside the band.
    const result = buildPlannedComparison(authored, did({ normPower: 275 }));
    expect(result.steps.find((s) => s.key === 'power')?.met).toBe(false);
  });

  it('measures deviation from the breached edge, not from the band’s middle', () => {
    const outside = scalar({
      key: 'hr',
      target: 165,
      targetLow: 160,
      targetHigh: 170,
      actual: 176,
      met: false
    });
    // 176 against a top edge of 170 → (176 − 170) / 170.
    expect(planStepDeviation(outside)).toBeCloseTo(6 / 170, 6);
    const inside = scalar({
      key: 'hr',
      target: 165,
      targetLow: 160,
      targetHigh: 170,
      actual: 162,
      met: true
    });
    expect(planStepDeviation(inside)).toBe(0);
  });

  it('leaves an intensity step unscored when the session did not record it', () => {
    const authored = plan({
      origin: 'authored',
      estimatedDurationS: null,
      estimatedDistanceM: null,
      targetLoad: null,
      steps: [step({ kind: 'work', target: { type: 'power', low: 250, high: 270 } })]
    });
    const result = buildPlannedComparison(authored, did({ normPower: null }));
    expect(result.steps.find((s) => s.key === 'power')?.met).toBeNull();
    expect(result.compliancePct).toBeNull();
  });

  it('ignores target types the page holds no actual for', () => {
    const authored = plan({
      origin: 'authored',
      steps: [step({ kind: 'work', target: { type: 'cadence', low: 85, high: 95 } })]
    });
    const result = buildPlannedComparison(authored, did({ durationS: 3600 }));
    expect(result.steps.map((s) => s.key)).not.toContain('cadence');
  });
});

describe('buildPlannedComparison', () => {
  it('only scores the targets the plan actually set', () => {
    const result = buildPlannedComparison(plan({ estimatedDistanceM: null, targetLoad: null }), {
      ...did({}),
      durationS: 3600,
      distanceM: 40000,
      load: 100
    });
    expect(result.steps.map((s) => s.key)).toEqual(['duration']);
    expect(result.targetDistanceM).toBeNull();
  });

  it('marks a target missed once it is more than a tenth out', () => {
    const result = buildPlannedComparison(plan({}), did({ durationS: 1800, distanceM: 40000, load: 100 }));
    expect(result.steps.find((s) => s.key === 'duration')?.met).toBe(false);
    expect(result.steps.find((s) => s.key === 'distance')?.met).toBe(true);
    expect(result.compliancePct).toBe(83); // (0.5 + 1 + 1) / 3
  });

  it('penalises overshooting as much as undershooting', () => {
    const over = buildPlannedComparison(
      plan({ estimatedDistanceM: null, targetLoad: null }),
      did({ durationS: 5400 }) // 150% of plan
    );
    expect(over.compliancePct).toBe(50);
    expect(over.steps[0]?.met).toBe(false);
  });

  it('leaves a target unscored when nothing comparable was recorded', () => {
    const result = buildPlannedComparison(plan({}), did({}));
    expect(result.steps.every((s) => s.met === null)).toBe(true);
    expect(result.compliancePct).toBeNull();
  });

  it('averages scalar and intensity rows into one adherence figure', () => {
    const authored = plan({
      origin: 'authored',
      estimatedDurationS: 3600,
      estimatedDistanceM: null,
      targetLoad: null,
      steps: [step({ kind: 'work', target: { type: 'hr', low: 150, high: 160 } })]
    });
    // Exactly on time, heart rate inside the band → both rows perfect.
    expect(buildPlannedComparison(authored, did({ durationS: 3600, avgHr: 155 })).compliancePct).toBe(100);
    // Half the time, heart rate still inside → (0.5 + 1) / 2.
    expect(buildPlannedComparison(authored, did({ durationS: 1800, avgHr: 155 })).compliancePct).toBe(75);
  });

  it('carries the plan’s origin through to the comparison', () => {
    expect(buildPlannedComparison(plan({ origin: 'authored' }), did({})).origin).toBe('authored');
    expect(buildPlannedComparison(plan({}), did({})).origin).toBe('garmin');
  });
});

describe('complianceOf', () => {
  it('is null when nothing measurable was set', () => {
    expect(complianceOf([])).toBeNull();
    expect(complianceOf([scalar({ actual: null, met: null })])).toBeNull();
  });

  it('mixes scalar and band rows, and never goes below zero', () => {
    const rows: PlannedStepComparison[] = [
      scalar({ key: 'duration', target: 3600, actual: 3600, met: true }),
      scalar({ key: 'power', target: 260, targetLow: 250, targetHigh: 270, actual: 500, met: false })
    ];
    // The band row is 85% over its top edge of 270 → 0.148, averaged with a perfect 1.
    expect(complianceOf(rows)).toBe(57);
  });
});

describe('planTakeaways', () => {
  const planFor = (steps: PlannedStepComparison[]) => ({
    workoutId: 'p1',
    name: 'Sesja',
    scheduledDay: '2026-05-01',
    kind: 'workout' as const,
    origin: 'authored' as const,
    description: null,
    targetDurationS: null,
    targetDistanceM: null,
    targetLoad: null,
    steps,
    compliancePct: complianceOf(steps)
  });

  it('says nothing when the plan was met', () => {
    expect(planTakeaways(planFor([scalar({ actual: 3600, met: true })]))).toEqual([]);
  });

  it('says nothing when there is no plan at all', () => {
    expect(planTakeaways(null)).toEqual([]);
  });

  it('says nothing when nothing was measurable', () => {
    expect(planTakeaways(planFor([scalar({ actual: null, met: null })]))).toEqual([]);
  });

  it('names the direction of a scalar miss', () => {
    const over = planTakeaways(
      planFor([scalar({ key: 'distance', target: 10000, actual: 15000, met: false })])
    );
    expect(over).toEqual([{ key: 'plan.takeaway.over', metric: 'distance', pct: 50 }]);

    const under = planTakeaways(
      planFor([scalar({ key: 'distance', target: 10000, actual: 6000, met: false })])
    );
    expect(under).toEqual([{ key: 'plan.takeaway.under', metric: 'distance', pct: 40 }]);
  });

  it('calls power above the band harder, and below it easier', () => {
    const hard = planTakeaways(
      planFor([
        scalar({ key: 'power', target: 260, targetLow: 250, targetHigh: 270, actual: 405, met: false })
      ])
    );
    expect(hard).toEqual([{ key: 'plan.takeaway.harder', metric: 'power', pct: 50 }]);

    const easy = planTakeaways(
      planFor([
        scalar({ key: 'power', target: 260, targetLow: 250, targetHigh: 270, actual: 200, met: false })
      ])
    );
    expect(easy[0]?.key).toBe('plan.takeaway.easier');
  });

  it('inverts the direction for pace, where a lower number is a harder session', () => {
    // 4:00/km against a band that asked for 5:00–5:30 — faster, so harder.
    const faster = planTakeaways(
      planFor([
        scalar({ key: 'pace', target: 315, targetLow: 300, targetHigh: 330, actual: 240, met: false })
      ])
    );
    expect(faster).toEqual([{ key: 'plan.takeaway.harder', metric: 'pace', pct: 20 }]);

    const slower = planTakeaways(
      planFor([
        scalar({ key: 'pace', target: 315, targetLow: 300, targetHigh: 330, actual: 396, met: false })
      ])
    );
    expect(slower[0]?.key).toBe('plan.takeaway.easier');
  });

  it('keeps at most three, worst miss first', () => {
    const takeaways = planTakeaways(
      planFor([
        scalar({ key: 'duration', target: 3600, actual: 4000, met: false }), // +11%
        scalar({ key: 'distance', target: 10000, actual: 20000, met: false }), // +100%
        scalar({ key: 'load', target: 100, actual: 150, met: false }), // +50%
        scalar({ key: 'hr', target: 150, targetLow: 140, targetHigh: 160, actual: 200, met: false }) // +25%
      ])
    );
    expect(takeaways.map((t) => t.metric)).toEqual(['distance', 'load', 'hr']);
  });

  it('does not raise a sentence over a miss that rounds to nothing', () => {
    // Half a percent past the band edge: outside it, but "o 0%" is not advice.
    const takeaways = planTakeaways(
      planFor([
        scalar({ key: 'hr', target: 150, targetLow: 140, targetHigh: 160, actual: 160.4, met: false })
      ])
    );
    expect(takeaways).toEqual([]);
  });

  it('is deterministic regardless of the order the rows arrive in', () => {
    const rows = [
      scalar({ key: 'duration', target: 3600, actual: 5400, met: false }),
      scalar({ key: 'distance', target: 10000, actual: 15000, met: false })
    ];
    expect(planTakeaways(planFor([...rows]))).toEqual(planTakeaways(planFor([...rows].reverse())));
  });
});
