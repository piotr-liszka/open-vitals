import { describe, it, expect } from 'vitest';
import {
  CONFIDENT_EXTRAPOLATION,
  MAX_EXTRAPOLATION,
  criticalSpeedTime,
  predictRaces,
  riegelTime,
  withPredictionTrend,
  type KnownBest
} from './race-predictor';

const best = (metres: number, timeS: number, label = `${metres} m`): KnownBest => ({
  metres,
  timeS,
  label,
  day: '2026-05-01'
});

describe('riegelTime', () => {
  it('predicts the same time for the same distance', () => {
    expect(riegelTime(1200, 5000, 5000)).toBe(1200);
  });

  it('predicts slower than linear over a longer distance', () => {
    // 20 min for 5 km. Linear would be 40 min for 10 km; Riegel says a little more.
    const t = riegelTime(1200, 5000, 10_000)!;
    expect(t).toBeGreaterThan(2400);
    expect(t).toBeLessThan(2600);
  });

  it('predicts faster than linear over a shorter distance', () => {
    const t = riegelTime(2400, 10_000, 5000)!;
    expect(t).toBeLessThan(1200);
  });

  it('honours a different fatigue exponent', () => {
    const gentle = riegelTime(1200, 5000, 10_000, 1.0)!;
    const steep = riegelTime(1200, 5000, 10_000, 1.15)!;
    expect(gentle).toBe(2400);
    expect(steep).toBeGreaterThan(gentle);
  });

  it('refuses unusable inputs', () => {
    expect(riegelTime(0, 5000, 10_000)).toBeNull();
    expect(riegelTime(1200, 0, 10_000)).toBeNull();
    expect(riegelTime(1200, 5000, 0)).toBeNull();
  });
});

describe('criticalSpeedTime', () => {
  it('spends the anaerobic reserve and runs the rest at critical speed', () => {
    // 10 km with CS 4 m/s and 200 m of reserve: 9800 / 4 = 2450 s.
    expect(criticalSpeedTime(4, 200, 10_000)).toBe(2450);
  });

  it('works with no reserve at all', () => {
    expect(criticalSpeedTime(4, null, 10_000)).toBe(2500);
    expect(criticalSpeedTime(4, 0, 10_000)).toBe(2500);
  });

  it('does not apply where the reserve alone would cover the distance', () => {
    expect(criticalSpeedTime(4, 500, 400)).toBeNull();
  });

  it('refuses unusable inputs', () => {
    expect(criticalSpeedTime(null, 200, 10_000)).toBeNull();
    expect(criticalSpeedTime(0, 200, 10_000)).toBeNull();
    expect(criticalSpeedTime(4, 200, 0)).toBeNull();
  });
});

describe('predictRaces', () => {
  it('predicts each distance from the best CLOSEST to it', () => {
    const predictions = predictRaces([best(1000, 210, '1 km'), best(10_000, 2400, '10 km')]);
    // The half must come from the 10 km best, not from the 1 km one.
    expect(predictions.find((p) => p.key === 'half')?.fromLabel).toBe('10 km');
    expect(predictions.find((p) => p.key === '5k')?.fromLabel).toBe('10 km');
  });

  it('is exact when a best IS the target distance', () => {
    const [tenK] = predictRaces([best(10_000, 2400, '10 km')], {
      targets: [{ key: '10k', label: '10 km', metres: 10_000 }]
    });
    expect(tenK!.riegelS).toBe(2400);
    expect(tenK!.extrapolation).toBe(1);
    expect(tenK!.confident).toBe(true);
    expect(tenK!.paceSecPerKm).toBe(240);
  });

  it('refuses to predict a marathon from a 1 km best — that is fiction, not extrapolation', () => {
    const predictions = predictRaces([best(1000, 210, '1 km')]);
    const marathon = predictions.find((p) => p.key === 'marathon');
    // 42× is far beyond the limit, so there is no Riegel number at all.
    expect(marathon?.riegelS ?? null).toBeNull();
  });

  it('omits a distance entirely when neither method can speak to it', () => {
    // A 1 km best is 5× from 5 km — already past the limit — so an athlete who has only ever raced a
    // kilometre gets NO race predictions rather than four flattering ones.
    expect(predictRaces([best(1000, 210, '1 km')])).toEqual([]);
  });

  it('starts predicting as soon as a best is close enough to a target', () => {
    // A 3 km best is 1.67× from 5 km and 3.3× from 10 km: both inside the limit, the first confident.
    const predictions = predictRaces([best(3000, 720, '3 km')]);
    expect(predictions.map((p) => p.key)).toEqual(['5k', '10k']);
    expect(predictions[0]!.confident).toBe(true);
    expect(predictions[1]!.confident).toBe(false);
  });

  it('marks a long extrapolation as not confident while still reporting it', () => {
    // 5 km → half is 4.2×… beyond MAX. 10 km → half is 2.1×, inside CONFIDENT.
    const fromFive = predictRaces([best(5000, 1200, '5 km')]).find((p) => p.key === 'half');
    expect(fromFive?.riegelS ?? null).toBeNull();

    const fromTen = predictRaces([best(10_000, 2400, '10 km')]).find((p) => p.key === 'half');
    expect(fromTen?.confident).toBe(true);
    expect(fromTen!.extrapolation!).toBeLessThanOrEqual(CONFIDENT_EXTRAPOLATION);
  });

  it('flags an extrapolation between the confident and maximum limits', () => {
    // 5 km → 15 km is 3×: past confident, inside the maximum.
    const [p] = predictRaces([best(5000, 1200, '5 km')], {
      targets: [{ key: '15k', label: '15 km', metres: 15_000 }]
    });
    expect(p!.riegelS).not.toBeNull();
    expect(p!.confident).toBe(false);
    expect(p!.extrapolation!).toBeGreaterThan(CONFIDENT_EXTRAPOLATION);
    expect(p!.extrapolation!).toBeLessThanOrEqual(MAX_EXTRAPOLATION);
  });

  it('says where each prediction came from, and when', () => {
    const [p] = predictRaces([best(10_000, 2400, '10 km')], {
      targets: [{ key: 'half', label: 'Półmaraton', metres: 21_097.5 }]
    });
    expect(p!.fromLabel).toBe('10 km');
    expect(p!.fromDay).toBe('2026-05-01');
  });

  it('adds a critical-speed estimate alongside Riegel', () => {
    const [p] = predictRaces([best(10_000, 2400, '10 km')], {
      csMps: 4,
      dPrimeM: 200,
      targets: [{ key: '10k', label: '10 km', metres: 10_000 }]
    });
    expect(p!.riegelS).toBe(2400);
    expect(p!.criticalSpeedS).toBe(2450);
  });

  it('can predict from critical speed alone, with no bests at all', () => {
    const predictions = predictRaces([], { csMps: 4, dPrimeM: 200 });
    expect(predictions).toHaveLength(4);
    for (const p of predictions) {
      expect(p.riegelS).toBeNull();
      expect(p.criticalSpeedS).not.toBeNull();
      expect(p.confident).toBe(false);
    }
  });

  it('reports nothing at all with neither bests nor a critical speed', () => {
    expect(predictRaces([])).toEqual([]);
  });

  it('ignores bests it cannot use', () => {
    expect(predictRaces([best(0, 100), best(5000, 0)])).toEqual([]);
  });

  it('keeps the target order it was given', () => {
    const predictions = predictRaces([best(10_000, 2400, '10 km')]);
    const metres = predictions.map((p) => p.metres);
    expect([...metres].sort((a, b) => a - b)).toEqual(metres);
  });
});

