/**
 * The PLANNED half of the activity verdict — matching a session to the day's plan, scoring it
 * against that plan's targets, and saying what to do differently next time (spec 026, widened by
 * spec 085).
 *
 * ## Why this is its own file, and why it is client-safe
 *
 * `activity-comparison.ts` imports `$lib/server/analytics/training-load` for the load model, and
 * SvelteKit's server guard refuses any `$lib/server` module reachable from browser code. The plan
 * side needs no load model at all — it is arithmetic over targets — and `PlannedVsActual.svelte`
 * plus the Przebieg strip render straight off these types. So the plan side lives here, where a
 * component may import it, and `activity-comparison.ts` pulls it in and re-exports it so the
 * verdict still has exactly one entry point.
 *
 * **Nothing in this file may import from `$lib/server`.**
 *
 * ## Two sources, one candidate
 *
 * A plan can come from Garmin's synced calendar (spec 024) — a title, a description and, rarely, an
 * estimated duration — or from a workout the athlete AUTHORED here (spec 050/066), which carries a
 * full step tree with durations, distances and target bands. Both are normalised into one
 * `PlannedCandidate` at the API edge, so the matcher below never learns about two shapes. Where both
 * exist for a day, the authored one wins: it is the only one that can be scored on intensity.
 */
import type { DayKey } from '$lib/date';
import { sportGroup } from '$lib/sport-labels';
import {
  estimateWorkoutDistanceM,
  estimateWorkoutDurationS,
  WORKOUT_TARGET_TYPES,
  type WorkoutDurationType,
  type WorkoutStep,
  type WorkoutStepKind,
  type WorkoutTarget,
  type WorkoutTargetType
} from '$lib/workouts';

/**
 * Why a planned workout is or is not attached:
 *  - `linked` — this session was matched to a plan on the same day;
 *  - `none-scheduled` — the calendar covers this date and had nothing planned for this sport;
 *  - `not-synced` — we hold no plan data anywhere near this date, so we cannot tell.
 */
export type PlannedWorkoutStatus = 'not-synced' | 'none-scheduled' | 'linked';

/** Which half of the plan a candidate came from. `authored` is the one that carries targets. */
export type PlannedOrigin = 'garmin' | 'authored';

/**
 * What a comparison row measures. The first three are scalars the plan set once; the last three are
 * intensity BANDS read off the step tree, compared against what the session actually held.
 */
export type PlannedStepKey = 'duration' | 'distance' | 'load' | 'pace' | 'power' | 'hr';

/** One measurable target of a planned workout against what was actually done. */
export interface PlannedStepComparison {
  readonly key: PlannedStepKey;
  /**
   * The scalar target, or — for an intensity band — its middle. Always positive, so a caller can
   * divide by it without checking.
   */
  readonly target: number;
  /**
   * Intensity rows only: the band the plan asked to be held, in the canonical unit
   * (`WORKOUT_TARGET_UNITS`). Both `null` on a scalar row. Either end may be `null` on its own —
   * "at least 250 W" is a legal target.
   */
  readonly targetLow: number | null;
  readonly targetHigh: number | null;
  readonly actual: number | null;
  /**
   * Scalar rows: within ±`PLAN_TOLERANCE` of the target. Intensity rows: inside the band,
   * inclusive — a band IS a tolerance, and applying a second one would widen it twice.
   * `null` when nothing comparable was recorded.
   */
  readonly met: boolean | null;
}

/** A planned session matched to this activity, scored against its targets. */
export interface PlannedWorkoutComparison {
  readonly workoutId: string;
  readonly name: string;
  readonly scheduledDay: DayKey;
  readonly kind: 'workout' | 'race' | 'note';
  readonly origin: PlannedOrigin;
  readonly description: string | null;
  readonly targetDurationS: number | null;
  readonly targetDistanceM: number | null;
  readonly targetLoad: number | null;
  readonly steps: readonly PlannedStepComparison[];
  /** 0–100: 100 means exactly on plan; deviation in either direction costs. */
  readonly compliancePct: number | null;
}

/** A scheduled session as the store holds it, reduced to what matching and scoring need. */
export interface PlannedCandidate {
  readonly id: string;
  readonly day: DayKey;
  readonly kind: 'workout' | 'race' | 'note';
  readonly origin: PlannedOrigin;
  readonly title: string;
  /** Garmin `typeKey`, or `null` for a plan that does not name a sport. */
  readonly sport: string | null;
  readonly description: string | null;
  readonly estimatedDurationS: number | null;
  readonly estimatedDistanceM: number | null;
  readonly targetLoad: number | null;
  /** The authored step tree; `null` for a Garmin calendar entry, which has none. */
  readonly steps: readonly WorkoutStep[] | null;
}

