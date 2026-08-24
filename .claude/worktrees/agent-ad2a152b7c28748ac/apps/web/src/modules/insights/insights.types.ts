/**
 * Contracts for the insights slice (spec 013): a deterministic readiness snapshot, per-metric
 * trends, anomaly flags, notable correlations, and life-time charts. Shared by the engine, the
 * API handler, the web view, and the MCP tools. Reuses `Lane` and `DayPoint`/`MetricFormat` so
 * there is one definition of each across slices.
 */
import type { Lane } from '$modules/metrics-dashboard/dashboard.types';
import type { DatedValue, DayPoint, MetricFormat } from '$lib/metric-series';
import type { MessageKey } from '$lib/i18n';
import type { DayKey } from '$lib/date';

export type { DatedValue, DayPoint, MetricFormat };

export type ReadinessBand = 'low' | 'moderate' | 'high' | 'peak';

/**
 * Where a channel's number came from (spec 084). `garmin` is one of Garmin's own published factor
 * percentages; `derived` is our fallback, computed from raw payloads for a day or an account with no
 * Training Readiness. The card says which, because a derived channel is a weaker claim.
 */
export type ReadinessChannelSource = 'garmin' | 'derived';

/**
 * One channel of the readiness score (spec 084).
 *
 * An ABSOLUTE 0–100 subscore, not a deviation. Until spec 084 each channel was a z-score against its
 * own last 30 days, which answers "how do I compare with my recent normal" — a different question
 * from "how ready am I today", and one whose norm drifts as the athlete tires. See the module header
 * of `insights.readiness.ts`.
 */
export interface ReadinessDriver {
  key: string;
  /** Message key for the channel's name (spec 076) — translated by the card, not the engine. */
  labelKey: MessageKey;
  accent: Lane;
  /** The channel's own 0–100 subscore. */
  percent: number;
  source: ReadinessChannelSource;
  /**
   * The one fact behind the number, already formatted (e.g. `99 ms · 102–133`), or null when the
   * percent speaks for itself. Kept short: this is a chip, not a paragraph.
   */
  detail: string | null;
  /** This channel's points in the uncapped composite (subscore × renormalised weight share). */
  contribution: number;
}

/** Which input imposed a ceiling. */
export type ReadinessLimitKey = 'recovery' | 'hrv' | 'load';

/**
 * How sure we are about when a limit clears (spec 084). `exact` is derived, not estimated — the
 * recovery timer's zero instant. `projected` extrapolates under a stated assumption. `unknown` is an
 * honest refusal, and it propagates: `fullyReadyAt` is null whenever any active limit is unknown.
 */
export type ReadinessConfidence = 'exact' | 'projected' | 'unknown';

/**
 * Why the score is lower than its channels alone would say (specs 070, 084).
 *
 * Spec 070 introduced this for Garmin's recovery timer, on the reasoning that a crushing input must
 * pin the score rather than be averaged away — sleeping well does not discharge a 61-hour recovery
 * debt. Spec 084 generalises it: on 2026-08-17 the timer had 21 h left (ceiling 70, harmless) while
 * the athlete was HRV-unbalanced, and only the HRV ceiling explained Garmin's `LOW`. On 2026-08-14
 * BOTH the timer and the load were crushing, which is why this is now a list.
 */
export interface ReadinessLimit {
  key: ReadinessLimitKey;
  labelKey: MessageKey;
  /** The cap this limit imposed, 0–100. */
  ceiling: number;
  /** Minutes still on Garmin's recovery clock — the `recovery` limit only. */
  minutes?: number;
  /** The one fact behind the ceiling, formatted; null when there is nothing to add. */
  detail: string | null;
  /** Epoch ms this limit clears, when it is an instant rather than a day (`recovery` only). */
  clearsAt: number | null;
  /** The day we expect this limit to clear; null when unknown. */
  clearsOn: DayKey | null;
  confidence: ReadinessConfidence;
}

/**
 * When the athlete expects to be at 100% (spec 084) — the second half of the question the start page
 * is asked, and one nothing in the app answered before.
 *
 * Deliberately two-layered, because "the recovery timer hit zero" is NOT "I am ready": on 2026-08-12
 * the timer reached zero (`recoveryTimeFactorPercent: 99`) and Garmin still scored 74, because HRV was
 * already out of band.
 */
export interface ReadinessForecast {
  /**
   * Epoch ms the recovery timer reaches zero, from `RecoveryTime.endsAt` (spec 075). Null when the
   * reading carries no capture instant or a later activity has superseded it — never a guess.
   */
  recoveredAt: number | null;
  /**
   * The day every active limit is expected to have cleared. Null when any of them is `unknown`:
   * "we don't know" must never render as "today".
   */
  fullyReadyAt: DayKey | null;
  /**
   * EVERY active constraint with its clearance — a superset of `Readiness.limitedBy`, which holds only
   * the ones that actually lowered the score. A 21-hour recovery timer under a composite of 67 caps
   * nothing and still postpones "100%" until tomorrow, so the date must account for it even though the
   * number does not.
   */
  limits: ReadinessLimit[];
}

