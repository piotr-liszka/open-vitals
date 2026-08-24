/**
 * Garmin's OWN Training Readiness, parsed out of the daily payload (spec 059) — pure, no I/O,
 * no `Date.now()`.
 *
 * Why this exists beside `insights.engine.ts`: the engine's score answers *"how do my four
 * channels compare with my own last 30 days"*. Garmin's answers *"how ready are you to train"* and
 * weighs things the engine cannot see — the recovery timer, acute load, ACWR, sleep and stress
 * history. On the same morning ours read 40 and Garmin's read 1. Both are correct; they are
 * different questions, so the card carries both and names which one is on screen.
 *
 * Everything here treats the payload as untrusted (AGENTS.md §10): every field optional, camelCase
 * first (the sidecar passes Garmin's own JSON through) with snake_case as a fallback, a non-finite
 * number is a gap, and an unrecognised level or change code is never rendered as prose.
 */
import type { GarminMetricDay } from '$lib/server/interfaces';
import type { MessageKey, Translator } from '$lib/i18n';
import { inner, pick } from '$lib/server/garmin/metric-specs';
import { daysBetween, formatDay, isDayKey, type DayKey } from '$lib/date';
import { fmtRecovery, isLiveCountdown, remainingMinutes } from './condition.format';
import type {
  GarminReadiness,
  GarminReadinessFactor,
  GarminReadinessLevel,
  HrvStatus,
  RecoveryState,
  RecoveryTime
} from './insights.types';

/** Read the first finite number found under any of `keys`. */
function num(data: Record<string, unknown>, keys: readonly string[]): number | null {
  for (const k of keys) {
    const v = data[k];
    if (typeof v === 'number' && Number.isFinite(v)) return v;
  }
  return null;
}

/** Read the first non-empty string found under any of `keys`. */
function str(data: Record<string, unknown>, keys: readonly string[]): string | null {
  for (const k of keys) {
    const v = data[k];
    if (typeof v === 'string' && v.trim() !== '') return v.trim();
  }
  return null;
}

/**
 * Garmin's capture instant → epoch ms (spec 075).
 *
 * The field arrives as `"2026-08-16T15:54:57.0"`: no zone suffix, and a one-digit fraction. That
 * shape is a trap — ECMAScript reads a date-*time* without an offset as LOCAL time (only a bare
 * date-only string defaults to UTC), so a plain `new Date(s)` is correct in the UTC container and
 * two hours wrong on a Warsaw laptop, which is exactly the kind of bug that only shows up in dev.
 * The zone is therefore appended explicitly.
 *
 * `timestamp` is UTC and `timestampLocal` is the same instant in the wearer's zone — but NEITHER
 * carries an offset, so they are indistinguishable to a parser. Only the UTC one may be read.
 */
export function parseGarminInstant(raw: string | null): number | null {
  if (raw === null) return null;
  const trimmed = raw.trim();
  // Already zoned (a future payload shape, or a snake_case source that normalised it) — trust it.
  const zoned = /(?:Z|[+-]\d{2}:?\d{2})$/.test(trimmed) ? trimmed : `${trimmed.replace(' ', 'T')}Z`;
  const ms = new Date(zoned).getTime();
  return Number.isFinite(ms) ? ms : null;
}

/** Garmin's level strings, normalised. Anything else stays `unknown` rather than being guessed at. */
export function normaliseLevel(raw: string | null): GarminReadinessLevel {
  switch (raw?.toUpperCase()) {
    case 'PRIME':
      return 'prime';
    case 'HIGH':
      return 'high';
    case 'MODERATE':
      return 'moderate';
    case 'LOW':
      return 'low';
    case 'POOR':
    case 'VERY_LOW':
      return 'poor';
    default:
      return 'unknown';
  }
}

/**
 * The level Garmin's own banding implies for a score, used only when the payload's `level` string
 * is missing or unrecognised — so the card still says something true rather than "unknown" beside
 * a perfectly good number.
 */
export function levelForScore(score: number): GarminReadinessLevel {
  if (score >= 90) return 'prime';
  if (score >= 75) return 'high';
  if (score >= 50) return 'moderate';
  if (score >= 25) return 'low';
  return 'poor';
}

