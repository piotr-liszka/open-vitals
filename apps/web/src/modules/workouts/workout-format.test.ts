import { describe, it, expect } from 'vitest';
import { createTranslator } from '$lib/i18n';
import type { WorkoutStep } from '$lib/workouts';
import {
  completionBadge,
  completionNotes,
  describeDuration,
  describeStep,
  describeSteps,
  describeTarget,
  fmtAdherence,
  fmtClock,
  fmtDayShift,
  fmtDistance,
  fmtMatchedBy
} from './workout-format';
import type { WorkoutCompletion } from './workouts.types';

const pl = createTranslator('pl');
const en = createTranslator('en');

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
  it('switches to km at a kilometre, following the locale decimal separator', () => {
    expect(fmtDistance(pl, 400)).toBe('400 m');
    expect(fmtDistance(pl, 1000)).toBe('1 km');
    expect(fmtDistance(pl, 1500)).toBe('1,5 km');
    // Same numbers, English decimal point — the whole point of spec 076.
    expect(fmtDistance(en, 1500)).toBe('1.5 km');
  });
});

describe('describeDuration', () => {
  it('reads a time step as a clock and a distance step as a distance', () => {
    expect(describeDuration(pl, step({ durationType: 'time', durationValue: 900 }))).toBe('15:00');
    expect(describeDuration(pl, step({ durationType: 'distance', durationValue: 1000 }))).toBe('1 km');
    expect(describeDuration(pl, step({ durationType: 'calories', durationValue: 250 }))).toBe('250 kcal');
  });

  /** A lap step has no duration at all — it ends when the athlete presses the button. */
  it('says a lap step ends on the button, not "0", in the active locale', () => {
    expect(describeDuration(pl, step({ durationType: 'lap', durationValue: null }))).toBe('do przycisku lap');
    expect(describeDuration(en, step({ durationType: 'lap', durationValue: null }))).toBe(
      'to the lap button'
    );
  });
});

describe('describeTarget', () => {
  /** Pace is stored as seconds per km; "255 s/km" is a number nobody paces by. */
  it('reads a pace target as a clock per kilometre', () => {
    expect(describeTarget(pl, { type: 'pace', low: 250, high: 260 })).toBe('4:10/km–4:20/km');
  });

  it('reads other targets in their canonical unit', () => {
    expect(describeTarget(pl, { type: 'power', low: 200, high: 240 })).toBe('200 w–240 w');
    expect(describeTarget(pl, { type: 'hr', low: 140, high: 155 })).toBe('140 bpm–155 bpm');
  });

  it('collapses a single-valued range to a point', () => {
    // "200–200 W" reads as a mistake.
    expect(describeTarget(pl, { type: 'power', low: 200, high: 200 })).toBe('200 w');
  });

  it('reads an open-ended range as a bound, translated', () => {
    expect(describeTarget(pl, { type: 'power', low: 200, high: null })).toBe('od 200 w');
    expect(describeTarget(pl, { type: 'hr', low: null, high: 150 })).toBe('do 150 bpm');
    expect(describeTarget(en, { type: 'power', low: 200, high: null })).toBe('from 200 w');
    expect(describeTarget(en, { type: 'hr', low: null, high: 150 })).toBe('up to 150 bpm');
  });

  it('is null when there is nothing to hold', () => {
    expect(describeTarget(pl, null)).toBeNull();
    expect(describeTarget(pl, { type: 'none', low: null, high: null })).toBeNull();
    expect(describeTarget(pl, { type: 'power', low: null, high: null })).toBeNull();
  });
});

describe('describeStep', () => {
  it('joins the duration and the target', () => {
    expect(
      describeStep(
        pl,
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
    expect(describeStep(pl, block)).toBe('5× (1 km + 2:00)');
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
    expect(describeSteps(pl, session)).toBe('15:00 · 4× (400 m) · 10:00');
  });

  it('is empty for no steps', () => {
    expect(describeSteps(pl, [])).toBe('');
  });
});

/** Spec 081 — the completion wording the day panel shows and the calendar deliberately does not. */
describe('completion formatting (spec 081)', () => {
  const completion = (over: Partial<WorkoutCompletion> = {}): WorkoutCompletion => ({
    activityId: 'a1',
    adherence: 'done',
    adherenceRatio: 1,
    dayShift: 0,
    matchedBy: 'workout-id',
    ...over
  });

  it('states the share of the plan that was covered', () => {
    expect(fmtAdherence(pl, 0.82)).toBe('82 % planu');
    expect(fmtAdherence(pl, 1)).toBe('100 % planu');
    expect(fmtAdherence(pl, 1.3)).toBe('130 % planu');
    expect(fmtAdherence(en, 0.82)).toBe('82% of plan');
  });

  it('says nothing about a share when the plan had no axis', () => {
    // A lap-button session cannot be a percentage OF anything.
    expect(fmtAdherence(pl, null)).toBeNull();
    expect(fmtAdherence(pl, Number.NaN)).toBeNull();
  });

  it('names the day shift in both directions, in the active locale', () => {
    expect(fmtDayShift(pl, 0)).toBeNull();
    expect(fmtDayShift(pl, 1)).toBe('wykonane 1 dzień później');
    expect(fmtDayShift(pl, -1)).toBe('wykonane 1 dzień wcześniej');
    expect(fmtDayShift(pl, 3)).toBe('wykonane 3 dni później');
    expect(fmtDayShift(pl, -2)).toBe('wykonane 2 dni wcześniej');
    expect(fmtDayShift(en, 1)).toBe('done 1 day later');
    expect(fmtDayShift(en, 3)).toBe('done 3 days later');
  });

  it('flags an inferred pairing and leaves a known one unqualified', () => {
    expect(fmtMatchedBy(pl, 'heuristic')).toMatch(/orientacyjnie/);
    expect(fmtMatchedBy(pl, 'workout-id')).toBeNull();
  });

  it('assembles only the notes that have something to say', () => {
    expect(completionNotes(pl, completion())).toEqual(['100 % planu']);
    expect(completionNotes(pl, completion({ adherenceRatio: null }))).toEqual([]);
    expect(
      completionNotes(pl, completion({ adherenceRatio: 0.82, dayShift: 1, matchedBy: 'heuristic' }))
    ).toEqual(['82 % planu', 'wykonane 1 dzień później', 'dopasowane orientacyjnie — po dniu i dystansie']);
  });

  it('labels a shortened session in the warning family, never the danger one', () => {
    // Doing 60 % of a session is a fact to report, not an error to alarm about.
    expect(completionBadge(pl, 'done').tone).toBe('success');
    expect(completionBadge(pl, 'shortened').tone).toBe('warning');
    expect(completionBadge(en, 'done').label).toBe('Done');
    expect(completionBadge(en, 'shortened').label).toBe('Shortened');
  });
});
