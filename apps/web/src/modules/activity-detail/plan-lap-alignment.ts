/**
 * Which lap was which planned step (spec 091).
 *
 * Spec 085 scored a plan on SESSION AGGREGATES, and said in its own closeout what that costs: for
 * `5 × 1 km hard + 400 m jog` the average pace sits between the work band and the recovery band, so
 * a perfectly executed session reads as off-plan. The fix is to score each step against the laps the
 * athlete actually ran for it — which first requires knowing which laps those were.
 *
 * ## Reported, not assumed
 *
 * The reason spec 085 left this out is real: a greedy walk down the laps shifts EVERY subsequent
 * pairing the moment one lap press is missed, and a confident wrong mapping is worse than no mapping
 * at all. So this file does two things differently:
 *
 *  1. It solves the whole segmentation at once (a small dynamic program) rather than walking
 *     greedily, so a merged lap is paid for once, locally, instead of cascading.
 *  2. Every pairing carries a `confidence`, and the result carries a status. When too few steps land
 *     confidently the whole alignment is reported as `unreconciled` and NOTHING is paired — the
 *     caller falls back to spec 085's aggregate scoring and says so on screen.
 *
 * ## The model
 *
 * Laps are consumed in order and each lap belongs to exactly one step: `steps[k]` covers a
 * contiguous run of laps, possibly EMPTY. That single rule covers both awkward cases the spec names:
 * one planned step spanning several laps is a long run, and several steps inside one lap is one step
 * claiming the lap while its neighbours report `none`. A step reporting `none` is the honest answer
 * — we know it happened somewhere inside a neighbour's lap, and splitting that lap between them
 * would invent measurements this file has no right to invent.
 *
 * ## Tolerance is generous in one direction only
 *
 * Overshooting a 1 km rep by 40 m is the same rep; a 400 m lap is not a 1 km rep. So the cost of
 * running long is scaled by {@link ALIGN_OVERSHOOT_TOLERANCE} and the cost of falling short by the
 * much tighter {@link ALIGN_UNDERSHOOT_TOLERANCE}.
 *
 * Pure and client-safe: laps in, steps in, pairing out. No store, no clock, no `$lib/server`. The
 * lap shape is declared structurally here rather than imported, so `ActivityLap` satisfies it
 * without this module depending on the server-side store types.
 */
import type { WorkoutDurationType } from '$lib/workouts';

/** How much we trust one step-to-laps pairing. */
export type AlignmentConfidence = 'exact' | 'approximate' | 'none';

/**
 * One executed lap, reduced to what alignment and per-step scoring need. `ActivityLap` satisfies
 * this structurally.
 */
export interface LapEffort {
  /** 1-based lap number as the device recorded it. */
  readonly index: number;
  readonly distanceM?: number | undefined;
  /** Timer duration — the seconds a plan's "2 min" means. */
  readonly durationS?: number | undefined;
  readonly movingDurationS?: number | undefined;
  /** Wall-clock duration, which is what the charts' elapsed axis counts. */
  readonly elapsedDurationS?: number | undefined;
  readonly avgHr?: number | undefined;
  readonly avgPower?: number | undefined;
  readonly normPower?: number | undefined;
}

/** One planned step, reduced to what alignment needs. `PlannedStructureStep` satisfies this. */
export interface AlignableStep {
  readonly index: number;
  readonly durationType: WorkoutDurationType;
  readonly durationValue: number | null;
  readonly plannedS: number | null;
  readonly plannedM: number | null;
}

/** Which laps a planned step was executed as, and how sure we are. */
export interface PlanStepAlignment {
  /** Device lap numbers (`ActivityLap.index`), in order. Empty when the step could not be placed. */
  readonly lapIndices: readonly number[];
  readonly confidence: AlignmentConfidence;
  /** Executed extent on the elapsed-time axis, from the laps' own clock. `null` with no laps. */
  readonly startS: number | null;
  readonly endS: number | null;
  readonly distanceM: number | null;
  readonly durationS: number | null;
  /** What was actually held over these laps — the per-step answer to a plan's target band. */
  readonly paceSecPerKm: number | null;
  readonly avgHr: number | null;
  /** Normalised power where the laps carry it, else average power. */
  readonly power: number | null;
}

