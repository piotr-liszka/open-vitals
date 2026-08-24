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
 *
 * ## Per step, where the laps allow it (spec 091)
 *
 * Intensity was first scored on the session's averages, which on an interval session sit between the
 * work band and the jog — so a perfect `5 × 1 km` read as off-plan. Since spec 091 the laps are
 * aligned to the step sequence in `./plan-lap-alignment` and each band is judged rep by rep. That
 * alignment is REPORTED: where the laps cannot be reconciled with the plan nothing is paired, the
 * comparison falls back to the aggregates unchanged, and `intensitySource` says which of the two
 * produced the number. `compliancePct` means exactly what spec 085 defined; only its inputs sharpened.
 */
import type { DayKey } from '$lib/date';
import { sportGroup } from '$lib/sport-labels';
import {
  alignPlanToLaps,
  type AlignmentConfidence,
  type LapEffort,
  type PlanAlignmentStatus,
  type PlanStepAlignment
} from './plan-lap-alignment';
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

/**
 * One planned step's OWN verdict, from the laps that step was executed as (spec 091).
 *
 * This is what a `5 × 1 km` session needs: the reps are judged one by one against the band each of
 * them asked for, instead of against a session average that sits between the work and the jog.
 */
export interface PlannedStepActual {
  /** Position in the flattened plan (`PlannedStructureStep.index`). */
  readonly stepIndex: number;
  /** 1-based repetition, when the step came out of a repeat block. */
  readonly repeatIndex: number | null;
  readonly repeatTotal: number | null;
  /** THIS step's own band — not the widened union the parent row carries. */
  readonly targetLow: number | null;
  readonly targetHigh: number | null;
  /** What was held over this step's laps; `null` when they did not record the metric. */
  readonly actual: number | null;
  readonly met: boolean | null;
  readonly confidence: AlignmentConfidence;
}

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
   *
   * With a per-step breakdown (below) this is "every step that could be judged was inside ITS OWN
   * band", so `met` and the row's score can never disagree — one sloppy rep costs both.
   */
  readonly met: boolean | null;
  /**
   * Intensity rows whose laps aligned to the plan's steps (spec 091): one entry per work step that
   * asked for this metric. `null` when the laps could not be reconciled with the plan, or on a
   * scalar row — and `null`, not `[]`, because "no breakdown" and "a breakdown of nothing" are
   * different statements. When present it is what `planStepScore` scores.
   */
  readonly perStep: readonly PlannedStepActual[] | null;
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
  /**
   * Which of the two comparisons produced the intensity rows above (spec 091) — the laps aligned to
   * each planned step, or the session's own averages. The card SAYS this, because an interval
   * session scored on its average is a different claim from one scored rep by rep, and the athlete
   * has to know which they are reading.
   */
  readonly intensitySource: PlanIntensitySource;
}

/** How a plan's intensity rows were measured. */
export type PlanIntensitySource = 'per-step' | 'session-average';

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
  /**
   * The id Garmin gave this session when it was pushed to the athlete's calendar (spec 081). When
   * it equals the ACTIVITY's `workoutId`, the watch itself says this is the plan that was executed
   * and no tie-break below gets a vote.
   */
  readonly garminWorkoutId: string | null;
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
  /**
   * The activity's own `workoutId` (spec 081) — the scheduled workout it was started from, or null
   * for a session the athlete just pressed start on. Null is the normal case, which is why it only
   * ever short-circuits the ranking and never gates it.
   */
  readonly garminWorkoutId: string | null;
}

