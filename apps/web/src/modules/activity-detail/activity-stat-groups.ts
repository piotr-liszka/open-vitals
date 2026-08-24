/**
 * Group the rich `ActivityStats` into the labelled clusters the page renders (spec 026). Pure and
 * client-safe.
 *
 * Three rules decide what a reader sees, and they are the whole point of this file:
 *
 * 1. **A group with nothing to say is not rendered.** Sixty stat tiles where fifty are empty is a
 *    worse page than twelve that all carry a number, so a section survives only if at least one of
 *    its rows has a real value.
 * 2. **Inside a surviving group, a known-unavailable value renders `—` with a reason.** Garmin
 *    genuinely does not report grade-adjusted pace, an average temperature without a stream, a
 *    run/walk split without typed splits, or a self-evaluation the athlete never filled in
 *    (spec 023 closeout). Saying so beats both hiding the row and inventing a number.
 * 3. **A row with neither a value nor a reason is dropped** — silence is better than a grid of
 *    unexplained dashes.
 *
 * Sport-awareness lives here too: running dynamics collapse to cadence on a bike, and minutes per
 * kilometre are not offered for a ride.
 */
import type { SportGroup } from '$lib/sport-labels';
import type { Translator } from '$lib/i18n';
import type { ActivityStats } from './activity-detail.types';
import {
  benefitLabel,
  fmtDuration,
  fmtNum,
  fmtPace,
  fmtSigned,
  isNum,
  paceFromMps,
  speedKmh
} from './activity-format';

/** One label/value pair inside a group. */
export interface StatItem {
  readonly key: string;
  readonly label: string;
  /** Pre-formatted value; `null` renders as an em dash. */
  readonly value: string | null;
  readonly unit?: string;
  /** Why this value is missing. Its presence keeps the row visible even without a value. */
  readonly hint?: string;
}

export interface StatSection {
  readonly key: string;
  readonly title: string;
  /** Lane token that tints the section marker, e.g. `var(--lane-red)`. */
  readonly accent: string;
  readonly items: readonly StatItem[];
}

export interface StatSectionsInput {
  readonly stats: ActivityStats;
  readonly sport: SportGroup;
  /** False when `/typedsplits` returned nothing — the only source of a run/walk split. */
  readonly hasTypedSplits: boolean;
}

/* --------------------------------------------------------------------- *
 * Reasons a value is genuinely unavailable (spec 023 closeout).
 * --------------------------------------------------------------------- */
function hints(t: Translator) {
  return {
    gradeAdjusted: t('stat.hint.gradeAdjusted'),
    avgTemperature: t('stat.hint.avgTemperature'),
    runWalk: t('stat.hint.runWalk'),
    selfEvaluation: t('stat.hint.selfEvaluation'),
    stamina: t('stat.hint.stamina'),
    executionScore: t('stat.hint.executionScore')
  } as const;
}

/** Row helper: a formatted value, or `null` when the source leaf is absent. */
function row(key: string, label: string, value: string | null, unit?: string, hint?: string): StatItem {
  return {
    key,
    label,
    value,
    ...(unit === undefined ? {} : { unit }),
    ...(hint === undefined ? {} : { hint })
  };
}

const timeRow = (key: string, label: string, seconds: number | undefined): StatItem =>
  row(key, label, isNum(seconds) ? fmtDuration(seconds) : null);

/** Drop rows that carry neither a value nor an explanation. */
function usable(items: StatItem[]): StatItem[] {
  return items.filter((i) => i.value !== null || i.hint !== undefined);
}

/** A section is worth a heading only when something in it is actually measured. */
function section(key: string, title: string, accent: string, items: StatItem[]): StatSection | null {
  const kept = usable(items);
  if (!kept.some((i) => i.value !== null)) return null;
  return { key, title, accent, items: kept };
}

