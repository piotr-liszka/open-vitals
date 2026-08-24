/**
 * Training paces from a time-trial result (spec 079).
 *
 * This is a COACHING MODEL, not a measurement, and it lives alone in one file for that reason: it
 * can be read, argued with and replaced without touching anything else. Every number the tools
 * report from here is stamped with `PACE_MODEL` so nobody downstream mistakes it for something the
 * watch recorded.
 *
 * The model, in two steps:
 *
 *  1. **Riegel to an equivalent 5 km.** A 10 km or half-marathon result is converted to the 5 km
 *     pace it implies (`T₂ = T₁·(D₂/D₁)^1.06`, the same law spec 043 predicts races with), so the
 *     offsets below only ever have one input to work from.
 *  2. **Conventional offsets from 5 km race pace.** These are the classic Daniels-style
 *     relationships, in seconds per kilometre. They are NOT personalised — two athletes with the
 *     same 5 km differ in where their threshold actually sits — which is exactly why the result is
 *     returned as a proposal for a coach to accept or adjust rather than written automatically.
 */
import { riegelTime } from './race-predictor';

/** The name reported with every derived set, so its provenance travels with the numbers. */
export const PACE_MODEL = 'riegel-5k-offsets';

/** The distance the offsets are defined against. */
export const REFERENCE_DISTANCE_M = 5000;

/**
 * Offsets from 5 km race pace, in SECONDS PER KILOMETRE, as `[fast, slow]` bounds of each band.
 *
 *  - `interval` sits at 5 km pace itself — that is what a 5 km race is.
 *  - `threshold` is the pace holdable for about an hour: roughly 15–25 s/km slower.
 *  - `easy` is the wide band most volume is run in, 75–105 s/km slower. Wide on purpose: the most
 *    common training error is running it too fast, and a narrow band invites splitting the
 *    difference upwards.
 *  - `long` overlaps the slow end of easy rather than being its own effort.
 *  - `goal` is 5 km pace, restated so a block has an explicit target to prescribe against.
 */
export const OFFSETS_S_PER_KM: Readonly<Record<string, readonly [number, number]>> = {
  interval: [-5, 5],
  threshold: [15, 25],
  easy: [75, 105],
  long: [85, 115],
  goal: [0, 0]
};

export interface PaceRange {
  readonly lowS: number;
  readonly highS: number;
}

export interface DerivedPaces {
  readonly model: string;
  /** The 5 km pace the offsets were applied to, seconds per km. */
  readonly equivalent5kPaceS: number;
  readonly paces: Readonly<Record<string, PaceRange>>;
}

/** A pace nothing human produces. Outside this, the input is a unit mistake, not a result. */
export const MIN_PACE_S = 120;
export const MAX_PACE_S = 1200;

/**
 * How far the Riegel conversion may reach, as a ratio between the trial distance and 5 km.
 *
 * Spec 043 caps its own predictions at `MAX_EXTRAPOLATION` (4×) and this is the same concern, but
 * the limit is deliberately looser: a half marathon is 4.2× a 5 km and is a perfectly ordinary
 * thing to have raced — the coach named it — while spec 043 is guarding against predicting a
 * MARATHON from a kilometre. Six admits every distance an athlete actually time-trials and still
 * refuses the case that motivated this bound: a 100 m sprint is 50× and extrapolating it to 5 km is
 * fiction with a plausible-looking pace attached.
 */
export const MAX_CONVERSION_RATIO = 6;

export class TimeTrialInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TimeTrialInputError';
  }
}

/**
 * Convert a time trial at any distance into training pace bands.
 *
 * @param distanceM the distance actually covered
 * @param durationS the time it took
 */
export function pacesFromTimeTrial(distanceM: number, durationS: number): DerivedPaces {
  if (!Number.isFinite(distanceM) || distanceM <= 0) {
    throw new TimeTrialInputError('distance must be a positive number of metres');
  }
  if (!Number.isFinite(durationS) || durationS <= 0) {
    throw new TimeTrialInputError('duration must be a positive number of seconds');
  }

  const ratio = Math.max(distanceM / REFERENCE_DISTANCE_M, REFERENCE_DISTANCE_M / distanceM);
  if (ratio > MAX_CONVERSION_RATIO) {
    throw new TimeTrialInputError(
      `${Math.round(distanceM)} m is too far from 5 km (${ratio.toFixed(1)}×) to convert reliably — ` +
        'time-trial a distance between about 800 m and 30 km'
    );
  }

  // Step 1: what would this athlete run 5 km in? A 5 km input passes through unchanged.
  // `riegelTime` returns null only for non-positive inputs, which the guards above have ruled out —
  // but it is typed nullable, so the fallback keeps that contract honest rather than asserting.
  const equivalent5kS =
    distanceM === REFERENCE_DISTANCE_M
      ? durationS
      : (riegelTime(durationS, distanceM, REFERENCE_DISTANCE_M) ?? durationS);

  const pace5k = Math.round((equivalent5kS / REFERENCE_DISTANCE_M) * 1000);

  /*
   * Guard the OUTPUT, not just the input. A 400 m sprint extrapolated to 5 km, or a distance/time
   * pair transposed by the caller, lands outside anything a human runs — and a block written with a
   * 40 s/km easy pace is worse than one with no paces at all.
   */
  if (pace5k < MIN_PACE_S || pace5k > MAX_PACE_S) {
    throw new TimeTrialInputError(
      `that result implies a 5 km pace of ${pace5k} s/km, which is outside anything runnable — check the distance and time`
    );
  }

  const paces: Record<string, PaceRange> = {};
  for (const [key, [fast, slow]] of Object.entries(OFFSETS_S_PER_KM)) {
    paces[key] = { lowS: pace5k + fast, highS: pace5k + slow };
  }

  return { model: PACE_MODEL, equivalent5kPaceS: pace5k, paces };
}
