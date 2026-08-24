/**
 * Polish number/time formatting for the activity page (spec 026). Pure and client-safe: no I/O, no
 * clock, no config — every function is total and answers `DASH` for an absent or nonsensical input,
 * so the UI never has to guard twice and never prints "NaN" or "Invalid Date".
 *
 * One rule runs through the whole file: **a missing value is a dash, never a zero**. Garmin leaves
 * plenty of leaves absent (see spec 023's closeout) and inventing a 0 for them would be a lie.
 */
import type { DeltaArrow, DeltaDirection } from '$lib/ui/DeltaBadge.svelte';
import type { MessageKey, Translator } from '$lib/i18n';
import type { SimilarDelta } from './similar-activities';
import { numberFormat as localeNumberFormat, DEFAULT_LOCALE, type Locale } from '$lib/i18n';

/** What an absent value looks like everywhere on the page. */
export const DASH = '—';

function numberFormat(digits: number, locale: Locale): Intl.NumberFormat {
  return localeNumberFormat(locale, { maximumFractionDigits: digits, minimumFractionDigits: 0 });
}

/** True for a real, finite number (rejects `null`, `undefined`, `NaN`, `±Infinity`). */
export function isNum(value: number | null | undefined): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

/**
 * A number in the active locale's notation, or `DASH`. `locale` defaults to Polish so every existing
 * call site (most of which have no i18n context reaching them yet) keeps its exact prior output.
 */
export function fmtNum(
  value: number | null | undefined,
  digits = 0,
  locale: Locale = DEFAULT_LOCALE
): string {
  return isNum(value) ? numberFormat(digits, locale).format(value) : DASH;
}

