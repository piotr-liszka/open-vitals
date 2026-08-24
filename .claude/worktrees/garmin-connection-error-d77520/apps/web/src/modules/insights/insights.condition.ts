/**
 * Condition & regeneration snapshot (spec 022) — pure, deterministic, no I/O and no `Date.now()`.
 *
 * Answers the question the start page opens with: *how am I right now?* It reuses the series the
 * insights engine already fetched (zero extra reads) and turns them into last night's sleep, the
 * four recovery channels against their own baselines, and ONE plain-Polish sentence about where
 * regeneration stands.
 *
 * Deliberately not a second engine: readiness itself still comes from `insights.engine.ts`; this
 * module only interprets it alongside the raw sleep payload.
 */
import type { GarminMetricDay } from '$lib/server/interfaces';
import { METRICS, inner, pick, type MetricSpec } from '$lib/server/garmin/metric-specs';
import { formatDay, isDayKey, type DayKey } from '$lib/date';
import { fmtSleepDuration } from './condition.format';
import {
  latestTrainingReadiness,
  markSuperseded,
  stalenessOf,
  toGarminReadiness
} from './insights.garmin-readiness';
import type {
  ConditionMetric,
  ConditionSnapshot,
  DayPoint,
  IntradayPoint,
  Readiness,
  RecoveryState,
  SleepNight
} from './insights.types';

/**
 * A metric's spec, its per-day extracted values, and the raw payloads they came from. A strict
 * superset of the engine's `MetricSeriesInput`, so the same array feeds both without a copy.
 */
export interface ConditionSeries {
  readonly spec: MetricSpec;
  readonly days: DayPoint[];
  readonly raw: GarminMetricDay[];
}

/** Below this |Δ%| a channel counts as unchanged rather than a move. */
export const FLAT_PCT = 1.5;

/* ------------------------------------------------------------------ *
 * Sleep
 * ------------------------------------------------------------------ */

/**
 * Garmin's `*TimestampLocal` fields are epoch milliseconds with the wearer's UTC offset already
 * folded in, so reading them **in UTC** yields the wall clock they went to bed at. Formatting them
 * in any real timezone would shift the number; that is why this is `toISOString`, not `Intl`.
 */
function wallClock(ms: number | null): string | null {
  if (ms === null || !Number.isFinite(ms)) return null;
  const at = new Date(ms);
  if (Number.isNaN(at.getTime())) return null;
  return at.toISOString().slice(11, 16);
}

const SLEEP_KEYS = {
  total: ['dailySleepDTO.sleepTimeSeconds', 'sleepTimeSeconds'],
  deep: ['dailySleepDTO.deepSleepSeconds', 'deepSleepSeconds'],
  light: ['dailySleepDTO.lightSleepSeconds', 'lightSleepSeconds'],
  rem: ['dailySleepDTO.remSleepSeconds', 'remSleepSeconds'],
  awake: ['dailySleepDTO.awakeSleepSeconds', 'awakeSleepSeconds'],
  score: ['dailySleepDTO.sleepScores.overall.value', 'sleepScores.overall.value'],
  start: ['dailySleepDTO.sleepStartTimestampLocal', 'sleepStartTimestampLocal'],
  end: ['dailySleepDTO.sleepEndTimestampLocal', 'sleepEndTimestampLocal']
} as const;

/**
 * Sleep efficiency = asleep ÷ in-bed. Only computed when both timestamps are present and sane;
 * a payload that would produce >100% is treated as untrustworthy and yields null rather than a lie.
 */
export function sleepEfficiency(
  totalS: number | null,
  startMs: number | null,
  endMs: number | null
): number | null {
  if (totalS === null || startMs === null || endMs === null) return null;
  const inBedS = (endMs - startMs) / 1000;
  if (!Number.isFinite(inBedS) || inBedS <= 0 || totalS <= 0) return null;
  const pct = Math.round((totalS / inBedS) * 100);
  return pct > 100 || pct < 1 ? null : pct;
}

