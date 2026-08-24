/**
 * Project the rich stats Garmin ALREADY returns on the activity list out of the stored
 * `synced_activities.raw` blob (spec 023). No re-sync is needed: the sidecar has always persisted the
 * payload verbatim, we simply never read past the dozen columns `normalizeActivity` lifts out.
 *
 * Pure and total: `raw` is untrusted (AGENTS.md §10), every field is optional, an unexpected shape
 * yields `undefined` rather than a throw, and nothing here touches I/O, the clock or config. Derived
 * values (pace, total calories, idle time, intensity-minute total) live in named exported functions
 * so the arithmetic is unit-tested once instead of scattered over handlers and components.
 *
 * Units are in the field names. Where Garmin genuinely does not report a value the field is simply
 * absent — see the spec's closeout for the list — and the UI renders "--".
 */
import type { ActivityLap } from '../interfaces';

export interface CalorieStats {
  /** Total kcal (Garmin's `calories`). */
  readonly total?: number;
  /** Resting/BMR kcal burned over the activity's duration. */
  readonly resting?: number;
  /** Derived: total − resting, floored at 0. */
  readonly active?: number;
}

export interface RespirationStats {
  readonly avg?: number;
  readonly min?: number;
  readonly max?: number;
}

export interface TrainingEffectStats {
  readonly aerobic?: number;
  readonly anaerobic?: number;
  /** Garmin's primary-benefit label, e.g. `TEMPO`, `AEROBIC_BASE`, `RECOVERY`. */
  readonly label?: string;
  /** Garmin's exercise/training load for the activity. */
  readonly load?: number;
}

export interface StaminaStats {
  readonly beginPotential?: number;
  readonly endPotential?: number;
  readonly min?: number;
}

export interface HrStats {
  readonly avg?: number;
  readonly max?: number;
  /** Seconds in HR zones 1–5, index 0 = zone 1. Present only when Garmin reported any zone. */
  readonly timeInZoneS?: readonly number[];
}

export interface TimingStats {
  readonly durationS?: number;
  readonly movingS?: number;
  readonly elapsedS?: number;
  /** Derived: duration − moving, floored at 0. */
  readonly idleS?: number;
}

export interface PowerStats {
  readonly avg?: number;
  readonly max?: number;
  readonly normalized?: number;
}

export interface ElevationStats {
  readonly gainM?: number;
  readonly lossM?: number;
  readonly minM?: number;
  readonly maxM?: number;
}

export interface PaceStats {
  readonly avgSpeedMps?: number;
  readonly maxSpeedMps?: number;
  /** Derived from distance + duration. */
  readonly avgSecPerKm?: number;
  /** Derived from distance + moving duration. */
  readonly avgMovingSecPerKm?: number;
  /** Derived from `maxSpeed`. */
  readonly bestSecPerKm?: number;
  /** Only present on the rare payloads that carry a grade-adjusted speed. */
  readonly gradeAdjustedSecPerKm?: number;
}

export interface RunningDynamicsStats {
  readonly avgCadenceSpm?: number;
  readonly maxCadenceSpm?: number;
  readonly avgStrideLengthCm?: number;
  readonly avgVerticalRatio?: number;
  readonly avgVerticalOscillationCm?: number;
  readonly avgGroundContactBalancePct?: number;
  readonly avgGroundContactTimeMs?: number;
}

export interface TemperatureStats {
  readonly avgC?: number;
  readonly minC?: number;
  readonly maxC?: number;
}

export interface IntensityMinuteStats {
  readonly moderate?: number;
  readonly vigorous?: number;
  /** Derived with Garmin's weekly-goal weighting: moderate + 2 × vigorous. */
  readonly total?: number;
}

export interface StressStats {
  readonly avg?: number;
  readonly max?: number;
  readonly start?: number;
  readonly end?: number;
  /** Garmin's `differenceStress` (end − start). */
  readonly difference?: number;
}

