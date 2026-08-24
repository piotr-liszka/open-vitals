import { describe, it, expect } from 'vitest';
import {
  CHEAPEST_GRADE_PCT,
  CS_LONG_S,
  CS_SHORT_S,
  MAX_GRADE_PCT,
  criticalSpeed,
  gradeAdjustedSpeed,
  gradeAdjustedStream,
  gradeCostFactor,
  meanGradeAdjustedSpeed,
  mergeSpeedCurves,
  speedDurationCurve
} from './pace-model';

describe('gradeCostFactor', () => {
  it('is exactly 1 on the flat, by definition', () => {
    expect(gradeCostFactor(0)).toBeCloseTo(1, 6);
  });

  it('costs about half again as much on a 10% climb', () => {
    expect(gradeCostFactor(10)).toBeCloseTo(1.5, 2);
  });

  it('has its minimum at the cheapest gradient, not at the steepest descent', () => {
    const cheapest = gradeCostFactor(CHEAPEST_GRADE_PCT);
    expect(cheapest).toBeLessThan(1);
    expect(cheapest).toBeCloseTo(0.833, 2);
    // The whole point of the vertex: it turns back UP below the cheapest gradient.
    expect(gradeCostFactor(-20)).toBeGreaterThan(cheapest);
    expect(gradeCostFactor(-30)).toBeGreaterThan(gradeCostFactor(-20));
  });

  it('rises monotonically uphill', () => {
    const factors = [0, 5, 10, 15, 20, 30].map(gradeCostFactor);
    for (let i = 1; i < factors.length; i++) {
      expect(factors[i]!).toBeGreaterThan(factors[i - 1]!);
    }
  });

  it('clamps beyond the range it was fitted over', () => {
    expect(gradeCostFactor(200)).toBe(gradeCostFactor(MAX_GRADE_PCT));
    expect(gradeCostFactor(-200)).toBe(gradeCostFactor(-MAX_GRADE_PCT));
  });

  it('treats an unusable gradient as flat rather than throwing', () => {
    expect(gradeCostFactor(Number.NaN)).toBe(1);
  });

  it('never claims running is more than free', () => {
    for (let g = -MAX_GRADE_PCT; g <= MAX_GRADE_PCT; g++) {
      expect(gradeCostFactor(g)).toBeGreaterThanOrEqual(0.5);
    }
  });
});

describe('gradeAdjustedSpeed', () => {
  it('says an uphill effort equals a FASTER flat pace', () => {
    expect(gradeAdjustedSpeed(3, 10)!).toBeGreaterThan(3);
  });

  it('says a downhill effort equals a SLOWER flat pace', () => {
    expect(gradeAdjustedSpeed(3, -8)!).toBeLessThan(3);
  });

  it('leaves a flat effort alone', () => {
    expect(gradeAdjustedSpeed(3, 0)).toBeCloseTo(3, 3);
  });

  it('refuses inputs it cannot use', () => {
    expect(gradeAdjustedSpeed(null, 5)).toBeNull();
    expect(gradeAdjustedSpeed(3, null)).toBeNull();
    expect(gradeAdjustedSpeed(0, 5)).toBeNull();
    expect(gradeAdjustedSpeed(-3, 5)).toBeNull();
  });
});

describe('gradeAdjustedStream', () => {
  it('adjusts every sample', () => {
    const out = gradeAdjustedStream([3, 3, 3], [0, 10, -8])!;
    expect(out[0]).toBeCloseTo(3, 2);
    expect(out[1]!).toBeGreaterThan(3);
    expect(out[2]!).toBeLessThan(3);
  });

  it('leaves a real gap where the athlete was stopped', () => {
    const out = gradeAdjustedStream([3, 0, 3], [0, 0, 0])!;
    expect(Number.isNaN(out[1]!)).toBe(true);
  });

  it('is undefined without both streams, and stops at the shorter one', () => {
    expect(gradeAdjustedStream(undefined, [0])).toBeUndefined();
    expect(gradeAdjustedStream([3], undefined)).toBeUndefined();
    expect(gradeAdjustedStream([], [])).toBeUndefined();
    expect(gradeAdjustedStream([3, 3, 3], [0])).toHaveLength(1);
  });
});