/** As `fmtNum`, but always with an explicit sign — for deltas (body battery, stress, form). */
export function fmtSigned(
  value: number | null | undefined,
  digits = 0,
  locale: Locale = DEFAULT_LOCALE
): string {
  if (!isNum(value)) return DASH;
  const body = numberFormat(digits, locale).format(Math.abs(value));
  if (value > 0) return `+${body}`;
  if (value < 0) return `−${body}`;
  return body;
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

/**
 * `h:mm:ss` past an hour, `m:ss` below it. Negative or absent input yields `DASH`; fractional
 * seconds are floored so a 59.7 s lap never renders as "1:00".
 */
export function fmtDuration(seconds: number | null | undefined): string {
  if (!isNum(seconds) || seconds < 0) return DASH;
  const total = Math.floor(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

/** Elapsed-time axis tick: same shape as `fmtDuration` but zero-padded minutes below an hour. */
export function fmtClock(seconds: number | null | undefined): string {
  if (!isNum(seconds) || seconds < 0) return DASH;
  const total = Math.round(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

/**
 * Pace as `m:ss` (per kilometre). Paces slower than 30 min/km are treated as noise from a stopped
 * sample rather than a reading, and answer `DASH` — otherwise a single pause renders "199:59".
 */
const MAX_SENSIBLE_PACE_S = 30 * 60;

export function fmtPace(secPerKm: number | null | undefined): string {
  if (!isNum(secPerKm) || secPerKm <= 0 || secPerKm > MAX_SENSIBLE_PACE_S) return DASH;
  const total = Math.round(secPerKm);
  return `${Math.floor(total / 60)}:${pad(total % 60)}`;
}

/** Seconds per kilometre from a speed in metres per second; `null` when the speed is unusable. */
export function paceFromMps(speedMps: number | null | undefined): number | null {
  if (!isNum(speedMps) || speedMps <= 0) return null;
  const pace = 1000 / speedMps;
  return pace > MAX_SENSIBLE_PACE_S ? null : pace;
}

/** Kilometres per hour from metres per second; `null` when absent. */
export function speedKmh(speedMps: number | null | undefined): number | null {
  return isNum(speedMps) && speedMps >= 0 ? speedMps * 3.6 : null;
}

/** Metres → kilometres, `null` when absent. */
export function toKm(metres: number | null | undefined): number | null {
  return isNum(metres) ? metres / 1000 : null;
}

/** Distance in km with a unit-free body (the unit is rendered separately). */
export function fmtKm(
  metres: number | null | undefined,
  digits = 2,
  locale: Locale = DEFAULT_LOCALE
): string {
  return fmtNum(toKm(metres), digits, locale);
}

/* ---- similar-effort deltas (spec 065) ---- */

/**
 * One comparable metric on the similar-activities table, and how to read a move in it.
 *
 * A table, not three call sites passing three literal option bags: "lower pace is better, lower power
 * is not" is a fact about the metric and belongs beside the metric's name. Adding cadence later is one
 * entry here, not another `{#if}` in the markup.
 */
export interface SimilarMetric {
  /** Field on a `SimilarEntry`. */
  readonly key: 'pace' | 'hr' | 'power';
  /** Catalog key for the noun used in the assistive-tech sentence — "dziś tempo niżej o …". */
  readonly nounKey: MessageKey;
  /** `'pace'` renders as a clock; anything else is a number followed by this literal unit. */
  readonly unit: string;
  readonly lowerIsBetter: boolean;
}

export const SIMILAR_METRICS: readonly SimilarMetric[] = [
  { key: 'pace', nounKey: 'similar.metric.pace', unit: 'pace', lowerIsBetter: true },
  { key: 'hr', nounKey: 'similar.metric.hr', unit: 'bpm', lowerIsBetter: true },
  // More power for the same distance and time is more work done, so up is the good direction.
  { key: 'power', nounKey: 'similar.metric.power', unit: 'W', lowerIsBetter: false }
];

/** Everything `DeltaBadge` needs, or `null` when there is nothing to compare. */
export interface SimilarBadge {
  readonly direction: DeltaDirection;
  readonly arrow: DeltaArrow;
  readonly value: string;
  readonly label: string;
}

/** Below this the two sessions are the same number for a reader; a 0,2% "improvement" is noise. */
const SAME_PCT = 0.5;

/**
 * Turn a stored delta into the three things `DeltaBadge` needs.
 *
 * Two inversions live here and nowhere else, which is the reason this is a tested function rather than
 * a helper inside the component:
 *
 *  1. **Point of view.** `SimilarDelta` is "the older session minus today"; the reader is looking at
 *     today, so every sentence is negated into "dziś … o …".
 *  2. **Direction is not the arrow.** A lower pace points DOWN and is an improvement; a lower power
 *     points down and is not. `lowerIsBetter` is what separates them, and getting it backwards is
 *     invisible in a screenshot.
 */
export function similarDeltaBadge(
  t: Translator,
  delta: SimilarDelta,
  metric: SimilarMetric
): SimilarBadge | null {
  if (delta.abs === null || delta.pct === null) return null;

  const noun = t(metric.nounKey);
  if (Math.abs(delta.pct) < SAME_PCT) {
    return {
      direction: 'same',
      arrow: 'none',
      value: t('similar.delta.sameValue'),
      label: t('similar.delta.sameLabel', { metric: noun })
    };
  }

  const todayDelta = -delta.abs;
  const todayIsLower = todayDelta < 0;
  const magnitude =
    metric.unit === 'pace' ? fmtPace(Math.abs(todayDelta)) : `${fmtNum(Math.abs(todayDelta))} ${metric.unit}`;

  return {
    direction: todayIsLower === metric.lowerIsBetter ? 'better' : 'worse',
    arrow: todayIsLower ? 'down' : 'up',
    value: magnitude,
    label: t(todayIsLower ? 'similar.delta.lower' : 'similar.delta.higher', {
      metric: noun,
      value: magnitude
    })
  };
}

const BENEFIT_LABEL_KEYS: Readonly<Record<string, MessageKey>> = {
  RECOVERY: 'benefit.recovery',
  BASE: 'benefit.base',
  AEROBIC_BASE: 'benefit.base',
  TEMPO: 'benefit.tempo',
  THRESHOLD: 'benefit.threshold',
  LACTATE_THRESHOLD: 'benefit.threshold',
  VO2MAX: 'benefit.vo2max',
  VO2_MAX: 'benefit.vo2max',
  ANAEROBIC_CAPACITY: 'benefit.anaerobicCapacity',
  ANAEROBIC: 'benefit.anaerobic',
  SPEED: 'benefit.speed',
  SPRINT: 'benefit.sprint',
  MAINTAINING: 'benefit.maintaining',
  IMPACT_NONE: 'benefit.impactNone',
  UNKNOWN: 'benefit.unknown',
  NO_BENEFIT: 'benefit.noBenefit'
};

/**
 * Garmin's `primaryBenefit` / `trainingEffectLabel` enum, translated. An unknown label degrades to a
 * readable Title Case of the raw token rather than being hidden — a new Garmin enum value should
 * still show up on the page, even untranslated.
 */
export function benefitLabel(t: Translator, raw: string | undefined): string | null {
  if (!raw) return null;
  const key = raw.toUpperCase();
  const known = BENEFIT_LABEL_KEYS[key];
  if (known) return t(known);
  return key
    .split(/[_\s]+/)
    .filter((w) => w.length > 0)
    .map((w) => w.charAt(0) + w.slice(1).toLowerCase())
    .join(' ');
}

/**
 * Garmin's typed-split codes, translated. `RWD_*` is the run/walk detection family; interval
 * work/rest comes back as `INTERVAL_ACTIVE`/`INTERVAL_REST`.
 */
const SPLIT_LABEL_KEYS: Readonly<Record<string, MessageKey>> = {
  RWD_RUN: 'split.run',
  RWD_WALK: 'split.walk',
  RWD_STAND: 'split.stand',
  INTERVAL_ACTIVE: 'split.interval',
  INTERVAL_REST: 'split.rest',
  INTERVAL_WARMUP: 'split.warmup',
  INTERVAL_COOLDOWN: 'split.cooldown',
  RUN: 'split.run',
  WALK: 'split.walk',
  STAND: 'split.stand',
  REST: 'split.otherRest'
};

export function splitLabel(t: Translator, raw: string | undefined): string {
  if (!raw) return t('split.fallback');
  const key = SPLIT_LABEL_KEYS[raw.toUpperCase()];
  return key ? t(key) : (benefitLabel(t, raw) ?? t('split.fallback'));
}
