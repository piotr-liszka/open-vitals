/**
 * Training load / Performance Management Chart (PWRX §4). PURE compute over already-resolved local
 * data — no I/O, no clock, no Garmin. The module handler resolves activities + streams from the
 * LocalStore and hands them here.
 *
 * Per-day training stress (TSS) is derived per activity with a graceful fallback chain:
 *   1. Garmin's own `trainingLoad` for the activity (best signal when present).
 *   2. Power-based TSS from the power stream + FTP: (NP/FTP)² · (durationH) · 100.
 *   3. HR-based Banister TRIMP from avg HR + rest/max HR (last-resort, still deterministic).
 * Days with no activity contribute 0. CTL = EWMA(TSS, 42d), ATL = EWMA(TSS, 7d),
 * TSB(day) = CTL(prev) − ATL(prev).
 */
import { createTranslator, DEFAULT_LOCALE, type Translator } from '$lib/i18n';

/** Fallback translator (Polish) for the ~90 non-web callers that predate spec 076's locale threading. */
const DEFAULT_TRANSLATOR = createTranslator(DEFAULT_LOCALE);

/** Form band derived from the latest TSB. */
export type TrainingBand = 'fresh' | 'optimal' | 'neutral' | 'fatigued' | 'very-fatigued';

/** How an activity's TSS was derived (for graceful-degrade transparency). */
export type LoadMethod = 'garmin' | 'power' | 'hr' | 'none';

/** One day on the PMC. */
export interface DailyLoadPoint {
  /** Local day `YYYY-MM-DD`. */
  readonly day: string;
  readonly tss: number;
  readonly ctl: number;
  readonly atl: number;
  readonly tsb: number;
}

export interface TrainingLoadResult {
  readonly series: DailyLoadPoint[];
  /** Latest (last-day) values. */
  readonly ctl: number;
  readonly atl: number;
  readonly tsb: number;
  readonly band: TrainingBand;
  readonly recommendation: string;
  /** True when at least one activity produced load. */
  readonly hasData: boolean;
}

/** A single activity reduced to just what load computation needs. */
export interface LoadActivity {
  /** Local day `YYYY-MM-DD`. */
  readonly day: string;
  readonly durationS: number | null;
  readonly trainingLoad: number | null;
  readonly avgHr: number | null;
  readonly maxHr: number | null;
  /** Power samples (assumed ~1 Hz) when available, else null. */
  readonly power: number[] | null;
}

export interface BuildLoadOptions {
  readonly ftpWatts: number | null;
  /** Resting HR for TRIMP (default 60). */
  readonly hrRest?: number;
  /** Athlete max HR for TRIMP; falls back to the activity's own max, else 190. */
  readonly hrMax?: number | null;
  /** Series end (inclusive) `YYYY-MM-DD` — usually "today" so freshness decays over rest days. */
  readonly endDay: string;
  /**
   * The reader's translator (spec 076). Optional so every non-web caller (tests, MCP tools) keeps
   * compiling and behaving unchanged, defaulting to the Polish catalog — the same fallback
   * `createTranslator` itself uses. Only the real web route passes the actual locale.
   */
  readonly t?: Translator;
}

const DAY_MS = 86_400_000;
const NP_WINDOW = 30; // 30-second rolling average for normalized power.

/** Exponentially-weighted moving average with a TrainingPeaks-style time constant of `days`. */
export function ewma(values: number[], days: number): number[] {
  const alpha = 1 - Math.exp(-1 / days);
  const out: number[] = [];
  let prev = 0;
  for (const v of values) {
    prev = prev + alpha * (v - prev);
    out.push(prev);
  }
  return out;
}

/** Simple trailing rolling average over a fixed sample window. */
function rollingAverage(samples: number[], window: number): number[] {
  if (window <= 1) return samples.slice();
  const out: number[] = [];
  let sum = 0;
  for (let i = 0; i < samples.length; i++) {
    sum += samples[i]!;
    if (i >= window) sum -= samples[i - window]!;
    const count = Math.min(i + 1, window);
    out.push(sum / count);
  }
  return out;
}

/** Normalized Power: 4th-root of the mean of the 4th powers of a 30 s rolling average. */
export function normalizedPower(power: number[]): number | null {
  const clean = power.filter((p) => Number.isFinite(p) && p >= 0);
  if (clean.length === 0) return null;
  const roll = rollingAverage(clean, Math.min(NP_WINDOW, clean.length));
  const meanFourth = roll.reduce((a, p) => a + p ** 4, 0) / roll.length;
  return meanFourth ** 0.25;
}

/** Power-based TSS. */
export function powerTss(normPower: number, ftpWatts: number, durationS: number): number {
  if (ftpWatts <= 0 || durationS <= 0) return 0;
  const intensity = normPower / ftpWatts;
  return intensity * intensity * (durationS / 3600) * 100;
}

/**
 * Banister TRIMP (exponential) as an HR-based stand-in for TSS. Deterministic given the inputs.
 * `k` = 1.92 (a common unisex constant). Returns 0 when inputs are degenerate.
 */