export interface PlannedInput {
  /** Events scheduled on the activity's own day, from BOTH sources. */
  readonly sameDay: readonly PlannedCandidate[];
  /**
   * True when we hold ANY plan near this date, from either source. Without it, "nothing scheduled"
   * and "nothing ever synced" would be indistinguishable, and we would claim the athlete had a rest
   * day planned when we simply do not know.
   */
  readonly calendarHasData: boolean;
  /** The activity's own sport key; a plan naming a different family is not a match. */
  readonly sport: string;
}

/**
 * What the activity actually achieved, for scoring against the plan. The intensity values are the
 * session's AGGREGATES — average pace, normalised power, average heart rate — deliberately, not a
 * lap-to-step alignment: one missed lap press shifts every step, and the Przebieg strip shows the
 * two side by side for the eye to do that job (spec 085).
 */
export interface ActualEffort {
  readonly durationS: number | null;
  readonly distanceM: number | null;
  readonly load: number | null;
  /** Average moving pace in seconds per kilometre — the actual behind a `pace` target. */
  readonly paceSecPerKm: number | null;
  /** Normalised power in watts — the actual behind a `power` target. */
  readonly normPower: number | null;
  /** Average heart rate in bpm — the actual behind an `hr` target. */
  readonly avgHr: number | null;
}

/* --------------------------------------------------------------------- *
 * The step tree, flattened
 * --------------------------------------------------------------------- */

/** A flattened step is never a `repeat` block: the block has been expanded into its repetitions. */
export type PlannedStepKind = Exclude<WorkoutStepKind, 'repeat'>;

/** One planned step, with its repeat block expanded and its extent resolved as far as it can be. */
export interface PlannedStructureStep {
  /** Position in the flattened sequence, 0-based — a stable key for the UI. */
  readonly index: number;
  readonly kind: PlannedStepKind;
  readonly durationType: WorkoutDurationType;
  readonly durationValue: number | null;
  /**
   * Planned seconds. `null` when unknowable: a `lap` or `calories` step has no time extent, and a
   * distance step only gets one when a pace/speed target pins its speed down.
   */
  readonly plannedS: number | null;
  /** Planned metres; `null` unless this is a distance step. */
  readonly plannedM: number | null;
  readonly target: WorkoutTarget | null;
  /** 1-based repetition this step came from; `null` for a step outside any repeat block. */
  readonly repeatIndex: number | null;
  readonly repeatTotal: number | null;
  readonly note: string | null;
}

/**
 * Expand the step tree into the sequence the athlete was actually asked to execute: a
 * `5 × (1 km + 2 min)` block becomes ten steps, each knowing which repetition it belongs to.
 *
 * Extents come from `estimateWorkoutDurationS` / `estimateWorkoutDistanceM` applied to the single
 * step, so there is exactly one definition of "how long is this step" in the codebase.
 */
export function flattenWorkoutSteps(steps: readonly WorkoutStep[]): PlannedStructureStep[] {
  const out: PlannedStructureStep[] = [];

  const push = (step: WorkoutStep, repeatIndex: number | null, repeatTotal: number | null): void => {
    // Nesting is refused by `normalizeWorkout`, so a child is never a block. Skipping one here is
    // belt-and-braces against a row written before that rule existed.
    if (step.kind === 'repeat') return;
    out.push({
      index: out.length,
      kind: step.kind,
      durationType: step.durationType ?? 'lap',
      durationValue: step.durationValue,
      plannedS: estimateWorkoutDurationS([step]),
      plannedM: estimateWorkoutDistanceM([step]),
      target: step.target,
      repeatIndex,
      repeatTotal,
      note: step.note
    });
  };

  for (const step of steps) {
    if (step.kind === 'repeat') {
      const total = Math.max(1, Math.trunc(step.repeats ?? 1));
      for (let r = 1; r <= total; r++) {
        for (const child of step.steps ?? []) push(child, r, total);
      }
      continue;
    }
    push(step, null, null);
  }

  return out;
}

/** One intensity band the plan asked for, collapsed across every work step that named that type. */
export interface IntensityBand {
  readonly type: Exclude<WorkoutTargetType, 'none'>;
  readonly low: number | null;
  readonly high: number | null;
}

const finite = (n: number | null | undefined): n is number => typeof n === 'number' && Number.isFinite(n);

