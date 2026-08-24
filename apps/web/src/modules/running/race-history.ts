/**
 * The predicted race time, day by day (spec 087). PURE: progression rows in, one series per race
 * target out. No store, no clock, no Garmin — the store read stays in `running.api.ts`.
 *
 * Spec 057 gave the card a delta badge, and its own closeout named the gap that left: the trend is
 * blind between the cutoff and today, because it compares two endpoints. This module fills that in.
 *
 * ## Why this needs no stored history
 *
 * A prediction is already a pure function of the fastest effort per distance as it stood on a day.
 * "Fastest so far" is a STEP FUNCTION: it only moves on the days a record was set, and is flat
 * everywhere else. So the whole year is reconstructible from the handful of record-setting rows
 * (`listBestEffortProgression`) plus arithmetic — nothing is persisted, and nothing is asked of
 * Garmin.
 *
 * ## Why every day is a real recomputation
 *
 * The values are NOT interpolated between records. Each day runs the same `predictRaces` the card
 * runs, over the bests standing that day, so a day in this history and the same day computed by the
 * card agree by construction rather than by luck. What makes that affordable is that the bests are
 * carried FORWARD across the window — each record row and each run is consumed once, not re-scanned
 * once per day.
 *
 * ## Why there is no critical speed here
 *
 * The same reason spec 057 gave for the as-of half of its badge: reconstructing the past speed–
 * duration curve would mean re-reading up to `SPEED_STREAM_CAP` speed streams PER DAY. The line is
 * the measured-bests (Riegel) model and the UI says so, so it is never mistaken for the card's
 * blended figure.
 */
import { RACE_TARGETS, predictRaces, type RaceDistance } from '$lib/analytics/race-predictor';
import { knownBestsFrom, type MeasuredEffort, type ProjectedBest } from './race-trend';

/** One race distance's line across the window. */
export interface PredictionHistoryDistance {
  /** `RACE_TARGETS` key, e.g. `half`. */
  readonly key: string;
  readonly label: string;
  readonly metres: number;
  /**
   * One entry per day in `days`, index for index. `null` is a genuine "nothing to predict from
   * yet" — the chart leaves a gap rather than drawing a line through it.
   */
  readonly values: readonly (number | null)[];
  /**
   * Seconds gained across the window: `first − last` over the defined values, so POSITIVE means
   * faster now — the same sign convention `RaceTrend.deltaS` uses. `null` when the window holds
   * fewer than two values, because one point is not a change.
   */
  readonly netChangeS: number | null;
}

export interface PredictionHistory {
  /** Every day in the window, ascending, local `YYYY-MM-DD`. */
  readonly days: readonly string[];
  /** One entry per race target the model can speak to at least once in the window. */
  readonly distances: readonly PredictionHistoryDistance[];
}

export interface PredictionHistoryInput {
  /** The window, ascending and gapless (`dayRange`). */
  readonly days: readonly string[];
  /**
   * The record PROGRESSION — efforts that were a personal best when they were set. Rows outside the
   * window matter: a record set before it is what the window STARTS from.
   */
  readonly efforts: readonly MeasuredEffort[];
  /**
   * Even-pace projections tagged with the day of the run they came from — one entry per (run,
   * distance), NOT the all-time winners. The running minimum below turns them into "the projection
   * standing on day D", which is what `personalBests` would have returned that day.
   */
  readonly projections: readonly ProjectedBest[];
  /** Overridable for tests. Defaults to the card's own `RACE_TARGETS`. */
  readonly targets?: readonly RaceDistance[];
}

/**
 * The series behind "Historia przewidywań".
 *
 * `null` — the section is absent, not empty — when the athlete has no measured effort at all, or
 * when no target is reachable anywhere in the window. A chart of nothing explains nothing, and an
 * all-gap line invites the reader to assume a regression.
 *
 * A target that is `null` on EVERY day of the window is dropped rather than shipped as an empty
 * chip: an athlete who has only ever run 5 km should not be offered a marathon line to click.
 */
export function predictionHistory(input: PredictionHistoryInput): PredictionHistory | null {
  const days = [...input.days];
  // No measured efforts means no record progression, and a history built purely from even-pace
  // projections would claim more than it knows. Spec 087: absent, not empty.
  if (days.length === 0 || input.efforts.length === 0) return null;

  const targets = input.targets ?? RACE_TARGETS;

  // Chronological, so the walk below can consume each row exactly once.
  const efforts = [...input.efforts].sort(byDay);
  const projections = [...input.projections].sort(byDay);

  /** The fastest measured effort per distance key SO FAR — the step function, carried forward. */
  const measuredSoFar = new Map<string, MeasuredEffort>();
  /** The same for even-pace projections, which `knownBestsFrom` uses only where a measure is absent. */
  const projectedSoFar = new Map<string, ProjectedBest>();

  const series = new Map<string, (number | null)[]>(targets.map((t) => [t.key, []]));
  let ei = 0;
  let pi = 0;

  for (const day of days) {
    // Everything set on or before this day has now happened. Rows dated BEFORE the window are
    // absorbed on the first iteration, which is how the window inherits the standing record.
    for (; ei < efforts.length && efforts[ei]!.day <= day; ei++) {
      const e = efforts[ei]!;
      if (!(e.durationS > 0) || !(e.actualM > 0)) continue;
      const held = measuredSoFar.get(e.key);
      if (!held || e.durationS < held.durationS) measuredSoFar.set(e.key, e);
    }
    for (; pi < projections.length && projections[pi]!.day <= day; pi++) {
      const p = projections[pi]!;
      if (!(p.timeS > 0) || !(p.meters > 0)) continue;
      const held = projectedSoFar.get(p.key);
      if (!held || p.timeS < held.timeS) projectedSoFar.set(p.key, p);
    }

    if (measuredSoFar.size === 0 && projectedSoFar.size === 0) {
      for (const t of targets) series.get(t.key)!.push(null);
      continue;
    }

    // The SAME engine and the SAME merge the card uses — deliberately without a critical speed.
    const bests = knownBestsFrom([...measuredSoFar.values()], [...projectedSoFar.values()]);
    const predicted = new Map(predictRaces(bests, { targets }).map((p) => [p.key, p.riegelS]));
    for (const t of targets) series.get(t.key)!.push(predicted.get(t.key) ?? null);
  }

  const distances: PredictionHistoryDistance[] = [];
  for (const t of targets) {
    const values = series.get(t.key)!;
    if (!values.some((v) => v !== null)) continue;
    distances.push({ key: t.key, label: t.label, metres: t.metres, values, netChangeS: netChange(values) });
  }

  return distances.length === 0 ? null : { days, distances };
}

/** `first − last` over the DEFINED values: positive = faster now. `null` under two of them. */
function netChange(values: readonly (number | null)[]): number | null {
  const defined = values.filter((v): v is number => v !== null);
  if (defined.length < 2) return null;
  return defined[0]! - defined[defined.length - 1]!;
}

const byDay = (a: { day: string }, b: { day: string }): number => a.day.localeCompare(b.day);
