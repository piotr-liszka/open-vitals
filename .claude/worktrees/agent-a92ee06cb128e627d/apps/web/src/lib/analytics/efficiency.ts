/**
 * Aerobic efficiency (spec 038) — the three numbers that say whether an endurance session went the way
 * the athlete thinks it did, and whether their aerobic engine is actually improving. PURE: streams and
 * scalars in, numbers out. No store, no clock, no Garmin.
 *
 * Lives in `lib/analytics/` rather than `lib/server/analytics/` because BOTH halves of the app need it
 * at runtime: the handler computes the session's scalars, and `activity-charts.ts` — which is bundled
 * into the browser — derives the beats-per-kilometre stream from it. A `$lib/server` import there
 * passes test, check and lint and then fails the production build, so the boundary is the file's home,
 * not a comment.
 *
 * ## Aerobic decoupling (Pa:HR — Friel)
 *
 * Split the session in half and ask how much more expensive the SECOND half was per heartbeat. A well
 * paced aerobic effort holds its pace-per-beat: decoupling under ~5% is coupled. Above it the athlete
 * either started too hard, was underfuelled, overheated, or is not yet aerobically ready for that
 * duration. It is the single most informative endurance number neither Strava nor Garmin surfaces, and
 * it needs only the two streams every watch records.
 *
 * Two deliberate simplifications, both stated because they change how the number reads:
 *  · The split is by ELAPSED time over the whole recording, not over a hand-marked steady block.
 *    Friel's protocol excludes the warm-up; including it makes an easy start look like drift, so a
 *    warm-up-heavy session reads slightly worse than a coached test would say.
 *  · Intervals are not steady state, so decoupling is meaningless for them. The caller decides — this
 *    module reports what the maths says, and the view says what it means.
 *
 * ## Efficiency factor (EF)
 *
 * Speed per heartbeat: metres covered per minute, per bpm. Tracked across months at similar intensity,
 * a rising EF is aerobic fitness improving — independent of how hard any one session felt, which is
 * exactly what makes it more honest than comparing paces.
 *
 * ## Cardiac cost
 *
 * Heartbeats spent per kilometre. The same idea inverted and in a unit athletes find intuitive: fewer
 * beats for the same kilometre is a fitter athlete. Falls out of the summary alone, so it can be
 * trended over every session ever synced without touching a stream.
 */

/** Decoupling under this is "coupled" — a well-paced aerobic effort. Friel's usual threshold. */
export const COUPLED_LIMIT_PCT = 5;
/** Samples each half needs before a decoupling number is worth reporting. */
export const MIN_HALF_SAMPLES = 60;
/** Below this speed the athlete is standing; those samples would drag both ratios down. */
const MOVING_MPS = 0.5;
/** Below this heart rate the strap is not reading; dividing by it produces nonsense. */
const LIVE_HR_BPM = 60;

export type DecouplingBasis = 'pace' | 'power';

export interface Decoupling {
  /**
   * Percent the second half cost MORE per heartbeat than the first. Positive = drifted (pace fell or
   * HR rose); negative = the athlete got more efficient, which usually means a conservative start.
   */
  readonly pct: number;
  /** `pace` for a Pa:HR run/walk/ride, `power` when a meter was fitted (Pw:HR). */
  readonly basis: DecouplingBasis;
  /** Output/HR ratio of each half — kept so a view can show the drift rather than just score it. */
  readonly firstRatio: number;
  readonly secondRatio: number;
  /** Samples behind each half, so a caller can judge how much to trust it. */
  readonly samples: number;
  /** True when `pct` is within the coupled limit. */
  readonly coupled: boolean;
}

interface Pair {
  output: number;
  hr: number;
}

