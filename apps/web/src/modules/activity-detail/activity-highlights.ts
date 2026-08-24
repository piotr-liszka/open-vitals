/**
 * "Which of these sixty numbers actually deserve your attention?" (spec 036)
 *
 * Two independent engines, deliberately not one:
 *
 *  · `buildHighlights` needs the athlete's history and answers *this was notable* — a personal best,
 *    or the fastest since some month. It is the reason to open the page.
 *  · `buildSuspects` needs only this session and answers *this number is probably wrong* — a GPS
 *    spike, a dropped strap, barometer drift. Garmin and Strava both render these as facts; naming
 *    them is the difference between data the athlete trusts and data they quietly discount.
 *
 * A page with no comparable history still gets its data-quality flags, which is why they are split.
 *
 * PURE. Everything is a parameter: no store, no clock, no `$lib/server`. That last one matters —
 * the Svelte component imports these types directly, so a server-only import here would break the
 * production build (SvelteKit's `$lib/server` guard only fires at build time).
 *
 * HONESTY RULES THE WORDING.
 *  · A metric with fewer than `MIN_COMPARABLE` comparable sessions is not ranked at all. A second-ever
 *    run is not a record, and calling it one teaches the athlete to distrust every other badge.
 *  · "Rekord" is claimed only when the window examined actually reaches back to the first comparable
 *    session. When it does not, the wording names the span we looked at instead.
 *  · Ranking is anchored on the activity's OWN day, like spec 026's verdict: a March run's standing
 *    must not change because it is now August.
 *  · Pace is derived from distance ÷ moving time on BOTH sides. A bulk `listActivities` read omits the
 *    `raw` blob, so Garmin's own average-speed field is not available for history — deriving it for
 *    both keeps the comparison apples to apples instead of silently mixing two definitions.
 */
import { daysBetween, isDayKey, type DayKey } from '$lib/date';
import type { SportGroup } from '$lib/sport-labels';
import { DEFAULT_LOCALE, numberFormat, type Locale, type MessageKey, type Translator } from '$lib/i18n';

/* --------------------------------------------------------------------- *
 * Tunables — one place, so re-tuning the judgement is a one-line change.
 * --------------------------------------------------------------------- */

/** Comparable sessions a metric needs before it may be ranked at all. */
export const MIN_COMPARABLE = 8;
/** How stale the last better session must be before "najlepszy od N miesięcy" is worth saying. */
export const NOTABLE_MONTHS = 6;
/** Placings worth reporting when nothing else applies. */
export const TOP_RANK = 3;
/** Days per month used to phrase the gap. Deliberately crude — the sentence says "miesięcy". */
const DAYS_PER_MONTH = 30;

/**
 * Speeds no human reaches under their own power in that sport, in km/h. Anything past these is a
 * spike, not an achievement. Families we cannot bound (`strength`, `other`) are simply absent.
 */
export const SPEED_CEILING_KMH: Partial<Record<SportGroup, number>> = {
  run: 32,
  walk: 15,
  ride: 100,
  swim: 12
};

/** A maximum this many times the average is a spike even when it clears the ceiling. */
const SPIKE_RATIO = 2.5;
/** Metres of climb per kilometre past which the barometer is more likely wrong than the hill. */
const CLIMB_PER_KM_CEILING = 250;
/** No athlete's heart reaches this; a strap picking up cadence does. */
const HR_CEILING_BPM = 220;
/** Gap between max and average HR that reads as a lone artefact rather than an interval session. */
const HR_SPIKE_GAP_BPM = 75;
/** Disagreement between distance ÷ time and the reported average speed worth mentioning. */
const SPEED_MISMATCH_PCT = 0.25;
/** Consecutive zero-cadence samples that mean the sensor dropped rather than the athlete paused. */
const CADENCE_GAP_SAMPLES = 60;

/* --------------------------------------------------------------------- *
 * Shapes
 * --------------------------------------------------------------------- */

/** `record` earned a superlative; `notable` earned a mention. */
export type HighlightKind = 'record' | 'notable';

export interface ActivityHighlight {
  readonly key: string;
  readonly label: string;
  /** Pre-formatted — this engine owns the number's presentation, the view only places it. */
  readonly value: string;
  readonly unit?: string;
  readonly kind: HighlightKind;
  /** Resolved Polish one-liner, e.g. "Rekord — najlepszy wynik w historii". */
  readonly text: string;
  /** 1 = nothing earlier beats it. */
  readonly rank: number;
  /** Comparable sessions the rank is out of, this one included. */
  readonly outOf: number;
}