/** Last night = the newest in-window day whose sleep payload carries a real duration. */
export function extractSleepNight(raw: readonly GarminMetricDay[]): SleepNight | null {
  for (let i = raw.length - 1; i >= 0; i--) {
    const day = raw[i]!;
    if (!isDayKey(day.date)) continue;
    const data = inner(day.data);
    if (!data) continue;
    const totalS = pick(data, [...SLEEP_KEYS.total]);
    if (totalS === null || totalS <= 0) continue;

    const startMs = pick(data, [...SLEEP_KEYS.start]);
    const endMs = pick(data, [...SLEEP_KEYS.end]);
    return {
      day: day.date,
      totalS,
      deepS: pick(data, [...SLEEP_KEYS.deep]),
      lightS: pick(data, [...SLEEP_KEYS.light]),
      remS: pick(data, [...SLEEP_KEYS.rem]),
      awakeS: pick(data, [...SLEEP_KEYS.awake]),
      score: pick(data, [...SLEEP_KEYS.score]),
      bedTime: wallClock(startMs),
      wakeTime: wallClock(endMs),
      efficiencyPct: sleepEfficiency(totalS, startMs, endMs)
    };
  }
  return null;
}

/* ------------------------------------------------------------------ *
 * Recovery channels
 * ------------------------------------------------------------------ */

function mean(values: readonly number[]): number {
  return values.length === 0 ? 0 : values.reduce((a, b) => a + b, 0) / values.length;
}

/**
 * One channel against its own in-window baseline. The baseline EXCLUDES the latest reading, so
 * "HRV above your baseline" compares today with the days before it rather than with itself.
 */
export function buildConditionMetric(spec: MetricSpec, days: readonly DayPoint[]): ConditionMetric | null {
  const present = days.filter((d): d is { date: string; value: number } => d.value !== null);
  if (present.length === 0) return null;

  const latestPoint = present[present.length - 1]!;
  const earlier = present.slice(0, -1).map((p) => p.value);
  const baseline = earlier.length > 0 ? Math.round(mean(earlier) * 100) / 100 : null;

  let deltaPct: number | null = null;
  if (baseline !== null && baseline !== 0) {
    deltaPct = Math.round(((latestPoint.value - baseline) / Math.abs(baseline)) * 1000) / 10;
  }

  const direction: ConditionMetric['direction'] =
    deltaPct === null || Math.abs(deltaPct) < FLAT_PCT ? 'flat' : deltaPct > 0 ? 'up' : 'down';
  const favourable = direction === 'flat' ? null : direction === spec.goodWhen;

  return {
    key: spec.key,
    label: spec.label,
    accent: spec.accent,
    unit: spec.unit,
    format: spec.format,
    goodWhen: spec.goodWhen,
    day: latestPoint.date,
    latest: latestPoint.value,
    baseline,
    deltaPct,
    direction,
    favourable
  };
}

/* ------------------------------------------------------------------ *
 * Body Battery — the last 24 hours
 * ------------------------------------------------------------------ */

/** Span the card draws, ending at the newest reading rather than at a wall-clock "now". */
export const BATTERY_DAY_MS = 24 * 60 * 60 * 1000;
/** Lattice step. Garmin samples every ~3 min; 15 keeps the shape and ~96 points instead of ~480. */
export const BATTERY_BUCKET_MS = 15 * 60 * 1000;
/**
 * How many trailing day payloads to scan. Garmin's "day" starts at LOCAL midnight, so one payload
 * already reaches into the previous UTC day; three is slack for a timezone and a late sync, at the
 * cost of three array walks.
 */
const BATTERY_SOURCE_DAYS = 3;

/**
 * Body Battery's intraday rows: `[epochMs, status, level, version]`, ~every 3 minutes, with a null
 * level wherever the watch recorded nothing.
 *
 * The timestamps are TRUE UTC epoch ms — unlike sleep's `*TimestampLocal`, which fold the wearer's
 * offset in. So they are formatted in a real timezone downstream, never read in UTC.
 */
const BATTERY_ROWS = 'bodyBatteryValuesArray';

/**
 * The last 24 h of Body Battery on a regular lattice, oldest→newest.
 *
 * The window ENDS at the newest reading, not at `now`: this module is pure and clock-free, and a
 * watch that last synced at lunchtime should still show its own last 24 h rather than a chart
 * padded with hours of nothing. The lattice starts at the first reading inside that window for the
 * same reason — leading emptiness is not data. Gaps *within* the covered span keep their slot as
 * null, so "watch was off" reads as a hole rather than as a straight line across it.
 */
