import { describe, it, expect } from 'vitest';
import { SPLIT_TOLERANCE_PCT, VARIABLE_CV_PCT, pacing, shapeOf } from './pacing';

/** Build a session from a list of per-second speeds (m/s). */
function session(speeds: readonly number[]): { cum: number[]; elapsed: number[] } {
  const cum = [0];
  const elapsed = [0];
  let total = 0;
  speeds.forEach((v, i) => {
    total += v;
    cum.push(total);
    elapsed.push(i + 1);
  });
  return { cum, elapsed };
}

const steady = (mps: number, seconds: number): number[] => new Array<number>(seconds).fill(mps);

describe('pacing', () => {
  it('calls a perfectly steady session even', () => {
    const { cum, elapsed } = session(steady(4, 600)); // 2.4 km
    const p = pacing(cum, elapsed)!;
    expect(p.splitPct).toBe(0);
    expect(p.variabilityPct).toBe(0);
    expect(p.shape).toBe('even');
    expect(p.firstHalfPaceSecPerKm).toBe(250);
    expect(p.secondHalfPaceSecPerKm).toBe(250);
  });

  it('detects a fade — the classic went-out-too-hard session', () => {
    // First half at 4 m/s, second at 3.2 m/s: 25% slower.
    const { cum, elapsed } = session([...steady(4, 300), ...steady(3.2, 375)]);
    const p = pacing(cum, elapsed)!;
    expect(p.splitPct).toBeGreaterThan(SPLIT_TOLERANCE_PCT);
    expect(p.secondHalfPaceSecPerKm).toBeGreaterThan(p.firstHalfPaceSecPerKm);
    // Variability from a single step change stays under the interval threshold.
    expect(p.shape).toBe('faded');
  });

  it('detects a negative split', () => {
    const { cum, elapsed } = session([...steady(3.2, 375), ...steady(4, 300)]);
    const p = pacing(cum, elapsed)!;
    expect(p.splitPct).toBeLessThan(-SPLIT_TOLERANCE_PCT);
    expect(p.shape).toBe('negative-split');
  });

  it('splits by DISTANCE, not by time — otherwise a fade is understated', () => {
    // A fading run: splitting the 675 s by time would put well over half the distance in the first half.
    const { cum, elapsed } = session([...steady(4, 300), ...steady(3.2, 375)]);
    const p = pacing(cum, elapsed)!;
    // Each half is 1200 m: 300 s and 375 s. Pace 250 vs 312.5 → +25%.
    expect(p.firstHalfPaceSecPerKm).toBe(250);
    expect(p.secondHalfPaceSecPerKm).toBe(313);
    expect(p.splitPct).toBeCloseTo(25, 0);
  });

  it('calls an interval session variable rather than badly paced', () => {
    // Ten alternating hard/easy chunks: a big spread with a balanced split.
    const reps = Array.from({ length: 10 }, (_, i) => (i % 2 === 0 ? steady(5, 60) : steady(2.8, 60))).flat();
    const { cum, elapsed } = session(reps);
    const p = pacing(cum, elapsed)!;
    expect(p.variabilityPct).toBeGreaterThan(VARIABLE_CV_PCT);
    expect(p.shape).toBe('variable');
  });

  it('reports how many chunks the variability rests on', () => {
    const { cum, elapsed } = session(steady(4, 600));
    expect(pacing(cum, elapsed)!.chunks).toBe(10);
  });

  it('refuses a session too short to judge', () => {
    const { cum, elapsed } = session(steady(4, 100)); // 400 m
    expect(pacing(cum, elapsed)).toBeNull();
  });

  it('refuses unusable axes', () => {
    expect(pacing(null, [0, 1])).toBeNull();
    expect(pacing([0, 100], null)).toBeNull();
    expect(pacing([0], [0])).toBeNull();
  });

  it('refuses a session whose clock never advanced', () => {
    expect(pacing([0, 1000, 2000, 3000], [0, 0, 0, 0])).toBeNull();
  });

  it('survives a mid-session stop without dividing by zero', () => {
    const { cum, elapsed } = session([...steady(4, 300), ...steady(0, 120), ...steady(4, 300)]);
    const p = pacing(cum, elapsed)!;
    expect(Number.isFinite(p.splitPct)).toBe(true);
    // The stop lands in the second half, so it reads as a fade — which is what the clock actually says.
    expect(p.splitPct).toBeGreaterThan(0);
  });

  it('interpolates within a coarse sample rather than quantising the split', () => {
    // 30-second samples: the halfway point falls inside a sample, so the halves must not snap to it.
    const cum = Array.from({ length: 21 }, (_, i) => i * 150); // 3 km in 150 m steps
    const elapsed = Array.from({ length: 21 }, (_, i) => i * 30);
    const p = pacing(cum, elapsed)!;
    expect(p.splitPct).toBe(0);
    expect(p.firstHalfPaceSecPerKm).toBe(200);
  });
});

describe('shapeOf', () => {
  it('lets variability win, because an interval session‘s split balance is an accident', () => {
    expect(shapeOf(30, VARIABLE_CV_PCT + 1)).toBe('variable');
    expect(shapeOf(-30, VARIABLE_CV_PCT + 1)).toBe('variable');
  });

  it('treats a small imbalance as even', () => {
    expect(shapeOf(0, 0)).toBe('even');
    expect(shapeOf(SPLIT_TOLERANCE_PCT, 0)).toBe('even');
    expect(shapeOf(-SPLIT_TOLERANCE_PCT, 0)).toBe('even');
  });

  it('names the direction past the tolerance', () => {
    expect(shapeOf(SPLIT_TOLERANCE_PCT + 0.1, 0)).toBe('faded');
    expect(shapeOf(-SPLIT_TOLERANCE_PCT - 0.1, 0)).toBe('negative-split');
  });
});
