/**
 * Pure power/HR analytics over an `ActivityStreams` (spec — PWRX §2 activity detail). No I/O, no
 * clock, no config: every function takes plain arrays and returns plain values so they are trivially
 * unit-testable with hand-computed fixtures. Each one DEGRADES gracefully — a missing stream yields
 * `null` (scalars) or `[]` (curves/zones) rather than throwing, so widgets can simply hide.
 *
 * Definitions (Coggan / TrainingPeaks):
 *  - Normalized Power (NP): 4th-root of the mean of the 4th powers of a 30-second rolling average.
 *  - Intensity Factor (IF): NP / FTP.
 *  - Training Stress Score (TSS): (durationS · NP · IF) / (FTP · 3600) · 100.
 *  - Mean-max curve: the best average power sustainable for each target duration.
 *  - Power zones: time spent in Coggan Z1–Z7 as a fraction of FTP.
 *  - HR zones: time spent in five bands of %maxHR.
 */
import { HR_ZONE_BANDS, POWER_ZONE_BANDS, zoneForPct } from '$lib/analytics/zones';

/** Best average power sustained over `durationS` seconds. */
export interface DurationPower {
  readonly durationS: number;
  readonly watts: number;
}

/** Time spent in one training zone. */
export interface ZoneBucket {
  /** 1-based zone number. */
  readonly zone: number;
  readonly label: string;
  readonly seconds: number;
  /** Share of total time, percent, one decimal. */
  readonly pct: number;
}

/** Target durations (seconds) for the mean-max best-power curve. */
export const MEAN_MAX_DURATIONS: readonly number[] = [5, 10, 30, 60, 120, 300, 600, 1200, 1800, 2700, 3600];

/** Median positive sample interval (seconds) inferred from the `time` stream; defaults to 1 Hz. */
export function sampleIntervalS(time?: readonly number[]): number {
  if (!time || time.length < 2) return 1;
  const diffs: number[] = [];
  for (let i = 1; i < time.length; i++) {
    const d = time[i]! - time[i - 1]!;
    if (d > 0) diffs.push(d);
  }
  if (diffs.length === 0) return 1;
  diffs.sort((a, b) => a - b);
  const mid = Math.floor(diffs.length / 2);
  const med = diffs.length % 2 === 1 ? diffs[mid]! : (diffs[mid - 1]! + diffs[mid]!) / 2;
  return med > 0 ? med : 1;
}

const mean = (xs: readonly number[]): number =>
  xs.length === 0 ? 0 : xs.reduce((s, x) => s + x, 0) / xs.length;

/** Trailing full-window averages of width `w`. When the series is shorter than `w`, the whole-series
 * mean is returned as a single value (so NP of a constant series equals that constant). */
function trailingWindowAverages(values: readonly number[], w: number): number[] {
  if (w <= 1) return [...values];
  if (values.length < w) return [mean(values)];
  const out: number[] = [];
  let sum = 0;
  for (let i = 0; i < values.length; i++) {
    sum += values[i]!;
    if (i >= w) sum -= values[i - w]!;
    if (i >= w - 1) out.push(sum / w);
  }
  return out;
}

/** Normalized Power (watts), rounded to the nearest integer. `null` when the power stream is empty. */
export function normalizedPower(power?: readonly number[], time?: readonly number[]): number | null {
  if (!power || power.length === 0) return null;
  const dt = sampleIntervalS(time);
  const window = Math.max(1, Math.round(30 / dt));
  const rolling = trailingWindowAverages(power, window);
  if (rolling.length === 0) return null;
  const mean4 = rolling.reduce((s, x) => s + x ** 4, 0) / rolling.length;
  return Math.round(mean4 ** 0.25);
}

/** Intensity Factor = NP / FTP, rounded to two decimals. `null` when NP or FTP is missing. */
export function intensityFactor(np: number | null, ftp: number | null): number | null {
  if (np == null || !ftp || ftp <= 0) return null;
  return Math.round((np / ftp) * 100) / 100;
}

/** Training Stress Score, rounded to the nearest integer. `null` when any input is missing. */
export function trainingStressScore(
  durationS: number | null,
  np: number | null,
  ftp: number | null
): number | null {
  if (!durationS || durationS <= 0 || np == null || !ftp || ftp <= 0) return null;
  const intensity = np / ftp; // raw IF (not the rounded display value) keeps TSS precise
  const tss = ((durationS * np * intensity) / (ftp * 3600)) * 100;
  return Math.round(tss);
}