/** Garmin's level → the card's shared recovery state, so both sources drive one badge. */
export function stateForLevel(level: GarminReadinessLevel): RecoveryState {
  switch (level) {
    case 'prime':
    case 'high':
      return 'rested';
    case 'moderate':
      return 'steady';
    case 'low':
    case 'poor':
      return 'strained';
    default:
      return 'unknown';
  }
}

/**
 * The factor percentages Garmin publishes, in reading order. Each is 0–100 on its own scale — they
 * are NOT shares of the score and deliberately are not presented as if they summed to it.
 */
const FACTORS: ReadonlyArray<{
  key: string;
  labelKey: MessageKey;
  accent: GarminReadinessFactor['accent'];
  keys: readonly string[];
}> = [
  {
    key: 'sleep',
    labelKey: 'garminReadiness.factor.sleep',
    accent: 'indigo',
    keys: ['sleepScoreFactorPercent', 'sleep_score_factor_percent']
  },
  {
    key: 'sleep_history',
    labelKey: 'garminReadiness.factor.sleep_history',
    accent: 'violet',
    keys: ['sleepHistoryFactorPercent', 'sleep_history_factor_percent']
  },
  {
    key: 'hrv',
    labelKey: 'garminReadiness.factor.hrv',
    accent: 'green',
    keys: ['hrvFactorPercent', 'hrv_factor_percent']
  },
  {
    key: 'recovery',
    labelKey: 'garminReadiness.factor.recovery',
    accent: 'cyan',
    keys: ['recoveryTimeFactorPercent', 'recovery_time_factor_percent']
  },
  {
    key: 'load',
    labelKey: 'garminReadiness.factor.load',
    accent: 'orange',
    keys: ['acwrFactorPercent', 'acwr_factor_percent']
  },
  {
    key: 'stress',
    labelKey: 'garminReadiness.factor.stress',
    accent: 'amber',
    keys: ['stressHistoryFactorPercent', 'stress_history_factor_percent']
  }
];

/**
 * Garmin's recovery-time change codes. Only codes we can state plainly are rendered; anything else
 * yields null, because a raw `RECOVERY_TIME_DECREASED_SOMETHING` in the middle of a Polish sentence
 * is worse than saying nothing.
 */
const CHANGE_PHRASE: Readonly<Record<string, MessageKey>> = {
  RECOVERY_TIME_DECREASED: 'garminReadiness.change.decreased',
  RECOVERY_TIME_INCREASED: 'garminReadiness.change.increased',
  RECOVERY_TIME_NO_CHANGE: 'garminReadiness.change.none',
  RECOVERY_TIME_UNCHANGED: 'garminReadiness.change.none',
  /*
   * The codes the live account actually emits (spec 075) — the map above was written from the field
   * name and never matched a real payload, so every reading silently rendered no phrase at all. The
   * suffix names what Garmin last recomputed against, which is worth saying: "unchanged after sleep"
   * is the difference between a timer that stalled and one that a night's sleep did not move.
   */
  NO_CHANGE_SLEEP: 'garminReadiness.change.noChangeSleep',
  NO_CHANGE_ACTIVITY: 'garminReadiness.change.noChangeActivity',
  DECREASED_SLEEP: 'garminReadiness.change.decreasedSleep',
  DECREASED_ACTIVITY: 'garminReadiness.change.decreasedActivity',
  INCREASED_ACTIVITY: 'garminReadiness.change.increasedActivity'
};

/** Garmin's own verdict on one of its factors. `null` when absent or unrecognised. */
export type FactorFeedback = 'good' | 'moderate' | 'poor' | null;

/**
 * Garmin's feedback word for a factor, normalised.
 *
 * Worth reading rather than thresholding the percentage ourselves: it is Garmin's judgement of its own
 * number, and it is what separates 36% `POOR` on 14.08 (a load that genuinely capped the day) from 61%
 * `MODERATE` on 17.08 (where an athlete mid-block normally sits). `VERY_GOOD` folds into `good` — the
 * distinction does not change any decision here.
 */
