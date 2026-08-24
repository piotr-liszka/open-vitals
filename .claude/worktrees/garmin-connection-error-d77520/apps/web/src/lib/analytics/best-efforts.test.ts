import { describe, it, expect } from 'vitest';
import { EFFORT_DISTANCES, bestEfforts, type EffortDistance } from './best-efforts';

/** A session sampled once a second, `speeds[i]` metres covered in second i. */
function session(speeds: readonly number[]): { cum: number[]; elapsed: number[] } {
  const cum: number[] = [0];
  const elapsed: number[] = [0];
  let total = 0;
  speeds.forEach((v, i) => {
    total += v;
    cum.push(total);
    elapsed.push(i + 1);
  });
  return { cum, elapsed };
}

const steady = (metresPerSecond: number, seconds: number): readonly number[] =>
  new Array<number>(seconds).fill(metresPerSecond);

const ONE_K: EffortDistance[] = [{ key: '1k', label: '1 km', metres: 1000 }];

describe('bestEfforts', () => {
  it('finds the fastest window for a steady effort', () => {
    // 4 m/s for 10 minutes: 1 km always takes 250 s.
    const { cum, elapsed } = session(steady(4, 600));
    const [effort] = bestEfforts(cum, elapsed, ONE_K);
    expect(effort).toMatchObject({ key: '1k', metres: 1000, durationS: 250 });
    expect(effort!.paceSecPerKm).toBe(250);
  });

  it('finds a fast kilometre buried in the middle of an easy run', () => {
    // 20 min easy at 3 m/s, a 1 km surge at 5 m/s, then easy again.
    const { cum, elapsed } = session([...steady(3, 1200), ...steady(5, 200), ...steady(3, 1200)]);
    const [effort] = bestEfforts(cum, elapsed, ONE_K);
    expect(effort!.durationS).toBe(200);
    // The surge starts after 1200 s of easy running.
    expect(effort!.startS).toBe(1200);
  });

  it('is the FASTEST window, not the first or the last', () => {
    const { cum, elapsed } = session([
      ...steady(4, 250), // 1 km in 250 s
      ...steady(5, 200), // 1 km in 200 s ← the winner
      ...steady(4.5, 223)
    ]);
    const [effort] = bestEfforts(cum, elapsed, ONE_K);
    expect(effort!.durationS).toBe(200);
  });

  it('omits a distance the session never covered instead of extrapolating', () => {
    const { cum, elapsed } = session(steady(3, 100)); // 300 m total
    const efforts = bestEfforts(cum, elapsed);
    expect(efforts).toEqual([]);
  });

  it('reports every distance the session does contain, shortest first', () => {
    const { cum, elapsed } = session(steady(4, 1600)); // 6.4 km
    const efforts = bestEfforts(cum, elapsed);
    expect(efforts.map((e) => e.key)).toEqual(['400m', '1k', 'mile', '5k']);
  });

  it('paces the effort over the distance actually covered, not over the nominal target', () => {
    // 10-second samples at 5 m/s: a window can only land on 50 m boundaries, so 1 km overshoots.
    const cum = Array.from({ length: 30 }, (_, i) => i * 50);
    const elapsed = Array.from({ length: 30 }, (_, i) => i * 10);
    const [effort] = bestEfforts(cum, elapsed, ONE_K);
    expect(effort!.actualM).toBeGreaterThanOrEqual(1000);
    // Pace derives from actualM ÷ durationS, so it stays the true 200 s/km rather than being flattered.
    expect(effort!.paceSecPerKm).toBeCloseTo((effort!.durationS / effort!.actualM) * 1000, 5);
    expect(effort!.paceSecPerKm).toBeCloseTo(200, 0);
  });

  it('reports how many samples are behind the number', () => {
    const { cum, elapsed } = session(steady(4, 600));
    const [effort] = bestEfforts(cum, elapsed, ONE_K);
    expect(effort!.samples).toBe(251); // 250 one-second steps, inclusive of both ends
  });

  it('survives a session that stands still for a while', () => {
    const { cum, elapsed } = session([...steady(4, 250), ...steady(0, 300), ...steady(4, 250)]);
    const [effort] = bestEfforts(cum, elapsed, ONE_K);
    // The stop cannot make a window faster, so the best 1 km is still the moving 250 s.
    expect(effort!.durationS).toBe(250);
  });

  it('returns nothing without the streams it needs', () => {
    expect(bestEfforts(null, [0, 1])).toEqual([]);
    expect(bestEfforts([0, 100], null)).toEqual([]);
    expect(bestEfforts(undefined, undefined)).toEqual([]);
  });

  it('returns nothing for a single sample', () => {
    expect(bestEfforts([0], [0])).toEqual([]);
  });

  it('handles mismatched stream lengths by using the shorter one', () => {
    const { cum, elapsed } = session(steady(4, 600));
    const efforts = bestEfforts(cum, elapsed.slice(0, 100), ONE_K);
    // Only 99 s of usable time → under 400 m covered → nothing reportable.
    expect(efforts).toEqual([]);
  });

  it('never reports a window of zero or negative duration', () => {
    // A stalled clock: distance climbs but elapsed time does not.
    const cum = [0, 500, 1000, 1500];
    const elapsed = [0, 0, 0, 0];
    expect(bestEfforts(cum, elapsed, ONE_K)).toEqual([]);
  });

  it('keeps the standard distance set in ascending order', () => {
    const metres = EFFORT_DISTANCES.map((d) => d.metres);
    expect([...metres].sort((a, b) => a - b)).toEqual(metres);
  });

  it('finds a marathon split inside a longer ultra', () => {
    // 50 km at 3 m/s. The marathon split should be 42195/3 ≈ 14 065 s.
    const { cum, elapsed } = session(steady(3, 16_700));
    const efforts = bestEfforts(cum, elapsed);
    const marathon = efforts.find((e) => e.key === 'marathon');
    expect(marathon).toBeDefined();
    expect(marathon!.durationS).toBeCloseTo(42_195 / 3, 0);
  });
});
