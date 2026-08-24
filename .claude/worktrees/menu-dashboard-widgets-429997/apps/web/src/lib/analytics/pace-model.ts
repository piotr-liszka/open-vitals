/**
 * What the athlete's legs can actually do, corrected for the ground and measured over durations
 * (spec 042). PURE: streams in, numbers out. No store, no clock, no Garmin. In `lib/analytics/` because
 * `activity-charts.ts` derives a chart from the first half of it and is bundled into the browser.
 *
 * Two halves, both of which the app was missing:
 *
 * ## 1. Grade-adjusted pace (GAP)
 *
 * A 5:30/km up a 6% climb is a much harder effort than 5:30/km on the flat, and Strava paywalls the
 * correction. We hold a `grade` stream, so the fix is arithmetic.
 *
 * The factor is a quadratic in gradient fitted to the shape of Minetti's cost-of-running curve: running
 * cost rises steeply uphill and falls downhill — but only to a point, because past roughly −10% braking
 * costs energy again. The polynomial reproduces that turn, which a linear "add 12 s per percent" rule of
 * thumb cannot.
 *
 * It is a MODEL, not a measurement. Two runners on the same hill do not pay the same penalty, and the
 * curve is fitted to level-ground economy. It is good enough to make a hilly run comparable to a flat one
 * and not good enough to be quoted as a race time.
 *
 * ## 2. Speed–duration curve, and critical speed
 *
 * The cycling side already has `meanMaxCurve` (best average power over each duration) and derives FTP
 * from it. This is the running twin: the best average SPEED sustained over each duration, which is the
 * curve every pace zone and race prediction should really be built on.
 *
 * From two points on it — a short one and a long one — comes **critical speed**: the asymptote the curve
 * flattens towards, i.e. the fastest pace that is aerobically sustainable. It is the running analogue of
 * FTP and, unlike a threshold test, it falls out of training the athlete already did.
 */

/* --------------------------------------------------------------------- *
 * Grade-adjusted pace
 * --------------------------------------------------------------------- */

/** Gradients beyond ±35% are scrambling, not running; the model is not fitted there. */
export const MAX_GRADE_PCT = 35;
/**
 * Downhill gradient at which the cost curve bottoms out. Steeper than this and braking starts costing
 * energy again, which is the behaviour a linear rule of thumb gets wrong.
 */
export const CHEAPEST_GRADE_PCT = -10;

/**
 * Energy cost of running at `gradePct`, relative to the flat (1.0 = flat). Clamped to the gradient range
 * the fit covers.
 *
 * A parabola with its vertex AT the cheapest gradient, pinned through two anchors:
 *
 *   f(0)   = 1.00   — flat is the reference by definition
 *   f(+10) = 1.50   — a 10% climb costs about half again as much
 *
 * Solving both with the vertex at `CHEAPEST_GRADE_PCT` fixes the third coefficient, and the minimum then
 * lands at 0.83 — i.e. a gentle descent is about 17% cheaper than the flat. Putting the vertex in the
 * formula rather than fitting three free coefficients is what guarantees the curve turns back UP below
 * −10% instead of promising ever-cheaper running, which is the mistake a linear "12 s per percent" rule
 * and a carelessly fitted quadratic both make.
 */
const VERTEX_COST = 5 / 6; // f(CHEAPEST_GRADE_PCT), from the two anchors above
const CURVATURE = (1 - VERTEX_COST) / CHEAPEST_GRADE_PCT ** 2;

export function gradeCostFactor(gradePct: number): number {
  if (!Number.isFinite(gradePct)) return 1;
  const g = Math.max(-MAX_GRADE_PCT, Math.min(MAX_GRADE_PCT, gradePct));
  const factor = CURVATURE * (g - CHEAPEST_GRADE_PCT) ** 2 + VERTEX_COST;
  // Never let the model claim a gradient makes running more than free.
  return Math.max(0.5, factor);
}

/**
 * The flat-ground speed equivalent to running `speedMps` at `gradePct`: faster than the raw speed uphill,
 * slower downhill. `null` when either input is unusable.
 */
