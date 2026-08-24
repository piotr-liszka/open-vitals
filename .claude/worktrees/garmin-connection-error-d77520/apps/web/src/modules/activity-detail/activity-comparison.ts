/**
 * "How good was this session?" for the top of the activity page (spec 026). Pure: activities in,
 * verdict out — no store, no clock, no Garmin.
 *
 * ## Two answers, because one of them can be missing
 *
 * 1. **Against the plan.** Since spec 024 the calendar service is synced, so a session can be
 *    matched to a `PlannedEvent` on the same day of the same sport family and scored against its
 *    targets. When the calendar holds nothing for that date the slot says which of the two reasons
 *    applies — nothing was scheduled, or nothing has been synced around that date — and never
 *    invents an adherence number.
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
import { sportGroup } from '$lib/sport-labels';
import { bandLabel, verdictLabel, type ActivityVerdict } from './activity-comparison.format';

// The label lookups and `ActivityVerdict` live in `./activity-comparison.format` so that
// `TrainingVerdict.svelte` can import them without dragging this module's `$lib/server` import
// into the browser bundle. Re-exported here so existing importers keep one entry point.
export { bandLabel, verdictLabel };
export type { ActivityVerdict };

/**
 * Why a planned workout is or is not attached:
 *  - `linked` — this session was matched to a plan on the same day;
 *  - `none-scheduled` — the calendar covers this date and had nothing planned for this sport;
 *  - `not-synced` — we hold no calendar data anywhere near this date, so we cannot tell.
 */
export type PlannedWorkoutStatus = 'not-synced' | 'none-scheduled' | 'linked';

/** One measurable target of a planned workout against what was actually done. */
export interface PlannedStepComparison {
  readonly key: 'duration' | 'distance' | 'load';
  readonly label: string;
  readonly target: number;
  readonly actual: number | null;
  /** Within ±10% of the target. `null` when nothing comparable was recorded. */
  readonly met: boolean | null;
}

/** A planned session matched to this activity, scored against its targets. */
export interface PlannedWorkoutComparison {
  readonly workoutId: string;
  readonly name: string;
  readonly scheduledDay: DayKey;
  readonly kind: 'workout' | 'race' | 'note';
  readonly description: string | null;
  readonly targetDurationS: number | null;
  readonly targetDistanceM: number | null;
  readonly targetLoad: number | null;
  readonly steps: readonly PlannedStepComparison[];
  /** 0–100: 100 means exactly on plan; deviation in either direction costs. */
  readonly compliancePct: number | null;
}

/** A scheduled event as the store holds it, reduced to what matching and scoring need. */
export interface PlannedCandidate {
  readonly id: string;
  readonly day: DayKey;
  readonly kind: 'workout' | 'race' | 'note';
  readonly title: string;
  /** Garmin `typeKey`, or `null` for a plan that does not name a sport. */
  readonly sport: string | null;
  readonly description: string | null;
  readonly estimatedDurationS: number | null;
  readonly estimatedDistanceM: number | null;
  readonly targetLoad: number | null;
}

export interface PlannedInput {
  /** Events scheduled on the activity's own day. */
  readonly sameDay: readonly PlannedCandidate[];
  /**
   * True when the store holds ANY planned event near this date. Without it, "nothing scheduled" and
   * "calendar never synced" would be indistinguishable, and we would claim the athlete had a rest
   * day planned when we simply do not know.
   */
  readonly calendarHasData: boolean;
  /** The activity's own sport key; a plan naming a different family is not a match. */
  readonly sport: string;
}

/** What the activity actually achieved, for scoring against the plan. */
export interface ActualEffort {
  readonly durationS: number | null;
  readonly distanceM: number | null;
  readonly load: number | null;
}

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

/* --------------------------------------------------------------------- *
 * The planned side (spec 024 synced the calendar; spec 026 reads it here)
 * --------------------------------------------------------------------- */

/** Within a tenth of the target counts as executed as planned. */
const PLAN_TOLERANCE = 0.1;

const finite = (n: number | null | undefined): n is number => typeof n === 'number' && Number.isFinite(n);

/**
 * Pick the plan this session executed: same day, same sport family (a plan that names no sport
 * matches anything), workouts before races before notes, and the most specific target wins ties. A
 * plan for a different sport on the same day is NOT a match — a Tuesday swim does not fulfil a
 * Tuesday interval run.
 */
export function matchPlanned(
  candidates: readonly PlannedCandidate[],
  sport: string
): PlannedCandidate | null {
  const family = sportGroup(sport);
  const kindRank: Record<PlannedCandidate['kind'], number> = { workout: 0, race: 1, note: 2 };
  const targets = (c: PlannedCandidate): number =>
    [c.estimatedDurationS, c.estimatedDistanceM, c.targetLoad].filter(finite).length;

  const matches = candidates.filter((c) => c.sport === null || sportGroup(c.sport) === family);
  if (matches.length === 0) return null;
  return [...matches].sort(
    (a, b) => kindRank[a.kind] - kindRank[b.kind] || targets(b) - targets(a) || a.id.localeCompare(b.id)
  )[0]!;
}

