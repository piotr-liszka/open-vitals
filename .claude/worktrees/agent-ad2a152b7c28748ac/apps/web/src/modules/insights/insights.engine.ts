/**
 * Deterministic insights engine (spec 013) — the heart of the feature. NO external LLM, NO I/O,
 * NO `Date`, NO random: given per-metric day series + a tunable config it computes per-metric trends,
 * anomaly flags, and notable correlations. All maths is pure and fully unit-tested; a connected AI
 * client turns the output into prose.
 *
 * Readiness LEFT this module in spec 084. It used to be the fourth thing computed here — four metrics
 * z-scored against their own last 30 days — and that shared the window and the statistics helpers with
 * everything else in the file. It no longer shares either: the score is now absolute, built from
 * Garmin's own factors and a live recovery timer, with no window at all. It lives in
 * `insights.readiness.ts`; `computeInsights` accepts the finished object rather than deriving one.
 *
 * The 30-day deviation maths stays here, because deviation from a recent norm is the right question
 * for trends, anomalies and correlations — it was only ever the wrong question for a readiness score.
 */
import type { GarminMetricName } from '$lib/server/interfaces';
import type { MetricSpec } from '$lib/server/garmin/metric-specs';
import type { DayPoint } from '$lib/metric-series';
import type {
  Anomaly,
  ComputedInsights,
  Correlation,
  CorrelationStrength,
  Readiness,
  Trend,
  TrendDirection
} from './insights.types';

/** One metric's spec paired with its day-by-day values across the window (oldest→newest). */
export interface MetricSeriesInput {
  spec: MetricSpec;
  days: DayPoint[];
}

export interface CorrelationPair {
  a: GarminMetricName;
  b: GarminMetricName;
  /** Days `b` is shifted back relative to `a` when aligning. */
  lag: number;
}

export interface InsightsConfig {
  /** Minimum non-null in-window points a readiness contributor needs to qualify. */
  minBaselineDays: number;
  /** |Δ%| below this is a "stable" trend. */
  stablePct: number;
  /** |z| at/above this flags an anomaly. */
  anomalyZ: number;
  /** Cap on reported anomalies. */
  maxAnomalies: number;
  /** Minimum aligned pairs for a correlation to be reported. */
  minCorrN: number;
  /** Minimum |r| for a correlation to be reported. */
  minCorrR: number;
  /** Predefined correlation pairs (with lag). */
  correlationPairs: CorrelationPair[];
}

/** Documented default constants — all tunable via a passed config. */
export const DEFAULT_INSIGHTS_CONFIG: InsightsConfig = {
  minBaselineDays: 5,
  stablePct: 3,
  anomalyZ: 2,
  maxAnomalies: 8,
  minCorrN: 8,
  minCorrR: 0.3,
  correlationPairs: [
    { a: 'sleep', b: 'hrv', lag: 0 },
    { a: 'sleep', b: 'resting_heart_rate', lag: 0 },
    { a: 'stress', b: 'body_battery', lag: 0 },
    { a: 'steps', b: 'sleep', lag: 0 }
  ]
};

/* ---------------- pure statistics helpers ---------------- */

function round(n: number, decimals = 0): number {
  const f = 10 ** decimals;
  return Math.round(n * f) / f;
}