/**
 *  - `aligned` — the laps reconcile with the plan and every pairing below may be used;
 *  - `unreconciled` — they do not, so nothing is paired and the caller must fall back;
 *  - `no-laps` — the activity has no laps at all, which is a different statement from a bad match.
 */
export type PlanAlignmentStatus = 'aligned' | 'unreconciled' | 'no-laps';

export interface PlanAlignment {
  readonly status: PlanAlignmentStatus;
  /** Index-for-index with the steps passed in. All `none` unless `status === 'aligned'`. */
  readonly steps: readonly PlanStepAlignment[];
  /** How many steps landed on their own laps within tolerance. */
  readonly confidentSteps: number;
  readonly lapCount: number;
}

/** Running 25% past a rep is still that rep. */
export const ALIGN_OVERSHOOT_TOLERANCE = 0.25;
/** Falling 10% short of it is already a different lap. */
export const ALIGN_UNDERSHOOT_TOLERANCE = 0.1;
/** Below this share of confidently placed steps the mapping is not worth trusting. */
export const MIN_CONFIDENT_SHARE = 0.6;

/**
 * Leaving a step unplaced costs more than stretching one to its tolerance edge, and far less than
 * pairing it with a lap that plainly is not it. That ordering is what makes a missed lap press cost
 * exactly one step instead of shifting the rest.
 */
const MISS_COST = 1.5;
/** A step whose laps do not carry its axis at all: placeable by position, never confidently. */
const UNKNOWN_COST = 1;

/**
 * Ceiling on the dynamic program's inner work (`steps × laps²`). A plan and a lap list large enough
 * to exceed it are not a session anyone lap-pressed deliberately, and spending the athlete's page
 * load on it would buy nothing.
 */
export const MAX_ALIGNMENT_WORK = 2_000_000;

const finite = (n: number | null | undefined): n is number => typeof n === 'number' && Number.isFinite(n);

/** Which axis a step is measured on, and how much of it the plan asked for. */
interface StepDemand {
  readonly axis: 'distance' | 'time' | 'boundary';
  /** Metres or seconds; 0 on `boundary`, which has no extent anyone could know in advance. */
  readonly value: number;
  /**
   * `boundary` only: the step ends on the LAP BUTTON, so one lap is not a guess but the step's own
   * definition. A `calories` step, or a malformed one, ends on nothing we can see — position is then
   * the only evidence, and position alone is never `exact`.
   */
  readonly lapPress: boolean;
}

/**
 * A step's own axis, read off `durationType` — never off the derived estimates.
 *
 * A distance step is matched on metres and a time step on seconds because that is what the plan
 * SAID; `plannedS` on a distance step is an inference from its pace target, and matching against an
 * inference would make the pairing depend on how good the athlete's pace target was.
 *
 * `lap` and `calories` steps have no knowable extent, so they align on the boundary itself — which,
 * for a `lap` step, is exactly what it means.
 */
function demandOf(step: AlignableStep): StepDemand {
  const boundary: StepDemand = { axis: 'boundary', value: 0, lapPress: step.durationType === 'lap' };
  if (step.durationType === 'distance') {
    const metres = finite(step.durationValue) ? step.durationValue : step.plannedM;
    if (finite(metres) && metres > 0) return { axis: 'distance', value: metres, lapPress: false };
    return boundary;
  }
  if (step.durationType === 'time') {
    const seconds = finite(step.durationValue) ? step.durationValue : step.plannedS;
    if (finite(seconds) && seconds > 0) return { axis: 'time', value: seconds, lapPress: false };
    return boundary;
  }
  return boundary;
}

const lapDistanceM = (lap: LapEffort): number | null => (finite(lap.distanceM) ? lap.distanceM : null);

/** Timer seconds first: a plan's "2 min" is running time, not time spent standing at the lights. */
function lapDurationS(lap: LapEffort): number | null {
  if (finite(lap.durationS)) return lap.durationS;
  if (finite(lap.movingDurationS)) return lap.movingDurationS;
  if (finite(lap.elapsedDurationS)) return lap.elapsedDurationS;
  return null;
}

/** Wall-clock seconds, for placing the executed extent on the same axis the charts are drawn on. */
function lapElapsedS(lap: LapEffort): number | null {
  if (finite(lap.elapsedDurationS)) return lap.elapsedDurationS;
  return lapDurationS(lap);
}