export function extractBatteryIntraday(raw: readonly GarminMetricDay[]): IntradayPoint[] {
  const readings: Array<{ at: number; value: number }> = [];
  for (const day of raw.slice(-BATTERY_SOURCE_DAYS)) {
    const data = inner(day.data);
    const rows = data?.[BATTERY_ROWS];
    if (!Array.isArray(rows)) continue;
    for (const row of rows) {
      if (!Array.isArray(row)) continue;
      const at = row[0];
      const level = row[2];
      if (typeof at !== 'number' || !Number.isFinite(at)) continue;
      if (typeof level !== 'number' || !Number.isFinite(level)) continue;
      readings.push({ at, value: level });
    }
  }
  if (readings.length === 0) return [];

  readings.sort((a, b) => a.at - b.at);
  const end = readings[readings.length - 1]!.at;
  const from = Math.max(end - BATTERY_DAY_MS, readings[0]!.at);

  // Last reading wins inside a bucket: the freshest number the bucket saw is the one to draw.
  const byBucket = new Map<number, number>();
  for (const r of readings) {
    if (r.at < from) continue;
    byBucket.set(Math.floor(r.at / BATTERY_BUCKET_MS), r.value);
  }

  const firstBucket = Math.floor(from / BATTERY_BUCKET_MS);
  const lastBucket = Math.floor(end / BATTERY_BUCKET_MS);
  const points: IntradayPoint[] = [];
  for (let b = firstBucket; b <= lastBucket; b++) {
    points.push({ at: b * BATTERY_BUCKET_MS, value: byBucket.get(b) ?? null });
  }
  return points;
}

/* ------------------------------------------------------------------ *
 * Interpretation
 * ------------------------------------------------------------------ */

export function recoveryStateOf(
  readiness: Readiness | null,
  channels: readonly ConditionMetric[]
): RecoveryState {
  if (readiness !== null) {
    if (readiness.band === 'peak' || readiness.band === 'high') return 'rested';
    if (readiness.band === 'moderate') return 'steady';
    return 'strained';
  }
  // No readiness (too little history): fall back to counting which way the channels moved.
  const moved = channels.filter((c) => c.favourable !== null);
  if (moved.length < 2) return 'unknown';
  const good = moved.filter((c) => c.favourable === true).length;
  if (good === moved.length) return 'rested';
  if (good === 0) return 'strained';
  return 'steady';
}

const STATE_HEAD: Readonly<Record<RecoveryState, string>> = {
  rested: 'Jesteś wypoczęty',
  steady: 'Regeneracja idzie swoim torem',
  strained: 'Organizm jest obciążony',
  unknown: 'Za mało danych, żeby ocenić regenerację'
};

const NUM = new Intl.NumberFormat('pl-PL', { maximumFractionDigits: 0 });

function channelClause(c: ConditionMetric): string {
  const where = c.direction === 'up' ? 'powyżej bazy' : 'poniżej bazy';
  const value =
    c.format === 'duration' ? (fmtSleepDuration(c.latest) ?? '—') : NUM.format(Math.round(c.latest));
  const unit = c.format === 'duration' || c.unit === '' ? '' : ` ${c.unit}`;
  return `${c.label} ${where} (${value}${unit})`;
}

/**
 * The evidence clauses both sentences are built from: at most the two biggest movers against their
 * own baselines, then last night's sleep. Source-independent facts — which is why the Garmin-mode
 * sentence (spec 059) reuses them verbatim instead of describing the same night differently.
 */
export function summaryClauses(channels: readonly ConditionMetric[], sleep: SleepNight | null): string[] {
  const movers = channels
    .filter((c) => c.direction !== 'flat' && c.deltaPct !== null)
    .sort((a, b) => Math.abs(b.deltaPct ?? 0) - Math.abs(a.deltaPct ?? 0))
    .slice(0, 2)
    .map(channelClause);

  const sleepClause = sleep === null ? null : `sen ${fmtSleepDuration(sleep.totalS) ?? '—'}`;
  return [...movers, ...(sleepClause ? [sleepClause] : [])];
}

/**
 * One sentence, assembled from facts we actually hold: the recovery state plus at most the two
 * biggest movers and last night's sleep. No hedging adjectives, no medical claims.
 */
export function conditionSummary(
  state: RecoveryState,
  channels: readonly ConditionMetric[],
  sleep: SleepNight | null,
  stale: { day: string; days: number } | null = null
): string {
  const head = STATE_HEAD[state];
  if (state === 'unknown') return `${head} — synchronizuj zegarek przez kilka dni, a policzymy resztę.`;

  const parts = summaryClauses(channels, sleep);
  // A stale snapshot names its day before anything else (spec 072): every clause below describes
  // that day, not today, and the sentence read exactly the same either way until now.
  if (stale !== null && stale.days > 0 && isDayKey(stale.day)) {
    parts.unshift(`dane z ${formatDay(stale.day)}`);
  }
  return parts.length === 0 ? `${head}.` : `${head} — ${parts.join(', ')}.`;
}

