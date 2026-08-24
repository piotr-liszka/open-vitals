import { describe, it, expect } from 'vitest';
import { MAX_DROP_M, MIN_GAIN_M, categoryFor, climbedMetres, findClimbs } from './climbs';

/**
 * A course from a list of per-step elevation DELTAS. Each step covers `stepM` metres and `stepS` seconds,
 * so gradient and VAM are exactly predictable.
 */
function course(deltas: readonly number[], stepM = 100, stepS = 20) {
  const elevation = [100];
  const cum = [0];
  const elapsed = [0];
  deltas.forEach((d, i) => {
    elevation.push((elevation[i] ?? 0) + d);
    cum.push((cum[i] ?? 0) + stepM);
    elapsed.push((elapsed[i] ?? 0) + stepS);
  });
  return { elevation, cum, elapsed };
}

const rise = (steps: number, perStep: number): number[] => new Array<number>(steps).fill(perStep);

describe('findClimbs', () => {
  it('finds one climb on a single steady ascent', () => {
    // 10 steps of +6 m over 100 m each: 60 m gain, 1 km, 6%.
    const { elevation, cum, elapsed } = course(rise(10, 6));
    const [climb] = findClimbs(elevation, cum, elapsed);
    expect(climb).toMatchObject({ index: 1, gainM: 60, distanceM: 1000, gradePct: 6 });
  });

  it('computes VAM as metres of ascent per hour', () => {
    // 60 m in 200 s → 1080 m/h.
    const { elevation, cum, elapsed } = course(rise(10, 6));
    expect(findClimbs(elevation, cum, elapsed)[0]!.vam).toBe(1080);
  });

  it('measures the gain to the PEAK, not to where the climb ended', () => {
    // Up 60 m, then a big drop that closes the climb: the gain is still 60.
    const { elevation, cum, elapsed } = course([...rise(10, 6), ...rise(5, -20)]);
    expect(findClimbs(elevation, cum, elapsed)[0]!.gainM).toBe(60);
  });

  it('keeps a climb going through a dip smaller than the tolerance', () => {
    // Up, a small dip, up again: one climb, not two.
    const { elevation, cum, elapsed } = course([...rise(10, 6), -(MAX_DROP_M - 2), ...rise(10, 6)]);
    const climbs = findClimbs(elevation, cum, elapsed);
    expect(climbs).toHaveLength(1);
    expect(climbs[0]!.gainM).toBeGreaterThan(100);
  });

  it('splits into two climbs when the descent between them is real', () => {
    const { elevation, cum, elapsed } = course([...rise(10, 6), ...rise(10, -8), ...rise(10, 6)]);
    const climbs = findClimbs(elevation, cum, elapsed);
    expect(climbs).toHaveLength(2);
    expect(climbs.map((c) => c.index)).toEqual([1, 2]);
  });

  it('rejects a bump that gains too little, however steep', () => {
    // 4 steps of +5 m = 20 m: steep but under the gain floor.
    const { elevation, cum, elapsed } = course([...rise(4, 5), ...rise(4, -20)]);
    expect(findClimbs(elevation, cum, elapsed)).toEqual([]);
    expect(MIN_GAIN_M).toBeGreaterThan(20);
  });

  it('rejects a long drag whose gradient is too shallow, however much it gains', () => {
    // 100 steps of +1 m over 100 m each: 100 m gain but only 1%.
    const { elevation, cum, elapsed } = course(rise(100, 1));
    expect(findClimbs(elevation, cum, elapsed)).toEqual([]);
  });

  it('closes an open climb at the end of the activity', () => {
    // The activity simply stops at the top; the climb must still be reported.
    const { elevation, cum, elapsed } = course(rise(20, 6));
    expect(findClimbs(elevation, cum, elapsed)).toHaveLength(1);
  });

  it('returns nothing for a flat course', () => {
    const { elevation, cum, elapsed } = course(rise(20, 0));
    expect(findClimbs(elevation, cum, elapsed)).toEqual([]);
  });

  it('returns nothing for a descent-only course', () => {
    const { elevation, cum, elapsed } = course(rise(20, -6));
    expect(findClimbs(elevation, cum, elapsed)).toEqual([]);
  });

  it('returns nothing without all three axes, or with too few samples', () => {
    const { elevation, cum, elapsed } = course(rise(10, 6));
    expect(findClimbs(null, cum, elapsed)).toEqual([]);
    expect(findClimbs(elevation, null, elapsed)).toEqual([]);
    expect(findClimbs(elevation, cum, null)).toEqual([]);
    expect(findClimbs([1, 2], [0, 1], [0, 1])).toEqual([]);
  });

  it('skips non-finite elevation samples rather than failing on them', () => {
    const { elevation, cum, elapsed } = course(rise(10, 6));
    elevation[4] = Number.NaN;
    const climbs = findClimbs(elevation, cum, elapsed);
    expect(climbs).toHaveLength(1);
    expect(Number.isFinite(climbs[0]!.gainM)).toBe(true);
  });

  it('reports where the climb started, so a chart can point at it', () => {
    const { elevation, cum, elapsed } = course([...rise(5, 0), ...rise(10, 6)]);
    // Five flat steps of 20 s each before the climb begins.
    expect(findClimbs(elevation, cum, elapsed)[0]!.startS).toBe(100);
  });

  it('counts a pause inside a climb against its VAM', () => {
    const { elevation, cum, elapsed } = course(rise(10, 6));
    // Add 600 s of standing at the halfway point, in place.
    for (let i = 5; i < elapsed.length; i++) elapsed[i] = (elapsed[i] ?? 0) + 600;
    const withPause = findClimbs(elevation, cum, elapsed)[0]!;
    // The same climb without the stop reads 1080 m/h; the pause genuinely lowered the rate of ascent.
    expect(withPause.vam).toBeLessThan(1080);
    expect(withPause.gainM).toBe(60);
  });

  it('categorises by gain × gradient, steepest and longest highest', () => {
    // 60 m at 6% → score 360, uncategorised.
    const small = findClimbs(...axes(course(rise(10, 6))))[0]!;
    expect(small.categoryLabel).toBe('Bez kat.');

    // 800 m at 8% → score 6400… still under the 4th-category floor.
    const big = findClimbs(...axes(course(rise(100, 8))))[0]!;
    expect(big.score).toBeGreaterThan(small.score);
  });
});