/** One target vs what happened. `met` is `null` when nothing comparable was recorded. */
function step(
  key: PlannedStepComparison['key'],
  label: string,
  target: number,
  actual: number | null
): PlannedStepComparison {
  return {
    key,
    label,
    target,
    actual,
    met: actual === null ? null : Math.abs(actual / target - 1) <= PLAN_TOLERANCE
  };
}

/**
 * Adherence: 100 means exactly on plan, and deviation in EITHER direction costs — going twice as
 * long as prescribed is as much a departure from the plan as doing half of it. Averaged over the
 * targets the plan actually set; `null` when it set none we can measure.
 */
export function complianceOf(steps: readonly PlannedStepComparison[]): number | null {
  const scored = steps.filter((s) => s.actual !== null && s.target > 0);
  if (scored.length === 0) return null;
  const total = scored.reduce((sum, s) => sum + Math.max(0, 1 - Math.abs(s.actual! / s.target - 1)), 0);
  return Math.round((total / scored.length) * 100);
}

/** Score a matched plan against what was actually done. */
export function buildPlannedComparison(
  plan: PlannedCandidate,
  actual: ActualEffort
): PlannedWorkoutComparison {
  const steps: PlannedStepComparison[] = [];
  if (finite(plan.estimatedDurationS) && plan.estimatedDurationS > 0) {
    steps.push(step('duration', 'Czas', plan.estimatedDurationS, actual.durationS));
  }
  if (finite(plan.estimatedDistanceM) && plan.estimatedDistanceM > 0) {
    steps.push(step('distance', 'Dystans', plan.estimatedDistanceM, actual.distanceM));
  }
  if (finite(plan.targetLoad) && plan.targetLoad > 0) {
    steps.push(step('load', 'Obciążenie', plan.targetLoad, actual.load));
  }
  return {
    workoutId: plan.id,
    name: plan.title,
    scheduledDay: plan.day,
    kind: plan.kind,
    description: plan.description,
    targetDurationS: finite(plan.estimatedDurationS) ? plan.estimatedDurationS : null,
    targetDistanceM: finite(plan.estimatedDistanceM) ? plan.estimatedDistanceM : null,
    targetLoad: finite(plan.targetLoad) ? plan.targetLoad : null,
    steps,
    compliancePct: complianceOf(steps)
  };
}

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
  const plan = input.planned ? matchPlanned(input.planned.sameDay, input.planned.sport) : null;
  const plannedWorkout =
    plan === null
      ? null
      : buildPlannedComparison(plan, input.actual ?? { durationS: null, distanceM: null, load });
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
    summary: summarize({
      load,
      method: scored.method,
      vsRecentPct,
      recentCount: recentLoads.length,
      tsbBefore,
      bandBefore
    }),
    windowDays: RECENT_WINDOW_DAYS,
    plannedWorkout,
    plannedWorkoutStatus
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

/** One plain Polish sentence — the only part of this module a reader has to understand. */
export function summarize(input: SummaryInput): string {
  const parts: string[] = [];

  if (input.load === null) {
    parts.push(
      'Nie da się ocenić obciążenia tej aktywności — nie ma ani obciążenia z Garmina, ani zapisu tętna.'
    );
  } else if (input.vsRecentPct === null) {
    parts.push(
      input.recentCount === 0
        ? 'To pierwsza porównywalna sesja w ostatnich 6 tygodniach, więc nie ma jeszcze do czego jej odnieść.'
        : 'Brak wiarygodnej normy z ostatnich 6 tygodni.'
    );
  } else {
    const pct = Math.abs(input.vsRecentPct);
    const norm = `typowej sesji z ostatnich 6 tygodni (${input.recentCount} porównywalnych)`;
    if (pct < 8) parts.push(`Obciążenie na poziomie ${norm}.`);
    else if (input.vsRecentPct > 0) parts.push(`O ${pct}% mocniejszy od ${norm}.`);
    else parts.push(`O ${pct}% lżejszy od ${norm}.`);
  }

  if (input.tsbBefore !== null && input.bandBefore !== null) {
    const sign = input.tsbBefore > 0 ? '+' : input.tsbBefore < 0 ? '−' : '';
    const value = Math.abs(input.tsbBefore).toFixed(0);
    parts.push(`Wchodziłeś w niego z formą ${sign}${value} (${bandLabel(input.bandBefore)}).`);
  }

  return parts.join(' ');
}
