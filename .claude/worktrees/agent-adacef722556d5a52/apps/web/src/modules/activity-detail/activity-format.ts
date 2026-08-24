/**
 * Polish number/time formatting for the activity page (spec 026). Pure and client-safe: no I/O, no
 * clock, no config — every function is total and answers `DASH` for an absent or nonsensical input,
 * so the UI never has to guard twice and never prints "NaN" or "Invalid Date".
 *
 * One rule runs through the whole file: **a missing value is a dash, never a zero**. Garmin leaves
 * plenty of leaves absent (see spec 023's closeout) and inventing a 0 for them would be a lie.
 */
import type { DeltaArrow, DeltaDirection } from '$lib/ui/DeltaBadge.svelte';
import type { SimilarDelta } from './similar-activities';

/** What an absent value looks like everywhere on the page. */
export const DASH = '—';

const LOCALE = 'pl-PL';
const formatters = new Map<number, Intl.NumberFormat>();

function numberFormat(digits: number): Intl.NumberFormat {
  let fmt = formatters.get(digits);
  if (!fmt) {
    fmt = new Intl.NumberFormat(LOCALE, { maximumFractionDigits: digits, minimumFractionDigits: 0 });
    formatters.set(digits, fmt);
  }
  return fmt;
}

/** True for a real, finite number (rejects `null`, `undefined`, `NaN`, `±Infinity`). */
export function isNum(value: number | null | undefined): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

/** A number in Polish notation (comma decimal separator), or `DASH`. */
export function fmtNum(value: number | null | undefined, digits = 0): string {
  return isNum(value) ? numberFormat(digits).format(value) : DASH;
}

/** As `fmtNum`, but always with an explicit sign — for deltas (body battery, stress, form). */
export function fmtSigned(value: number | null | undefined, digits = 0): string {
  if (!isNum(value)) return DASH;
  const body = numberFormat(digits).format(Math.abs(value));
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
export function fmtKm(metres: number | null | undefined, digits = 2): string {
  return fmtNum(toKm(metres), digits);
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
  /** Polish noun used in the assistive-tech sentence — "dziś tempo niżej o …". */
  readonly noun: string;
  /** `'pace'` renders as a clock; anything else is a number followed by this literal unit. */
  readonly unit: string;
  readonly lowerIsBetter: boolean;
}

export const SIMILAR_METRICS: readonly SimilarMetric[] = [
  { key: 'pace', noun: 'tempo', unit: 'pace', lowerIsBetter: true },
  { key: 'hr', noun: 'tętno', unit: 'bpm', lowerIsBetter: true },
  // More power for the same distance and time is more work done, so up is the good direction.
  { key: 'power', noun: 'moc', unit: 'W', lowerIsBetter: false }
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
export function similarDeltaBadge(delta: SimilarDelta, metric: SimilarMetric): SimilarBadge | null {
  if (delta.abs === null || delta.pct === null) return null;

  if (Math.abs(delta.pct) < SAME_PCT) {
    return {
      direction: 'same',
      arrow: 'none',
      value: 'bez zmian',
      label: `${metric.noun} bez zmian względem tego treningu`
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
    label: `dziś ${metric.noun} ${todayIsLower ? 'niżej' : 'wyżej'} o ${magnitude} niż w tym treningu`
  };
}

/**
 * Garmin's `primaryBenefit` / `trainingEffectLabel` enum in Polish. Unknown labels degrade to a
 * readable Title Case of the raw token rather than being hidden — a new Garmin enum value should
 * still show up on the page.
 */
const BENEFIT_LABELS: Readonly<Record<string, string>> = {
  RECOVERY: 'Regeneracja',
  BASE: 'Baza tlenowa',
  AEROBIC_BASE: 'Baza tlenowa',
  TEMPO: 'Tempo',
  THRESHOLD: 'Próg mleczanowy',
  LACTATE_THRESHOLD: 'Próg mleczanowy',
  VO2MAX: 'VO2 max',
  VO2_MAX: 'VO2 max',
  ANAEROBIC_CAPACITY: 'Wydolność beztlenowa',
  ANAEROBIC: 'Beztlenowy',
  SPEED: 'Szybkość',
  SPRINT: 'Sprint',
  MAINTAINING: 'Podtrzymanie',
  IMPACT_NONE: 'Bez wpływu',
  UNKNOWN: 'Nieokreślony',
  NO_BENEFIT: 'Bez wyraźnej korzyści'
};

export function benefitLabel(raw: string | undefined): string | null {
  if (!raw) return null;
  const key = raw.toUpperCase();
  const known = BENEFIT_LABELS[key];
  if (known) return known;
  return key
    .split(/[_\s]+/)
    .filter((w) => w.length > 0)
    .map((w) => w.charAt(0) + w.slice(1).toLowerCase())
    .join(' ');
}

/**
 * Garmin's typed-split codes in Polish. `RWD_*` is the run/walk detection family; interval work/rest
 * comes back as `INTERVAL_ACTIVE`/`INTERVAL_REST`.
 */
const SPLIT_LABELS: Readonly<Record<string, string>> = {
  RWD_RUN: 'Bieg',
  RWD_WALK: 'Marsz',
  RWD_STAND: 'Postój',
  INTERVAL_ACTIVE: 'Interwał',
  INTERVAL_REST: 'Przerwa',
  INTERVAL_WARMUP: 'Rozgrzewka',
  INTERVAL_COOLDOWN: 'Schłodzenie',
  RUN: 'Bieg',
  WALK: 'Marsz',
  STAND: 'Postój',
  REST: 'Odpoczynek'
};

export function splitLabel(raw: string | undefined): string {
  if (!raw) return 'Odcinek';
  return SPLIT_LABELS[raw.toUpperCase()] ?? benefitLabel(raw) ?? 'Odcinek';
}