function round2(n: number): number {
  return round(n, 2);
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

export function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

/** Sample standard deviation (n−1). Returns 0 for fewer than 2 points. */
export function sampleStd(values: number[]): number {
  const n = values.length;
  if (n < 2) return 0;
  const m = mean(values);
  const variance = values.reduce((sum, v) => sum + (v - m) ** 2, 0) / (n - 1);
  return Math.sqrt(variance);
}

export function pearson(xs: number[], ys: number[]): number {
  const n = xs.length;
  if (n === 0 || ys.length !== n) return 0;
  const mx = mean(xs);
  const my = mean(ys);
  let num = 0;
  let dx = 0;
  let dy = 0;
  for (let i = 0; i < n; i++) {
    const a = xs[i]! - mx;
    const b = ys[i]! - my;
    num += a * b;
    dx += a * a;
    dy += b * b;
  }
  const den = Math.sqrt(dx * dy);
  return den === 0 ? 0 : num / den;
}

/** Days since 1970-01-01 for a YYYY-MM-DD string (pure integer maths — no `Date`). */
function toDayNumber(iso: string): number {
  const [y, m, d] = iso.split('-').map(Number) as [number, number, number];
  const yy = m <= 2 ? y - 1 : y;
  const era = Math.floor((yy >= 0 ? yy : yy - 399) / 400);
  const yoe = yy - era * 400;
  const doy = Math.floor((153 * (m > 2 ? m - 3 : m + 9) + 2) / 5) + d - 1;
  const doe = yoe * 365 + Math.floor(yoe / 4) - Math.floor(yoe / 100) + doy;
  return era * 146097 + doe - 719468;
}

function nonNull(days: DayPoint[]): Array<{ date: string; value: number }> {
  return days.filter((d): d is { date: string; value: number } => d.value !== null);
}

/* ---------------- trends ---------------- */

export function computeTrends(series: MetricSeriesInput[], config: InsightsConfig): Trend[] {
  const trends: Trend[] = [];

  for (const { spec, days } of series) {
    const present = nonNull(days);
    if (present.length < 4) continue;

    const n = present.length;
    const recentCount = Math.ceil(n / 2);
    const recentValues = present.slice(n - recentCount).map((p) => p.value);
    const earlierValues = present.slice(0, n - recentCount).map((p) => p.value);

    const recentAvg = mean(recentValues);
    const earlierAvg = mean(earlierValues);
    const signedMove = recentAvg - earlierAvg;
    const magnitudePct = earlierAvg === 0 ? null : round2((signedMove / Math.abs(earlierAvg)) * 100);

    let direction: TrendDirection;
    if (magnitudePct === null || Math.abs(magnitudePct) < config.stablePct) {
      direction = 'stable';
    } else {
      const improving = spec.goodWhen === 'up' ? signedMove > 0 : signedMove < 0;
      direction = improving ? 'improving' : 'declining';
    }

    trends.push({
      key: spec.key,
      label: spec.label,
      accent: spec.accent,
      unit: spec.unit,
      format: spec.format,
      direction,
      magnitudePct,
      recentAvg: round2(recentAvg),
      earlierAvg: round2(earlierAvg)
    });
  }

  return trends;
}

/* ---------------- anomalies ---------------- */

export function computeAnomalies(series: MetricSeriesInput[], config: InsightsConfig): Anomaly[] {
  const found: Anomaly[] = [];

  for (const { spec, days } of series) {
    const present = nonNull(days);
    if (present.length < 2) continue;

    const values = present.map((p) => p.value);
    const baseline = mean(values);
    const std = sampleStd(values);
    if (std === 0) continue;

    for (const p of present) {
      const z = (p.value - baseline) / std;
      if (Math.abs(z) < config.anomalyZ) continue;
      found.push({
        key: spec.key,
        label: spec.label,
        accent: spec.accent,
        date: p.date,
        value: p.value,
        z: round2(z),
        direction: z > 0 ? 'up' : 'down',
        severity: Math.abs(z) >= 3 ? 'strong' : 'moderate'
      });
    }
  }

  // Strongest first; newest first on ties.
  found.sort((a, b) => {
    const byZ = Math.abs(b.z) - Math.abs(a.z);
    if (byZ !== 0) return byZ;
    return a.date < b.date ? 1 : a.date > b.date ? -1 : 0;
  });

  return found.slice(0, config.maxAnomalies);
}

/* ---------------- correlations ---------------- */

function strengthFor(absR: number): CorrelationStrength {
  if (absR >= 0.7) return 'strong';
  if (absR >= 0.5) return 'moderate';
  return 'weak';
}

function phraseCorrelation(aLabel: string, bLabel: string, r: number): string {
  const dir = r >= 0 ? 'wyższym' : 'niższym';
  return `Więcej „${aLabel}” zwykle wiąże się z ${dir} „${bLabel}”.`;
}

export function computeCorrelations(series: MetricSeriesInput[], config: InsightsConfig): Correlation[] {
  const byKey = new Map(series.map((s) => [s.spec.key, s]));
  const out: Correlation[] = [];

  for (const pair of config.correlationPairs) {
    const aEntry = byKey.get(pair.a);
    const bEntry = byKey.get(pair.b);
    if (!aEntry || !bEntry) continue;

    // Index b by day-number so we can align a[d] with b[d - lag] (lag is 0 for all current pairs).
    const bByDay = new Map<number, number>();
    for (const p of nonNull(bEntry.days)) bByDay.set(toDayNumber(p.date), p.value);

    const xs: number[] = [];
    const ys: number[] = [];
    for (const p of nonNull(aEntry.days)) {
      const partner = bByDay.get(toDayNumber(p.date) - pair.lag);
      if (partner === undefined) continue;
      xs.push(p.value);
      ys.push(partner);
    }

    const n = xs.length;
    if (n < config.minCorrN) continue;
    const r = round2(pearson(xs, ys));
    if (Math.abs(r) < config.minCorrR) continue;

    out.push({
      a: pair.a,
      b: pair.b,
      aLabel: aEntry.spec.label,
      bLabel: bEntry.spec.label,
      lag: pair.lag,
      r,
      n,
      strength: strengthFor(Math.abs(r)),
      phrasing: phraseCorrelation(aEntry.spec.label, bEntry.spec.label, r)
    });
  }

  return out;
}

/* ---------------- top-level ---------------- */

/**
 * Trends, anomalies and correlations over the window, with readiness passed THROUGH rather than
 * derived (spec 084).
 *
 * Readiness takes inputs this function is not given — Garmin's factors, the HRV band, the live recovery
 * countdown — and has no window of its own, so deriving it here would mean either widening this
 * signature until it is two functions in a trench coat, or quietly recomputing a worse score from the
 * series that happen to be at hand. The caller builds it with `computeReadiness` and hands it over.
 */
export function computeInsights(
  series: MetricSeriesInput[],
  config: InsightsConfig = DEFAULT_INSIGHTS_CONFIG,
  readiness: Readiness | null = null
): ComputedInsights {
  return {
    readiness,
    trends: computeTrends(series, config),
    anomalies: computeAnomalies(series, config),
    correlations: computeCorrelations(series, config)
  };
}