export function gradeAdjustedSpeed(
  speedMps: number | null | undefined,
  gradePct: number | null | undefined
): number | null {
  if (!isNum(speedMps) || speedMps <= 0) return null;
  if (!isNum(gradePct)) return null;
  return round3(speedMps * gradeCostFactor(gradePct));
}

/**
 * A grade-adjusted speed stream. `undefined` when either input is missing; a sample is `NaN` where the
 * athlete was stopped or the grade is unusable, which every `lib/ui` chart draws as a real gap.
 */
export function gradeAdjustedStream(
  speed: readonly number[] | undefined,
  grade: readonly number[] | undefined
): number[] | undefined {
  if (!speed || !grade) return undefined;
  const n = Math.min(speed.length, grade.length);
  if (n === 0) return undefined;
  const out = new Array<number>(n);
  for (let i = 0; i < n; i++) {
    out[i] = gradeAdjustedSpeed(speed[i], grade[i]) ?? Number.NaN;
  }
  return out;
}

/**
 * Mean grade-adjusted speed over a whole session, weighted by the time each sample covers. Time-weighted
 * rather than a plain mean because a sample at a standstill would otherwise count as much as a minute of
 * running. `null` when nothing is usable.
 */
export function meanGradeAdjustedSpeed(
  speed: readonly number[] | undefined,
  grade: readonly number[] | undefined,
  elapsedS?: readonly number[]
): number | null {
  const adjusted = gradeAdjustedStream(speed, grade);
  if (!adjusted) return null;
  let weighted = 0;
  let seconds = 0;
  for (let i = 0; i < adjusted.length; i++) {
    const v = adjusted[i];
    if (v === undefined || !Number.isFinite(v)) continue;
    const dt = elapsedS ? sampleSpan(elapsedS, i) : 1;
    if (dt <= 0) continue;
    weighted += v * dt;
    seconds += dt;
  }
  return seconds > 0 ? round3(weighted / seconds) : null;
}

/** Seconds sample `i` accounts for, from the elapsed axis. Falls back to 1 s at the edges. */
function sampleSpan(elapsedS: readonly number[], i: number): number {
  const prev = elapsedS[i - 1];
  const here = elapsedS[i];
  if (here === undefined) return 0;
  if (prev === undefined) return 1;
  const dt = here - prev;
  return dt > 0 && dt < 3600 ? dt : 0;
}

/* --------------------------------------------------------------------- *
 * Speed–duration curve
 * --------------------------------------------------------------------- */

/** Durations the curve is sampled at, in seconds. Matches the power curve's spirit: sprint → long run. */
export const CURVE_DURATIONS: readonly number[] = [
  15, 30, 60, 120, 300, 600, 1200, 1800, 2700, 3600, 5400, 7200
];

export interface SpeedDurationPoint {
  readonly durationS: number;
  /** Best average speed sustained for that long, m/s. */
  readonly speedMps: number;
  /** The same as seconds per kilometre, for a pace-native view. */
  readonly paceSecPerKm: number;
}

/**
 * Best average speed sustained over each duration, using a prefix-sum sliding window — O(n) per duration
 * rather than O(n·window). A duration longer than the session is simply absent.
 *
 * `sampleSeconds` is how many seconds one sample covers (1 for a 1 Hz recording). Stopped samples are
 * INCLUDED: a window containing a rest genuinely had a lower average speed, and excluding rests would
 * turn the curve into "best speed while moving", which is a different and much less useful thing.
 */