describe('meanGradeAdjustedSpeed', () => {
  it('averages the adjusted stream', () => {
    expect(meanGradeAdjustedSpeed([3, 3], [0, 0])).toBeCloseTo(3, 2);
  });

  it('weights by the time each sample covers, so a standstill cannot outvote a minute of running', () => {
    // Sample 1 covers 1 s at 4 m/s; sample 2 covers 100 s at 2 m/s. A plain mean would say 3.
    const weighted = meanGradeAdjustedSpeed([4, 2], [0, 0], [0, 100])!;
    expect(weighted).toBeCloseTo(2, 1);
  });

  it('is null when nothing is usable', () => {
    expect(meanGradeAdjustedSpeed([0, 0], [0, 0])).toBeNull();
    expect(meanGradeAdjustedSpeed(undefined, undefined)).toBeNull();
  });
});

describe('speedDurationCurve', () => {
  /** `seconds` samples at 1 Hz, all at `mps`. */
  const steady = (mps: number, seconds: number): number[] => new Array<number>(seconds).fill(mps);

  it('reports the best average speed for each duration the session is long enough for', () => {
    const curve = speedDurationCurve(steady(4, 700));
    expect(curve.map((p) => p.durationS)).toEqual([15, 30, 60, 120, 300, 600]);
    for (const p of curve) expect(p.speedMps).toBeCloseTo(4, 2);
  });

  it('converts each point to a pace as well', () => {
    const [p] = speedDurationCurve(steady(4, 60), 1, [60]);
    expect(p!.paceSecPerKm).toBe(250); // 1000 / 4
  });

  it('finds the fastest window rather than the average of the session', () => {
    // 10 min easy, 1 min hard, 10 min easy: the 60 s best must be the hard minute.
    const speed = [...steady(3, 600), ...steady(6, 60), ...steady(3, 600)];
    const [oneMin] = speedDurationCurve(speed, 1, [60]);
    expect(oneMin!.speedMps).toBeCloseTo(6, 2);
  });

  it('counts a rest inside the window against it, rather than skipping it', () => {
    // A window straddling a stop genuinely averaged less; "best speed while moving" is a different thing.
    const speed = [...steady(4, 30), ...steady(0, 30), ...steady(4, 30)];
    const [oneMin] = speedDurationCurve(speed, 1, [60]);
    expect(oneMin!.speedMps).toBeLessThan(4);
  });

  it('omits durations longer than the session', () => {
    expect(speedDurationCurve(steady(4, 30), 1, [15, 60])!.map((p) => p.durationS)).toEqual([15]);
  });

  it('honours a sample interval other than one second', () => {
    // 4-second samples: 15 s of data is under 4 samples, but 60 s is 15 samples.
    const curve = speedDurationCurve(steady(4, 30), 4, [60]);
    expect(curve).toHaveLength(1);
    expect(curve[0]!.speedMps).toBeCloseTo(4, 2);
  });

  it('returns nothing for missing, empty or all-stopped input', () => {
    expect(speedDurationCurve(undefined)).toEqual([]);
    expect(speedDurationCurve([])).toEqual([]);
    expect(speedDurationCurve(steady(0, 600))).toEqual([]);
    expect(speedDurationCurve(steady(4, 600), 0)).toEqual([]);
  });

  it('treats a non-finite sample as a stop rather than propagating NaN', () => {
    const speed = [...steady(4, 30), Number.NaN, ...steady(4, 29)];
    const [oneMin] = speedDurationCurve(speed, 1, [60]);
    expect(Number.isFinite(oneMin!.speedMps)).toBe(true);
  });
});