export interface SelfEvaluationStats {
  /** Perceived effort, 0–10 (Garmin stores RPE × 10). */
  readonly perceivedEffort?: number;
  /** How the session felt, 0–100 (higher = better). */
  readonly feel?: number;
}

/** Run / walk / standing seconds, from Garmin's own typed splits. */
export interface RunWalkStats {
  readonly runS?: number;
  readonly walkS?: number;
  readonly idleS?: number;
}

/**
 * Everything the activity page can show beyond the columns already normalized into `ActivitySummary`.
 * Groups are ALWAYS present (so the UI can read `stats.pace.avgSecPerKm` without guarding twice);
 * every leaf is optional.
 */
export interface ActivityStats {
  readonly calories: CalorieStats;
  /** Estimated sweat loss, millilitres. */
  readonly hydration: { readonly sweatLossMl?: number };
  readonly respiration: RespirationStats;
  readonly trainingEffect: TrainingEffectStats;
  readonly stamina: StaminaStats;
  readonly hr: HrStats;
  readonly timing: TimingStats;
  readonly power: PowerStats;
  readonly elevation: ElevationStats;
  readonly pace: PaceStats;
  readonly runningDynamics: RunningDynamicsStats;
  readonly temperature: TemperatureStats;
  readonly intensityMinutes: IntensityMinuteStats;
  /** Net body-battery change over the activity (negative = drained). */
  readonly bodyBattery: { readonly difference?: number };
  readonly stress: StressStats;
  readonly selfEvaluation: SelfEvaluationStats;
  readonly runWalk: RunWalkStats;
}

/* ---------------- primitives ---------------- */

function asRecord(v: unknown): Record<string, unknown> | null {
  return v !== null && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

/** First candidate key holding a finite number, else undefined. */
function num(o: Record<string, unknown>, keys: readonly string[]): number | undefined {
  for (const k of keys) {
    const v = o[k];
    if (typeof v === 'number' && Number.isFinite(v)) return v;
  }
  return undefined;
}

/** As `num`, but rounded to a whole number. */
function int(o: Record<string, unknown>, keys: readonly string[]): number | undefined {
  const n = num(o, keys);
  return n === undefined ? undefined : Math.round(n);
}

function text(o: Record<string, unknown>, keys: readonly string[]): string | undefined {
  for (const k of keys) {
    const v = o[k];
    if (typeof v === 'string' && v.length > 0) return v;
  }
  return undefined;
}

/**
 * Drop undefined leaves so a group serializes as `{}` rather than `{a: undefined}` — required under
 * `exactOptionalPropertyTypes`, and it keeps the SSR payload free of null noise.
 */
function compact<T extends object>(o: { [K in keyof T]: T[K] | undefined }): T {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(o)) if (v !== undefined) out[k] = v;
  return out as T;
}

/* ---------------- derivations (pure, individually tested) ---------------- */

/** Seconds per kilometre from metres + seconds. Undefined unless both are positive. */
export function paceSecPerKm(
  distanceM: number | undefined,
  durationS: number | undefined
): number | undefined {
  if (!distanceM || !durationS || distanceM <= 0 || durationS <= 0) return undefined;
  return Math.round((durationS / distanceM) * 1000);
}

/** Seconds per kilometre from a speed in metres per second. */
export function paceFromSpeed(speedMps: number | undefined): number | undefined {
  if (!speedMps || speedMps <= 0) return undefined;
  return Math.round(1000 / speedMps);
}

/**
 * Reconcile Garmin's two calorie fields. `calories` is the TOTAL and `bmrCalories` the resting part,
 * so active = total − resting (Garmin's own activity page does exactly this subtraction). Either
 * side may be missing; whatever can be derived is, the rest stays undefined.
 */
export function calorieSplit(total: number | undefined, resting: number | undefined): CalorieStats {
  if (total !== undefined && resting !== undefined) {
    return {
      total: Math.round(total),
      resting: Math.round(resting),
      active: Math.max(0, Math.round(total - resting))
    };
  }
  if (total !== undefined) return { total: Math.round(total) };
  if (resting !== undefined) return { resting: Math.round(resting) };
  return {};
}