export function normaliseFeedback(raw: string | null): FactorFeedback {
  switch (raw?.toUpperCase()) {
    case 'VERY_GOOD':
    case 'GOOD':
      return 'good';
    case 'MODERATE':
      return 'moderate';
    case 'POOR':
    case 'VERY_POOR':
      return 'poor';
    default:
      return null;
  }
}

/** One parsed day, or null when the payload carries no usable score. */
export interface ParsedTrainingReadiness {
  day: string;
  score: number;
  level: GarminReadinessLevel;
  factors: GarminReadinessFactor[];
  hrvWeeklyAvg: number | null;
  acuteLoad: number | null;
  /** Garmin's own verdict on its ACWR factor — the load ceiling's trigger (spec 084). */
  loadFeedback: FactorFeedback;
  recovery: RecoveryTime | null;
}

export function parseTrainingReadinessDay(day: string, rawData: unknown): ParsedTrainingReadiness | null {
  const data = inner(rawData);
  if (!data) return null;

  const score = num(data, ['score', 'trainingReadinessScore']);
  if (score === null || score < 0 || score > 100) return null;

  // Garmin's own `calendarDate` wins over the store's key: the store day is when we asked, the
  // payload day is what Garmin answered for.
  const payloadDay = str(data, ['calendarDate', 'calendar_date']);
  const reportedDay = payloadDay && isDayKey(payloadDay) ? payloadDay : day;

  const named = normaliseLevel(str(data, ['level', 'trainingReadinessLevel']));
  const level = named === 'unknown' ? levelForScore(score) : named;

  const factors: GarminReadinessFactor[] = [];
  for (const f of FACTORS) {
    const percent = num(data, f.keys);
    if (percent === null || percent < 0 || percent > 100) continue;
    factors.push({
      key: f.key,
      labelKey: f.labelKey,
      accent: f.accent,
      percent: Math.round(percent)
    });
  }

  /*
   * `recoveryTime` is MINUTES, not hours (spec 070). Spec 059 read it as hours on the strength of a
   * wrapper library's docstring, and the card then told an athlete with a 61-hour timer that he had
   * "153 dni do pełnej regeneracji" — a number no Garmin device can even produce, since the timer
   * caps out around four days.
   *
   * Deliberately NOT auto-detected from magnitude: a field that silently means minutes above some
   * threshold and hours below it is worse than one wrong constant, because the same payload would
   * then render in two different units on two different days.
   */
  const minutes = num(data, ['recoveryTime', 'recovery_time']);
  const changeCode = str(data, ['recoveryTimeChangePhrase', 'recovery_time_change_phrase']);
  /*
   * The instant Garmin computed the reading (spec 075), which turns the countdown from a number we
   * can only repeat into one we can advance. It has been in the stored payload all along — the
   * sidecar keeps Garmin's document whole — so this reads existing data rather than syncing more.
   */
  const capturedAt = parseGarminInstant(str(data, ['timestamp']));
  const recovery: RecoveryTime | null =
    minutes === null || minutes < 0
      ? null
      : {
          day: reportedDay,
          minutes: Math.round(minutes),
          changeKey: changeCode ? (CHANGE_PHRASE[changeCode.toUpperCase()] ?? null) : null,
          capturedAt,
          endsAt: capturedAt === null ? null : capturedAt + Math.round(minutes) * 60_000,
          // The parser cannot see activities; `markSuperseded` decides this where they are known.
          superseded: false
        };

  return {
    day: reportedDay,
    score: Math.round(score),
    level,
    factors,
    hrvWeeklyAvg: num(data, ['hrvWeeklyAverage', 'hrv_weekly_average']),
    acuteLoad: num(data, ['acuteLoad', 'acute_load']),
    loadFeedback: normaliseFeedback(str(data, ['acwrFactorFeedback', 'acwr_factor_feedback'])),
    recovery
  };
}

/** The newest in-window day Garmin actually scored. Older days are history, not "right now". */
export function latestTrainingReadiness(raw: readonly GarminMetricDay[]): ParsedTrainingReadiness | null {
  for (let i = raw.length - 1; i >= 0; i--) {
    const day = raw[i]!;
    if (!isDayKey(day.date)) continue;
    const parsed = parseTrainingReadinessDay(day.date, day.data);
    if (parsed) return parsed;
  }
  return null;
}

