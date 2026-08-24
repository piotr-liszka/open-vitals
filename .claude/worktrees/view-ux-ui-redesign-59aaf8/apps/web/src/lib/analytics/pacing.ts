/**
 * Did the athlete pace this, or blow up? (spec 045) PURE: a distance/time axis in, a verdict out. No
 * store, no clock, no Garmin. In `lib/analytics/` alongside the other stream engines.
 *
 * Every session on the activity page reports an average pace, which says nothing about the SHAPE of the
 * effort — and the shape is what the athlete wants to know after a hard session. Two numbers cover it:
 *
 * 1. **Split balance** — second half against first half. Negative split (finishing faster) is what good
 *    pacing looks like; a large positive split is the classic went-out-too-hard session.
 * 2. **Variability** — the coefficient of variation of pace across even chunks of the session. A steady
 *    tempo run and an interval session can share an average and a split balance while being nothing alike,
 *    and only the variability tells them apart.
 *
 * The two together classify the session, and the classification is the point: "even", "negative split",
 * "faded" and "variable" are four different sessions that the same average pace hides.
 *
 * ## Honesty
 *
 * · The halves are split by DISTANCE, not by time. Splitting a fading run by time puts more than half its
 *   distance in the first half and understates the fade.
 * · A session too short to chunk meaningfully is not judged at all.
 * · Variability cannot distinguish deliberate intervals from a collapse; it reports the number and the
 *   classification says "variable" rather than "badly paced".
 */

/** Chunks the session is divided into for the variability measure. */
export const PACING_CHUNKS = 10;
/** Minimum distance before a session is worth judging at all. */
export const MIN_DISTANCE_M = 1500;
/** Split imbalance beyond this counts as fading (or, negative, as a negative split). */
export const SPLIT_TOLERANCE_PCT = 3;
/** Pace coefficient of variation beyond this reads as a deliberately varied session. */
export const VARIABLE_CV_PCT = 12;

export type PacingShape = 'even' | 'negative-split' | 'faded' | 'variable';

export interface Pacing {
  /**
   * Percent the second half was SLOWER than the first, by pace. Positive = faded, negative = negative
   * split, near zero = even.
   */
  readonly splitPct: number;
  readonly firstHalfPaceSecPerKm: number;
  readonly secondHalfPaceSecPerKm: number;
  /** Coefficient of variation of chunk pace, in percent. Higher = more varied. */
  readonly variabilityPct: number;
  readonly shape: PacingShape;
  /** Chunks behind the variability figure. */
  readonly chunks: number;
}

/**
 * Pace shape of a session, from a cumulative-distance and elapsed-time pair (`cumulativeDistance` and
 * `elapsedSeconds` from `activity-charts.ts` produce exactly that). `null` when the session is too short
 * or the axes are unusable.
 */
export function pacing(
  cumulativeM: readonly number[] | null | undefined,
  elapsedS: readonly number[] | null | undefined
): Pacing | null {
  if (!cumulativeM || !elapsedS) return null;
  const n = Math.min(cumulativeM.length, elapsedS.length);
  if (n < 4) return null;

  const startM = cumulativeM[0] ?? 0;
  const startT = elapsedS[0] ?? 0;
  const totalM = (cumulativeM[n - 1] ?? 0) - startM;
  const totalT = (elapsedS[n - 1] ?? 0) - startT;
  if (!(totalM >= MIN_DISTANCE_M) || !(totalT > 0)) return null;

  /** Elapsed seconds at the point the athlete had covered `metres`, by linear interpolation. */
  const timeAt = (metres: number): number => {
    const target = startM + metres;
    for (let i = 1; i < n; i++) {
      const prevM = cumulativeM[i - 1] ?? 0;
      const hereM = cumulativeM[i] ?? 0;
      if (hereM < target) continue;
      const prevT = elapsedS[i - 1] ?? 0;
      const hereT = elapsedS[i] ?? 0;
      const span = hereM - prevM;
      // Interpolate within the sample so a coarse recording does not quantise the split.
      const fraction = span > 0 ? (target - prevM) / span : 0;
      return prevT + (hereT - prevT) * fraction - startT;
    }
    return totalT;
  };

  const halfT = timeAt(totalM / 2);
  const firstHalfPace = paceOf(totalM / 2, halfT);
  const secondHalfPace = paceOf(totalM / 2, totalT - halfT);
  if (firstHalfPace === null || secondHalfPace === null) return null;

  const splitPct = round1(((secondHalfPace - firstHalfPace) / firstHalfPace) * 100);

  // Chunk paces over EQUAL DISTANCES, so each chunk is a comparable piece of the route.
  const chunkM = totalM / PACING_CHUNKS;
  const paces: number[] = [];
  let previousT = 0;
  for (let k = 1; k <= PACING_CHUNKS; k++) {
    const t = timeAt(chunkM * k);
    const pace = paceOf(chunkM, t - previousT);
    if (pace !== null) paces.push(pace);
    previousT = t;
  }
  const variabilityPct = coefficientOfVariation(paces);

  return {
    splitPct,
    firstHalfPaceSecPerKm: Math.round(firstHalfPace),
    secondHalfPaceSecPerKm: Math.round(secondHalfPace),
    variabilityPct,
    shape: shapeOf(splitPct, variabilityPct),
    chunks: paces.length
  };
}

/**
 * Classify the pair. Variability is checked FIRST: an interval session's split balance is an accident of
 * where the reps fell, so calling it "faded" would be wrong even when the number says so.
 */
export function shapeOf(splitPct: number, variabilityPct: number): PacingShape {
  if (variabilityPct > VARIABLE_CV_PCT) return 'variable';
  if (splitPct > SPLIT_TOLERANCE_PCT) return 'faded';
  if (splitPct < -SPLIT_TOLERANCE_PCT) return 'negative-split';
  return 'even';
}

function paceOf(metres: number, seconds: number): number | null {
  if (!(metres > 0) || !(seconds > 0)) return null;
  return seconds / (metres / 1000);
}

/** Coefficient of variation in percent; 0 for fewer than two values. */
function coefficientOfVariation(values: readonly number[]): number {
  if (values.length < 2) return 0;
  const mean = values.reduce((s, v) => s + v, 0) / values.length;
  if (!(mean > 0)) return 0;
  const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length;
  return round1((Math.sqrt(variance) / mean) * 100);
}

function round1(v: number): number {
  return Math.round(v * 10) / 10;
}