/** Samples where the athlete was moving and the strap was reading — the only ones that mean anything. */
function usablePairs(output: readonly number[], hr: readonly number[], minOutput: number): Pair[] {
  const n = Math.min(output.length, hr.length);
  const out: Pair[] = [];
  for (let i = 0; i < n; i++) {
    const o = output[i];
    const h = hr[i];
    if (o === undefined || h === undefined) continue;
    if (!Number.isFinite(o) || !Number.isFinite(h)) continue;
    if (o < minOutput || h < LIVE_HR_BPM) continue;
    out.push({ output: o, hr: h });
  }
  return out;
}

function meanRatio(pairs: readonly Pair[]): number | null {
  if (pairs.length === 0) return null;
  let output = 0;
  let hr = 0;
  for (const p of pairs) {
    output += p.output;
    hr += p.hr;
  }
  // Ratio of the MEANS, not the mean of the ratios: a single slow sample at a low HR would otherwise
  // swing the average far more than the second it actually lasted. Over equal sample counts the two
  // divisions by `n` cancel, so this is simply Σoutput / Σhr.
  return hr > 0 ? output / hr : null;
}

/**
 * Aerobic decoupling over a session. `null` when either half lacks `MIN_HALF_SAMPLES` usable samples —
 * a 10-minute jog cannot decouple, and pretending otherwise produces a scary number from noise.
 *
 * The halves are split on the USABLE samples, so a long stop mid-session does not push the boundary
 * into the second half of the effort.
 */
export function aerobicDecoupling(
  output: readonly number[] | undefined,
  hr: readonly number[] | undefined,
  basis: DecouplingBasis = 'pace'
): Decoupling | null {
  if (!output || !hr) return null;
  const pairs = usablePairs(output, hr, basis === 'power' ? 1 : MOVING_MPS);
  const half = Math.floor(pairs.length / 2);
  if (half < MIN_HALF_SAMPLES) return null;

  const firstRatio = meanRatio(pairs.slice(0, half));
  const secondRatio = meanRatio(pairs.slice(half, half * 2));
  if (firstRatio === null || secondRatio === null || firstRatio <= 0) return null;

  const pct = round1(((firstRatio - secondRatio) / firstRatio) * 100);
  return {
    pct,
    basis,
    firstRatio: round3(firstRatio),
    secondRatio: round3(secondRatio),
    samples: half,
    coupled: Math.abs(pct) <= COUPLED_LIMIT_PCT
  };
}

/**
 * Efficiency factor: metres per minute per bpm. `null` unless both inputs are usable.
 *
 * Deliberately derived from the SUMMARY rather than the streams, so the same definition can be
 * trended across every session ever synced without a stream read.
 */
export function efficiencyFactor(
  avgSpeedMps: number | null | undefined,
  avgHr: number | null | undefined
): number | null {
  if (!isNum(avgSpeedMps) || !isNum(avgHr)) return null;
  if (avgSpeedMps <= 0 || avgHr < LIVE_HR_BPM) return null;
  return round3((avgSpeedMps * 60) / avgHr);
}

/** Power-based efficiency factor: watts per bpm. The bike counterpart of the above. */
export function powerEfficiencyFactor(
  normPower: number | null | undefined,
  avgHr: number | null | undefined
): number | null {
  if (!isNum(normPower) || !isNum(avgHr)) return null;
  if (normPower <= 0 || avgHr < LIVE_HR_BPM) return null;
  return round3(normPower / avgHr);
}

/**
 * Heartbeats spent per kilometre. `null` unless distance, time and average HR are all usable.
 * Distances under 400 m are refused — the number is dominated by the first few strides there.
 */
export function cardiacCost(
  distanceM: number | null | undefined,
  durationS: number | null | undefined,
  avgHr: number | null | undefined
): number | null {
  if (!isNum(distanceM) || !isNum(durationS) || !isNum(avgHr)) return null;
  if (distanceM < 400 || durationS <= 0 || avgHr < LIVE_HR_BPM) return null;
  const beats = avgHr * (durationS / 60);
  return Math.round(beats / (distanceM / 1000));
}

/**
 * A per-sample "beats per kilometre" stream, for charting the cost of each moment rather than of the
 * whole session. `undefined` when either input is missing; individual samples are `NaN` where the
 * athlete was stopped or the strap was not reading, which every chart in `lib/ui` draws as a gap
 * rather than joining across.
 */