/** Spread a course fixture into the argument order `findClimbs` takes. */
function axes(c: { elevation: number[]; cum: number[]; elapsed: number[] }): [number[], number[], number[]] {
  return [c.elevation, c.cum, c.elapsed];
}

describe('categoryFor', () => {
  it('names the hardest category for a huge score', () => {
    expect(categoryFor(200_000).label).toBe('HC');
  });

  it('walks down the table as the score falls', () => {
    expect(categoryFor(70_000).key).toBe('c1');
    expect(categoryFor(40_000).key).toBe('c2');
    expect(categoryFor(20_000).key).toBe('c3');
    expect(categoryFor(9000).key).toBe('c4');
    expect(categoryFor(100).key).toBe('uncat');
  });

  it('never leaves a climb uncategorised in the type sense', () => {
    expect(categoryFor(0).label).toBe('Bez kat.');
  });
});

describe('climbedMetres', () => {
  it('sums the ascent that was actually climbing', () => {
    const { elevation, cum, elapsed } = course([...rise(10, 6), ...rise(10, -8), ...rise(10, 6)]);
    const climbs = findClimbs(elevation, cum, elapsed);
    expect(climbedMetres(climbs)).toBe(climbs.reduce((s, c) => s + c.gainM, 0));
    expect(climbedMetres(climbs)).toBeGreaterThan(100);
  });

  it('is zero for no climbs', () => {
    expect(climbedMetres([])).toBe(0);
  });
});
