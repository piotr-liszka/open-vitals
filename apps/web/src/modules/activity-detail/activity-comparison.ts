/**
 * "How good was this session?" for the top of the activity page (spec 026). Pure: activities in,
 * verdict out — no store, no clock, no Garmin.
 *
 * ## Two answers, because one of them can be missing
 *
 * 1. **Against the plan.** A session is matched to whatever was scheduled for the same day in the
 *    same sport family — Garmin's synced calendar (spec 024) or the athlete's own authored workout
 *    (spec 050/066) — and scored against its targets. That half lives in `./activity-plan`; this
 *    file only calls it. When nothing was scheduled the slot says which of the two reasons applies —
 *    nothing planned, or nothing synced around that date — and never invents an adherence number.
 * 2. **Against the athlete's own recent training**, which always works and is the more honest answer
 *    to "how good was it":
 *      - **vs. the recent norm** — this session's stress against the median comparable session of
 *        the last 42 days ("was this harder or easier than usual?"), and
 *      - **vs. fitness and form** — its stress against CTL on the eve of the session, plus the TSB
 *        the athlete carried into it ("was this a big ask for the shape you were in?").
 *
 * ## Why history load ignores power
 *
 * `activityLoad` can derive TSS from a power stream, but pulling power for every session in the
 * window would cost a second heavy query on a page that is already stream-heavy. History and the
 * activity itself are therefore both scored on the SAME restricted chain — Garmin's own training
 * load, else HR TRIMP — so the comparison is apples to apples. The power-derived TSS still shows up
 * on its own, in the IF/TSS card.
 */
import {
  activityLoad,
  buildTrainingLoad,
  type LoadMethod,
  type TrainingBand
} from '$lib/server/analytics/training-load';
import { addDays, compareDays, type DayKey } from '$lib/date';
import type { Translator } from '$lib/i18n';
import { bandLabel, verdictLabel, type ActivityVerdict } from './activity-comparison.format';
import {
  buildPlannedComparison as buildPlanned,
  matchPlanned as matchPlan,
  planTakeaways as takeawaysOf,
  type ActualEffort,
  type PlanTakeaway,
  type PlannedInput,
  type PlannedWorkoutComparison,
  type PlannedWorkoutStatus
} from './activity-plan';

// The label lookups and `ActivityVerdict` live in `./activity-comparison.format` so that
// `TrainingVerdict.svelte` can import them without dragging this module's `$lib/server` import
// into the browser bundle. Re-exported here so existing importers keep one entry point.
export { bandLabel, verdictLabel };
export type { ActivityVerdict };

/*
 * The PLANNED side — matching, scoring and takeaways — lives in `./activity-plan`. It needs no load
 * model, and keeping it out of this file is what lets `PlannedVsActual.svelte` and the Przebieg
 * strip import it without dragging this module's `$lib/server` import into the browser bundle.
 * Re-exported here so the verdict keeps one entry point.
 */
export {
  alignPlannedStructure,
  buildExecutedStrip,
  buildPlannedComparison,
  buildPlanStrip,
  complianceOf,
  flattenWorkoutSteps,
  insideBand,
  matchPlanned,
  MAX_PLAN_TAKEAWAYS,
  planStepDeviation,
  planStepScore,
  planTakeaways,
  PLAN_TOLERANCE,
  workIntensityBands
} from './activity-plan';
export type {
  ActualEffort,
  AlignedPlan,
  ExecutedStripBlock,
  IntensityBand,
  PlanIntensitySource,
  PlanStrip,
  PlanStripBlock,
  PlanStripMarker,
  PlanTakeaway,
  PlanTakeawayKey,
  PlannedCandidate,
  PlannedInput,
  PlannedOrigin,
  PlannedStepActual,
  PlannedStepComparison,
  PlannedStepKey,
  PlannedStepKind,
  PlannedStructureStep,
  PlannedWorkoutComparison,
  PlannedWorkoutStatus
} from './activity-plan';
/** The aligner itself (spec 091) — pure, client-safe, and re-exported for the same one-door reason. */
export { alignPlanToLaps } from './plan-lap-alignment';
export type {
  AlignmentConfidence,
  LapEffort,
  PlanAlignment,
  PlanAlignmentStatus,
  PlanStepAlignment
} from './plan-lap-alignment';

