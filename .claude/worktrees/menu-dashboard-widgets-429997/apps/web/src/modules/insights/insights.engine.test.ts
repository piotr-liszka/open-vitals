import { describe, it, expect } from 'vitest';
import { METRICS, type MetricSpec } from '$lib/server/garmin/metric-specs';
import type { GarminMetricName } from '$lib/server/interfaces';
import type { DayPoint } from '$lib/metric-series';
import {
  DEFAULT_INSIGHTS_CONFIG,
  computeAnomalies,
  computeCorrelations,
  computeInsights,
  computeReadiness,
  computeTrends,
  type MetricSeriesInput
} from './insights.engine';

function specFor(key: GarminMetricName): MetricSpec {
  const spec = METRICS.find((m) => m.key === key);
  if (!spec) throw new Error(`no spec for ${key}`);
  return spec;
}

function addDay(iso: string, n: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Build a series of consecutive dated points from raw values (nulls allowed). */
function series(
  key: GarminMetricName,
  values: Array<number | null>,
  start = '2026-03-01'
): MetricSeriesInput {
  const days: DayPoint[] = values.map((value, i) => ({ date: addDay(start, i), value }));
  return { spec: specFor(key), days };
}

describe('computeReadiness', () => {
  it('weights subscores over present contributors and bands the score', () => {
    // body_battery [40,40,60,50,60]: mean 50, sample-std 10, latest 60 → rawZ +1 (up), subscore 65.
    // hrv        [60,60,40,50,40]: mean 50, sample-std 10, latest 40 → rawZ -1 (down), subscore 35.
    // score = (65*.30 + 35*.25) / .55 = 28.25/.55 = 51.36 → 51 → 'moderate'.
    const readiness = computeReadiness(
      [series('body_battery', [40, 40, 60, 50, 60]), series('hrv', [60, 60, 40, 50, 40])],
      DEFAULT_INSIGHTS_CONFIG
    );
    expect(readiness).not.toBeNull();
    expect(readiness!.score).toBe(51);
    expect(readiness!.band).toBe('moderate');
    expect(readiness!.basisDays).toBe(5);

    const bb = readiness!.drivers.find((d) => d.key === 'body_battery')!;
    expect(bb.z).toBe(1);
    expect(bb.direction).toBe('up');
    expect(bb.contribution).toBe(35); // round(65 * .30/.55)

    const hrv = readiness!.drivers.find((d) => d.key === 'hrv')!;
    expect(hrv.z).toBe(-1);
    expect(hrv.direction).toBe('down');
    expect(hrv.contribution).toBe(16); // round(35 * .25/.55)
  });

  it('returns null when fewer than two contributors qualify', () => {
    expect(
      computeReadiness([series('body_battery', [40, 40, 60, 50, 60])], DEFAULT_INSIGHTS_CONFIG)
    ).toBeNull();
  });

  it('returns null when a contributor lacks the minimum baseline days', () => {
    // body_battery has 5 points but hrv only 4 (< MIN_BASELINE_DAYS) → only 1 qualifies → null.
    const readiness = computeReadiness(
      [series('body_battery', [40, 40, 60, 50, 60]), series('hrv', [40, 50, 60, 55])],
      DEFAULT_INSIGHTS_CONFIG
    );
    expect(readiness).toBeNull();
  });
});

describe('computeTrends', () => {
  it('orients a goodWhen=down metric: falling resting HR is improving', () => {
    // rhr [60,60,50,50]: recent [50,50]=50, earlier [60,60]=60 → Δ -16.67% → improving (down-good).
    const [trend] = computeTrends([series('resting_heart_rate', [60, 60, 50, 50])], DEFAULT_INSIGHTS_CONFIG);
    expect(trend!.direction).toBe('improving');
    expect(trend!.magnitudePct).toBe(-16.67);
    expect(trend!.recentAvg).toBe(50);
    expect(trend!.earlierAvg).toBe(60);
  });

  it('marks a sub-threshold move as stable', () => {
    // steps [1000,1010,990,1005]: recent 997.5 vs earlier 1005 → -0.75% (< STABLE_PCT) → stable.
    const [trend] = computeTrends([series('steps', [1000, 1010, 990, 1005])], DEFAULT_INSIGHTS_CONFIG);
    expect(trend!.direction).toBe('stable');
    expect(trend!.magnitudePct).toBe(-0.75);
  });

  it('omits a metric with fewer than four non-null points', () => {
    expect(computeTrends([series('steps', [1, 2, 3])], DEFAULT_INSIGHTS_CONFIG)).toEqual([]);
  });
});

describe('computeAnomalies', () => {
  // steps: eight 0s + one 30 → mean 30/9, std 10, outlier z = 8/3 ≈ 2.67 (moderate, up).
  const steps = series('steps', [0, 0, 0, 0, 0, 0, 0, 0, 30]);
  // hrv: ten 0s + one 40 → outlier z ≈ 3.02 (strong, up).
  const hrv = series('hrv', [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 40]);

  it('sorts by |z| desc and labels severity/direction', () => {
    const anomalies = computeAnomalies([steps, hrv], DEFAULT_INSIGHTS_CONFIG);
    expect(anomalies.length).toBe(2);
    expect(anomalies[0]!.key).toBe('hrv');
    expect(anomalies[0]!.z).toBe(3.02);
    expect(anomalies[0]!.severity).toBe('strong');
    expect(anomalies[0]!.direction).toBe('up');
    expect(anomalies[1]!.key).toBe('steps');
    expect(anomalies[1]!.z).toBe(2.67);
    expect(anomalies[1]!.severity).toBe('moderate');
  });

  it('caps at MAX_ANOMALIES keeping the strongest', () => {
    const anomalies = computeAnomalies([steps, hrv], { ...DEFAULT_INSIGHTS_CONFIG, maxAnomalies: 1 });
    expect(anomalies.length).toBe(1);
    expect(anomalies[0]!.key).toBe('hrv');
  });

  it('is inclusive at exactly the z threshold', () => {
    // steps outlier |z| is exactly 8/3.
    const atThreshold = computeAnomalies([steps], { ...DEFAULT_INSIGHTS_CONFIG, anomalyZ: 8 / 3 });
    expect(atThreshold.length).toBe(1);
    const justAbove = computeAnomalies([steps], { ...DEFAULT_INSIGHTS_CONFIG, anomalyZ: 8 / 3 + 1e-9 });
    expect(justAbove.length).toBe(0);
  });

  it('breaks |z| ties by newest date first', () => {
    // Two metrics with an identical outlier shape but the second dated one day later.
    const a = series('steps', [0, 0, 0, 0, 0, 0, 0, 0, 30], '2026-03-01');
    const b = series('calories', [0, 0, 0, 0, 0, 0, 0, 0, 30], '2026-03-02');
    const anomalies = computeAnomalies([a, b], DEFAULT_INSIGHTS_CONFIG);
    expect(anomalies.length).toBe(2);
    expect(anomalies[0]!.key).toBe('calories'); // 2026-03-10 is newer than 2026-03-09
    expect(anomalies[0]!.date > anomalies[1]!.date).toBe(true);
  });
});

describe('computeCorrelations', () => {
  it('accepts a strongly correlated pair with a plain-language phrasing', () => {
    const sleep = series('sleep', [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    const hrv = series('hrv', [2, 4, 6, 8, 10, 12, 14, 16, 18, 20]); // = 2 * sleep → r = 1
    const [corr] = computeCorrelations([sleep, hrv], DEFAULT_INSIGHTS_CONFIG);
    expect(corr).toBeDefined();
    expect(corr!.a).toBe('sleep');
    expect(corr!.b).toBe('hrv');
    expect(corr!.r).toBe(1);
    expect(corr!.n).toBe(10);
    expect(corr!.strength).toBe('strong');
    expect(corr!.lag).toBe(0);
    expect(corr!.phrasing).toBe('Więcej „Sen” zwykle wiąże się z wyższym „HRV”.');
  });

  it('rejects a pair with fewer than MIN_CORR_N aligned days', () => {
    const stress = series('stress', [1, 2, 3, 4, 5]);
    const bb = series('body_battery', [5, 4, 3, 2, 1]);
    expect(computeCorrelations([stress, bb], DEFAULT_INSIGHTS_CONFIG)).toEqual([]);
  });

  it('rejects a pair below MIN_CORR_R', () => {
    const steps = series('steps', [1, 2, 1, 2, 1, 2, 1, 2]);
    const sleep = series('sleep', [5, 5, 5, 5, 5, 5, 5, 5]); // constant → r = 0
    expect(computeCorrelations([steps, sleep], DEFAULT_INSIGHTS_CONFIG)).toEqual([]);
  });
});

describe('computeInsights', () => {
  it('assembles all four insight kinds', () => {
    const result = computeInsights(
      [series('body_battery', [40, 40, 60, 50, 60]), series('hrv', [60, 60, 40, 50, 40])],
      DEFAULT_INSIGHTS_CONFIG
    );
    expect(result.readiness).not.toBeNull();
    expect(Array.isArray(result.trends)).toBe(true);
    expect(Array.isArray(result.anomalies)).toBe(true);
    expect(Array.isArray(result.correlations)).toBe(true);
  });
});