/** Total mechanical work in kilojoules (∑ power·dt / 1000). `null` when the power stream is empty. */
export function totalWorkKj(power?: readonly number[], time?: readonly number[]): number | null {
  if (!power || power.length === 0) return null;
  const dt = sampleIntervalS(time);
  const joules = power.reduce((s, w) => s + w * dt, 0);
  return Math.round(joules / 1000);
}

/** Mean-max best-power curve across {@link MEAN_MAX_DURATIONS}. Durations longer than the activity
 * are omitted; an empty array is returned when there is no power stream. */
export function meanMaxCurve(power?: readonly number[], time?: readonly number[]): DurationPower[] {
  if (!power || power.length === 0) return [];
  const dt = sampleIntervalS(time);
  const n = power.length;
  const prefix = new Array<number>(n + 1).fill(0);
  for (let i = 0; i < n; i++) prefix[i + 1] = prefix[i]! + power[i]!;
  const out: DurationPower[] = [];
  for (const d of MEAN_MAX_DURATIONS) {
    const w = Math.max(1, Math.round(d / dt));
    if (w > n) continue;
    let best = -Infinity;
    for (let i = w; i <= n; i++) {
      const avg = (prefix[i]! - prefix[i - w]!) / w;
      if (avg > best) best = avg;
    }
    out.push({ durationS: d, watts: Math.round(best) });
  }
  return out;
}

/** Estimate FTP as 95% of the best 20-minute (1200 s) power. `null` when that point is absent. */
export function estimateFtpFromCurve(curve: readonly DurationPower[]): number | null {
  const best20 = curve.find((c) => c.durationS === 1200);
  if (!best20) return null;
  return Math.round(0.95 * best20.watts);
}

/**
 * Coggan power-zone index (1–7) for a power sample expressed as a percentage of FTP.
 *
 * The bands themselves live in `$lib/analytics/zones` (spec 086), because the UI has to explain them
 * and a component cannot import `$lib/server`. Deriving them here — rather than keeping a second
 * copy of the numbers — is the whole point of that module.
 */
function powerZoneIndex(pct: number): number {
  return zoneForPct(POWER_ZONE_BANDS, pct);
}

/** Time-in-zone across Coggan power zones Z1–Z7. Empty when power or FTP is missing. */
export function powerZones(
  power?: readonly number[],
  ftp?: number | null,
  time?: readonly number[]
): ZoneBucket[] {
  if (!power || power.length === 0 || !ftp || ftp <= 0) return [];
  const dt = sampleIntervalS(time);
  const secs = new Array<number>(POWER_ZONE_BANDS.length + 1).fill(0);
  for (const p of power) {
    const z = powerZoneIndex((p / ftp) * 100);
    secs[z] = (secs[z] ?? 0) + dt;
  }
  return toBuckets(secs, POWER_ZONE_BANDS.length);
}

/**
 * HR-zone index (1–5) for a heart-rate sample expressed as a percentage of max HR. Bands from the
 * shared table in `$lib/analytics/zones` (spec 086), same as the power zones above.
 */
function hrZoneIndex(pct: number): number {
  return zoneForPct(HR_ZONE_BANDS, pct);
}

/** Time-in-zone across five %maxHR bands Z1–Z5. Empty when HR or maxHR is missing. */
export function hrZones(
  hr?: readonly number[],
  maxHr?: number | null,
  time?: readonly number[]
): ZoneBucket[] {
  if (!hr || hr.length === 0 || !maxHr || maxHr <= 0) return [];
  const dt = sampleIntervalS(time);
  const secs = new Array<number>(HR_ZONE_BANDS.length + 1).fill(0);
  for (const h of hr) {
    const z = hrZoneIndex((h / maxHr) * 100);
    secs[z] = (secs[z] ?? 0) + dt;
  }
  return toBuckets(secs, HR_ZONE_BANDS.length);
}

/** Turn a per-zone seconds array (index = zone number) into labelled, percentaged buckets. */
function toBuckets(secs: readonly number[], zones: number): ZoneBucket[] {
  const total = secs.reduce((a, b) => a + b, 0);
  const out: ZoneBucket[] = [];
  for (let z = 1; z <= zones; z++) {
    out.push({
      zone: z,
      label: `Z${z}`,
      seconds: secs[z] ?? 0,
      pct: total > 0 ? Math.round(((secs[z] ?? 0) / total) * 1000) / 10 : 0
    });
  }
  return out;
}