export interface TrainingComparison {
  /** Stress score for this session on the restricted chain. */
  readonly load: number | null;
  readonly loadMethod: LoadMethod;
  /** Median stress of comparable sessions in the 42 days before this one. */
  readonly recentMedianLoad: number | null;
  /** How many comparable sessions that median came from. */
  readonly recentCount: number;
  /** `load / recentMedianLoad − 1`, in percent. */
  readonly vsRecentPct: number | null;
  /** Fitness, fatigue and form on the eve of the session. */
  readonly ctlBefore: number | null;
  readonly atlBefore: number | null;
  readonly tsbBefore: number | null;
  readonly bandBefore: TrainingBand | null;
  /** `load / ctlBefore` — this session measured against the fitness that met it. */
  readonly loadRatio: number | null;
  readonly verdict: ActivityVerdict;
  /** One Polish sentence a human can read without decoding any of the numbers above. */
  readonly summary: string;
  /** Days the recent-norm window spans. */
  readonly windowDays: number;
  /** The planned workout this session executed; `null` when none could be matched. */
  readonly plannedWorkout: PlannedWorkoutComparison | null;
  readonly plannedWorkoutStatus: PlannedWorkoutStatus;
  /**
   * 0–3 pieces of guidance for next time, as message keys plus their numbers (spec 085). Empty when
   * the plan was met, when nothing about it was measurable, or when no plan matched at all.
   */
  readonly plannedTakeaways: readonly PlanTakeaway[];
}

/** A past or present session reduced to what load scoring needs. */
export interface ComparableActivity {
  readonly day: DayKey;
  readonly durationS: number | null;
  readonly trainingLoad: number | null;
  readonly avgHr: number | null;
  readonly maxHr: number | null;
}

export interface ComparisonInput {
  readonly t: Translator;
  readonly day: DayKey;
  readonly activity: ComparableActivity;
  /** Comparable sessions (same sport family) that happened BEFORE `day`; order irrelevant. */
  readonly history: readonly ComparableActivity[];
  /** Athlete resting HR for TRIMP; the model's own default is used when absent. */
  readonly hrRest?: number | undefined;
  readonly hrMax?: number | null | undefined;
  /** The scheduled side, when the calendar has been synced. */
  readonly planned?: PlannedInput | undefined;
  /** What the session actually achieved, for scoring against the plan. */
  readonly actual?: ActualEffort | undefined;
}

/** Six weeks: long enough to average out a taper week, short enough to still be "recently". */
export const RECENT_WINDOW_DAYS = 42;

/**
 * How far back the handler reads to seed the fitness/fatigue model. CTL has a 42-day time constant
 * and starts from zero, so a 42-day read would report a fitness that is ~63% of the truth; at 120
 * days the EWMA has converged to within a few percent.
 */
export const HISTORY_WINDOW_DAYS = 120;

/** Median of a non-empty list; `null` for an empty one. */
export function median(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[mid]!;
  return ((sorted[mid - 1] ?? 0) + (sorted[mid] ?? 0)) / 2;
}

/** Verdict from the recent norm, falling back to load-vs-fitness when there is no norm. */
export function verdictFor(vsRecentPct: number | null, loadRatio: number | null): ActivityVerdict {
  if (vsRecentPct !== null) {
    if (vsRecentPct >= 50) return 'peak';
    if (vsRecentPct >= 15) return 'hard';
    if (vsRecentPct > -15) return 'steady';
    return 'easy';
  }
  if (loadRatio !== null) {
    if (loadRatio >= 1.5) return 'peak';
    if (loadRatio >= 1.0) return 'hard';
    if (loadRatio >= 0.5) return 'steady';
    return 'easy';
  }
  return 'unknown';
}

const round = (n: number, digits = 0): number => {
  const f = 10 ** digits;
  return Math.round(n * f) / f;
};

/**
 * Score the session and place it against the athlete's own recent training. Deterministic: the
 * anchor is the activity's own day, never "today".
 */