/**
 * What the activity actually achieved, for scoring against the plan.
 *
 * The intensity values here are the session's AGGREGATES — average pace, normalised power, average
 * heart rate. Spec 085 had nothing else, and said what that costs: on a `5 × 1 km` session the
 * average sits between the work band and the jog, so a perfect execution reads as off-plan. Since
 * spec 091 the laps come along too, and where they reconcile with the plan the aggregates are
 * SUPERSEDED by per-step measurements. They remain the fallback, and the only input when the laps
 * cannot be reconciled — which is reported rather than hidden.
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
  /**
   * The device laps, in order, for per-step alignment (spec 091). Absent or empty simply means the
   * comparison stays on the session aggregates above.
   */
  readonly laps?: readonly LapEffort[] | undefined;
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
  /**
   * Planned metres. `null` when unknowable: a distance step states its own, and a time step only
   * gets one when a pace/speed target pins its speed down — the mirror of `plannedS`.
   */
  readonly plannedM: number | null;
  readonly target: WorkoutTarget | null;
  /** 1-based repetition this step came from; `null` for a step outside any repeat block. */
  readonly repeatIndex: number | null;
  readonly repeatTotal: number | null;
  readonly note: string | null;
  /**
   * Which laps this step was actually executed as, and how sure we are (spec 091). `null` straight
   * out of {@link flattenWorkoutSteps} and after an alignment that could not be reconciled — the
   * plan alone says nothing about laps. Filled by {@link alignPlannedStructure}.
   */
  readonly alignment: PlanStepAlignment | null;
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
      note: step.note,
      alignment: null
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

/** A flattened plan with each step's laps attached, plus whether the attachment may be trusted. */
export interface AlignedPlan {
  readonly steps: readonly PlannedStructureStep[];
  readonly status: PlanAlignmentStatus;
}

/**
 * Attach the executed laps to the plan's steps (spec 091).
 *
 * On anything other than `status: 'aligned'` every step comes back with `alignment: null`: a
 * mapping we do not trust must not be shown, scored, or drawn. The status is what the caller reports
 * instead — an honest "this is the session average" beats a confident wrong pairing.
 */