/* ------------------------------------------------------------------ *
 * Top level
 * ------------------------------------------------------------------ */

/** The four channels the panel reports on, in reading order. */
export const CONDITION_KEYS = ['body_battery', 'hrv', 'resting_heart_rate', 'stress'] as const;

const SPEC_BY_KEY = new Map<string, MetricSpec>(METRICS.map((s) => [s.key, s]));

/**
 * Build the whole snapshot from series the caller already fetched. Returns null only when there is
 * nothing at all to show (no sleep, no channel, no readiness) — an empty panel is worse than none.
 */
export interface ConditionOptions {
  /**
   * "Now" as epoch ms, from the injected clock (spec 075). Drives Garmin's recovery countdown, which
   * is advanced from the instant Garmin captured it rather than repeated verbatim. Omitted — as in
   * the many tests that only care about day-level facts — the countdown degrades to the stored
   * figure, which is the pre-075 behaviour.
   */
  nowMs?: number | null;
  /**
   * Epoch ms of the newest activity start we hold. An activity later than the readiness capture has
   * certainly made Garmin re-derive the timer, which stops the countdown (see `markSuperseded`).
   */
  latestActivityStartMs?: number | null;
}

export function computeCondition(
  series: readonly ConditionSeries[],
  readiness: Readiness | null,
  today: DayKey,
  opts: ConditionOptions = {}
): ConditionSnapshot | null {
  const byKey = new Map(series.map((s) => [s.spec.key, s]));

  const sleepSeries = byKey.get('sleep');
  const sleep = sleepSeries ? extractSleepNight(sleepSeries.raw) : null;

  const batterySeries = byKey.get('body_battery');
  const batteryDay = batterySeries ? extractBatteryIntraday(batterySeries.raw) : [];

  const channels: ConditionMetric[] = [];
  for (const key of CONDITION_KEYS) {
    const entry = byKey.get(key);
    const spec = entry?.spec ?? SPEC_BY_KEY.get(key);
    if (!entry || !spec) continue;
    const metric = buildConditionMetric(spec, entry.days);
    if (metric) channels.push(metric);
  }

  const sleepSpec = sleepSeries?.spec ?? SPEC_BY_KEY.get('sleep');
  const sleepChannel = sleepSeries && sleepSpec ? buildConditionMetric(sleepSpec, sleepSeries.days) : null;

  // Garmin's own verdict for the newest day it scored (spec 059). Absent for an account, device or
  // day without Training Readiness — then the card simply leads with our composite.
  const trSeries = byKey.get('training_readiness');
  const parsedRaw = trSeries ? latestTrainingReadiness(trSeries.raw) : null;
  /*
   * Decide here — not in the parser — whether the recovery countdown may run: only this layer knows
   * about activities (spec 075). Rebuilt rather than mutated so the summary sentence below and the
   * `recovery` field the card reads can never disagree about it.
   */
  const nowMs = opts.nowMs ?? null;
  const parsedGarmin = parsedRaw
    ? { ...parsedRaw, recovery: markSuperseded(parsedRaw.recovery, opts.latestActivityStartMs ?? null) }
    : null;

  if (sleep === null && channels.length === 0 && readiness === null && parsedGarmin === null) {
    return null;
  }

  const state = recoveryStateOf(readiness, channels);
  // Sleep joins the interpretation as a channel too — it is the biggest single recovery lever.
  const interpreted = sleepChannel ? [...channels, sleepChannel] : channels;
  const clauses = summaryClauses(interpreted, sleep);

  /*
   * The day this snapshot actually describes, and how far behind today it is (spec 072). Every field
   * below is read off the newest day the store HOLDS, which is not the same thing as today: when the
   * watch has not uploaded, the newest day is however long ago it last did, and the card said
   * nothing about the difference.
   */
  const day = sleep?.day ?? channels[0]?.day ?? parsedGarmin?.day ?? null;
  const staleDays = day !== null && isDayKey(day) ? stalenessOf(day, today) : null;
  const stale = day !== null && staleDays !== null ? { day, days: staleDays } : null;

  return {
    day,
    staleDays,
    readiness,
    sleep,
    sleepTrend: sleepChannel,
    channels,
    batteryDay,
    state,
    summary: conditionSummary(state, interpreted, sleep, stale),
    garmin: parsedGarmin ? toGarminReadiness(parsedGarmin, clauses, today, nowMs) : null,
    recovery: parsedGarmin?.recovery ?? null
  };
}
