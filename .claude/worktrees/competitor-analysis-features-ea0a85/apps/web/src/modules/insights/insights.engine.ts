/**
 * Deterministic insights engine (spec 013) — the heart of the feature. NO external LLM, NO I/O,
 * NO `Date`, NO random: given per-metric day series + a tunable config it computes a readiness
 * snapshot, per-metric trends, anomaly flags, and notable correlations. All maths is pure and
 * fully unit-tested; a connected AI client turns the output into prose.
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
  ReadinessBand,
  ReadinessDriver,
  ReadinessLimit,
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
  /** Readiness contributors → weight. Orientation comes from each metric's `goodWhen`. */
  readinessWeights: Partial<Record<GarminMetricName, number>>;
  /**
   * Recovery-time ceiling: the hours on Garmin's recovery timer at which readiness is capped at 0.
   * The cap falls linearly from 100 at "recovered" (spec 070). 72 h is a little past the ~4-day
   * maximum a Garmin device will ever put on the clock, so a real timer never quite pins the score
   * to zero — being maximally fatigued is not the same as being dead.
   */
  recoveryCeilingHours: number;
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
  readinessWeights: {
    body_battery: 0.3,
    sleep: 0.3,
    hrv: 0.25,
    resting_heart_rate: 0.15
  },
  recoveryCeilingHours: 72,
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

/* ---------------- readiness ---------------- */

/**
 * The highest readiness a recovery timer of `minutes` still allows, 0–100.
 *
 * WHY A CEILING AND NOT A FIFTH WEIGHTED CHANNEL (spec 070). The four channels are a *relative*
 * index: each is z-scored against its own last 30 days, so the score answers "how do I compare with
 * my own normal". That question has a blind spot by construction — an athlete who has been deep in
 * training for a month has a tired baseline, so being tired reads as z ≈ 0, i.e. "normal", i.e. 50.
 * Averaging a recovery term into that mix would move the number a few points and leave the blind
 * spot intact: on the morning this was investigated the four channels scored 40 while Garmin scored
 * 1, and a weighted recovery term would have produced ~34.
 *
 * Garmin's own Training Readiness is not a mean either. Its factors that morning were 68 / 71 / 73 /
 * 19 / 36 / 60 — a weighted mean of those is ~55, and Garmin answered 1, tagged
 * `RECOVERY_TIME_LIMITED`. One crushing input pins the score; it does not get averaged away. That is
 * also the physiologically honest model: sleeping well does not discharge a 61-hour recovery debt.
 *
 * So the channels keep answering their own question and the timer sets a lid over the top. A 24-hour
 * timer caps readiness at 67, 48 hours at 33, 61 hours at 15 — near Garmin's own recovery factor of
 * 19% for that same timer.
 */
export function recoveryCeiling(minutes: number, config: InsightsConfig): number {
  if (!Number.isFinite(minutes) || minutes <= 0) return 100;
  const hours = minutes / 60;
  const span = config.recoveryCeilingHours;
  if (!Number.isFinite(span) || span <= 0) return 100;
  return clamp(100 * (1 - hours / span), 0, 100);
}

export interface ReadinessInputs {
  /**
   * Minutes on Garmin's recovery timer for the latest day it reported one, or null when the account,
   * device or day has none. Null means no ceiling — the score is exactly the channel composite, which
   * is what an account without Training Readiness has always seen.
   */
  recoveryMinutes?: number | null;
}

export function computeReadiness(
  series: MetricSeriesInput[],
  config: InsightsConfig,
  inputs: ReadinessInputs = {}
): Readiness | null {
  const byKey = new Map(series.map((s) => [s.spec.key, s]));

  interface Contributor {
    key: string;
    label: string;
    accent: ReadinessDriver['accent'];
    weight: number;
    subscore: number;
    rawZ: number;
    direction: 'up' | 'down';
    basis: number;
  }

  const contributors: Contributor[] = [];

  for (const [key, weight] of Object.entries(config.readinessWeights) as Array<[GarminMetricName, number]>) {
    const entry = byKey.get(key);
    if (!entry) continue;
    const present = nonNull(entry.days);
    if (present.length < config.minBaselineDays) continue;

    const values = present.map((p) => p.value);
    const latest = values[values.length - 1]!;
    /*
     * The baseline is the days BEFORE the latest one. Including today in the norm it is measured
     * against pulls the norm towards today and shrinks every z by roughly (n-1)/n — the score drifts
     * to 50 exactly when a reading is extreme enough to matter. `buildConditionMetric` has always
     * excluded it, so until now the same card's channel deltas and its score disagreed about what
     * "your baseline" meant (spec 070).
     */
    const earlier = values.slice(0, -1);
    const baseline = mean(earlier);
    const std = sampleStd(earlier);
    const rawZ = std === 0 ? 0 : (latest - baseline) / std;
    // Orient so a "good" move is always positive.
    const orientedZ = entry.spec.goodWhen === 'down' ? -rawZ : rawZ;
    const subscore = clamp(50 + 15 * clamp(orientedZ, -3, 3), 0, 100);

    contributors.push({
      key,
      label: entry.spec.label,
      accent: entry.spec.accent,
      weight,
      subscore,
      rawZ,
      direction: rawZ >= 0 ? 'up' : 'down',
      basis: present.length
    });
  }

  if (contributors.length < 2) return null;

  const totalWeight = contributors.reduce((sum, c) => sum + c.weight, 0);
  const channelScore = round(contributors.reduce((sum, c) => sum + c.subscore * c.weight, 0) / totalWeight);

  const drivers: ReadinessDriver[] = contributors.map((c) => ({
    key: c.key,
    label: c.label,
    accent: c.accent,
    z: round2(c.rawZ),
    direction: c.direction,
    contribution: round(c.subscore * (c.weight / totalWeight))
  }));

  const basisDays = Math.min(...contributors.map((c) => c.basis));

  // The timer only ever lowers the number. A "recovered" watch does not certify a bad night's sleep
  // as readiness, so the ceiling is a cap and never a floor.
  const minutes = inputs.recoveryMinutes ?? null;
  const ceiling = minutes === null ? 100 : round(recoveryCeiling(minutes, config));
  const limitedBy: ReadinessLimit | null =
    minutes !== null && ceiling < channelScore
      ? { key: 'recovery', label: 'Czas regeneracji', minutes: Math.round(minutes), uncapped: channelScore }
      : null;

  const score = Math.min(channelScore, ceiling);

  return { score, band: bandFor(score), drivers, basisDays, limitedBy };
}

function bandFor(score: number): ReadinessBand {
  if (score < 40) return 'low';
  if (score < 60) return 'moderate';
  if (score < 80) return 'high';
  return 'peak';
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

export function computeInsights(
  series: MetricSeriesInput[],
  config: InsightsConfig = DEFAULT_INSIGHTS_CONFIG,
  inputs: ReadinessInputs = {}
): ComputedInsights {
  return {
    readiness: computeReadiness(series, config, inputs),
    trends: computeTrends(series, config),
    anomalies: computeAnomalies(series, config),
    correlations: computeCorrelations(series, config)
  };
}