export function alignPlannedStructure(
  steps: readonly PlannedStructureStep[],
  laps: readonly LapEffort[]
): AlignedPlan {
  const result = alignPlanToLaps(steps, laps);
  if (result.status !== 'aligned') {
    return {
      steps: steps.map((step) => (step.alignment === null ? step : { ...step, alignment: null })),
      status: result.status
    };
  }
  return {
    steps: steps.map((step, i) => ({ ...step, alignment: result.steps[i] ?? null })),
    status: result.status
  };
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

/** A planned block as it was ACTUALLY executed, placed on the recorded elapsed-time axis. */
export interface ExecutedStripBlock {
  readonly index: number;
  readonly kind: PlannedStepKind;
  readonly startS: number;
  readonly endS: number;
  readonly confidence: AlignmentConfidence;
  readonly repeatIndex: number | null;
  readonly repeatTotal: number | null;
}

/**
 * Where each planned block really happened (spec 091), for a second strip under the planned one.
 *
 * This is the requirement that the aligner be CHECKABLE rather than trusted: two rows on one axis
 * let the eye see a rep that started late or ran long. Steps the aligner could not place are simply
 * absent — a gap in the lower row is the honest picture of a lap press that never happened.
 *
 * Empty when nothing aligned, which the caller draws as no second row at all.
 */
export function buildExecutedStrip(steps: readonly PlannedStructureStep[]): ExecutedStripBlock[] {
  const out: ExecutedStripBlock[] = [];
  for (const step of steps) {
    const alignment = step.alignment;
    if (!alignment || alignment.confidence === 'none') continue;
    if (!finite(alignment.startS) || !finite(alignment.endS)) continue;
    if (alignment.endS <= alignment.startS) continue;
    out.push({
      index: step.index,
      kind: step.kind,
      startS: alignment.startS,
      endS: alignment.endS,
      confidence: alignment.confidence,
      repeatIndex: step.repeatIndex,
      repeatTotal: step.repeatTotal
    });
  }
  return out;
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
 *
 * **Before any of that (spec 081):** if the activity carries Garmin's `workoutId` and a candidate
 * was pushed under that same id, the watch has already answered the question and the ranking below
 * is not consulted — not even the sport family, which a session logged under the wrong activity
 * type would fail. Everything here is a tie-break between plausible plans; an id is not plausible,
 * it is known. `null` on either side is not a value and matches nothing.
 */
export function matchPlanned(
  candidates: readonly PlannedCandidate[],
  sport: string,
  garminWorkoutId: string | null = null
): PlannedCandidate | null {
  const family = sportGroup(sport);
  const targets = (c: PlannedCandidate): number =>
    [c.estimatedDurationS, c.estimatedDistanceM, c.targetLoad].filter(finite).length;

  if (garminWorkoutId !== null) {
    // Sorted by id so two candidates pushed under one workout id (which the store's partial unique
    // index forbids, but the type does not) resolve deterministically rather than by array order.
    const exact = candidates
      .filter((c) => c.garminWorkoutId !== null && c.garminWorkoutId === garminWorkoutId)
      .sort((a, b) => a.id.localeCompare(b.id));
    if (exact.length > 0) return exact[0]!;
  }

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

/** How far a value sits outside a band, as a signed fraction of the edge it breached. */
function bandDeviation(value: number | null, low: number | null, high: number | null): number | null {
  if (value === null) return null;
  const edge = breachedEdge(value, low, high);
  if (edge === null) return 0;
  if (edge === 0) return null;
  return (value - edge) / edge;
}

/** The per-step deviations of an intensity row, each against ITS OWN band. Empty when unaligned. */
function perStepDeviations(step: PlannedStepComparison): number[] {
  if (step.perStep === null) return [];
  const out: number[] = [];
  for (const entry of step.perStep) {
    const deviation = bandDeviation(entry.actual, entry.targetLow, entry.targetHigh);
    if (deviation !== null) out.push(deviation);
  }
  return out;
}

const mean = (xs: readonly number[]): number => xs.reduce((sum, x) => sum + x, 0) / xs.length;

/**
 * How far off plan a row landed, as a signed fraction: positive above the target, negative below,
 * exactly 0 anywhere inside a band. `null` when nothing comparable was recorded.
 *
 * With a per-step breakdown (spec 091) this is the MEAN of the steps' own deviations, so a session
 * where every rep drifted the same way reads as that drift, and one where the reps cancelled out
 * reads as roughly on plan — which is what the athlete would say too.
 *
 * Note the sign convention is NUMERIC, not qualitative: a pace is seconds per kilometre, so a
 * negative deviation on a pace row means the athlete ran FASTER than asked. Callers that phrase
 * this for a human have to invert it — see `planTakeaways`.
 */
export function planStepDeviation(step: PlannedStepComparison): number | null {
  const perStep = perStepDeviations(step);
  if (perStep.length > 0) return mean(perStep);
  if (step.actual === null) return null;
  if (isBand(step)) return bandDeviation(step.actual, step.targetLow, step.targetHigh);
  if (!(step.target > 0)) return null;
  return step.actual / step.target - 1;
}

/**
 * 0–1 adherence for one row; `null` when the row cannot be scored at all.
 *
 * With a per-step breakdown this is the mean of the STEPS' scores, not the score of their mean:
 * three clean reps and two sloppy ones must not average into a number that looks like five decent
 * ones. `compliancePct` keeps exactly the meaning spec 085 gave it — only this input got sharper.
 */
export function planStepScore(step: PlannedStepComparison): number | null {
  const perStep = perStepDeviations(step);
  if (perStep.length > 0) return mean(perStep.map((d) => Math.max(0, 1 - Math.abs(d))));
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
    met: actual === null ? null : Math.abs(actual / target - 1) <= PLAN_TOLERANCE,
    perStep: null
  };
}

const bandMiddle = (low: number | null, high: number | null): number => {
  const ends = [low, high].filter(finite);
  return ends.length === 0 ? 0 : ends.reduce((a, b) => a + b, 0) / ends.length;
};

function bandStep(
  key: PlannedStepKey,
  low: number | null,
  high: number | null,
  actual: number | null
): PlannedStepComparison {
  return {
    key,
    target: bandMiddle(low, high),
    targetLow: low,
    targetHigh: high,
    actual,
    met: actual === null ? null : insideBand(actual, low, high),
    perStep: null
  };
}

/** The measured value of one metric over a step's own laps. */
function alignedValue(key: PlannedStepKey, alignment: PlanStepAlignment): number | null {
  if (key === 'pace') return alignment.paceSecPerKm;
  if (key === 'power') return alignment.power;
  if (key === 'hr') return alignment.avgHr;
  return null;
}

/**
 * The intensity row for one target type, measured step by step (spec 091).
 *
 * Only WORK steps that asked for this metric and that the aligner placed on their own laps take
 * part — same rule spec 085 used to read the band, applied to the actual. A step the aligner
 * reported as `none` contributes nothing at all: we know it happened inside some neighbour's lap,
 * and splitting that lap between them would invent a measurement.
 *
 * The row's `actual` is the whole WORK effort, not the whole session: total time over total distance
 * for pace, duration-weighted for power and heart rate. That alone is the fix this spec exists for —
 * on a `5 × 1 km` the jog no longer drags the number between the bands.
 */
function perStepBandRow(
  key: PlannedStepKey,
  type: WorkoutTargetType,
  low: number | null,
  high: number | null,
  steps: readonly PlannedStructureStep[]
): PlannedStepComparison | null {
  const entries: PlannedStepActual[] = [];
  let weighted = 0;
  let weight = 0;
  let distanceM = 0;
  let durationS = 0;
  let paced = true;

  for (const step of steps) {
    if (step.kind !== 'work') continue;
    const target = step.target;
    if (!target || target.type !== type) continue;
    if (!finite(target.low) && !finite(target.high)) continue;
    const alignment = step.alignment;
    if (!alignment || alignment.confidence === 'none') continue;

    const actual = alignedValue(key, alignment);
    entries.push({
      stepIndex: step.index,
      repeatIndex: step.repeatIndex,
      repeatTotal: step.repeatTotal,
      targetLow: finite(target.low) ? target.low : null,
      targetHigh: finite(target.high) ? target.high : null,
      actual,
      met: actual === null ? null : insideBand(actual, target.low, target.high),
      confidence: alignment.confidence
    });

    if (actual === null) continue;
    const seconds = finite(alignment.durationS) && alignment.durationS > 0 ? alignment.durationS : 1;
    weighted += actual * seconds;
    weight += seconds;
    if (finite(alignment.distanceM) && finite(alignment.durationS)) {
      distanceM += alignment.distanceM;
      durationS += alignment.durationS;
    } else {
      paced = false;
    }
  }

  if (entries.length === 0 || weight === 0) return null;

  const actual =
    key === 'pace' && paced && distanceM > 0 && durationS > 0
      ? Math.round((durationS / distanceM) * 1000)
      : Math.round(weighted / weight);

  return {
    key,
    target: bandMiddle(low, high),
    targetLow: low,
    targetHigh: high,
    actual,
    // Every step that could be judged had to be inside ITS OWN band, so `met` cannot contradict the
    // row's score the way a whole-row band check would.
    met: entries.every((e) => e.met !== false),
    perStep: entries
  };
}

/** Which intensity band types have an actual on this page. `speed` and `cadence` have none. */
const INTENSITY_KEYS: Readonly<Partial<Record<WorkoutTargetType, PlannedStepKey>>> = {
  pace: 'pace',
  power: 'power',
  hr: 'hr'
};

/**
 * Score a matched plan against what was actually done.
 *
 * Scalar rows (duration, distance, load) are session totals and always were. Intensity rows prefer
 * the LAPS: when `actual.laps` reconcile with the plan's step sequence each band is judged step by
 * step, and only when they do not does the comparison fall back to spec 085's session aggregates —
 * unchanged, and named as such in `intensitySource` so the card can say which one the athlete is
 * reading.
 */
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

  /*
   * The alignment is recomputed here rather than passed in, for the same reason `matchPlanned` is
   * asked twice on this page: it is pure and deterministic, so the same steps and the same laps
   * cannot produce a different pairing, and threading a pre-computed one through the verdict would
   * let a caller hand this function an alignment belonging to another plan.
   */
  const aligned = plan.steps
    ? alignPlannedStructure(flattenWorkoutSteps(plan.steps), actual.laps ?? [])
    : { steps: [], status: 'no-laps' as PlanAlignmentStatus };

  for (const band of plan.steps ? workIntensityBands(plan.steps) : []) {
    const key = INTENSITY_KEYS[band.type];
    if (key === undefined) continue;
    const perStep =
      aligned.status === 'aligned'
        ? perStepBandRow(key, band.type, band.low, band.high, aligned.steps)
        : null;
    if (perStep !== null) {
      steps.push(perStep);
      continue;
    }
    const value = key === 'pace' ? actual.paceSecPerKm : key === 'power' ? actual.normPower : actual.avgHr;
    steps.push(bandStep(key, band.low, band.high, value));
  }

  return {
    intensitySource: steps.some((s) => s.perStep !== null) ? 'per-step' : 'session-average',
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