export function cardiacCostStream(
  speed: readonly number[] | undefined,
  hr: readonly number[] | undefined
): number[] | undefined {
  if (!speed || !hr) return undefined;
  const n = Math.min(speed.length, hr.length);
  if (n === 0) return undefined;
  const out = new Array<number>(n);
  for (let i = 0; i < n; i++) {
    const v = speed[i];
    const h = hr[i];
    out[i] =
      v === undefined ||
      h === undefined ||
      !Number.isFinite(v) ||
      !Number.isFinite(h) ||
      v < MOVING_MPS ||
      h < LIVE_HR_BPM
        ? Number.NaN
        : // beats per km = (bpm / 60) beats per second ÷ (v / 1000) km per second
          h / 60 / (v / 1000);
  }
  return out;
}

/* --------------------------------------------------------------------- *
 * Trending efficiency over months
 *
 * The point of EF and cardiac cost is not one session — it is the slope over
 * months. Both come out of the SUMMARY, so a trend over every session ever
 * synced costs one activity read and no stream reads at all.
 * --------------------------------------------------------------------- */

/** One session's contribution to the trend. */
export interface EfficiencySession {
  /** `YYYY-MM-DD`. */
  readonly day: string;
  readonly distanceM: number | null;
  /** Moving time where the watch reports it. */
  readonly durationS: number | null;
  readonly avgHr: number | null;
}

/** Mean efficiency of the sessions in one calendar month. */
export interface EfficiencyMonth {
  /** `YYYY-MM`. */
  readonly month: string;
  /** Mean efficiency factor across the month's usable sessions; `null` when it had none. */
  readonly ef: number | null;
  /** Mean beats per kilometre; `null` when the month had no usable session. */
  readonly cardiacCost: number | null;
  /** Sessions that contributed — a one-session month is a point, not a trend. */
  readonly sessions: number;
}

/**
 * Mean EF and cardiac cost per calendar month, on a caller-supplied month lattice (so it lines up with
 * whatever else that page charts). Months with no usable session are `null`, never `0` — a month off
 * is not a month of terrible efficiency.
 *
 * Sessions are averaged UNWEIGHTED. A weighted mean would let one long run define the month, and the
 * question here is "how efficient were my runs", not "how efficient was my volume".
 */
export function monthlyEfficiency(
  sessions: readonly EfficiencySession[],
  months: readonly string[]
): EfficiencyMonth[] {
  const buckets = new Map<string, { ef: number[]; cost: number[] }>(
    months.map((m) => [m, { ef: [], cost: [] }])
  );

  for (const s of sessions) {
    const bucket = buckets.get(s.day.slice(0, 7));
    if (!bucket) continue;
    const speed =
      isNum(s.distanceM) && isNum(s.durationS) && s.durationS > 0 ? s.distanceM / s.durationS : null;
    const ef = efficiencyFactor(speed, s.avgHr);
    const cost = cardiacCost(s.distanceM, s.durationS, s.avgHr);
    if (ef !== null) bucket.ef.push(ef);
    if (cost !== null) bucket.cost.push(cost);
  }

  return months.map((month) => {
    const b = buckets.get(month) ?? { ef: [], cost: [] };
    return {
      month,
      ef: b.ef.length === 0 ? null : round3(mean(b.ef)),
      cardiacCost: b.cost.length === 0 ? null : Math.round(mean(b.cost)),
      sessions: Math.max(b.ef.length, b.cost.length)
    };
  });
}

function mean(xs: readonly number[]): number {
  return xs.reduce((s, x) => s + x, 0) / xs.length;
}

const isNum = (v: number | null | undefined): v is number => typeof v === 'number' && Number.isFinite(v);

function round1(v: number): number {
  return Math.round(v * 10) / 10;
}

function round3(v: number): number {
  return Math.round(v * 1000) / 1000;
}
