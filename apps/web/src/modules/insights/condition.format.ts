/**
 * Client-safe formatting for the condition panel (spec 022).
 *
 * Separate from `insights.condition.ts` on purpose: that module imports `$lib/server/*` (metric
 * specs, Garmin types) and so can never be pulled into a Svelte component. These helpers are pure
 * string work, shared by the server-side snapshot builder and `ConditionCard.svelte`, so both
 * render a duration or a delta exactly the same way.
 */
import { formatDecimals, formatInteger, type Translator } from '$lib/i18n';
import { DEFAULT_TIME_ZONE, dayKeyOf, daysBetween, formatDay, formatInstant } from '$lib/date';
import type { ConditionMetric, RecoveryTime } from './insights.types';

/** `7 h 31 min` / `48 min`. The app's one voice for a slept/trained duration. */
export function fmtSleepDuration(seconds: number | null): string | null {
  if (seconds === null || !Number.isFinite(seconds) || seconds <= 0) return null;
  const total = Math.round(seconds);
  if (total < 60) return `${total} s`;
  // Round to whole minutes FIRST, so 59:40 becomes "1 h 00 min" rather than "0 h 60 min".
  const minutes = Math.round(total / 60);
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h} h ${String(m).padStart(2, '0')} min` : `${m} min`;
}

/** A channel's headline number, respecting the metric's own format. */
export function fmtChannelValue(t: Translator, metric: ConditionMetric): string {
  if (metric.format === 'duration') return fmtSleepDuration(metric.latest) ?? '—';
  return formatInteger(t.locale, Math.round(metric.latest));
}

/** `+6.2%` / `−3.1%` against the baseline, or null when the channel is flat / has no baseline. */
export function fmtDelta(t: Translator, metric: ConditionMetric): string | null {
  if (metric.deltaPct === null || metric.direction === 'flat') return null;
  const sign = metric.deltaPct > 0 ? '+' : '−';
  return `${sign}${formatDecimals(t.locale, Math.abs(metric.deltaPct), 1)}%`;
}

/** The baseline written the way the channel's value is written. */
export function fmtBaseline(t: Translator, metric: ConditionMetric): string | null {
  if (metric.baseline === null) return null;
  if (metric.format === 'duration') return fmtSleepDuration(metric.baseline);
  return formatInteger(t.locale, Math.round(metric.baseline));
}

/**
 * Garmin's recovery timer: `45 min` / `34 h` / `2 dni 4 h` / `gotowy` (specs 059, 070).
 *
 * The argument is MINUTES — Garmin's `recoveryTime` field is in minutes, and reading it as hours is
 * what once rendered a 3672-minute (61-hour) timer as "153 dni". Zero means recovered, which must
 * read as an answer rather than as missing data.
 *
 * Under an hour is written in minutes rather than rounded: "0 h" beside a badge that still says you
 * are not recovered is a contradiction, and "gotowy" would be an outright lie with 40 minutes left.
 */
export function fmtRecovery(t: Translator, minutes: number): string {
  if (!Number.isFinite(minutes) || minutes <= 0) return t('condition.readyLabel');
  const total = Math.round(minutes);
  if (total < 60) return `${total} min`;
  // Whole hours from here on, the way Garmin's own timer reads.
  const hours = Math.round(total / 60);
  if (hours < 24) return `${hours} h`;
  const days = Math.floor(hours / 24);
  const rest = hours % 24;
  const daysText = t('common.days', { count: days });
  return rest === 0 ? daysText : `${daysText} ${rest} h`;
}

/* ------------------------------------------------------------------ *
 * The recovery timer as a live countdown (spec 075)
 * ------------------------------------------------------------------ */

/**
 * Minutes still remaining at `nowMs`, counted from the instant Garmin computed the reading.
 *
 * Falls back to the stored figure — the spec 072 behaviour — in the two cases where counting would
 * be a guess rather than a derivation: no capture instant to count from, and a reading a later
 * activity has already invalidated. `nowMs = null` means "no clock supplied", which is the same
 * situation and gets the same answer.
 *
 * A capture instant in the FUTURE (clock skew between the watch, Garmin and this host) is clamped to
 * `nowMs`, so the card can never advertise more time than Garmin itself reported.
 */
export function remainingMinutes(recovery: RecoveryTime, nowMs: number | null): number {
  if (nowMs === null || !Number.isFinite(nowMs)) return recovery.minutes;
  if (recovery.superseded || recovery.endsAt === null) return recovery.minutes;
  const elapsed = Math.max(0, nowMs - (recovery.capturedAt as number));
  return Math.max(0, recovery.minutes - Math.floor(elapsed / 60_000));
}

/** True when the card may show a live, ticking figure rather than a frozen one. */
export function isLiveCountdown(recovery: RecoveryTime, nowMs: number | null): boolean {
  return nowMs !== null && Number.isFinite(nowMs) && !recovery.superseded && recovery.endsAt !== null;
}

/**
 * The moment full recovery lands, said the way a reader would: `dziś 09:43` / `today 09:43`,
 * `jutro` / `tomorrow`, or `17 sie, 09:43` further out. Null when there is no instant to name.
 *
 * The absolute moment is the half of this pair that does not decay: a countdown answers "how long",
 * a clock time answers "when", and only the second one survives being read an hour later or
 * compared against what the watch is showing.
 */
export function fmtRecoveryEnd(
  t: Translator,
  endsAt: number | null,
  nowMs: number | null,
  timeZone: string = DEFAULT_TIME_ZONE
): string | null {
  if (endsAt === null || nowMs === null || !Number.isFinite(endsAt) || !Number.isFinite(nowMs)) {
    return null;
  }
  const at = new Date(endsAt);
  const time = formatInstant(t.locale, at, 'time', timeZone);
  if (time === '') return null;
  const days = daysBetween(dayKeyOf(new Date(nowMs), timeZone), dayKeyOf(at, timeZone));
  if (days === 0) return t('condition.recoveryEndToday', { time });
  if (days === 1) return t('condition.recoveryEndTomorrow', { time });
  return t('condition.recoveryEndOn', { day: formatDay(t.locale, dayKeyOf(at, timeZone)), time });
}

/** Whole percent, e.g. a sleep-efficiency readout. */
export function fmtPercent(t: Translator, value: number | null): string | null {
  return value === null || !Number.isFinite(value) ? null : `${formatInteger(t.locale, Math.round(value))}%`;
}