/** Non-moving seconds: total − moving, floored at 0. Undefined unless both are known. */
export function idleSeconds(durationS: number | undefined, movingS: number | undefined): number | undefined {
  if (durationS === undefined || movingS === undefined) return undefined;
  return Math.max(0, Math.round(durationS - movingS));
}

/**
 * Garmin's weekly-goal weighting: vigorous minutes count double. Returns undefined when neither
 * value is reported; a missing half counts as zero once the other is present.
 */
export function totalIntensityMinutes(
  moderate: number | undefined,
  vigorous: number | undefined
): number | undefined {
  if (moderate === undefined && vigorous === undefined) return undefined;
  return Math.round((moderate ?? 0) + (vigorous ?? 0) * 2);
}

/**
 * Run / walk / standing seconds from Garmin's typed splits (`RWD_RUN`/`RWD_WALK`/`RWD_STAND`).
 * This is the ONLY place the breakdown exists — the activity-list payload carries no run/walk split —
 * so an activity without typed splits yields an empty object.
 */
export function runWalkFromSplits(splits: readonly ActivityLap[] | undefined): RunWalkStats {
  if (!splits || splits.length === 0) return {};
  let runS: number | undefined;
  let walkS: number | undefined;
  let idleS: number | undefined;
  for (const split of splits) {
    const seconds = split.durationS;
    if (seconds === undefined || !Number.isFinite(seconds)) continue;
    const type = (split.type ?? '').toUpperCase();
    if (type.includes('RUN')) runS = (runS ?? 0) + seconds;
    else if (type.includes('WALK')) walkS = (walkS ?? 0) + seconds;
    else if (type.includes('STAND') || type.includes('IDLE') || type.includes('REST'))
      idleS = (idleS ?? 0) + seconds;
  }
  return compact({
    runS: runS === undefined ? undefined : Math.round(runS),
    walkS: walkS === undefined ? undefined : Math.round(walkS),
    idleS: idleS === undefined ? undefined : Math.round(idleS)
  });
}

/** Mean of a numeric stream, one decimal. Undefined for an absent/empty stream. */
export function streamAverage(values: readonly number[] | undefined): number | undefined {
  if (!values || values.length === 0) return undefined;
  let sum = 0;
  let n = 0;
  for (const v of values) {
    if (typeof v === 'number' && Number.isFinite(v)) {
      sum += v;
      n++;
    }
  }
  return n === 0 ? undefined : Math.round((sum / n) * 10) / 10;
}

/* ---------------- the projection ---------------- */

/** Seconds in HR zones 1–5; undefined when Garmin reported none of them. */
function hrZoneSeconds(o: Record<string, unknown>): number[] | undefined {
  const zones = [1, 2, 3, 4, 5].map((z) => num(o, [`hrTimeInZone_${z}`, `hrTimeInZone${z}`]));
  return zones.some((z) => z !== undefined) ? zones.map((z) => Math.round(z ?? 0)) : undefined;
}

/**
 * Project every stat we can read off a raw Garmin activity-summary payload.
 * `raw` is whatever the sidecar stored — anything non-object yields all-empty groups.
 */