/**
 * The intensity the plan asked to be HELD, read off the work steps only.
 *
 * Warm-ups, recoveries and cool-downs are deliberately excluded: a session's intensity target is
 * what its hard parts prescribe, and averaging the jog back in would make every interval workout
 * look like a steady run. Several work steps naming the same target collapse into the widest band
 * that covers all of them — one row per target type, never one per step.
 */
export function workIntensityBands(steps: readonly WorkoutStep[]): IntensityBand[] {
  const lows = new Map<WorkoutTargetType, number>();
  const highs = new Map<WorkoutTargetType, number>();
  const seen = new Set<WorkoutTargetType>();

  for (const step of flattenWorkoutSteps(steps)) {
    if (step.kind !== 'work') continue;
    const target = step.target;
    if (!target || target.type === 'none') continue;
    if (!finite(target.low) && !finite(target.high)) continue;
    seen.add(target.type);
    if (finite(target.low)) {
      const current = lows.get(target.type);
      lows.set(target.type, current === undefined ? target.low : Math.min(current, target.low));
    }
    if (finite(target.high)) {
      const current = highs.get(target.type);
      highs.set(target.type, current === undefined ? target.high : Math.max(current, target.high));
    }
  }

  // Emitted in the canonical target order rather than in encounter order, so two plans with the
  // same targets in a different sequence produce the same rows.
  const out: IntensityBand[] = [];
  for (const type of WORKOUT_TARGET_TYPES) {
    if (type === 'none' || !seen.has(type)) continue;
    out.push({ type, low: lows.get(type) ?? null, high: highs.get(type) ?? null });
  }
  return out;
}

/* --------------------------------------------------------------------- *
 * The strip drawn above the stream charts (Przebieg)
 * --------------------------------------------------------------------- */

/** A planned step with a real time extent, placed on the elapsed-time axis. */
export interface PlanStripBlock {
  readonly index: number;
  readonly kind: PlannedStepKind;
  readonly startS: number;
  readonly endS: number;
  readonly target: WorkoutTarget | null;
  readonly repeatIndex: number | null;
  readonly repeatTotal: number | null;
}

/** A planned step with NO time extent — it ends on a lap press or a calorie count. */
export interface PlanStripMarker {
  readonly index: number;
  readonly kind: PlannedStepKind;
  readonly atS: number;
  readonly durationType: WorkoutDurationType;
  readonly target: WorkoutTarget | null;
}

export interface PlanStrip {
  readonly blocks: readonly PlanStripBlock[];
  readonly markers: readonly PlanStripMarker[];
  /** Planned seconds the whole sequence adds up to. */
  readonly totalS: number;
}

/**
 * Lay the flattened plan out on an elapsed-time axis.
 *
 * A step that ends on `lap` or `calories` has no duration anyone can know before the session
 * happened, so it becomes a MARKER at the cursor rather than a block of invented width — drawing it
 * as a block would put a made-up number on the same axis as measured data.
 *
 * `null` when no step has a knowable extent: a strip of nothing but markers has no axis to sit on.
 */
export function buildPlanStrip(steps: readonly PlannedStructureStep[]): PlanStrip | null {
  const blocks: PlanStripBlock[] = [];
  const markers: PlanStripMarker[] = [];
  let cursor = 0;

  for (const step of steps) {
    if (finite(step.plannedS) && step.plannedS > 0) {
      blocks.push({
        index: step.index,
        kind: step.kind,
        startS: cursor,
        endS: cursor + step.plannedS,
        target: step.target,
        repeatIndex: step.repeatIndex,
        repeatTotal: step.repeatTotal
      });
      cursor += step.plannedS;
      continue;
    }
    markers.push({
      index: step.index,
      kind: step.kind,
      atS: cursor,
      durationType: step.durationType,
      target: step.target
    });
  }

  if (blocks.length === 0) return null;
  return { blocks, markers, totalS: cursor };
}

/* --------------------------------------------------------------------- *
 * Matching
 * --------------------------------------------------------------------- */

/** Within a tenth of the target counts as executed as planned. Scalar targets only. */
export const PLAN_TOLERANCE = 0.1;

const ORIGIN_RANK: Readonly<Record<PlannedOrigin, number>> = { authored: 0, garmin: 1 };
const KIND_RANK: Readonly<Record<PlannedCandidate['kind'], number>> = { workout: 0, race: 1, note: 2 };