const lapPowerW = (lap: LapEffort): number | null =>
  finite(lap.normPower) ? lap.normPower : finite(lap.avgPower) ? lap.avgPower : null;

/** Prefix sums plus a count of how many laps actually carried the value, so gaps stay visible. */
interface Prefix {
  readonly sum: readonly number[];
  readonly known: readonly number[];
}

function prefixOf(laps: readonly LapEffort[], read: (lap: LapEffort) => number | null): Prefix {
  const sum: number[] = [0];
  const known: number[] = [0];
  for (let i = 0; i < laps.length; i++) {
    const value = read(laps[i]!);
    sum.push((sum[i] ?? 0) + (value ?? 0));
    known.push((known[i] ?? 0) + (value === null ? 0 : 1));
  }
  return { sum, known };
}

/** Total over laps `[from, to)`, or `null` when any lap in the run is missing the value. */
function totalOver(prefix: Prefix, from: number, to: number): number | null {
  if (to <= from) return null;
  const known = (prefix.known[to] ?? 0) - (prefix.known[from] ?? 0);
  if (known < to - from) return null;
  return (prefix.sum[to] ?? 0) - (prefix.sum[from] ?? 0);
}

/**
 * How badly a run of laps fits one step. 0 is a perfect fit; anything at or below 1 is inside the
 * (asymmetric) tolerance and counts as confident.
 */
function segmentCost(demand: StepDemand, lapCount: number, measured: number | null): number {
  if (lapCount === 0) return MISS_COST;
  if (demand.axis === 'boundary') {
    // A `lap` step ends on one lap press. More than one is possible but is not what it asked for.
    return lapCount === 1 ? 0 : (lapCount - 1) * UNKNOWN_COST;
  }
  if (measured === null) return UNKNOWN_COST * lapCount;
  const delta = measured - demand.value;
  if (delta >= 0) return delta / demand.value / ALIGN_OVERSHOOT_TOLERANCE;
  return -delta / demand.value / ALIGN_UNDERSHOOT_TOLERANCE;
}

function confidenceOf(
  demand: StepDemand,
  lapCount: number,
  measured: number | null,
  cost: number
): AlignmentConfidence {
  if (lapCount === 0) return 'none';
  if (demand.axis === 'boundary') return demand.lapPress && lapCount === 1 ? 'exact' : 'approximate';
  if (measured === null) return 'approximate';
  return cost <= 1 ? 'exact' : 'approximate';
}

const unpaired = (): PlanStepAlignment => ({
  lapIndices: [],
  confidence: 'none',
  startS: null,
  endS: null,
  distanceM: null,
  durationS: null,
  paceSecPerKm: null,
  avgHr: null,
  power: null
});

function unaligned(
  steps: readonly AlignableStep[],
  lapCount: number,
  status: PlanAlignmentStatus
): PlanAlignment {
  return { status, steps: steps.map(unpaired), confidentSteps: 0, lapCount };
}

/** Duration-weighted mean over the laps that carry `read`; `null` when none of them do. */
function weightedMean(
  laps: readonly LapEffort[],
  from: number,
  to: number,
  read: (lap: LapEffort) => number | null
): number | null {
  let weighted = 0;
  let weight = 0;
  for (let i = from; i < to; i++) {
    const lap = laps[i]!;
    const value = read(lap);
    if (value === null) continue;
    // A lap with no clock still counts, as one sample: dropping it would be a bigger lie than
    // weighting it evenly with the rest.
    const w = lapDurationS(lap) ?? 1;
    weighted += value * w;
    weight += w;
  }
  return weight > 0 ? weighted / weight : null;
}

/**
 * Map planned steps onto executed laps.
 *
 * Both inputs are taken in ORDER and stay in order — the result is index-for-index with `steps`.
 * When the laps cannot be reconciled with the plan the result pairs nothing and says
 * `status: 'unreconciled'`; the caller must then fall back to session aggregates rather than
 * pretending to a mapping.
 */
