/**
 * Predicted race times (spec 043). PURE: bests in, predictions out. No store, no clock, no Garmin.
 *
 * Garmin's race predictor is the number its users check most and it is not in the data we sync. Two
 * independent ways to estimate it, both from things we already compute:
 *
 * 1. **Riegel** — `T₂ = T₁ · (D₂/D₁)^1.06`. An empirical law fitted to race results across distances:
 *    pace degrades slightly faster than distance grows. It works on any known best.
 * 2. **Critical speed** — from the two-parameter model, `t = (D − D′)/CS`. Physiological rather than
 *    empirical, and it comes free with spec 042's curve.
 *
 * Reporting BOTH is the point. They are derived from different data and different assumptions, so when
 * they agree the number is worth something, and when they diverge that itself is the finding — usually a
 * runner whose speed is far ahead of their endurance, or vice versa.
 *
 * ## Honesty, and why the extrapolation limit exists
 *
 * Riegel is fitted over a modest range of distances. Predicting a marathon from a 1 km best means
 * extrapolating 42× and the answer is fiction — it ignores fuelling, heat and the fact that the athlete
 * may never have run over 10 km. So:
 *
 *  · every prediction names the best it came from and the factor it extrapolated;
 *  · beyond `MAX_EXTRAPOLATION` no prediction is produced at all;
 *  · a prediction is marked `confident` only within `CONFIDENT_EXTRAPOLATION`;
 *  · the source best chosen is always the one CLOSEST in distance to the target, so a 10 km best predicts
 *    the half rather than a 1 km best doing it.
 */

/** Riegel's fatigue exponent. 1.06 is the classic fit; higher means pace fades faster with distance. */
export const RIEGEL_EXPONENT = 1.06;
/** Beyond this ratio between target and source distance, no prediction is offered. */
export const MAX_EXTRAPOLATION = 4;
/** Within this ratio the prediction is worth trusting. */
export const CONFIDENT_EXTRAPOLATION = 2.5;

export interface RaceDistance {
  readonly key: string;
  readonly label: string;
  readonly metres: number;
}

export const RACE_TARGETS: readonly RaceDistance[] = [
  { key: '5k', label: '5 km', metres: 5000 },
  { key: '10k', label: '10 km', metres: 10_000 },
  { key: 'half', label: 'Półmaraton', metres: 21_097.5 },
  { key: 'marathon', label: 'Maraton', metres: 42_195 }
];

/**
 * Where a source best came from (spec 057).
 *
 *  - `measured`  — the fastest window actually recorded inside an activity (spec 054's stored efforts).
 *  - `projected` — an even-pace projection over a whole run (`personalBests`). A 15 km run's "5 km" is
 *                  `duration × (5/15)`: arithmetic, not a result. Kept only as a FALLBACK, and named
 *                  as such, so a prediction never quietly claims more than it knows.
 */
export type PredictionBasis = 'measured' | 'projected';

/** A known best the prediction can be built from. */
export interface KnownBest {
  readonly metres: number;
  readonly timeS: number;
  /** Label of the best, for saying where a prediction came from. */
  readonly label: string;
  /** Local day the best was set, so a view can say how fresh it is. */
  readonly day?: string;
  /** How this pair was obtained. Absent = unknown provenance (older callers). */
  readonly basis?: PredictionBasis;
}

/**
 * How a prediction has moved against an AS-OF snapshot of the same athlete (spec 057).
 *
 * Sign convention: `deltaS = previousS − currentS`, so POSITIVE means faster now. Times are the one
 * metric where "smaller is better", and encoding that once here keeps every consumer from re-deciding
 * it (and from getting it backwards).
 */
export interface RaceTrend {
  /** Seconds gained since the cutoff. Positive = improvement, negative = regression, 0 = unchanged. */
  readonly deltaS: number;
  /** The prediction as it stood at the cutoff, seconds. */
  readonly previousS: number;
  /** The cutoff itself, local `YYYY-MM-DD` — a delta with no "since when" is not a fact. */
  readonly sinceDay: string;
}

export interface RacePrediction {
  readonly key: string;
  readonly label: string;
  readonly metres: number;
  /** Riegel estimate, seconds. `null` when no usable best is close enough. */
  readonly riegelS: number | null;
  /** Critical-speed estimate, seconds. `null` without a critical speed. */
  readonly criticalSpeedS: number | null;
  /** Pace of the Riegel estimate, s/km. */
  readonly paceSecPerKm: number | null;
  /** Which best Riegel extrapolated from. */
  readonly fromLabel: string | null;
  readonly fromDay: string | null;
  /** Whether that source was a measured effort or an even-pace projection (spec 057). */
  readonly fromBasis: PredictionBasis | null;
  /** Target ÷ source distance. 1 means the best IS this distance. */
  readonly extrapolation: number | null;
  /** True when the extrapolation is small enough to trust. */
  readonly confident: boolean;
  /**
   * Movement against an as-of snapshot (spec 057). ABSENT — never a zero — when the two sides are not
   * comparable, because "no earlier prediction" and "exactly as fast as before" are different facts
   * and a fake 0 would be read as the second one.
   */
  readonly trend?: RaceTrend;
}

