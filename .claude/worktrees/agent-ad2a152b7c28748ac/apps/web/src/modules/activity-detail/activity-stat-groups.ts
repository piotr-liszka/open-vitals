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
const HINTS = {
  gradeAdjusted:
    'Garmin nie udostępnia tempa skorygowanego o nachylenie — liczy je dopiero Strava, na podstawie własnego modelu.',
  avgTemperature:
    'Garmin podaje tylko minimum i maksimum. Średnią liczymy ze strumienia temperatury, a to urządzenie go nie zapisało.',
  runWalk:
    'Podział na bieg i marsz pochodzi z klasyfikacji Garmina (typed splits). Ta aktywność ich nie ma — zwykle znaczy to, że sport lub zegarek ich nie generuje.',
  selfEvaluation:
    'Odczucia po treningu wypełnia się ręcznie w zegarku lub w Garmin Connect. Ta aktywność nie ma takiego wpisu.',
  stamina: 'Stamina jest raportowana tylko przez nowsze zegarki i tylko dla części sportów.',
  executionScore:
    'Wynik wykonania Garmin zwraca wyłącznie dla treningów wykonanych według zaplanowanego workoutu. Ta aktywność go nie ma.'
} as const;

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

const numRow = (key: string, label: string, value: number | undefined, unit?: string, digits = 0): StatItem =>
  row(key, label, isNum(value) ? fmtNum(value, digits) : null, unit);

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

