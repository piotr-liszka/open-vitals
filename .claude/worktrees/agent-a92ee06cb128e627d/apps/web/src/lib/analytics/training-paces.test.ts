import { describe, it, expect } from 'vitest';
import { pacesFromTimeTrial, PACE_MODEL, TimeTrialInputError, OFFSETS_S_PER_KM } from './training-paces';

/** 20:00 over 5 km — the athlete's stated sub-20 target, one second the wrong side of it. */
const FIVE_K_IN_20MIN = { distanceM: 5000, durationS: 1200 };

describe('pacesFromTimeTrial', () => {
  it('applies the offsets to a 5 km result without converting anything', () => {
    const result = pacesFromTimeTrial(FIVE_K_IN_20MIN.distanceM, FIVE_K_IN_20MIN.durationS);

    expect(result.model).toBe(PACE_MODEL);
    expect(result.equivalent5kPaceS).toBe(240); // 4:00/km
    expect(result.paces.goal!).toEqual({ lowS: 240, highS: 240 });
    expect(result.paces.interval!).toEqual({ lowS: 235, highS: 245 });
    expect(result.paces.threshold!).toEqual({ lowS: 255, highS: 265 });
    expect(result.paces.easy!).toEqual({ lowS: 315, highS: 345 }); // 5:15–5:45/km
    expect(result.paces.long!).toEqual({ lowS: 325, highS: 355 });
  });

  it('converts a longer result to its equivalent 5 km first', () => {
    // 10 km in 42:00. Riegel says the equivalent 5 km is faster than half of it.
    const result = pacesFromTimeTrial(10_000, 2520);
    const halfOfTenKPace = 252; // what 42:00/10 km averages, s/km

    expect(result.equivalent5kPaceS).toBeLessThan(halfOfTenKPace);
    // …and every band is anchored to that faster number, not to the 10 km average.
    expect(result.paces.goal!.lowS).toBe(result.equivalent5kPaceS);
  });

  it('converts a shorter result upwards', () => {
    // A fast 1500 implies a 5 km pace SLOWER than the 1500 pace.
    const result = pacesFromTimeTrial(1500, 300); // 3:20/km
    expect(result.equivalent5kPaceS).toBeGreaterThan(200);
  });

  it('keeps the bands in the right order, fastest to slowest', () => {
    const { paces } = pacesFromTimeTrial(FIVE_K_IN_20MIN.distanceM, FIVE_K_IN_20MIN.durationS);
    expect(paces.interval!.lowS).toBeLessThan(paces.threshold!.lowS);
    expect(paces.threshold!.lowS).toBeLessThan(paces.easy!.lowS);
    expect(paces.easy!.lowS).toBeLessThan(paces.long!.lowS);
  });

  it('gives every band a low end at or below its high end', () => {
    const { paces } = pacesFromTimeTrial(FIVE_K_IN_20MIN.distanceM, FIVE_K_IN_20MIN.durationS);
    for (const [key, range] of Object.entries(paces)) {
      expect(range.lowS, key).toBeLessThanOrEqual(range.highS);
    }
  });

  it('covers exactly the bands a block stores', () => {
    const { paces } = pacesFromTimeTrial(FIVE_K_IN_20MIN.distanceM, FIVE_K_IN_20MIN.durationS);
    expect(Object.keys(paces).sort()).toEqual(Object.keys(OFFSETS_S_PER_KM).sort());
  });

  it('rejects nonsense input rather than producing a nonsense pace', () => {
    expect(() => pacesFromTimeTrial(0, 1200)).toThrow(TimeTrialInputError);
    expect(() => pacesFromTimeTrial(5000, 0)).toThrow(TimeTrialInputError);
    expect(() => pacesFromTimeTrial(-5000, 1200)).toThrow(TimeTrialInputError);
    expect(() => pacesFromTimeTrial(Number.NaN, 1200)).toThrow(TimeTrialInputError);
  });

  it('rejects a result whose implied pace is outside anything runnable', () => {
    // Distance and time transposed by the caller: 1200 m in 5000 s is a 69-minute kilometre.
    expect(() => pacesFromTimeTrial(1200, 5000)).toThrow(TimeTrialInputError);
    // …and the message says what to check rather than just refusing.
    expect(() => pacesFromTimeTrial(1200, 5000)).toThrow(/check the distance and time/);
  });

  it('refuses to extrapolate from a distance nowhere near 5 km', () => {
    // 100 m is 50× away. Riegel is not fitted over that range, and the pace it produces looks
    // plausible enough to be believed, which is what makes it worth refusing outright.
    expect(() => pacesFromTimeTrial(100, 10)).toThrow(/too far from 5 km/);
    expect(() => pacesFromTimeTrial(42_195, 9000)).toThrow(/too far from 5 km/);
  });

  it('still accepts every distance an athlete actually time-trials', () => {
    // A half marathon is 4.2× away — beyond spec 043's prediction cap, but an ordinary thing to
    // have raced, and the coach named it explicitly.
    expect(() => pacesFromTimeTrial(21_097, 5400)).not.toThrow();
    expect(() => pacesFromTimeTrial(1000, 200)).not.toThrow();
    expect(() => pacesFromTimeTrial(10_000, 2520)).not.toThrow();
  });
});
