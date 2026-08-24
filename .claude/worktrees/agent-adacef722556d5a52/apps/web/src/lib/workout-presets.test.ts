/**
 * Workout presets (spec 050) — the one-call path to a real session. Each expansion is checked to be a
 * VALID workout for its sport (it goes straight through `normalizeWorkout` afterwards in production),
 * and the titles are checked because they are what the athlete sees on the watch.
 */
import { describe, it, expect } from 'vitest';
import { buildWorkoutPreset } from './workout-presets';
import { countWorkoutSteps, normalizeWorkout, WorkoutValidationError } from './workouts';

/** Every preset must expand into something the validator accepts. */
function valid(sport: string, built: { title: string; steps: ReturnType<typeof build>['steps'] }) {
  return normalizeWorkout({ sport, title: built.title, steps: built.steps });
}
const build = buildWorkoutPreset;

describe('buildWorkoutPreset', () => {
  it('builds a bike interval session with warmup, repeat block and cooldown', () => {
    const built = build('intervals', {
      sport: 'cycling',
      repeats: 4,
      workS: 480,
      recoveryS: 240,
      targetType: 'power',
      targetLow: 250,
      targetHigh: 265
    });

    expect(built.title).toBe('Interwały 4×8 min');
    expect(built.steps.map((s) => s.kind)).toEqual(['warmup', 'repeat', 'cooldown']);
    expect(built.steps[1]?.repeats).toBe(4);
    expect(built.steps[1]?.steps?.map((s) => s.kind)).toEqual(['work', 'recovery']);
    expect(built.steps[1]?.steps?.[0]?.target).toEqual({ type: 'power', low: 250, high: 265 });
    expect(countWorkoutSteps(built.steps)).toBe(5);
    expect(() => valid('cycling', built)).not.toThrow();
  });

  it('builds a distance-based run interval session and names it in km', () => {
    const built = build('intervals', {
      sport: 'running',
      repeats: 5,
      workM: 1000,
      recoveryS: 120,
      targetType: 'pace',
      targetLow: 240,
      targetHigh: 250
    });

    expect(built.title).toBe('Interwały 5×1 km');
    expect(built.steps[1]?.steps?.[0]?.durationType).toBe('distance');
    expect(built.steps[1]?.steps?.[0]?.durationValue).toBe(1000);
    expect(() => valid('running', built)).not.toThrow();
  });

  it('defaults recovery to the work length, capped at three minutes', () => {
    const short = build('intervals', { sport: 'running', workS: 120 });
    const long = build('intervals', { sport: 'running', workS: 600 });

    expect(short.steps[1]?.steps?.[1]?.durationValue).toBe(120);
    expect(long.steps[1]?.steps?.[1]?.durationValue).toBe(180);
  });

  it('builds tempo, easy and long sessions with sensible defaults', () => {
    expect(build('tempo', { sport: 'running' }).title).toBe('Tempo 20 min');
    expect(build('easy', { sport: 'running' }).title).toBe('Spokojnie 45 min');
    expect(build('long', { sport: 'cycling' }).title).toBe('Długi 90 min');
    // Whole hours read as hours; 90 minutes does not ("1.5 h" is worse than "90 min" on a watch).
    expect(build('long', { sport: 'cycling', workS: 7200 }).title).toBe('Długi 2 h');
    // Easy/long are single steps — no warmup ritual around a whole-session effort.
    expect(build('long', { sport: 'cycling' }).steps).toHaveLength(1);
    expect(build('tempo', { sport: 'running' }).steps.map((s) => s.kind)).toEqual([
      'warmup',
      'work',
      'cooldown'
    ]);
  });

  it('names the threshold test per sport and only allows ride/run', () => {
    expect(build('ftp_test', { sport: 'cycling' }).title).toBe('Test FTP 20 min');
    expect(build('ftp_test', { sport: 'running' }).title).toBe('Test progu 20 min');
    expect(() => build('ftp_test', { sport: 'walking' })).toThrow(WorkoutValidationError);
  });

  it('drops the warmup and cooldown when they are set to zero', () => {
    const built = build('intervals', { sport: 'running', workS: 60, warmupS: 0, cooldownS: 0 });
    expect(built.steps.map((s) => s.kind)).toEqual(['repeat']);
  });

  it('is zone-free unless the caller passes numbers', () => {
    // The app does not know the athlete's threshold, so a preset without targets is legitimate…
    const plain = build('tempo', { sport: 'cycling' });
    expect(plain.steps[1]?.target).toBeNull();
    // …but half a target is a mistake worth reporting.
    expect(() => build('tempo', { sport: 'cycling', targetType: 'power' })).toThrow(/targetLow/);
    expect(() => build('tempo', { sport: 'cycling', targetLow: 250 })).toThrow(/targetType/);
  });

  it('still validates the target against the sport once expanded', () => {
    const built = build('tempo', { sport: 'walking', targetType: 'power', targetLow: 200 });
    // The preset does not second-guess the target; the validator is the gate that catches it.
    expect(() => valid('walking', built)).toThrow(/does not apply/);
  });
});