export function speedDurationCurve(
  speed: readonly number[] | undefined,
  sampleSeconds = 1,
  durations: readonly number[] = CURVE_DURATIONS
): SpeedDurationPoint[] {
  if (!speed || speed.length === 0 || !(sampleSeconds > 0)) return [];

  // Prefix sums with non-finite samples treated as zero speed, so a window's mean stays defined.
  const prefix = new Array<number>(speed.length + 1).fill(0);
  for (let i = 0; i < speed.length; i++) {
    const v = speed[i];
    prefix[i + 1] = (prefix[i] ?? 0) + (isNum(v) && v > 0 ? v : 0);
  }

  const out: SpeedDurationPoint[] = [];
  for (const durationS of durations) {
    const window = Math.round(durationS / sampleSeconds);
    if (window < 1 || window > speed.length) continue;

    let best = 0;
    for (let i = 0; i + window <= speed.length; i++) {
      const mean = ((prefix[i + window] ?? 0) - (prefix[i] ?? 0)) / window;
      if (mean > best) best = mean;
    }
    if (best <= 0) continue;
    out.push({
      durationS,
      speedMps: round3(best),
      paceSecPerKm: Math.round(1000 / best)
    });
  }
  return out;
}

/**
 * The envelope of several curves: the best speed at each duration across all of them. This is what makes
 * a personal curve — one session shows one day's shape, the envelope over months shows the athlete.
 */
export function mergeSpeedCurves(curves: readonly SpeedDurationPoint[][]): SpeedDurationPoint[] {
  const best = new Map<number, number>();
  for (const curve of curves) {
    for (const p of curve) {
      const current = best.get(p.durationS);
      if (current === undefined || p.speedMps > current) best.set(p.durationS, p.speedMps);
    }
  }
  return [...best.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([durationS, speedMps]) => ({
      durationS,
      speedMps,
      paceSecPerKm: Math.round(1000 / speedMps)
    }));
}

export interface CriticalSpeed {
  /** The sustainable-speed asymptote, m/s. */
  readonly speedMps: number;
  readonly paceSecPerKm: number;
  /**
   * Anaerobic distance capacity, metres — how far the athlete can go ABOVE critical speed before it runs
   * out. The `D′` of the two-parameter model; large values mean a strong finishing kick.
   */
  readonly dPrimeM: number;
  /** The two durations the estimate was taken from, so a view can say what it rests on. */
  readonly fromDurationsS: readonly [number, number];
}

/** Shortest and longest durations the two-point estimate will use. */
export const CS_SHORT_S = 180;
export const CS_LONG_S = 1200;

/**
 * Critical speed from two points on the curve, via the linear distance–time model
 * `d = CS·t + D′`: two (t, d) pairs give the slope (CS) and the intercept (D′).
 *
 * `null` unless the curve has a short and a long point far enough apart to make the slope meaningful —
 * two neighbouring durations would turn any noise into a wild asymptote.
 */
export function criticalSpeed(curve: readonly SpeedDurationPoint[]): CriticalSpeed | null {
  if (curve.length < 2) return null;
  const short = nearestPoint(curve, CS_SHORT_S);
  const long = nearestPoint(curve, CS_LONG_S);
  if (!short || !long) return null;
  // The two anchors must be genuinely far apart; adjacent points make the slope noise-dominated.
  if (long.durationS <= short.durationS * 2) return null;

  const d1 = short.speedMps * short.durationS;
  const d2 = long.speedMps * long.durationS;
  const cs = (d2 - d1) / (long.durationS - short.durationS);
  if (!(cs > 0)) return null;
  const dPrime = d1 - cs * short.durationS;

  return {
    speedMps: round3(cs),
    paceSecPerKm: Math.round(1000 / cs),
    // A negative intercept means the two points do not fit the model; report zero rather than nonsense.
    dPrimeM: Math.max(0, Math.round(dPrime)),
    fromDurationsS: [short.durationS, long.durationS]
  };
}

/** Curve point nearest a target duration, or `undefined` for an empty curve. */
function nearestPoint(curve: readonly SpeedDurationPoint[], targetS: number): SpeedDurationPoint | undefined {
  let best: SpeedDurationPoint | undefined;
  let bestGap = Infinity;
  for (const p of curve) {
    const gap = Math.abs(p.durationS - targetS);
    if (gap < bestGap) {
      bestGap = gap;
      best = p;
    }
  }
  return best;
}

const isNum = (v: number | null | undefined): v is number => typeof v === 'number' && Number.isFinite(v);

function round3(v: number): number {
  return Math.round(v * 1000) / 1000;
}