export function buildTrainingComparison(input: ComparisonInput): TrainingComparison {
  const dayBefore = addDays(input.day, -1);
  const opts = {
    ftpWatts: null,
    endDay: dayBefore,
    ...(input.hrRest === undefined ? {} : { hrRest: input.hrRest }),
    ...(input.hrMax === undefined ? {} : { hrMax: input.hrMax })
  };

  const scored = activityLoad({ ...input.activity, power: null }, opts);
  const load = scored.tss > 0 ? round(scored.tss) : null;

  // History strictly before the activity, so nothing that happened after can leak into "before".
  const past = input.history.filter((a) => compareDays(a.day, input.day) < 0);
  const windowStart = addDays(input.day, -RECENT_WINDOW_DAYS);
  const recentLoads: number[] = [];
  for (const a of past) {
    if (compareDays(a.day, windowStart) < 0) continue;
    const { tss } = activityLoad({ ...a, power: null }, opts);
    if (tss > 0) recentLoads.push(tss);
  }
  const recentMedianRaw = median(recentLoads);
  const recentMedianLoad = recentMedianRaw === null ? null : round(recentMedianRaw);

  const pmc = buildTrainingLoad(
    past.map((a) => ({ ...a, power: null })),
    opts
  );
  const hasPmc = pmc.hasData && pmc.series.length > 0;
  const ctlBefore = hasPmc ? round(pmc.ctl, 1) : null;
  const atlBefore = hasPmc ? round(pmc.atl, 1) : null;
  // Form carried INTO the session = fitness − fatigue as they stood the evening before.
  const tsbBefore = ctlBefore !== null && atlBefore !== null ? round(ctlBefore - atlBefore, 1) : null;
  const bandBefore = tsbBefore === null ? null : bandForTsbLocal(tsbBefore);

  const vsRecentPct =
    load !== null && recentMedianRaw !== null && recentMedianRaw > 0
      ? Math.round((load / recentMedianRaw - 1) * 100)
      : null;
  const loadRatio = load !== null && ctlBefore !== null && ctlBefore > 0 ? round(load / ctlBefore, 2) : null;

  const verdict = load === null ? 'unknown' : verdictFor(vsRecentPct, loadRatio);

  // The planned side. `not-synced` is the honest default: with no calendar data anywhere near this
  // date we cannot claim the athlete had nothing scheduled.
  // spec 081: the activity's own workout id short-circuits the ranking when the watch already
  // linked this session to a plan.
  const plan = input.planned
    ? matchPlan(input.planned.sameDay, input.planned.sport, input.planned.garminWorkoutId)
    : null;
  const plannedWorkout =
    plan === null
      ? null
      : buildPlanned(
          plan,
          input.actual ?? {
            durationS: null,
            distanceM: null,
            load,
            paceSecPerKm: null,
            normPower: null,
            avgHr: null
          }
        );
  const plannedWorkoutStatus: PlannedWorkoutStatus =
    plannedWorkout !== null ? 'linked' : input.planned?.calendarHasData ? 'none-scheduled' : 'not-synced';

  return {
    load,
    loadMethod: scored.method,
    recentMedianLoad,
    recentCount: recentLoads.length,
    vsRecentPct,
    ctlBefore,
    atlBefore,
    tsbBefore,
    bandBefore,
    loadRatio,
    verdict,
    summary: summarize(input.t, {
      load,
      method: scored.method,
      vsRecentPct,
      recentCount: recentLoads.length,
      tsbBefore,
      bandBefore
    }),
    windowDays: RECENT_WINDOW_DAYS,
    plannedWorkout,
    plannedWorkoutStatus,
    plannedTakeaways: takeawaysOf(plannedWorkout)
  };
}

/** Local copy of the model's TSB banding, applied to the pre-session form. */
function bandForTsbLocal(tsb: number): TrainingBand {
  if (tsb > 25) return 'fresh';
  if (tsb >= 5) return 'optimal';
  if (tsb >= -10) return 'neutral';
  if (tsb >= -30) return 'fatigued';
  return 'very-fatigued';
}

interface SummaryInput {
  load: number | null;
  method: LoadMethod;
  vsRecentPct: number | null;
  recentCount: number;
  tsbBefore: number | null;
  bandBefore: TrainingBand | null;
}

/** One plain sentence — the only part of this module a reader has to understand. */
export function summarize(t: Translator, input: SummaryInput): string {
  const parts: string[] = [];

  if (input.load === null) {
    parts.push(t('verdict.summary.noLoad'));
  } else if (input.vsRecentPct === null) {
    parts.push(t(input.recentCount === 0 ? 'verdict.summary.firstSession' : 'verdict.summary.noNorm'));
  } else {
    const pct = Math.abs(input.vsRecentPct);
    const norm = t('verdict.summary.norm', { count: input.recentCount });
    if (pct < 8) parts.push(t('verdict.summary.typical', { norm }));
    else if (input.vsRecentPct > 0) parts.push(t('verdict.summary.harder', { pct, norm }));
    else parts.push(t('verdict.summary.lighter', { pct, norm }));
  }

  if (input.tsbBefore !== null && input.bandBefore !== null) {
    const sign = input.tsbBefore > 0 ? '+' : input.tsbBefore < 0 ? '−' : '';
    const value = Math.abs(input.tsbBefore).toFixed(0);
    parts.push(t('verdict.summary.form', { sign, value, band: bandLabel(t, input.bandBefore) }));
  }

  return parts.join(' ');
}