export type SuspectSeverity = 'warn' | 'info';

export interface SuspectValue {
  readonly key: string;
  readonly label: string;
  readonly value: string;
  /** Why it looks wrong, in plain Polish. */
  readonly text: string;
  readonly severity: SuspectSeverity;
}

/** The summary fields a session contributes to a ranking. All nullable: watches differ. */
export interface HighlightActivity {
  readonly day: string;
  readonly distanceM: number | null;
  /** Moving time where the watch reports it, else elapsed. */
  readonly durationS: number | null;
  readonly elevationGainM: number | null;
  readonly calories: number | null;
  readonly trainingLoad: number | null;
  readonly normPower: number | null;
}

export interface HighlightsInput {
  readonly sport: SportGroup;
  readonly current: HighlightActivity;
  /** Comparable sessions of the same family from BEFORE this one. Order is irrelevant. */
  readonly history: readonly HighlightActivity[];
  /**
   * True when `history` reaches the athlete's first comparable session — the only case in which a
   * superlative may be claimed.
   */
  readonly coversAllHistory: boolean;
}

export interface SuspectInput {
  readonly sport: SportGroup;
  readonly distanceM: number | null;
  /** Elapsed time. */
  readonly durationS: number | null;
  readonly movingS: number | null;
  readonly elevationGainM: number | null;
  /** Garmin's own averages, from the raw payload — absent on some sports. */
  readonly avgSpeedMps: number | null;
  readonly maxSpeedMps: number | null;
  readonly avgHr: number | null;
  readonly maxHr: number | null;
  readonly cadence?: readonly number[] | undefined;
}

/* --------------------------------------------------------------------- *
 * Small local formatting. Deliberately NOT `activity-format`: that module
 * renders "—" for absent values, and everything here is already known to
 * be a real number.
 * --------------------------------------------------------------------- */

const isNum = (v: number | null | undefined): v is number => typeof v === 'number' && Number.isFinite(v);