/**
 * Pick the plan this session executed: same day, same sport family (a plan that names no sport
 * matches anything), the athlete's OWN authored session before Garmin's calendar entry, then
 * workouts before races before notes, and the most specific target wins the remaining ties. A plan
 * for a different sport on the same day is NOT a match — a Tuesday swim does not fulfil a Tuesday
 * interval run.
 *
 * Authored first because only an authored workout carries a step tree, and therefore the only
 * targets that can be scored on intensity. A Garmin entry that duplicates it would answer the same
 * question with less information.
 */
export function matchPlanned(
  candidates: readonly PlannedCandidate[],
  sport: string
): PlannedCandidate | null {
  const family = sportGroup(sport);
  const targets = (c: PlannedCandidate): number =>
    [c.estimatedDurationS, c.estimatedDistanceM, c.targetLoad].filter(finite).length;

  const matches = candidates.filter((c) => c.sport === null || sportGroup(c.sport) === family);
  if (matches.length === 0) return null;
  return [...matches].sort(
    (a, b) =>
      ORIGIN_RANK[a.origin] - ORIGIN_RANK[b.origin] ||
      KIND_RANK[a.kind] - KIND_RANK[b.kind] ||
      targets(b) - targets(a) ||
      a.id.localeCompare(b.id)
  )[0]!;
}

/* --------------------------------------------------------------------- *
 * Scoring
 * --------------------------------------------------------------------- */

/** True when `value` sits inside the band, inclusive. An open end never excludes anything. */
export function insideBand(value: number, low: number | null, high: number | null): boolean {
  if (finite(low) && value < low) return false;
  if (finite(high) && value > high) return false;
  return true;
}

/** The band edge a value breached, or `null` when it breached none. */
function breachedEdge(value: number, low: number | null, high: number | null): number | null {
  if (finite(low) && value < low) return low;
  if (finite(high) && value > high) return high;
  return null;
}

const isBand = (step: PlannedStepComparison): boolean => step.targetLow !== null || step.targetHigh !== null;

/**
 * How far off plan a row landed, as a signed fraction: positive above the target, negative below,
 * exactly 0 anywhere inside a band. `null` when nothing comparable was recorded.
 *
 * Note the sign convention is NUMERIC, not qualitative: a pace is seconds per kilometre, so a
 * negative deviation on a pace row means the athlete ran FASTER than asked. Callers that phrase
 * this for a human have to invert it — see `planTakeaways`.
 */
export function planStepDeviation(step: PlannedStepComparison): number | null {
  if (step.actual === null) return null;
  if (isBand(step)) {
    const edge = breachedEdge(step.actual, step.targetLow, step.targetHigh);
    if (edge === null) return 0;
    if (edge === 0) return null;
    return (step.actual - edge) / edge;
  }
  if (!(step.target > 0)) return null;
  return step.actual / step.target - 1;
}

/** 0–1 adherence for one row; `null` when the row cannot be scored at all. */
export function planStepScore(step: PlannedStepComparison): number | null {
  const deviation = planStepDeviation(step);
  if (deviation === null) return null;
  return Math.max(0, 1 - Math.abs(deviation));
}

/**
 * Adherence: 100 means exactly on plan, and deviation in EITHER direction costs — going twice as
 * long as prescribed is as much a departure from the plan as doing half of it. Averaged over the
 * targets the plan actually set, intensity bands included; `null` when it set none we can measure.
 */
export function complianceOf(steps: readonly PlannedStepComparison[]): number | null {
  const scored = steps.map(planStepScore).filter((s): s is number => s !== null);
  if (scored.length === 0) return null;
  return Math.round((scored.reduce((sum, s) => sum + s, 0) / scored.length) * 100);
}

function scalarStep(key: PlannedStepKey, target: number, actual: number | null): PlannedStepComparison {
  return {
    key,
    target,
    targetLow: null,
    targetHigh: null,
    actual,
    met: actual === null ? null : Math.abs(actual / target - 1) <= PLAN_TOLERANCE
  };
}

function bandStep(
  key: PlannedStepKey,
  low: number | null,
  high: number | null,
  actual: number | null
): PlannedStepComparison {
  const ends = [low, high].filter(finite);
  const middle = ends.length === 0 ? 0 : ends.reduce((a, b) => a + b, 0) / ends.length;
  return {
    key,
    target: middle,
    targetLow: low,
    targetHigh: high,
    actual,
    met: actual === null ? null : insideBand(actual, low, high)
  };
}

/** Which intensity band types have an actual on this page. `speed` and `cadence` have none. */
const INTENSITY_KEYS: Readonly<Partial<Record<WorkoutTargetType, PlannedStepKey>>> = {
  pace: 'pace',
  power: 'power',
  hr: 'hr'
};