export interface Readiness {
  /** 0–100, after every ceiling. */
  score: number;
  band: ReadinessBand;
  /** The uncapped weighted mean of the channels — the number `drivers` sum to. */
  composite: number;
  /** The channels, in reading order. They sum to `composite`, not necessarily to `score`. */
  drivers: ReadinessDriver[];
  /**
   * The ceilings that actually LOWERED the score, strongest first. Empty when nothing capped the
   * composite — see `forecast.limits` for everything still standing between here and 100%.
   */
  limitedBy: ReadinessLimit[];
  forecast: ReadinessForecast;
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

/*
 * `ReadinessSource` (spec 059) is gone as of spec 084. It existed because the card carried two
 * headline scores built from different inputs and let the reader pick which one to believe. Our score
 * is now built from Garmin's own factors, so the two no longer answer different questions — Garmin's
 * number stays on the card as a reference chip, not as a rival the reader has to adjudicate.
 */

/**
 * Garmin's HRV verdict for a night, with the band it judged against (spec 084).
 *
 * `weeklyAvg` against `balancedLow…balancedUpper` is the comparison Garmin's own HRV factor makes, and
 * it is why our score and Garmin's disagreed on 2026-08-17: we read `lastNightAvg` (113 — a good
 * night) against our own 30-day mean, while Garmin read the 7-day average (99) against a band
 * starting at 102. Every field of this has been in the synced payload since spec 015 and was read
 * nowhere until now.
 */
export interface HrvStatus {
  day: string;
  /** Garmin's own status string, normalised. Anything unrecognised is `unknown`, never guessed. */
  status: 'balanced' | 'unbalanced' | 'low' | 'poor' | 'unknown';
  /** Mean of the last 7 nights, ms. */
  weeklyAvg: number | null;
  lastNightAvg: number | null;
  /** The balanced band, ms. Null when the payload's band is absent or self-contradictory. */
  balancedLow: number | null;
  balancedUpper: number | null;
}

/** Garmin's level for the day, normalised. `unknown` keeps an unrecognised upstream string honest. */
export type GarminReadinessLevel = 'prime' | 'high' | 'moderate' | 'low' | 'poor' | 'unknown';

/** One input Garmin reports as a percentage backing (or dragging) its score. */
export interface GarminReadinessFactor {
  key: string;
  /** Message key for the factor's name (spec 076) — translated by the card, not the parser. */
  labelKey: MessageKey;
  accent: Lane;
  /** 0–100, as Garmin reports it. NOT a share of the score — the five do not sum to it. */
  percent: number;
}

/**
 * Time Garmin says remains until full recovery.
 *
 * Carried in MINUTES because that is the unit Garmin's `recoveryTime` field is actually in. Reading
 * it as hours is what once put "153 dni do pełnej regeneracji" on the card for a 61-hour timer, so
 * the unit is now in the field name and the conversion happens once, at the formatter.
 *
 * `minutes` is a countdown frozen at `capturedAt`, which is why spec 075 carries the derived instant
 * beside it: a timer without its origin can only be repeated, never advanced, and repeating it is
 * what left "16 h" on the card unchanged for a day and a half.
 */
export interface RecoveryTime {
  /** Day the figure was reported for. */
  day: string;
  /** Whole minutes remaining **as of `capturedAt`**; 0 means recovered. */
  minutes: number;
  /** Message key for Garmin's change code, or null when absent/unrecognised. */
  changeKey: MessageKey | null;
  /**
   * Epoch ms of Garmin's own `timestamp` — the instant it computed this reading (spec 075). Null
   * when the payload carries no parseable timestamp, which disables the countdown entirely rather
   * than substituting a guess: our fetch time sat 60 minutes behind Garmin's in the row that
   * prompted this, so anchoring on it would overstate the remaining time by an hour.
   */
  capturedAt: number | null;
  /** Epoch ms of full recovery = `capturedAt + minutes`. Null exactly when `capturedAt` is. */
  endsAt: number | null;
  /**
   * True when an activity started after `capturedAt`, so Garmin has certainly re-derived the timer
   * and this countdown describes a world that no longer exists. Counting it down would be confidently
   * wrong (a hard session RAISES the timer), so consumers fall back to the spec 072 stale label.
   */
  superseded: boolean;
}

/** Garmin's readiness verdict for the newest day that carries one. */
export interface GarminReadiness {
  day: string;
  /**
   * Days between `day` and today (spec 072). 0 means "this is today's verdict"; anything above it
   * means the card is showing a snapshot Garmin has not refreshed since — which is what let a
   * Thursday-evening score of 1 sit on the start page all Saturday looking current.
   */
  staleDays: number;
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
  /**
   * Days between `day` and today (spec 072). `null` when nothing is dated — "we don't know how old
   * this is" and "this is current" must never collapse into the same 0.
   */
  staleDays: number | null;
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
  window: number;
  start: string;
  end: string;
  readiness: Readiness | null;
  trends: Trend[];
  anomalies: Anomaly[];
  correlations: Correlation[];
  charts: MetricChart[];
  /** Condition & regeneration (spec 022); null when not connected or with no data. */
  condition: ConditionSnapshot | null;
}