describe('prediction basis (spec 055)', () => {
  it('reports whether the source was a measured effort or an even-pace projection', () => {
    const target = [{ key: '10k', label: '10 km', metres: 10_000 }];
    const [measured] = predictRaces([{ ...best(10_000, 2400, '10 km'), basis: 'measured' }], {
      targets: target
    });
    expect(measured!.fromBasis).toBe('measured');

    const [projected] = predictRaces([{ ...best(10_000, 2400, '10 km'), basis: 'projected' }], {
      targets: target
    });
    expect(projected!.fromBasis).toBe('projected');
  });

  it('leaves the basis null when the caller did not say', () => {
    const [p] = predictRaces([best(10_000, 2400)], {
      targets: [{ key: '10k', label: '10 km', metres: 10_000 }]
    });
    expect(p!.fromBasis).toBeNull();
  });
});

describe('withPredictionTrend', () => {
  const TARGET = [{ key: '10k', label: '10 km', metres: 10_000 }];
  const at = (timeS: number): ReturnType<typeof predictRaces> =>
    predictRaces([best(10_000, timeS, '10 km')], { targets: TARGET });

  it('reports a positive delta when the athlete got faster', () => {
    const [p] = withPredictionTrend(at(2400), at(2500), '2026-05-11');
    expect(p!.trend).toEqual({ deltaS: 100, previousS: 2500, sinceDay: '2026-05-11' });
  });

  it('reports a negative delta when the prediction got slower', () => {
    // Reachable in real data: a newly measured, steadier 10 km replaces a sharp 5 km extrapolation.
    const [p] = withPredictionTrend(at(2500), at(2400), '2026-05-11');
    expect(p!.trend?.deltaS).toBe(-100);
  });

  it('reports an honest zero when nothing changed', () => {
    const [p] = withPredictionTrend(at(2400), at(2400), '2026-05-11');
    expect(p!.trend?.deltaS).toBe(0);
  });

  it('omits the trend entirely when the earlier snapshot has nothing to compare', () => {
    const [p] = withPredictionTrend(at(2400), [], '2026-05-11');
    expect(p!.trend).toBeUndefined();
    expect('trend' in p!).toBe(false);
  });

  it('omits the trend when the earlier snapshot had only a critical-speed estimate', () => {
    const previous = predictRaces([], { csMps: 4, dPrimeM: 200, targets: TARGET });
    expect(previous[0]!.riegelS).toBeNull();
    expect(withPredictionTrend(at(2400), previous, '2026-05-11')[0]!.trend).toBeUndefined();
  });

  it('leaves a current row Riegel cannot reach untrended', () => {
    const current = predictRaces([], { csMps: 4, dPrimeM: 200, targets: TARGET });
    const [p] = withPredictionTrend(current, at(2400), '2026-05-11');
    expect(p!.trend).toBeUndefined();
  });

  it('matches rows by distance key, never by position', () => {
    const current = predictRaces([best(10_000, 2400, '10 km')]);
    const previous = predictRaces([best(10_000, 2500, '10 km')]).slice(1);
    const trended = withPredictionTrend(current, previous, '2026-05-11');
    for (const p of trended) {
      const prev = previous.find((q) => q.key === p.key);
      if (prev?.riegelS == null || p.riegelS === null) expect(p.trend).toBeUndefined();
      else expect(p.trend?.previousS).toBe(prev.riegelS);
    }
  });
});