export function buildStatSections(t: Translator, input: StatSectionsInput): StatSection[] {
  // Locale-aware, not the module-level default: a decimal number in this grid must follow the
  // reader's language the same way every translated label already does.
  const numRow = (
    key: string,
    label: string,
    value: number | undefined,
    unit?: string,
    digits = 0
  ): StatItem => row(key, label, isNum(value) ? fmtNum(value, digits, t.locale) : null, unit);

  const { stats, sport } = input;
  const paceSport = sport === 'run' || sport === 'walk' || sport === 'swim';
  const out: (StatSection | null)[] = [];
  const HINTS = hints(t);

  /* ---- Czas i ruch ---- */
  const runWalkHint = input.hasTypedSplits ? undefined : HINTS.runWalk;
  out.push(
    section('timing', t('stat.timing.title'), 'var(--lane-cyan)', [
      timeRow('duration', t('stat.timing.duration'), stats.timing.durationS),
      timeRow('moving', t('stat.timing.moving'), stats.timing.movingS),
      timeRow('elapsed', t('stat.timing.elapsed'), stats.timing.elapsedS),
      timeRow('idle', t('stat.timing.idle'), stats.timing.idleS),
      row(
        'run',
        t('stat.timing.run'),
        isNum(stats.runWalk.runS) ? fmtDuration(stats.runWalk.runS) : null,
        undefined,
        runWalkHint
      ),
      row(
        'walk',
        t('stat.timing.walk'),
        isNum(stats.runWalk.walkS) ? fmtDuration(stats.runWalk.walkS) : null,
        undefined,
        runWalkHint
      ),
      row(
        'stand',
        t('stat.timing.stand'),
        isNum(stats.runWalk.idleS) ? fmtDuration(stats.runWalk.idleS) : null,
        undefined,
        runWalkHint
      )
    ])
  );

  /* ---- Tempo i prędkość ---- */
  const avgSpeed = speedKmh(stats.pace.avgSpeedMps ?? null);
  const maxSpeed = speedKmh(stats.pace.maxSpeedMps ?? null);
  const paceRows: StatItem[] = paceSport
    ? [
        row('avgPace', t('stat.pace.avgPace'), fmtPaceOrNull(stats.pace.avgSecPerKm), 'min/km'),
        row('movingPace', t('stat.pace.movingPace'), fmtPaceOrNull(stats.pace.avgMovingSecPerKm), 'min/km'),
        row('bestPace', t('stat.pace.bestPace'), fmtPaceOrNull(stats.pace.bestSecPerKm), 'min/km'),
        row(
          'gap',
          t('stat.pace.gap'),
          fmtPaceOrNull(stats.pace.gradeAdjustedSecPerKm),
          'min/km',
          stats.pace.gradeAdjustedSecPerKm === undefined ? HINTS.gradeAdjusted : undefined
        ),
        numRow('avgSpeed', t('stat.pace.avgSpeed'), avgSpeed ?? undefined, 'km/h', 1),
        numRow('maxSpeed', t('stat.pace.maxSpeed'), maxSpeed ?? undefined, 'km/h', 1)
      ]
    : [
        numRow('avgSpeed', t('stat.pace.avgSpeed'), avgSpeed ?? undefined, 'km/h', 1),
        numRow('maxSpeed', t('stat.pace.maxSpeed'), maxSpeed ?? undefined, 'km/h', 1),
        numRow(
          'avgPaceRide',
          t('stat.pace.avgPaceRide'),
          paceFromMps(stats.pace.avgSpeedMps ?? null) ?? undefined,
          's/km'
        )
      ];
  out.push(section('pace', t('stat.pace.title'), 'var(--lane-orange)', paceRows));

  /* ---- Wysokość ---- */
  out.push(
    section('elevation', t('stat.elevation.title'), 'var(--lane-green)', [
      numRow('gain', t('stat.elevation.gain'), stats.elevation.gainM, 'm'),
      numRow('loss', t('stat.elevation.loss'), stats.elevation.lossM, 'm'),
      numRow('min', t('stat.elevation.min'), stats.elevation.minM, 'm'),
      numRow('max', t('stat.elevation.max'), stats.elevation.maxM, 'm')
    ])
  );

  /* ---- Tętno ---- */
  out.push(
    section('hr', t('stat.hr.title'), 'var(--lane-red)', [
      numRow('avg', t('stat.hr.avg'), stats.hr.avg, 'bpm'),
      numRow('max', t('stat.hr.max'), stats.hr.max, 'bpm')
    ])
  );

  /* ---- Moc ---- */
  out.push(
    section('power', t('stat.power.title'), 'var(--lane-amber)', [
      numRow('avg', t('stat.power.avg'), stats.power.avg, 'W'),
      numRow('max', t('stat.power.max'), stats.power.max, 'W'),
      numRow('np', t('stat.power.np'), stats.power.normalized, 'W')
    ])
  );

  /* ---- Dynamika biegu (kadencja only off a run) ---- */
  const rd = stats.runningDynamics;
  const cadenceUnit = paceSport ? t('chart.unit.stepsPerMin') : t('chart.unit.rpm');
  out.push(
    sport === 'run'
      ? section('runningDynamics', t('stat.dynamics.title'), 'var(--lane-violet)', [
          numRow('avgCadence', t('stat.dynamics.avgCadence'), rd.avgCadenceSpm, cadenceUnit),
          numRow('maxCadence', t('stat.dynamics.maxCadence'), rd.maxCadenceSpm, cadenceUnit),
          numRow('stride', t('stat.dynamics.stride'), rd.avgStrideLengthCm, 'cm', 1),
          numRow('vRatio', t('stat.dynamics.vRatio'), rd.avgVerticalRatio, '%', 1),
          numRow('vOsc', t('stat.dynamics.vOsc'), rd.avgVerticalOscillationCm, 'cm', 1),
          numRow('gctBalance', t('stat.dynamics.gctBalance'), rd.avgGroundContactBalancePct, '% L', 1),
          numRow('gct', t('stat.dynamics.gct'), rd.avgGroundContactTimeMs, 'ms')
        ])
      : section('cadence', t('stat.cadence.title'), 'var(--lane-violet)', [
          numRow('avgCadence', t('stat.cadence.avg'), rd.avgCadenceSpm, cadenceUnit),
          numRow('maxCadence', t('stat.cadence.max'), rd.maxCadenceSpm, cadenceUnit)
        ])
  );

  /* ---- Kalorie i nawodnienie ---- */
  out.push(
    section('calories', t('stat.calories.title'), 'var(--lane-lime)', [
      numRow('total', t('stat.calories.total'), stats.calories.total, 'kcal'),
      numRow('active', t('stat.calories.active'), stats.calories.active, 'kcal'),
      numRow('resting', t('stat.calories.resting'), stats.calories.resting, 'kcal'),
      numRow('sweat', t('stat.calories.sweat'), stats.hydration.sweatLossMl, 'ml')
    ])
  );

  /* ---- Efekt treningowy ---- */
  const se = stats.selfEvaluation;
  out.push(
    section('trainingEffect', t('stat.trainingEffect.title'), 'var(--lane-indigo)', [
      numRow('aerobic', t('stat.trainingEffect.aerobic'), stats.trainingEffect.aerobic, '/ 5', 1),
      numRow('anaerobic', t('stat.trainingEffect.anaerobic'), stats.trainingEffect.anaerobic, '/ 5', 1),
      row('benefit', t('stat.trainingEffect.benefit'), benefitLabel(t, stats.trainingEffect.label)),
      numRow('load', t('stat.trainingEffect.load'), stats.trainingEffect.load),
      row(
        'rpe',
        t('stat.trainingEffect.rpe'),
        isNum(se.perceivedEffort) ? fmtNum(se.perceivedEffort, 0, t.locale) : null,
        '/ 10',
        se.perceivedEffort === undefined ? HINTS.selfEvaluation : undefined
      ),
      row(
        'feel',
        t('stat.trainingEffect.feel'),
        isNum(se.feel) ? fmtNum(se.feel, 0, t.locale) : null,
        '/ 100',
        se.feel === undefined ? HINTS.selfEvaluation : undefined
      ),
      row('execution', t('stat.trainingEffect.execution'), null, undefined, HINTS.executionScore)
    ])
  );

  /* ---- Fizjologia ---- */
  out.push(
    section('physiology', t('stat.physiology.title'), 'var(--lane-teal)', [
      numRow(
        'respAvg',
        t('stat.physiology.respAvg'),
        stats.respiration.avg,
        t('chart.unit.breathsPerMin'),
        1
      ),
      numRow(
        'respMin',
        t('stat.physiology.respMin'),
        stats.respiration.min,
        t('chart.unit.breathsPerMin'),
        1
      ),
      numRow(
        'respMax',
        t('stat.physiology.respMax'),
        stats.respiration.max,
        t('chart.unit.breathsPerMin'),
        1
      ),
      row(
        'staminaBegin',
        t('stat.physiology.staminaBegin'),
        isNum(stats.stamina.beginPotential) ? fmtNum(stats.stamina.beginPotential, 0, t.locale) : null,
        '%',
        stats.stamina.beginPotential === undefined ? HINTS.stamina : undefined
      ),
      numRow('staminaEnd', t('stat.physiology.staminaEnd'), stats.stamina.endPotential, '%'),
      numRow('staminaMin', t('stat.physiology.staminaMin'), stats.stamina.min, '%'),
      row(
        'bodyBattery',
        t('stat.physiology.bodyBattery'),
        isNum(stats.bodyBattery.difference) ? fmtSigned(stats.bodyBattery.difference, 0, t.locale) : null
      ),
      numRow('stressAvg', t('stat.physiology.stressAvg'), stats.stress.avg),
      numRow('stressMax', t('stat.physiology.stressMax'), stats.stress.max),
      row(
        'stressDiff',
        t('stat.physiology.stressDiff'),
        isNum(stats.stress.difference) ? fmtSigned(stats.stress.difference, 0, t.locale) : null
      )
    ])
  );

  /* ---- Temperatura ---- */
  out.push(
    section('temperature', t('stat.temperature.title'), 'var(--lane-sky)', [
      row(
        'avg',
        t('stat.temperature.avg'),
        isNum(stats.temperature.avgC) ? fmtNum(stats.temperature.avgC, 1, t.locale) : null,
        '°C',
        stats.temperature.avgC === undefined ? HINTS.avgTemperature : undefined
      ),
      numRow('min', t('stat.temperature.min'), stats.temperature.minC, '°C', 1),
      numRow('max', t('stat.temperature.max'), stats.temperature.maxC, '°C', 1)
    ])
  );

  /* ---- Minuty intensywności ---- */
  out.push(
    section('intensityMinutes', t('stat.intensity.title'), 'var(--lane-orange)', [
      numRow('moderate', t('stat.intensity.moderate'), stats.intensityMinutes.moderate, 'min'),
      numRow('vigorous', t('stat.intensity.vigorous'), stats.intensityMinutes.vigorous, 'min'),
      numRow('total', t('stat.intensity.total'), stats.intensityMinutes.total, 'min')
    ])
  );

  return out.filter((s): s is StatSection => s !== null);
}