export function hrTrimp(durationS: number, avgHr: number, hrRest: number, hrMax: number): number {
  if (durationS <= 0 || hrMax <= hrRest) return 0;
  const reserve = (avgHr - hrRest) / (hrMax - hrRest);
  if (reserve <= 0) return 0;
  const clamped = Math.min(reserve, 1);
  const minutes = durationS / 60;
  return minutes * clamped * 0.64 * Math.exp(1.92 * clamped);
}

/** Resolve a single activity's stress score via the fallback chain. */
export function activityLoad(a: LoadActivity, opts: BuildLoadOptions): { tss: number; method: LoadMethod } {
  if (a.trainingLoad != null && a.trainingLoad > 0) return { tss: a.trainingLoad, method: 'garmin' };

  const durationS = a.durationS ?? (a.power ? a.power.length : 0);

  if (opts.ftpWatts != null && opts.ftpWatts > 0 && a.power && a.power.length > 0) {
    const np = normalizedPower(a.power);
    if (np != null) return { tss: powerTss(np, opts.ftpWatts, durationS), method: 'power' };
  }

  if (a.avgHr != null && a.avgHr > 0 && durationS > 0) {
    const hrRest = opts.hrRest ?? 60;
    const hrMax = opts.hrMax ?? a.maxHr ?? 190;
    const trimp = hrTrimp(durationS, a.avgHr, hrRest, hrMax);
    if (trimp > 0) return { tss: trimp, method: 'hr' };
  }

  return { tss: 0, method: 'none' };
}

/** TSB → form band per PWRX thresholds. */
export function bandForTsb(tsb: number): TrainingBand {
  if (tsb > 25) return 'fresh';
  if (tsb >= 5) return 'optimal';
  if (tsb >= -10) return 'neutral';
  if (tsb >= -30) return 'fatigued';
  return 'very-fatigued';
}

/** Built per-call from a `Translator` (spec 076) so the verdict sentence renders in the reader's locale. */
function recommendationsFor(t: Translator): Record<TrainingBand, string> {
  return {
    fresh: t('trainingLoad.recommendation.fresh'),
    optimal: t('trainingLoad.recommendation.optimal'),
    neutral: t('trainingLoad.recommendation.neutral'),
    fatigued: t('trainingLoad.recommendation.fatigued'),
    'very-fatigued': t('trainingLoad.recommendation.veryFatigued')
  };
}

function addDays(day: string, n: number): string {
  const d = new Date(`${day}T00:00:00Z`).getTime() + n * DAY_MS;
  return new Date(d).toISOString().slice(0, 10);
}

function daysBetween(start: string, end: string): number {
  return Math.round(
    (new Date(`${end}T00:00:00Z`).getTime() - new Date(`${start}T00:00:00Z`).getTime()) / DAY_MS
  );
}

/**
 * Build the full PMC series + latest form snapshot from a set of activities.
 *
 * `opts.t` is optional so every existing call site (and the ~90 tests that predate spec 076) keeps
 * compiling and behaving exactly as before, defaulting to the Polish catalog — the same fallback
 * `createTranslator` itself uses. Only the real web route resolves the reader's actual locale.
 */
export function buildTrainingLoad(activities: LoadActivity[], opts: BuildLoadOptions): TrainingLoadResult {
  const t = opts.t ?? DEFAULT_TRANSLATOR;
  const perDay = new Map<string, number>();
  let hasData = false;
  for (const a of activities) {
    const { tss } = activityLoad(a, opts);
    if (tss > 0) hasData = true;
    perDay.set(a.day, (perDay.get(a.day) ?? 0) + tss);
  }

  if (perDay.size === 0) {
    return {
      series: [],
      ctl: 0,
      atl: 0,
      tsb: 0,
      band: 'neutral',
      recommendation: t('trainingLoad.recommendation.noData'),
      hasData: false
    };
  }

  const days = [...perDay.keys()].sort();
  const startDay = days[0]!;
  // Extend to the later of the last activity and the requested end so form decays over rest days.
  const lastActivity = days[days.length - 1]!;
  const endDay = opts.endDay > lastActivity ? opts.endDay : lastActivity;

  const span = Math.max(0, daysBetween(startDay, endDay));
  const dayList: string[] = [];
  const tssSeries: number[] = [];
  for (let i = 0; i <= span; i++) {
    const day = addDays(startDay, i);
    dayList.push(day);
    tssSeries.push(perDay.get(day) ?? 0);
  }

  const ctl = ewma(tssSeries, 42);
  const atl = ewma(tssSeries, 7);

  const series: DailyLoadPoint[] = dayList.map((day, i) => ({
    day,
    tss: tssSeries[i]!,
    ctl: ctl[i]!,
    atl: atl[i]!,
    // TSB uses the PREVIOUS day's fitness/fatigue; day 0 seeds from 0.
    tsb: (i === 0 ? 0 : ctl[i - 1]!) - (i === 0 ? 0 : atl[i - 1]!)
  }));

  const latest = series[series.length - 1]!;
  const band = bandForTsb(latest.tsb);

  return {
    series,
    ctl: latest.ctl,
    atl: latest.atl,
    tsb: latest.tsb,
    band,
    recommendation: hasData ? recommendationsFor(t)[band] : t('trainingLoad.recommendation.noData'),
    hasData
  };
}
