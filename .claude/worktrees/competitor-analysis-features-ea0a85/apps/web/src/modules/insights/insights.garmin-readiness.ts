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
import { inner } from '$lib/server/garmin/metric-specs';
import { isDayKey } from '$lib/date';
import { fmtRecovery } from './condition.format';
import type {
  GarminReadiness,
  GarminReadinessFactor,
  GarminReadinessLevel,
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
  label: string;
  accent: GarminReadinessFactor['accent'];
  keys: readonly string[];
}> = [
  {
    key: 'sleep',
    label: 'Sen',
    accent: 'indigo',
    keys: ['sleepScoreFactorPercent', 'sleep_score_factor_percent']
  },
  {
    key: 'sleep_history',
    label: 'Historia snu',
    accent: 'violet',
    keys: ['sleepHistoryFactorPercent', 'sleep_history_factor_percent']
  },
  { key: 'hrv', label: 'HRV', accent: 'green', keys: ['hrvFactorPercent', 'hrv_factor_percent'] },
  {
    key: 'recovery',
    label: 'Regeneracja',
    accent: 'cyan',
    keys: ['recoveryTimeFactorPercent', 'recovery_time_factor_percent']
  },
  { key: 'load', label: 'Obciążenie', accent: 'orange', keys: ['acwrFactorPercent', 'acwr_factor_percent'] },
  {
    key: 'stress',
    label: 'Historia stresu',
    accent: 'amber',
    keys: ['stressHistoryFactorPercent', 'stress_history_factor_percent']
  }
];

/**
 * Garmin's recovery-time change codes. Only codes we can state plainly are rendered; anything else
 * yields null, because a raw `RECOVERY_TIME_DECREASED_SOMETHING` in the middle of a Polish sentence
 * is worse than saying nothing.
 */
const CHANGE_PHRASE: Readonly<Record<string, string>> = {
  RECOVERY_TIME_DECREASED: 'krótszy niż wczoraj',
  RECOVERY_TIME_INCREASED: 'dłuższy niż wczoraj',
  RECOVERY_TIME_NO_CHANGE: 'bez zmian',
  RECOVERY_TIME_UNCHANGED: 'bez zmian'
};

/** One parsed day, or null when the payload carries no usable score. */
export interface ParsedTrainingReadiness {
  day: string;
  score: number;
  level: GarminReadinessLevel;
  factors: GarminReadinessFactor[];
  hrvWeeklyAvg: number | null;
  acuteLoad: number | null;
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
    factors.push({ key: f.key, label: f.label, accent: f.accent, percent: Math.round(percent) });
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
  const recovery: RecoveryTime | null =
    minutes === null || minutes < 0
      ? null
      : {
          day: reportedDay,
          minutes: Math.round(minutes),
          change: changeCode ? (CHANGE_PHRASE[changeCode.toUpperCase()] ?? null) : null
        };

  return {
    day: reportedDay,
    score: Math.round(score),
    level,
    factors,
    hrvWeeklyAvg: num(data, ['hrvWeeklyAverage', 'hrv_weekly_average']),
    acuteLoad: num(data, ['acuteLoad', 'acute_load']),
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

const LEVEL_HEAD: Readonly<Record<GarminReadinessLevel, string>> = {
  prime: 'Garmin: gotowość szczytowa',
  high: 'Garmin: gotowość wysoka',
  moderate: 'Garmin: gotowość umiarkowana',
  low: 'Garmin: gotowość niska',
  poor: 'Garmin: gotowość bardzo niska',
  unknown: 'Garmin: gotowość bez oceny'
};

/**
 * The Garmin-mode sentence. Leads with Garmin's verdict, then the recovery timer — the input that
 * most often explains why Garmin's number sits far from ours — then whatever channel clauses the
 * caller already assembled for its own sentence.
 */
export function garminSummary(
  level: GarminReadinessLevel,
  recovery: RecoveryTime | null,
  clauses: readonly string[]
): string {
  const parts: string[] = [];
  if (recovery !== null) {
    parts.push(
      recovery.minutes <= 0
        ? 'regeneracja zakończona'
        : `do pełnej regeneracji ${fmtRecovery(recovery.minutes)}`
    );
  }
  parts.push(...clauses);
  return parts.length === 0 ? `${LEVEL_HEAD[level]}.` : `${LEVEL_HEAD[level]} — ${parts.join(', ')}.`;
}

/** Assemble the contract object the card consumes. */
export function toGarminReadiness(
  parsed: ParsedTrainingReadiness,
  clauses: readonly string[]
): GarminReadiness {
  return {
    day: parsed.day,
    score: parsed.score,
    level: parsed.level,
    state: stateForLevel(parsed.level),
    factors: parsed.factors,
    hrvWeeklyAvg: parsed.hrvWeeklyAvg,
    acuteLoad: parsed.acuteLoad,
    summary: garminSummary(parsed.level, parsed.recovery, clauses)
  };
}