/** Score a matched plan against what was actually done. */
export function buildPlannedComparison(
  plan: PlannedCandidate,
  actual: ActualEffort
): PlannedWorkoutComparison {
  const steps: PlannedStepComparison[] = [];
  if (finite(plan.estimatedDurationS) && plan.estimatedDurationS > 0) {
    steps.push(scalarStep('duration', plan.estimatedDurationS, actual.durationS));
  }
  if (finite(plan.estimatedDistanceM) && plan.estimatedDistanceM > 0) {
    steps.push(scalarStep('distance', plan.estimatedDistanceM, actual.distanceM));
  }
  if (finite(plan.targetLoad) && plan.targetLoad > 0) {
    steps.push(scalarStep('load', plan.targetLoad, actual.load));
  }

  for (const band of plan.steps ? workIntensityBands(plan.steps) : []) {
    const key = INTENSITY_KEYS[band.type];
    if (key === undefined) continue;
    const value = key === 'pace' ? actual.paceSecPerKm : key === 'power' ? actual.normPower : actual.avgHr;
    steps.push(bandStep(key, band.low, band.high, value));
  }

  return {
    workoutId: plan.id,
    name: plan.title,
    scheduledDay: plan.day,
    kind: plan.kind,
    origin: plan.origin,
    description: plan.description,
    targetDurationS: finite(plan.estimatedDurationS) ? plan.estimatedDurationS : null,
    targetDistanceM: finite(plan.estimatedDistanceM) ? plan.estimatedDistanceM : null,
    targetLoad: finite(plan.targetLoad) ? plan.targetLoad : null,
    steps,
    compliancePct: complianceOf(steps)
  };
}

/* --------------------------------------------------------------------- *
 * "What to do differently next time"
 * --------------------------------------------------------------------- */

/** At most three sentences: past that, guidance turns into a list nobody reads. */
export const MAX_PLAN_TAKEAWAYS = 3;

export type PlanTakeawayKey =
  'plan.takeaway.over' | 'plan.takeaway.under' | 'plan.takeaway.harder' | 'plan.takeaway.easier';

/**
 * One piece of guidance, as a message key plus its numbers — NOT a finished sentence.
 *
 * A pure function that returned Polish prose would be untranslatable and would put copy in a module
 * the catalog cannot see. The component renders `t(key, { metric, pct })`, so the wording lives in
 * `pl.ts`/`en.ts` with every other string and this stays a deterministic, testable calculation.
 */
export interface PlanTakeaway {
  readonly key: PlanTakeawayKey;
  readonly metric: PlannedStepKey;
  /** How far off, in whole percent. Always positive; `key` carries the direction. */
  readonly pct: number;
}

/** Below this the miss is not worth a sentence — it rounds to "0% off plan". */
const MIN_TAKEAWAY_PCT = 1;

function takeawayKey(step: PlannedStepComparison, deviation: number): PlanTakeawayKey {
  if (!isBand(step)) return deviation > 0 ? 'plan.takeaway.over' : 'plan.takeaway.under';
  // Seconds per kilometre: BELOW the band is faster, and therefore harder, than asked.
  const harder = step.key === 'pace' ? deviation < 0 : deviation > 0;
  return harder ? 'plan.takeaway.harder' : 'plan.takeaway.easier';
}

/**
 * 0–3 pieces of guidance for next time, worst miss first. Empty when the plan was met, or when
 * nothing about it was measurable — inventing advice out of an unmeasurable plan is worse than
 * saying nothing.
 */
export function planTakeaways(plan: PlannedWorkoutComparison | null): PlanTakeaway[] {
  if (plan === null) return [];

  const missed = plan.steps
    .filter((step) => step.met === false)
    .map((step) => ({ step, deviation: planStepDeviation(step) }))
    .filter((entry): entry is { step: PlannedStepComparison; deviation: number } => {
      const { deviation } = entry;
      return deviation !== null && Math.round(Math.abs(deviation) * 100) >= MIN_TAKEAWAY_PCT;
    });

  // Worst miss first; the key breaks ties so the order never depends on the input's order.
  missed.sort(
    (a, b) => Math.abs(b.deviation) - Math.abs(a.deviation) || a.step.key.localeCompare(b.step.key)
  );

  return missed.slice(0, MAX_PLAN_TAKEAWAYS).map(({ step, deviation }) => ({
    key: takeawayKey(step, deviation),
    metric: step.key,
    pct: Math.round(Math.abs(deviation) * 100)
  }));
}
