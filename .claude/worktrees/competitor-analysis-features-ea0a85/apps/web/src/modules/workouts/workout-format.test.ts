import { describe, it, expect } from 'vitest';
import type { WorkoutStep } from '$lib/workouts';
import {
  describeDuration,
  describeStep,
  describeSteps,
  describeTarget,
  fmtClock,
  fmtDistance
} from './workout-format';

const step = (over: Partial<WorkoutStep> = {}): WorkoutStep => ({
  kind: 'work',
  durationType: 'time',
  durationValue: 300,
  target: null,
  repeats: null,
  steps: null,
  note: null,
  ...over
});

describe('fmtClock', () => {
  it('is M:SS below an hour and H:MM:SS above', () => {
    expect(fmtClock(300)).toBe('5:00');
    expect(fmtClock(90)).toBe('1:30');
    expect(fmtClock(3661)).toBe('1:01:01');
  });

  it('never renders a negative or a fraction', () => {
    expect(fmtClock(-5)).toBe('0:00');
    expect(fmtClock(90.6)).toBe('1:31');
  });
});

describe('fmtDistance', () => {
  it('switches to km at a kilometre', () => {
    expect(fmtDistance(400)).toBe('400 m');
    expect(fmtDistance(1000)).toBe('1 km');
    expect(fmtDistance(1500)).toBe('1,5 km');
  });
});

describe('describeDuration', () => {
  it('reads a time step as a clock and a distance step as a distance', () => {
    expect(describeDuration(step({ durationType: 'time', durationValue: 900 }))).toBe('15:00');
    expect(describeDuration(step({ durationType: 'distance', durationValue: 1000 }))).toBe('1 km');
    expect(describeDuration(step({ durationType: 'calories', durationValue: 250 }))).toBe('250 kcal');
  });

  /** A lap step has no duration at all — it ends when the athlete presses the button. */
  it('says a lap step ends on the button, not "0"', () => {
    expect(describeDuration(step({ durationType: 'lap', durationValue: null }))).toBe('do przycisku lap');
  });
});

describe('describeTarget', () => {
  /** Pace is stored as seconds per km; "255 s/km" is a number nobody paces by. */
  it('reads a pace target as a clock per kilometre', () => {
    expect(describeTarget({ type: 'pace', low: 250, high: 260 })).toBe('4:10/km–4:20/km');
  });

  it('reads other targets in their canonical unit', () => {
    expect(describeTarget({ type: 'power', low: 200, high: 240 })).toBe('200 w–240 w');
    expect(describeTarget({ type: 'hr', low: 140, high: 155 })).toBe('140 bpm–155 bpm');
  });

  it('collapses a single-valued range to a point', () => {
    // "200–200 W" reads as a mistake.
    expect(describeTarget({ type: 'power', low: 200, high: 200 })).toBe('200 w');
  });

  it('reads an open-ended range as a bound', () => {
    expect(describeTarget({ type: 'power', low: 200, high: null })).toBe('od 200 w');
    expect(describeTarget({ type: 'hr', low: null, high: 150 })).toBe('do 150 bpm');
  });

  it('is null when there is nothing to hold', () => {
    expect(describeTarget(null)).toBeNull();
    expect(describeTarget({ type: 'none', low: null, high: null })).toBeNull();
    expect(describeTarget({ type: 'power', low: null, high: null })).toBeNull();
  });
});

describe('describeStep', () => {
  it('joins the duration and the target', () => {
    expect(
      describeStep(
        step({ durationType: 'distance', durationValue: 1000, target: { type: 'pace', low: 250, high: 250 } })
      )
    ).toBe('1 km @ 4:10/km');
  });

  /**
   * A repeat renders WITH its children. The whole point of the block is that those steps belong
   * together, and a summary that hides them sends the reader into the editor to answer "what are the
   * intervals".
   */
  it('renders a repeat block inline with its children', () => {
    const block = step({
      kind: 'repeat',
      durationType: null,
      durationValue: null,
      repeats: 5,
      steps: [
        step({ durationType: 'distance', durationValue: 1000 }),
        step({ kind: 'recovery', durationType: 'time', durationValue: 120 })
      ]
    });
    expect(describeStep(block)).toBe('5× (1 km + 2:00)');
  });
});

describe('describeSteps', () => {
  it('reads a whole session as one line', () => {
    const session = [
      step({ kind: 'warmup', durationValue: 900 }),
      step({
        kind: 'repeat',
        durationType: null,
        durationValue: null,
        repeats: 4,
        steps: [step({ durationType: 'distance', durationValue: 400 })]
      }),
      step({ kind: 'cooldown', durationValue: 600 })
    ];
    expect(describeSteps(session)).toBe('15:00 · 4× (400 m) · 10:00');
  });

  it('is empty for no steps', () => {
    expect(describeSteps([])).toBe('');
  });
});
