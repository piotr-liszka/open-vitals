/**
 * Client-safe formatting for the condition panel (spec 022).
 *
 * Separate from `insights.condition.ts` on purpose: that module imports `$lib/server/*` (metric
 * specs, Garmin types) and so can never be pulled into a Svelte component. These helpers are pure
 * string work, shared by the server-side snapshot builder and `ConditionCard.svelte`, so both
 * render a duration or a delta exactly the same way.
 */
import type { ConditionMetric } from './insights.types';

const INT = new Intl.NumberFormat('pl-PL', { maximumFractionDigits: 0 });
const ONE_DP = new Intl.NumberFormat('pl-PL', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

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
export function fmtChannelValue(metric: ConditionMetric): string {
  if (metric.format === 'duration') return fmtSleepDuration(metric.latest) ?? '—';
  return INT.format(Math.round(metric.latest));
}

/** `+6,2%` / `−3,1%` against the baseline, or null when the channel is flat / has no baseline. */
export function fmtDelta(metric: ConditionMetric): string | null {
  if (metric.deltaPct === null || metric.direction === 'flat') return null;
  const sign = metric.deltaPct > 0 ? '+' : '−';
  return `${sign}${ONE_DP.format(Math.abs(metric.deltaPct))}%`;
}

/** The baseline written the way the channel's value is written. */
export function fmtBaseline(metric: ConditionMetric): string | null {
  if (metric.baseline === null) return null;
  if (metric.format === 'duration') return fmtSleepDuration(metric.baseline);
  return INT.format(Math.round(metric.baseline));
}

/**
 * Garmin's recovery timer: `34 h` / `2 dni 4 h` / `gotowy` (spec 059). Garmin reports whole hours,
 * and zero means recovered — which must read as an answer, not as missing data.
 */
export function fmtRecovery(hours: number): string {
  if (!Number.isFinite(hours) || hours <= 0) return 'gotowy';
  const total = Math.round(hours);
  if (total < 24) return `${total} h`;
  const days = Math.floor(total / 24);
  const rest = total % 24;
  const dayWord = days === 1 ? 'dzień' : 'dni';
  return rest === 0 ? `${days} ${dayWord}` : `${days} ${dayWord} ${rest} h`;
}

/** Whole percent, e.g. a sleep-efficiency readout. */
export function fmtPercent(value: number | null): string | null {
  return value === null || !Number.isFinite(value) ? null : `${INT.format(Math.round(value))}%`;
}