export function alignPlanToLaps(steps: readonly AlignableStep[], laps: readonly LapEffort[]): PlanAlignment {
  const stepCount = steps.length;
  const lapCount = laps.length;
  if (stepCount === 0) return { status: 'unreconciled', steps: [], confidentSteps: 0, lapCount };
  if (lapCount === 0) return unaligned(steps, 0, 'no-laps');
  if (stepCount * (lapCount + 1) * (lapCount + 1) > MAX_ALIGNMENT_WORK) {
    return unaligned(steps, lapCount, 'unreconciled');
  }

  const demands = steps.map(demandOf);
  const distance = prefixOf(laps, lapDistanceM);
  const duration = prefixOf(laps, lapDurationS);

  const measuredFor = (demand: StepDemand, from: number, to: number): number | null =>
    demand.axis === 'distance'
      ? totalOver(distance, from, to)
      : demand.axis === 'time'
        ? totalOver(duration, from, to)
        : null;

  /*
   * best[k][j] = cheapest way to execute the first k steps as the first j laps. Every lap must end
   * up inside some step's run — an activity's laps all happened — so the answer is best[N][L].
   */
  const width = lapCount + 1;
  const best = new Float64Array((stepCount + 1) * width).fill(Number.POSITIVE_INFINITY);
  const cameFrom = new Int32Array((stepCount + 1) * width).fill(-1);
  best[0] = 0;

  for (let k = 1; k <= stepCount; k++) {
    const demand = demands[k - 1]!;
    for (let j = 0; j <= lapCount; j++) {
      let bestCost = Number.POSITIVE_INFINITY;
      let bestFrom = -1;
      for (let i = 0; i <= j; i++) {
        const prior = best[(k - 1) * width + i] ?? Number.POSITIVE_INFINITY;
        if (!Number.isFinite(prior)) continue;
        const cost = prior + segmentCost(demand, j - i, measuredFor(demand, i, j));
        // `<=` keeps the LARGEST start, so on a tie the earlier step keeps the disputed lap —
        // which is the chronological reading of a merged lap press.
        if (cost <= bestCost) {
          bestCost = cost;
          bestFrom = i;
        }
      }
      best[k * width + j] = bestCost;
      cameFrom[k * width + j] = bestFrom;
    }
  }

  if (!Number.isFinite(best[stepCount * width + lapCount] ?? Number.POSITIVE_INFINITY)) {
    return unaligned(steps, lapCount, 'unreconciled');
  }

  // Walk the choices back into one [from, to) run per step.
  const bounds: { from: number; to: number }[] = new Array(stepCount);
  let cut = lapCount;
  for (let k = stepCount; k >= 1; k--) {
    const from = cameFrom[k * width + cut] ?? cut;
    bounds[k - 1] = { from, to: cut };
    cut = from;
  }

  const elapsed = prefixOf(laps, lapElapsedS);
  const out: PlanStepAlignment[] = [];
  let confidentSteps = 0;

  for (let k = 0; k < stepCount; k++) {
    const { from, to } = bounds[k]!;
    const demand = demands[k]!;
    const count = to - from;
    if (count === 0) {
      out.push(unpaired());
      continue;
    }
    const measured = measuredFor(demand, from, to);
    const confidence = confidenceOf(demand, count, measured, segmentCost(demand, count, measured));
    if (confidence === 'exact') confidentSteps++;

    const distanceM = totalOver(distance, from, to);
    const durationS = totalOver(duration, from, to);
    out.push({
      lapIndices: laps.slice(from, to).map((lap) => lap.index),
      confidence,
      startS: Math.round(elapsed.sum[from] ?? 0),
      endS: Math.round(elapsed.sum[to] ?? 0),
      distanceM,
      durationS,
      paceSecPerKm:
        distanceM !== null && distanceM > 0 && durationS !== null && durationS > 0
          ? Math.round((durationS / distanceM) * 1000)
          : null,
      avgHr: roundOrNull(weightedMean(laps, from, to, (lap) => (finite(lap.avgHr) ? lap.avgHr : null))),
      power: roundOrNull(weightedMean(laps, from, to, lapPowerW))
    });
  }

  const status: PlanAlignmentStatus =
    confidentSteps >= 1 && confidentSteps / stepCount >= MIN_CONFIDENT_SHARE ? 'aligned' : 'unreconciled';

  if (status !== 'aligned') return unaligned(steps, lapCount, 'unreconciled');
  return { status, steps: out, confidentSteps, lapCount };
}

function roundOrNull(value: number | null): number | null {
  return value === null ? null : Math.round(value);
}