/** Riegel's law. `null` for unusable inputs. */
export function riegelTime(
  sourceTimeS: number,
  sourceMetres: number,
  targetMetres: number,
  exponent = RIEGEL_EXPONENT
): number | null {
  if (!(sourceTimeS > 0) || !(sourceMetres > 0) || !(targetMetres > 0)) return null;
  return Math.round(sourceTimeS * (targetMetres / sourceMetres) ** exponent);
}

/**
 * Time to cover `targetMetres` at critical speed, spending the anaerobic reserve: `t = (D − D′)/CS`.
 * `null` when the reserve alone would cover the distance (the model does not apply at sprint distances).
 */
export function criticalSpeedTime(
  csMps: number | null | undefined,
  dPrimeM: number | null | undefined,
  targetMetres: number
): number | null {
  if (!isNum(csMps) || csMps <= 0 || !(targetMetres > 0)) return null;
  const reserve = isNum(dPrimeM) && dPrimeM > 0 ? dPrimeM : 0;
  const aerobic = targetMetres - reserve;
  if (aerobic <= 0) return null;
  return Math.round(aerobic / csMps);
}

export interface PredictOptions {
  readonly csMps?: number | null;
  readonly dPrimeM?: number | null;
  readonly targets?: readonly RaceDistance[];
  readonly exponent?: number;
}

/**
 * One prediction per target distance. Targets with no usable source are omitted rather than filled with a
 * guess, so an athlete who has only ever run 5 km sees a 10 km prediction and not a marathon one.
 */
export function predictRaces(bests: readonly KnownBest[], opts: PredictOptions = {}): RacePrediction[] {
  const targets = opts.targets ?? RACE_TARGETS;
  const usable = bests.filter((b) => b.metres > 0 && b.timeS > 0);
  const out: RacePrediction[] = [];

  for (const target of targets) {
    const source = closestBest(usable, target.metres);
    const extrapolation = source ? ratio(target.metres, source.metres) : null;
    const withinRange = source !== null && extrapolation !== null && extrapolation <= MAX_EXTRAPOLATION;

    const riegelS = withinRange
      ? riegelTime(source.timeS, source.metres, target.metres, opts.exponent)
      : null;
    const criticalSpeedS = criticalSpeedTime(opts.csMps, opts.dPrimeM, target.metres);

    // Nothing to say about this distance from either method.
    if (riegelS === null && criticalSpeedS === null) continue;

    out.push({
      key: target.key,
      label: target.label,
      metres: target.metres,
      riegelS,
      criticalSpeedS,
      paceSecPerKm: riegelS === null ? null : Math.round(riegelS / (target.metres / 1000)),
      fromLabel: riegelS === null ? null : (source?.label ?? null),
      fromDay: riegelS === null ? null : (source?.day ?? null),
      fromBasis: riegelS === null ? null : (source?.basis ?? null),
      extrapolation: riegelS === null ? null : round2(extrapolation ?? 1),
      confident: riegelS !== null && extrapolation !== null && extrapolation <= CONFIDENT_EXTRAPOLATION
    });
  }

  return out;
}

/**
 * Attach the movement of each prediction against an AS-OF snapshot of the same athlete (spec 057).
 *
 * `previous` is the output of `predictRaces` run over only the bests that existed on or before
 * `sinceDay`, so the comparison is a real recomputation with the same engine — not a stored number
 * from a past page load, and not a different model.
 *
 * The trend is attached to the RIEGEL estimate, because that is the number the card leads with. A
 * distance the earlier snapshot could not speak to (or that Riegel cannot reach today) gets no `trend`
 * key at all: "I have no comparison" must not render as "no change".
 *
 * Both directions are genuinely reachable even though both sides use all-time bests, because
 * `closestBest` may pick a different SOURCE distance on each side — an athlete who has since run an
 * actual, steadier 10 km replaces a sharp 5 km extrapolation with a slower and more honest number.
 */
export function withPredictionTrend(
  current: readonly RacePrediction[],
  previous: readonly RacePrediction[],
  sinceDay: string
): RacePrediction[] {
  const before = new Map<string, RacePrediction>();
  for (const p of previous) before.set(p.key, p);

  return current.map((p) => {
    const prev = before.get(p.key);
    const previousS = prev?.riegelS ?? null;
    if (p.riegelS === null || previousS === null) return p;
    return { ...p, trend: { deltaS: previousS - p.riegelS, previousS, sinceDay } };
  });
}

/**
 * The best whose distance is closest to the target in RATIO terms, not in metres. A 5 km best and a 20 km
 * best are each 4× from 20 km and 5 km respectively; ranking by metres would wrongly prefer whichever
 * happens to be numerically nearer and give a much worse extrapolation.
 */
function closestBest(bests: readonly KnownBest[], targetMetres: number): KnownBest | null {
  let best: KnownBest | null = null;
  let bestRatio = Infinity;
  for (const b of bests) {
    const r = ratio(targetMetres, b.metres);
    if (r < bestRatio) {
      bestRatio = r;
      best = b;
    }
  }
  return best;
}

/** How far apart two distances are, as a factor ≥ 1 in either direction. */
function ratio(a: number, b: number): number {
  if (!(a > 0) || !(b > 0)) return Infinity;
  return a > b ? a / b : b / a;
}

const isNum = (v: number | null | undefined): v is number => typeof v === 'number' && Number.isFinite(v);

function round2(v: number): number {
  return Math.round(v * 100) / 100;
}
