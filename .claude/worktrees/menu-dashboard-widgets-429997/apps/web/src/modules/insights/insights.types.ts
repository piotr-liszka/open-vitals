/**
 * Contracts for the insights slice (spec 013): a deterministic readiness snapshot, per-metric
 * trends, anomaly flags, notable correlations, and life-time charts. Shared by the engine, the
 * API handler, the web view, and the MCP tools. Reuses `Lane` and `DayPoint`/`MetricFormat` so
 * there is one definition of each across slices.
 */
import type { Lane } from '$modules/metrics-dashboard/dashboard.types';
import type { DatedValue, DayPoint, MetricFormat } from '$lib/metric-series';

export type { DatedValue, DayPoint, MetricFormat };

export type ReadinessBand = 'low' | 'moderate' | 'high' | 'peak';

export interface ReadinessDriver {
  key: string;
  label: string;
  accent: Lane;
  /** Signed z of the latest reading vs its in-window baseline (actual movement, 2 dp). */
  z: number;
  /** Actual movement of the latest reading relative to baseline mean. */
  direction: 'up' | 'down';
  /** This driver's points added to the 0–100 score (subscore × renormalised weight share). */
  contribution: number;
}

export interface Readiness {
  /** 0–100 composite. */
  score: number;
  band: ReadinessBand;
  drivers: ReadinessDriver[];
  /** Smallest per-contributor baseline size backing the score. */
  basisDays: number;
}

export type TrendDirection = 'improving' | 'declining' | 'stable';

export interface Trend {
  key: string;
  label: string;
  accent: Lane;
  unit: string;
  format: MetricFormat;
  /** Oriented by the metric's `goodWhen`. */
  direction: TrendDirection;
  /** Signed % change recent-vs-earlier half; null when the earlier mean is 0. */
  magnitudePct: number | null;
  recentAvg: number;
  earlierAvg: number;
}

export type AnomalyDirection = 'up' | 'down';
export type AnomalySeverity = 'moderate' | 'strong';

export interface Anomaly {
  key: string;
  label: string;
  accent: Lane;
  date: string;
  value: number;
  /** Signed z vs the in-window baseline (2 dp). */
  z: number;
  direction: AnomalyDirection;
  severity: AnomalySeverity;
}

export type CorrelationStrength = 'weak' | 'moderate' | 'strong';

export interface Correlation {
  a: string;
  b: string;
  aLabel: string;
  bLabel: string;
  /** Days `b` is shifted relative to `a` when aligning (0 for all current pairs). */
  lag: number;
  /** Pearson r (2 dp). */
  r: number;
  /** Number of aligned, both-present day pairs. */
  n: number;
  strength: CorrelationStrength;
  /** Plain-language sentence describing the relationship. */
  phrasing: string;
}

/**
 * One metric's chart plus everything a numbers-reader wants about it (spec 048).
 *
 * The statistics half of this shape came from the separate Analityka page, which rendered the same
 * chart from the same `METRICS` list over the same global range and added a summary row. Folding the
 * two pages into one made the split pointless, so the chart carries its own numbers.
 *
 * The plotted points are bucketed past ~45 days; **every statistic below is computed from the DAILY
 * series regardless**, so `best` names a real day with a real reading and `avg` averages days rather
 * than an already-averaged series.
 */
export interface MetricChart {
  key: string;
  label: string;
  accent: Lane;
  unit: string;
  format: MetricFormat;
  /** Which direction is healthy — orients `best`/`worst` and the delta's colour. */
  goodWhen: 'up' | 'down';
  /** Most recent reading in the range. */
  latest: number | null;
  min: number | null;
  max: number | null;
  /** Mean of the days that have a reading, at the metric's precision. */
  avg: number | null;
  /** Sum — only for counters like steps/calories (`MetricSpec.summable`); null otherwise. */
  total: number | null;
  /** Percent change first→last available day; null when the first reading is 0. */
  deltaPct: number | null;
  /** Days with a reading. */
  count: number;
  /** Days in the range, whether or not they have a reading. */
  rangeDays: number;
  /** Healthiest / least-healthy day, oriented by `goodWhen`. */
  best: DatedValue | null;
  worst: DatedValue | null;
  /** The PLOTTED points (oldest→newest), bucketed for long ranges; nulls preserved for gaps. */
  days: DayPoint[];
  /** Non-null plotted values only (oldest→newest) — convenient for charts. */
  series: number[];
}

/* ---------------- condition / regeneration (spec 022) ---------------- */

/** Last night's sleep, as far as the stored payload actually reports it. Every field may be null. */
export interface SleepNight {
  /** The day the night is attributed to. */
  day: string;
  /** Time actually asleep, seconds. */
  totalS: number;
  deepS: number | null;
  lightS: number | null;
  remS: number | null;
  awakeS: number | null;
  /** Garmin sleep score, 0–100. */
  score: number | null;
  /** Local wall clock `HH:MM`. */
  bedTime: string | null;
  wakeTime: string | null;
  /** Asleep ÷ in-bed, percent; null when the payload cannot support an honest figure. */
  efficiencyPct: number | null;
}