/* ------------------------------------------------------------------ *
 * HRV status and its balanced band (spec 084)
 * ------------------------------------------------------------------ */

/** A percentage Garmin published, or null when absent or outside 0–100 (never clamped). */
export function factorPercent(parsed: ParsedTrainingReadiness | null, key: string): number | null {
  const found = parsed?.factors.find((f) => f.key === key);
  return found ? found.percent : null;
}

/** Garmin's status strings, normalised. Unrecognised stays `unknown` rather than being guessed at. */
export function normaliseHrvStatus(raw: string | null): HrvStatus['status'] {
  switch (raw?.toUpperCase()) {
    case 'BALANCED':
      return 'balanced';
    case 'UNBALANCED':
      return 'unbalanced';
    case 'LOW':
      return 'low';
    case 'POOR':
      return 'poor';
    default:
      return 'unknown';
  }
}

/**
 * `hrvSummary` → the weekly average and the band Garmin judged it against (spec 084).
 *
 * A band whose `balancedLow` is not strictly below its `balancedUpper` is DISCARDED rather than
 * sorted: silently swapping two fields would turn a corrupt payload into a confident, wrong verdict
 * about how far out of range the athlete is. Same for a non-finite or negative millisecond figure.
 */
export function parseHrvStatusDay(day: string, rawData: unknown): HrvStatus | null {
  const data = inner(rawData);
  if (!data) return null;
  const summary = data['hrvSummary'];
  if (!summary || typeof summary !== 'object') return null;
  const s = summary as Record<string, unknown>;

  const ms = (keys: string[]): number | null => {
    const v = pick(s, keys);
    return v === null || v <= 0 ? null : v;
  };

  const low = ms(['baseline.balancedLow', 'baseline.balanced_low']);
  const upper = ms(['baseline.balancedUpper', 'baseline.balanced_upper']);
  const bandOk = low !== null && upper !== null && low < upper;

  const payloadDay = str(s, ['calendarDate', 'calendar_date']);
  const status = normaliseHrvStatus(str(s, ['status']));
  const weeklyAvg = ms(['weeklyAvg', 'weekly_avg']);
  const lastNightAvg = ms(['lastNightAvg', 'last_night_avg']);

  // Nothing usable at all — a status word with no numbers cannot drive a ceiling or a projection.
  if (status === 'unknown' && weeklyAvg === null && lastNightAvg === null) return null;

  return {
    day: payloadDay && isDayKey(payloadDay) ? payloadDay : day,
    status,
    weeklyAvg,
    lastNightAvg,
    balancedLow: bandOk ? low : null,
    balancedUpper: bandOk ? upper : null
  };
}

/** The newest in-window day carrying an HRV summary. */
export function latestHrvStatus(raw: readonly GarminMetricDay[]): HrvStatus | null {
  for (let i = raw.length - 1; i >= 0; i--) {
    const day = raw[i]!;
    if (!isDayKey(day.date)) continue;
    const parsed = parseHrvStatusDay(day.date, day.data);
    if (parsed) return parsed;
  }
  return null;
}

/**
 * True when Garmin says the weekly average sits outside the balanced band — the condition that makes
 * HRV a ceiling rather than just a channel (spec 084).
 *
 * Trusts the numbers over the word where both are present: `status` is a label Garmin computed at
 * capture time, and a weekly average below `balancedLow` is the fact underneath it. Where the band is
 * missing, the status word is all there is.
 */
export function isHrvUnbalanced(hrv: HrvStatus | null): boolean {
  if (hrv === null) return false;
  if (hrv.weeklyAvg !== null && hrv.balancedLow !== null) return hrv.weeklyAvg < hrv.balancedLow;
  return hrv.status === 'unbalanced' || hrv.status === 'low' || hrv.status === 'poor';
}

const LEVEL_HEAD: Readonly<Record<GarminReadinessLevel, MessageKey>> = {
  prime: 'garminReadiness.head.prime',
  high: 'garminReadiness.head.high',
  moderate: 'garminReadiness.head.moderate',
  low: 'garminReadiness.head.low',
  poor: 'garminReadiness.head.poor',
  unknown: 'garminReadiness.head.unknown'
};