export function buildStatSections(input: StatSectionsInput): StatSection[] {
  const { stats, sport } = input;
  const paceSport = sport === 'run' || sport === 'walk' || sport === 'swim';
  const out: (StatSection | null)[] = [];

  /* ---- Czas i ruch ---- */
  const runWalkHint = input.hasTypedSplits ? undefined : HINTS.runWalk;
  out.push(
    section('timing', 'Czas i ruch', 'var(--lane-cyan)', [
      timeRow('duration', 'Czas trwania', stats.timing.durationS),
      timeRow('moving', 'W ruchu', stats.timing.movingS),
      timeRow('elapsed', 'Czas całkowity', stats.timing.elapsedS),
      timeRow('idle', 'Przestój', stats.timing.idleS),
      row(
        'run',
        'Bieg',
        isNum(stats.runWalk.runS) ? fmtDuration(stats.runWalk.runS) : null,
        undefined,
        runWalkHint
      ),
      row(
        'walk',
        'Marsz',
        isNum(stats.runWalk.walkS) ? fmtDuration(stats.runWalk.walkS) : null,
        undefined,
        runWalkHint
      ),
      row(
        'stand',
        'Stanie',
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
        row('avgPace', 'Średnie tempo', fmtPaceOrNull(stats.pace.avgSecPerKm), 'min/km'),
        row('movingPace', 'Tempo w ruchu', fmtPaceOrNull(stats.pace.avgMovingSecPerKm), 'min/km'),
        row('bestPace', 'Najlepsze tempo', fmtPaceOrNull(stats.pace.bestSecPerKm), 'min/km'),
        row(
          'gap',
          'Tempo skorygowane',
          fmtPaceOrNull(stats.pace.gradeAdjustedSecPerKm),
          'min/km',
          stats.pace.gradeAdjustedSecPerKm === undefined ? HINTS.gradeAdjusted : undefined
        ),
        numRow('avgSpeed', 'Średnia prędkość', avgSpeed ?? undefined, 'km/h', 1),
        numRow('maxSpeed', 'Maks. prędkość', maxSpeed ?? undefined, 'km/h', 1)
      ]
    : [
        numRow('avgSpeed', 'Średnia prędkość', avgSpeed ?? undefined, 'km/h', 1),
        numRow('maxSpeed', 'Maks. prędkość', maxSpeed ?? undefined, 'km/h', 1),
        numRow(
          'avgPaceRide',
          'Średnie tempo',
          paceFromMps(stats.pace.avgSpeedMps ?? null) ?? undefined,
          's/km'
        )
      ];
  out.push(section('pace', 'Tempo i prędkość', 'var(--lane-orange)', paceRows));

  /* ---- Wysokość ---- */
  out.push(
    section('elevation', 'Wysokość', 'var(--lane-green)', [
      numRow('gain', 'Suma podejść', stats.elevation.gainM, 'm'),
      numRow('loss', 'Suma zjazdów', stats.elevation.lossM, 'm'),
      numRow('min', 'Najniżej', stats.elevation.minM, 'm'),
      numRow('max', 'Najwyżej', stats.elevation.maxM, 'm')
    ])
  );

  /* ---- Tętno ---- */
  out.push(
    section('hr', 'Tętno', 'var(--lane-red)', [
      numRow('avg', 'Średnie', stats.hr.avg, 'bpm'),
      numRow('max', 'Maksymalne', stats.hr.max, 'bpm')
    ])
  );

  /* ---- Moc ---- */
  out.push(
    section('power', 'Moc', 'var(--lane-amber)', [
      numRow('avg', 'Średnia', stats.power.avg, 'W'),
      numRow('max', 'Maksymalna', stats.power.max, 'W'),
      numRow('np', 'Znormalizowana', stats.power.normalized, 'W')
    ])
  );

  /* ---- Dynamika biegu (kadencja only off a run) ---- */
  const rd = stats.runningDynamics;
  const cadenceUnit = paceSport ? 'kroki/min' : 'obr./min';
  out.push(
    sport === 'run'
      ? section('runningDynamics', 'Dynamika biegu', 'var(--lane-violet)', [
          numRow('avgCadence', 'Średnia kadencja', rd.avgCadenceSpm, cadenceUnit),
          numRow('maxCadence', 'Maks. kadencja', rd.maxCadenceSpm, cadenceUnit),
          numRow('stride', 'Długość kroku', rd.avgStrideLengthCm, 'cm', 1),
          numRow('vRatio', 'Stosunek pionowy', rd.avgVerticalRatio, '%', 1),
          numRow('vOsc', 'Oscylacja pionowa', rd.avgVerticalOscillationCm, 'cm', 1),
          numRow('gctBalance', 'Balans kontaktu', rd.avgGroundContactBalancePct, '% L', 1),
          numRow('gct', 'Czas kontaktu', rd.avgGroundContactTimeMs, 'ms')
        ])
      : section('cadence', 'Kadencja', 'var(--lane-violet)', [
          numRow('avgCadence', 'Średnia', rd.avgCadenceSpm, cadenceUnit),
          numRow('maxCadence', 'Maksymalna', rd.maxCadenceSpm, cadenceUnit)
        ])
  );

  /* ---- Kalorie i nawodnienie ---- */
  out.push(
    section('calories', 'Kalorie i nawodnienie', 'var(--lane-lime)', [
      numRow('total', 'Kalorie', stats.calories.total, 'kcal'),
      numRow('active', 'Aktywne', stats.calories.active, 'kcal'),
      numRow('resting', 'Spoczynkowe', stats.calories.resting, 'kcal'),
      numRow('sweat', 'Utrata potu', stats.hydration.sweatLossMl, 'ml')
    ])
  );

  /* ---- Efekt treningowy ---- */
  const se = stats.selfEvaluation;
  out.push(
    section('trainingEffect', 'Efekt treningowy', 'var(--lane-indigo)', [
      numRow('aerobic', 'Tlenowy', stats.trainingEffect.aerobic, '/ 5', 1),
      numRow('anaerobic', 'Beztlenowy', stats.trainingEffect.anaerobic, '/ 5', 1),
      row('benefit', 'Główna korzyść', benefitLabel(stats.trainingEffect.label)),
      numRow('load', 'Obciążenie', stats.trainingEffect.load),
      row(
        'rpe',
        'Odczuwany wysiłek',
        isNum(se.perceivedEffort) ? fmtNum(se.perceivedEffort) : null,
        '/ 10',
        se.perceivedEffort === undefined ? HINTS.selfEvaluation : undefined
      ),
      row(
        'feel',
        'Samopoczucie',
        isNum(se.feel) ? fmtNum(se.feel) : null,
        '/ 100',
        se.feel === undefined ? HINTS.selfEvaluation : undefined
      ),
      row('execution', 'Wynik wykonania', null, undefined, HINTS.executionScore)
    ])
  );

  /* ---- Fizjologia ---- */
  out.push(
    section('physiology', 'Fizjologia', 'var(--lane-teal)', [
      numRow('respAvg', 'Oddech — średni', stats.respiration.avg, 'odd./min', 1),
      numRow('respMin', 'Oddech — min.', stats.respiration.min, 'odd./min', 1),
      numRow('respMax', 'Oddech — maks.', stats.respiration.max, 'odd./min', 1),
      row(
        'staminaBegin',
        'Stamina na starcie',
        isNum(stats.stamina.beginPotential) ? fmtNum(stats.stamina.beginPotential) : null,
        '%',
        stats.stamina.beginPotential === undefined ? HINTS.stamina : undefined
      ),
      numRow('staminaEnd', 'Stamina na końcu', stats.stamina.endPotential, '%'),
      numRow('staminaMin', 'Stamina minimalna', stats.stamina.min, '%'),
      row(
        'bodyBattery',
        'Body Battery',
        isNum(stats.bodyBattery.difference) ? fmtSigned(stats.bodyBattery.difference) : null
      ),
      numRow('stressAvg', 'Stres — średni', stats.stress.avg),
      numRow('stressMax', 'Stres — maks.', stats.stress.max),
      row(
        'stressDiff',
        'Stres — zmiana',
        isNum(stats.stress.difference) ? fmtSigned(stats.stress.difference) : null
      )
    ])
  );

  /* ---- Temperatura ---- */
  out.push(
    section('temperature', 'Temperatura', 'var(--lane-sky)', [
      row(
        'avg',
        'Średnia',
        isNum(stats.temperature.avgC) ? fmtNum(stats.temperature.avgC, 1) : null,
        '°C',
        stats.temperature.avgC === undefined ? HINTS.avgTemperature : undefined
      ),
      numRow('min', 'Minimalna', stats.temperature.minC, '°C', 1),
      numRow('max', 'Maksymalna', stats.temperature.maxC, '°C', 1)
    ])
  );

  /* ---- Minuty intensywności ---- */
  out.push(
    section('intensityMinutes', 'Minuty intensywności', 'var(--lane-orange)', [
      numRow('moderate', 'Umiarkowane', stats.intensityMinutes.moderate, 'min'),
      numRow('vigorous', 'Intensywne', stats.intensityMinutes.vigorous, 'min'),
      numRow('total', 'Razem (z wagą 2×)', stats.intensityMinutes.total, 'min')
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
          label: `Strefa ${i + 1}`,
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