/** One recovery channel measured against its own in-window baseline. */
export interface ConditionMetric {
  key: string;
  label: string;
  accent: Lane;
  unit: string;
  format: MetricFormat;
  goodWhen: 'up' | 'down';
  /** Day the latest reading is from. */
  day: string;
  latest: number;
  /** Mean of the in-window readings BEFORE the latest one; null when there is only one. */
  baseline: number | null;
  /** Signed % of latest vs baseline (1 dp); null without a baseline. */
  deltaPct: number | null;
  direction: 'up' | 'down' | 'flat';
  /** Whether the move is the healthy direction; null when flat. */
  favourable: boolean | null;
}

/** One intraday reading: an instant (epoch ms, UTC) and the level measured at it. */
export interface IntradayPoint {
  at: number;
  /** null where the watch recorded nothing — the gap keeps its slot on the time lattice. */
  value: number | null;
}

export type RecoveryState = 'rested' | 'steady' | 'strained' | 'unknown';

/* ------------------------------------------------------------------ *
 * Garmin's own Training Readiness (spec 059)
 * ------------------------------------------------------------------ */

/**
 * Which score the condition card is leading with. `own` is this app's composite
 * (`insights.engine.ts`, four channels against their own 30-day baselines); `garmin` is Garmin's
 * Training Readiness, which additionally weighs recovery time, acute load and ACWR — which is why
 * the two legitimately disagree, sometimes wildly.
 */
export type ReadinessSource = 'garmin' | 'own';

/** Garmin's level for the day, normalised. `unknown` keeps an unrecognised upstream string honest. */
export type GarminReadinessLevel = 'prime' | 'high' | 'moderate' | 'low' | 'poor' | 'unknown';

/** One input Garmin reports as a percentage backing (or dragging) its score. */
export interface GarminReadinessFactor {
  key: string;
  label: string;
  accent: Lane;
  /** 0–100, as Garmin reports it. NOT a share of the score — the five do not sum to it. */
  percent: number;
}

/** Hours Garmin says remain until full recovery. */
export interface RecoveryTime {
  /** Day the figure was reported for. */
  day: string;
  /** Whole hours remaining; 0 means recovered. */
  hours: number;
  /** Rendered Polish phrase for Garmin's change code, or null when absent/unrecognised. */
  change: string | null;
}

/** Garmin's readiness verdict for the newest day that carries one. */
export interface GarminReadiness {
  day: string;
  /** 0–100, Garmin's own composite. */
  score: number;
  level: GarminReadinessLevel;
  /** The state badge equivalent, so both sources drive the card the same way. */
  state: RecoveryState;
  /** Sleep, sleep history, HRV, recovery, load, stress — present ones only, in reading order. */
  factors: GarminReadinessFactor[];
  /** Garmin's weekly average HRV in ms, when reported. */
  hrvWeeklyAvg: number | null;
  /** Garmin's acute training load, when reported. */
  acuteLoad: number | null;
  /** One plain-Polish sentence for this source, mirroring `ConditionSnapshot.summary`. */
  summary: string;
}

/** "How am I right now" — the start page's opening answer. */
export interface ConditionSnapshot {
  /** Day the snapshot describes, or null when nothing is dated. */
  day: string | null;
  readiness: Readiness | null;
  sleep: SleepNight | null;
  /** Sleep duration as a trend channel (latest vs baseline). */
  sleepTrend: ConditionMetric | null;
  /** Body Battery, HRV, resting HR, stress — in reading order, present ones only. */
  channels: ConditionMetric[];
  /**
   * Body Battery's last 24 hours, on a regular time lattice ending at the newest reading. Empty
   * when the payload carries no intraday readings. Daily maxima answer "how have the weeks gone";
   * this answers "what happened to me since yesterday", which is what the card is asking.
   */
  batteryDay: IntradayPoint[];
  state: RecoveryState;
  /** One plain-Polish sentence. Never medical advice. */
  summary: string;
  /**
   * Garmin's own Training Readiness for the newest day it reported one (spec 059); null when the
   * account, device or day has none. The card can lead with either this or `readiness`.
   */
  garmin: GarminReadiness | null;
  /**
   * Garmin's recovery timer. Shown whichever source leads — it is a fact about the body, not about
   * a scoring method, and nothing in this app estimates it when Garmin does not report it.
   */
  recovery: RecoveryTime | null;
}

/** The engine's output (surface-independent). */
export interface ComputedInsights {
  readiness: Readiness | null;
  trends: Trend[];
  anomalies: Anomaly[];
  correlations: Correlation[];
}

export interface InsightsData {
  connected: boolean;
  /** detailed_analytics consent (web gate; MCP is not consent-gated). */
  enabled: boolean;
  window: number;
  start: string;
  end: string;
  readiness: Readiness | null;
  trends: Trend[];
  anomalies: Anomaly[];
  correlations: Correlation[];
  charts: MetricChart[];
  /** Condition & regeneration (spec 022); null when not connected/consented or with no data. */
  condition: ConditionSnapshot | null;
}