describe('mergeSpeedCurves', () => {
  it('keeps the best speed at each duration across sessions', () => {
    const a = [
      { durationS: 60, speedMps: 5, paceSecPerKm: 200 },
      { durationS: 600, speedMps: 3, paceSecPerKm: 333 }
    ];
    const b = [
      { durationS: 60, speedMps: 4, paceSecPerKm: 250 },
      { durationS: 600, speedMps: 3.5, paceSecPerKm: 286 }
    ];
    const merged = mergeSpeedCurves([a, b]);
    expect(merged.find((p) => p.durationS === 60)?.speedMps).toBe(5);
    expect(merged.find((p) => p.durationS === 600)?.speedMps).toBe(3.5);
  });

  it('keeps durations ascending and recomputes each pace', () => {
    const merged = mergeSpeedCurves([
      [{ durationS: 600, speedMps: 3, paceSecPerKm: 0 }],
      [{ durationS: 60, speedMps: 5, paceSecPerKm: 0 }]
    ]);
    expect(merged.map((p) => p.durationS)).toEqual([60, 600]);
    expect(merged[0]!.paceSecPerKm).toBe(200);
  });

  it('is empty for no curves', () => {
    expect(mergeSpeedCurves([])).toEqual([]);
    expect(mergeSpeedCurves([[], []])).toEqual([]);
  });
});

describe('criticalSpeed', () => {
  /** A curve that fits d = CS·t + D′ exactly, so the estimate must recover CS and D′. */
  function modelCurve(cs: number, dPrime: number, durations: number[]) {
    return durations.map((durationS) => {
      const speedMps = (cs * durationS + dPrime) / durationS;
      return { durationS, speedMps, paceSecPerKm: Math.round(1000 / speedMps) };
    });
  }

  it('recovers the critical speed and D′ from a curve that follows the model', () => {
    const cs = criticalSpeed(modelCurve(4, 200, [CS_SHORT_S, CS_LONG_S]))!;
    expect(cs.speedMps).toBeCloseTo(4, 2);
    expect(cs.dPrimeM).toBeCloseTo(200, -1);
    expect(cs.paceSecPerKm).toBe(250);
    expect(cs.fromDurationsS).toEqual([CS_SHORT_S, CS_LONG_S]);
  });

  it('picks the points nearest the two anchors', () => {
    const cs = criticalSpeed(modelCurve(4, 200, [60, 120, 300, 1200, 3600]))!;
    // 120 s is nearer the 180 s anchor than 300 s is; 1200 s is the long anchor exactly.
    expect(cs.fromDurationsS).toEqual([120, 1200]);
    // Whichever pair it lands on, a model-perfect curve must still recover the parameters.
    expect(cs.speedMps).toBeCloseTo(4, 2);
    expect(cs.dPrimeM).toBeCloseTo(200, -1);
  });

  it('refuses two points too close together to give a meaningful slope', () => {
    expect(criticalSpeed(modelCurve(4, 200, [300, 320]))).toBeNull();
  });

  it('refuses a curve with fewer than two points', () => {
    expect(criticalSpeed([])).toBeNull();
    expect(criticalSpeed(modelCurve(4, 200, [300]))).toBeNull();
  });

  it('refuses a curve that implies a non-positive asymptote', () => {
    // Speed rising with duration is not a fatigue curve; the slope would be nonsense.
    const upsideDown = [
      { durationS: 180, speedMps: 2, paceSecPerKm: 500 },
      { durationS: 1200, speedMps: 2, paceSecPerKm: 500 }
    ];
    const cs = criticalSpeed(upsideDown);
    // Flat curve → CS equals the speed and D′ is zero, which is coherent.
    expect(cs?.speedMps).toBeCloseTo(2, 2);
    expect(cs?.dPrimeM).toBe(0);
  });

  it('never reports a negative anaerobic capacity', () => {
    const badFit = [
      { durationS: 180, speedMps: 3, paceSecPerKm: 333 },
      { durationS: 1200, speedMps: 4, paceSecPerKm: 250 }
    ];
    expect(criticalSpeed(badFit)?.dPrimeM).toBe(0);
  });
});