/** `locale` defaults to Polish so every existing caller (none of which pass one yet) is unaffected. */
function fixed(v: number, digits: number, locale: Locale = DEFAULT_LOCALE): string {
  return numberFormat(locale, { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(v);
}

function fmtPaceValue(secPerKm: number): string {
  const total = Math.round(secPerKm);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function fmtDurationValue(seconds: number): string {
  const total = Math.round(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return h > 0
    ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
    : `${m}:${String(s).padStart(2, '0')}`;
}

/* --------------------------------------------------------------------- *
 * Metrics
 * --------------------------------------------------------------------- */

interface MetricDef {
  readonly key: string;
  readonly labelKey: MessageKey;
  readonly unit?: string;
  /** Which direction is an achievement. */
  readonly goodWhen: 'up' | 'down';
  /** Families this metric is offered for; absent = all of them. */
  readonly sports?: readonly SportGroup[];
  readonly value: (a: HighlightActivity) => number | null;
  readonly format: (v: number, locale: Locale) => string;
}

/** Distance ÷ moving time as seconds per kilometre. `null` unless both sides are usable. */
export function derivedPaceSecPerKm(a: HighlightActivity): number | null {
  if (!isNum(a.distanceM) || !isNum(a.durationS)) return null;
  if (a.distanceM < 400 || a.durationS <= 0) return null;
  return a.durationS / (a.distanceM / 1000);
}

/** Distance ÷ moving time as km/h. `null` unless both sides are usable. */
export function derivedSpeedKmh(a: HighlightActivity): number | null {
  const pace = derivedPaceSecPerKm(a);
  return pace === null || pace <= 0 ? null : 3600 / pace;
}

const METRICS: readonly MetricDef[] = [
  {
    key: 'distance',
    labelKey: 'highlight.metric.distance',
    unit: 'km',
    goodWhen: 'up',
    value: (a) => (isNum(a.distanceM) && a.distanceM > 0 ? a.distanceM : null),
    format: (v, locale) => fixed(v / 1000, 2, locale)
  },
  {
    key: 'duration',
    labelKey: 'highlight.metric.duration',
    goodWhen: 'up',
    value: (a) => (isNum(a.durationS) && a.durationS > 0 ? a.durationS : null),
    format: fmtDurationValue
  },
  {
    key: 'elevation',
    labelKey: 'highlight.metric.elevation',
    unit: 'm',
    goodWhen: 'up',
    value: (a) => (isNum(a.elevationGainM) && a.elevationGainM > 0 ? a.elevationGainM : null),
    format: (v, locale) => fixed(v, 0, locale)
  },
  {
    key: 'pace',
    labelKey: 'highlight.metric.pace',
    unit: 'min/km',
    goodWhen: 'down',
    sports: ['run', 'walk', 'swim'],
    value: derivedPaceSecPerKm,
    format: fmtPaceValue
  },
  {
    key: 'speed',
    labelKey: 'highlight.metric.speed',
    unit: 'km/h',
    goodWhen: 'up',
    sports: ['ride'],
    value: derivedSpeedKmh,
    format: (v, locale) => fixed(v, 1, locale)
  },
  {
    key: 'load',
    labelKey: 'highlight.metric.load',
    goodWhen: 'up',
    value: (a) => (isNum(a.trainingLoad) && a.trainingLoad > 0 ? a.trainingLoad : null),
    format: (v, locale) => fixed(v, 0, locale)
  },
  {
    key: 'calories',
    labelKey: 'highlight.metric.calories',
    unit: 'kcal',
    goodWhen: 'up',
    value: (a) => (isNum(a.calories) && a.calories > 0 ? a.calories : null),
    format: (v, locale) => fixed(v, 0, locale)
  },
  {
    key: 'normPower',
    labelKey: 'highlight.metric.normPower',
    unit: 'W',
    goodWhen: 'up',
    value: (a) => (isNum(a.normPower) && a.normPower > 0 ? a.normPower : null),
    format: (v, locale) => fixed(v, 0, locale)
  }
];

/** Whole months between two day keys; 0 when either is unusable. */
function monthsBetween(from: string, to: string): number {
  if (!isDayKey(from) || !isDayKey(to)) return 0;
  const days = daysBetween(from as DayKey, to as DayKey);
  return days <= 0 ? 0 : Math.floor(days / DAYS_PER_MONTH);
}

/** The span a truncated window actually covered, phrased for the sentence. */
function spanText(t: Translator, history: readonly HighlightActivity[], day: string): string {
  const days = history
    .map((h) => h.day)
    .filter(isDayKey)
    .sort();
  const oldest = days[0];
  if (oldest === undefined) return t('highlight.span.syncedHistory');
  const months = monthsBetween(oldest, day);
  if (months >= 24) return t('highlight.span.years', { years: Math.floor(months / 12) });
  if (months >= 1) return t('highlight.months', { count: months });
  return t('highlight.span.syncedHistory');
}

const better = (a: number, b: number, goodWhen: 'up' | 'down'): boolean =>
  goodWhen === 'up' ? a > b : a < b;

/**
 * Rank this session's value among earlier ones and, when something beat it, how long ago that was.
 *
 * Ties are counted apart from wins on purpose. Equalling a best is not setting one, and — more
 * importantly — a metric several earlier sessions report identically is not measuring anything about
 * THIS session (a watch that hands every walk the same training load, say). `tied` is what lets the
 * caller tell "wyrównany rekord" from "this number is a constant, say nothing".
 */
function place(
  current: number,
  earlier: readonly { value: number; day: string }[],
  goodWhen: 'up' | 'down',
  day: string
): { rank: number; outOf: number; tied: number; monthsSinceBetter: number | null } {
  let strictlyBetter = 0;
  let tied = 0;
  let lastBetterDay: string | null = null;
  for (const e of earlier) {
    if (e.value === current) {
      tied++;
      continue;
    }
    if (!better(e.value, current, goodWhen)) continue;
    strictlyBetter++;
    if (lastBetterDay === null || e.day > lastBetterDay) lastBetterDay = e.day;
  }
  return {
    rank: strictlyBetter + 1,
    outOf: earlier.length + 1,
    tied,
    monthsSinceBetter: lastBetterDay === null ? null : monthsBetween(lastBetterDay, day)
  };
}

/** Earlier sessions tying a best, past which the metric is a constant rather than an achievement. */
const MAX_TIES_FOR_BEST = 1;

export function buildHighlights(t: Translator, input: HighlightsInput): ActivityHighlight[] {
  const { current, history, sport, coversAllHistory } = input;
  const out: ActivityHighlight[] = [];

  for (const metric of METRICS) {
    if (metric.sports && !metric.sports.includes(sport)) continue;

    const value = metric.value(current);
    if (value === null) continue;

    const earlier = history.flatMap((h) => {
      const v = metric.value(h);
      return v === null ? [] : [{ value: v, day: h.day }];
    });
    // A second-ever run is not a record. Silence beats a badge nobody should believe.
    if (earlier.length < MIN_COMPARABLE) continue;

    const { rank, outOf, tied, monthsSinceBetter } = place(value, earlier, metric.goodWhen, current.day);

    let kind: HighlightKind | null = null;
    let text = '';
    if (rank === 1 && tied > MAX_TIES_FOR_BEST) {
      // Several earlier sessions report exactly this value: the metric is a constant here, not a
      // result. Saying "rekord" would be true of every one of them.
      continue;
    } else if (rank === 1 && tied === 1) {
      kind = 'notable';
      text = coversAllHistory
        ? t('highlight.tiedAllTime')
        : t('highlight.tiedWindow', { span: spanText(t, history, current.day) });
    } else if (rank === 1) {
      kind = 'record';
      text = coversAllHistory
        ? t('highlight.recordAllTime')
        : t('highlight.recordWindow', { span: spanText(t, history, current.day) });
    } else if (monthsSinceBetter !== null && monthsSinceBetter >= NOTABLE_MONTHS) {
      kind = 'notable';
      text = t('highlight.bestSince', { span: t('highlight.months', { count: monthsSinceBetter }) });
    } else if (rank <= TOP_RANK) {
      kind = 'notable';
      text = coversAllHistory
        ? t('highlight.rankAllTime', { rank })
        : t('highlight.rankWindow', { rank, span: spanText(t, history, current.day) });
    }
    if (kind === null) continue;

    out.push({
      key: metric.key,
      label: t(metric.labelKey),
      value: metric.format(value, t.locale),
      ...(metric.unit === undefined ? {} : { unit: metric.unit }),
      kind,
      text,
      rank,
      outOf
    });
  }

  // Records first, then the closest placings; metric order breaks the remaining ties.
  const order = new Map(METRICS.map((m, i) => [m.key, i]));
  return out.sort(
    (a, b) =>
      Number(b.kind === 'record') - Number(a.kind === 'record') ||
      a.rank - b.rank ||
      (order.get(a.key) ?? 0) - (order.get(b.key) ?? 0)
  );
}

/* --------------------------------------------------------------------- *
 * Suspect values
 * --------------------------------------------------------------------- */

/** Longest run of consecutive zeros in a stream. 0 for an absent or all-positive stream. */
export function longestZeroRun(stream: readonly number[] | undefined): number {
  if (!stream || stream.length === 0) return 0;
  let best = 0;
  let run = 0;
  for (const v of stream) {
    if (v === 0) {
      run++;
      if (run > best) best = run;
    } else if (Number.isFinite(v)) {
      run = 0;
    }
  }
  return best;
}

export function buildSuspects(t: Translator, input: SuspectInput): SuspectValue[] {
  const out: SuspectValue[] = [];
  const {
    sport,
    distanceM,
    durationS,
    movingS,
    elevationGainM,
    avgSpeedMps,
    maxSpeedMps,
    avgHr,
    maxHr,
    cadence
  } = input;

  const maxKmh = isNum(maxSpeedMps) && maxSpeedMps > 0 ? maxSpeedMps * 3.6 : null;
  const avgKmh = isNum(avgSpeedMps) && avgSpeedMps > 0 ? avgSpeedMps * 3.6 : null;
  const ceiling = SPEED_CEILING_KMH[sport];

  /* ---- speed: over a physical ceiling, else far over its own average ---- */
  const overCeiling = maxKmh !== null && ceiling !== undefined && maxKmh > ceiling;
  if (overCeiling && maxKmh !== null && ceiling !== undefined) {
    out.push({
      key: 'maxSpeedCeiling',
      label: t('suspect.label.maxSpeed'),
      value: `${fixed(maxKmh, 1, t.locale)} km/h`,
      text: t('suspect.speedCeiling', { ceiling }),
      severity: 'warn'
    });
  } else if (maxKmh !== null && avgKmh !== null && avgKmh > 1 && maxKmh / avgKmh >= SPIKE_RATIO) {
    out.push({
      key: 'maxSpeedSpike',
      label: t('suspect.label.maxSpeed'),
      value: `${fixed(maxKmh, 1, t.locale)} km/h`,
      text: t('suspect.speedSpike', {
        ratio: fixed(maxKmh / avgKmh, 1, t.locale),
        avg: fixed(avgKmh, 1, t.locale)
      }),
      severity: 'info'
    });
  }

  /* ---- climb per kilometre ---- */
  if (isNum(elevationGainM) && isNum(distanceM) && distanceM >= 1000) {
    const km = distanceM / 1000;
    const perKm = elevationGainM / km;
    if (perKm > CLIMB_PER_KM_CEILING) {
      out.push({
        key: 'elevationPerKm',
        label: t('suspect.label.elevation'),
        value: `${fixed(elevationGainM, 0, t.locale)} m / ${fixed(km, 2, t.locale)} km`,
        text: t('suspect.elevationPerKm', {
          perKm: fixed(perKm, 0, t.locale),
          ceiling: CLIMB_PER_KM_CEILING
        }),
        severity: 'warn'
      });
    }
  }

  /* ---- heart rate ---- */
  if (isNum(maxHr) && maxHr >= HR_CEILING_BPM) {
    out.push({
      key: 'maxHrCeiling',
      label: t('suspect.label.maxHr'),
      value: `${fixed(maxHr, 0, t.locale)} bpm`,
      text: t('suspect.maxHrCeiling', { ceiling: HR_CEILING_BPM }),
      severity: 'warn'
    });
  } else if (isNum(maxHr) && isNum(avgHr) && maxHr - avgHr >= HR_SPIKE_GAP_BPM) {
    out.push({
      key: 'hrSpike',
      label: t('suspect.label.maxHr'),
      value: `${fixed(maxHr, 0, t.locale)} bpm`,
      text: t('suspect.hrSpike', { gap: fixed(maxHr - avgHr, 0, t.locale), avg: fixed(avgHr, 0, t.locale) }),
      severity: 'info'
    });
  }

  /* ---- distance ÷ time vs the reported average ---- */
  const timeForSpeed = isNum(movingS) && movingS > 0 ? movingS : durationS;
  if (isNum(distanceM) && isNum(timeForSpeed) && timeForSpeed > 0 && avgKmh !== null) {
    const impliedKmh = (distanceM / timeForSpeed) * 3.6;
    const drift = Math.abs(impliedKmh - avgKmh) / avgKmh;
    if (drift > SPEED_MISMATCH_PCT) {
      out.push({
        key: 'speedMismatch',
        label: t('suspect.label.distanceTime'),
        value: `${fixed(impliedKmh, 1, t.locale)} vs ${fixed(avgKmh, 1, t.locale)} km/h`,
        text: t('suspect.speedMismatch', {
          implied: fixed(impliedKmh, 1, t.locale),
          avg: fixed(avgKmh, 1, t.locale),
          drift: fixed(drift * 100, 0, t.locale)
        }),
        severity: 'info'
      });
    }
  }

  /* ---- moving longer than elapsed ---- */
  if (isNum(movingS) && isNum(durationS) && movingS > durationS + 5) {
    out.push({
      key: 'movingOverElapsed',
      label: t('suspect.label.movingTime'),
      value: `${fmtDurationValue(movingS)} / ${fmtDurationValue(durationS)}`,
      text: t('suspect.movingOverElapsed'),
      severity: 'warn'
    });
  }

  /* ---- cadence dropout ---- */
  if (sport === 'run' || sport === 'walk' || sport === 'ride') {
    const gap = longestZeroRun(cadence);
    if (gap >= CADENCE_GAP_SAMPLES) {
      out.push({
        key: 'cadenceGap',
        label: t('suspect.label.cadence'),
        value: t('suspect.zeroSamples', { count: fixed(gap, 0, t.locale) }),
        text: t('suspect.cadenceGap', {
          gap: fixed(gap, 0, t.locale),
          minutes: fixed(gap / 60, 0, t.locale)
        }),
        severity: 'info'
      });
    }
  }

  // Hard problems before curiosities.
  return out.sort((a, b) => Number(b.severity === 'warn') - Number(a.severity === 'warn'));
}