export function extractActivityStats(raw: unknown): ActivityStats {
  const o = asRecord(raw) ?? {};

  const durationS = num(o, ['duration']);
  const movingS = num(o, ['movingDuration']);
  const elapsedS = num(o, ['elapsedDuration']);
  const distanceM = num(o, ['distance', 'distanceInMeters']);
  const moderate = num(o, ['moderateIntensityMinutes']);
  const vigorous = num(o, ['vigorousIntensityMinutes']);
  const rpe = num(o, ['directWorkoutRpe', 'workoutRpe']);

  return {
    calories: calorieSplit(
      num(o, ['calories', 'totalKilocalories']),
      num(o, ['bmrCalories', 'restingCalories'])
    ),
    hydration: compact({ sweatLossMl: int(o, ['waterEstimated', 'sweatLoss']) }),
    respiration: compact({
      avg: num(o, ['avgRespirationRate', 'averageRespirationRate']),
      min: num(o, ['minRespirationRate', 'lowestRespirationRate']),
      max: num(o, ['maxRespirationRate', 'highestRespirationRate'])
    }),
    trainingEffect: compact({
      aerobic: num(o, ['aerobicTrainingEffect']),
      anaerobic: num(o, ['anaerobicTrainingEffect']),
      label: text(o, ['trainingEffectLabel', 'primaryBenefit']),
      load: num(o, ['activityTrainingLoad', 'trainingLoad'])
    }),
    stamina: compact({
      beginPotential: num(o, ['beginPotentialStamina']),
      endPotential: num(o, ['endPotentialStamina']),
      min: num(o, ['minAvailableStamina'])
    }),
    hr: compact({
      avg: int(o, ['averageHR', 'avgHr']),
      max: int(o, ['maxHR', 'maxHr']),
      timeInZoneS: hrZoneSeconds(o)
    }),
    timing: compact({ durationS, movingS, elapsedS, idleS: idleSeconds(durationS, movingS) }),
    power: compact({
      avg: int(o, ['avgPower', 'averagePower', 'avgBikingPower']),
      max: int(o, ['maxPower', 'maxBikingPower']),
      normalized: int(o, ['normPower', 'normalizedPower'])
    }),
    elevation: compact({
      gainM: num(o, ['elevationGain', 'totalElevationGain']),
      lossM: num(o, ['elevationLoss', 'totalElevationLoss']),
      minM: num(o, ['minElevation']),
      maxM: num(o, ['maxElevation'])
    }),
    pace: compact({
      avgSpeedMps: num(o, ['averageSpeed', 'avgSpeed']),
      maxSpeedMps: num(o, ['maxSpeed']),
      avgSecPerKm: paceSecPerKm(distanceM, durationS),
      avgMovingSecPerKm: paceSecPerKm(distanceM, movingS),
      bestSecPerKm: paceFromSpeed(num(o, ['maxSpeed'])),
      gradeAdjustedSecPerKm: paceFromSpeed(num(o, ['avgGradeAdjustedSpeed', 'averageGradeAdjustedSpeed']))
    }),
    runningDynamics: compact({
      avgCadenceSpm: int(o, ['averageRunningCadenceInStepsPerMinute', 'avgRunCadence', 'avgDoubleCadence']),
      maxCadenceSpm: int(o, ['maxRunningCadenceInStepsPerMinute', 'maxRunCadence', 'maxDoubleCadence']),
      avgStrideLengthCm: num(o, ['avgStrideLength', 'averageStrideLength']),
      avgVerticalRatio: num(o, ['avgVerticalRatio']),
      avgVerticalOscillationCm: num(o, ['avgVerticalOscillation']),
      avgGroundContactBalancePct: num(o, ['avgGroundContactBalance']),
      avgGroundContactTimeMs: num(o, ['avgGroundContactTime'])
    }),
    temperature: compact({
      avgC: num(o, ['avgTemperature', 'averageTemperature']),
      minC: num(o, ['minTemperature']),
      maxC: num(o, ['maxTemperature'])
    }),
    intensityMinutes: compact({ moderate, vigorous, total: totalIntensityMinutes(moderate, vigorous) }),
    bodyBattery: compact({ difference: int(o, ['differenceBodyBattery']) }),
    stress: compact({
      avg: int(o, ['avgStress', 'averageStress']),
      max: int(o, ['maxStress']),
      start: int(o, ['startStress']),
      end: int(o, ['endStress']),
      difference: int(o, ['differenceStress'])
    }),
    selfEvaluation: compact({
      // Garmin stores RPE as 0–100 (effort × 10); surface the familiar 0–10 scale.
      perceivedEffort: rpe === undefined ? undefined : Math.round(rpe > 10 ? rpe / 10 : rpe),
      feel: int(o, ['directWorkoutFeel', 'workoutFeel'])
    }),
    runWalk: {}
  };
}