function fmtPaceOrNull(secPerKm: number | undefined): string | null {
  if (!isNum(secPerKm)) return null;
  const text = fmtPace(secPerKm);
  return text === '—' ? null : text;
}

/* --------------------------------------------------------------------- *
 * Heart-rate zone bars
 * --------------------------------------------------------------------- */

export interface HrZoneBar {
  readonly zone: number;
  readonly label: string;
  readonly seconds: number;
  readonly pct: number;
  readonly color: string;
}

/** Whether the zone split came from Garmin's own zones or our %-of-max estimate. */
export type HrZoneSource = 'garmin' | 'estimated';

export interface HrZoneBreakdown {
  readonly source: HrZoneSource;
  readonly bars: readonly HrZoneBar[];
}

const ZONE_COLORS = [
  'var(--lane-cyan)',
  'var(--lane-green)',
  'var(--lane-lime)',
  'var(--lane-amber)',
  'var(--lane-red)'
] as const;

/**
 * Prefer Garmin's `hrTimeInZone_*` (the athlete's own configured zones) and fall back to the
 * handler's %-of-max estimate. Returns `null` when neither source has any time in it, so the panel
 * disappears instead of drawing five empty bars.
 */
export function buildHrZones(
  t: Translator,
  garminSeconds: readonly number[] | undefined,
  estimated: readonly { zone: number; label: string; seconds: number; pct: number }[]
): HrZoneBreakdown | null {
  const fromGarmin = garminSeconds && garminSeconds.some((s) => isNum(s) && s > 0);
  if (fromGarmin) {
    const total = garminSeconds.reduce((sum, s) => sum + (isNum(s) ? s : 0), 0);
    return {
      source: 'garmin',
      bars: garminSeconds.map((raw, i) => {
        const seconds = isNum(raw) ? raw : 0;
        return {
          zone: i + 1,
          label: t('zones.hrBarLabel', { zone: i + 1 }),
          seconds,
          pct: total > 0 ? Math.round((seconds / total) * 100) : 0,
          color: ZONE_COLORS[i] ?? 'var(--color-accent)'
        };
      })
    };
  }
  const bars = estimated
    .filter((z) => z.seconds > 0)
    .map((z) => ({
      zone: z.zone,
      label: z.label,
      seconds: z.seconds,
      pct: z.pct,
      color: ZONE_COLORS[z.zone - 1] ?? 'var(--color-accent)'
    }));
  return bars.length > 0 ? { source: 'estimated', bars } : null;
}