/**
 * How many days back the reading is. Non-negative: a payload dated ahead of today (clock skew on
 * either side) is treated as current rather than as a negative age.
 */
export function stalenessOf(day: string, today: DayKey): number {
  if (!isDayKey(day)) return 0;
  return Math.max(0, daysBetween(day, today));
}

/**
 * Flag a reading a later activity has already invalidated (spec 075).
 *
 * Garmin re-derives `recoveryTime` after every session, so a countdown is only true while nothing
 * new has happened. The realistic failure this guards: a sync at 19:00 brings home the 18:00 ride
 * *and* a readiness document Garmin computed at 15:54, before that ride existed. Counting down from
 * 15:54 would then show a few hours left when the true answer had just gone UP.
 *
 * Only later activities matter — an earlier one is already priced into Garmin's own figure.
 */
export function markSuperseded(
  recovery: RecoveryTime | null,
  latestActivityStartMs: number | null
): RecoveryTime | null {
  if (recovery === null || recovery.capturedAt === null) return recovery;
  if (latestActivityStartMs === null || !Number.isFinite(latestActivityStartMs)) return recovery;
  if (latestActivityStartMs <= recovery.capturedAt) return recovery;
  return { ...recovery, superseded: true };
}

/**
 * The Garmin-mode sentence. Leads with Garmin's verdict, then the recovery timer — the input that
 * most often explains why Garmin's number sits far from ours — then whatever channel clauses the
 * caller already assembled for its own sentence.
 *
 * A stale reading says so FIRST (spec 072). Since spec 075 the timer itself is no longer part of
 * what "stale" costs us: with Garmin's own capture instant in hand the countdown is advanced to
 * `nowMs`, so the figure is current even when the reading is two days old. The "(stan na ten dzień)"
 * qualifier is therefore kept ONLY where the countdown really is frozen — no capture instant, or a
 * later activity that has already superseded it.
 */
export function garminSummary(
  t: Translator,
  level: GarminReadinessLevel,
  recovery: RecoveryTime | null,
  clauses: readonly string[],
  stale: { day: string; days: number } | null = null,
  nowMs: number | null = null
): string {
  const isStale = stale !== null && stale.days > 0 && isDayKey(stale.day);
  const parts: string[] = [];
  if (isStale) {
    parts.push(t('garminReadiness.dataFrom', { day: formatDay(t.locale, stale.day as DayKey) }));
  }
  if (recovery !== null) {
    const live = isLiveCountdown(recovery, nowMs);
    const minutes = remainingMinutes(recovery, nowMs);
    // A frozen figure must still admit it is frozen; a live one has nothing to qualify.
    const frozen = !live && isStale;
    parts.push(
      minutes <= 0
        ? t('garminReadiness.recovered')
        : t(frozen ? 'garminReadiness.recoveryInStale' : 'garminReadiness.recoveryIn', {
            time: fmtRecovery(t, minutes)
          })
    );
  }
  parts.push(...clauses);
  const head = isStale ? `${t(LEVEL_HEAD[level])} (${t('garminReadiness.stale')})` : t(LEVEL_HEAD[level]);
  return parts.length === 0 ? `${head}.` : `${head} — ${parts.join(', ')}.`;
}

/** Assemble the contract object the card consumes. */
export function toGarminReadiness(
  t: Translator,
  parsed: ParsedTrainingReadiness,
  clauses: readonly string[],
  today: DayKey,
  nowMs: number | null = null
): GarminReadiness {
  const staleDays = stalenessOf(parsed.day, today);
  return {
    day: parsed.day,
    staleDays,
    score: parsed.score,
    level: parsed.level,
    state: stateForLevel(parsed.level),
    factors: parsed.factors,
    hrvWeeklyAvg: parsed.hrvWeeklyAvg,
    acuteLoad: parsed.acuteLoad,
    summary: garminSummary(
      t,
      parsed.level,
      parsed.recovery,
      clauses,
      { day: parsed.day, days: staleDays },
      nowMs
    )
  };
}
