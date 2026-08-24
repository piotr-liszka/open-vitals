/**
 * Laps and Garmin's classified splits, reduced to exactly the table the page draws (spec 026). Pure
 * and client-safe.
 *
 * A column exists only when at least one lap actually carries that field, so a treadmill run does
 * not get an empty elevation column and a ride does not get a stride-length one. The cells are
 * pre-formatted here rather than in the markup, which is what makes the whole table unit-testable.
 */
import type { SportGroup } from '$lib/sport-labels';
import type { ActivityLap } from './activity-detail.types';
import { fmtDuration, fmtNum, fmtPace, isNum, paceFromMps, speedKmh, splitLabel } from './activity-format';

export interface LapColumn {
  readonly key: string;
  readonly label: string;
  /** Right-aligned, tabular figures. */
  readonly numeric: boolean;
}

export interface LapRow {
  readonly key: string;
  /** Formatted cells, index-for-index with `columns`; `null` renders an em dash. */
  readonly cells: readonly (string | null)[];
}

export interface LapTable {
  readonly columns: readonly LapColumn[];
  readonly rows: readonly LapRow[];
}

interface LapField {
  key: string;
  label: string;
  numeric: boolean;
  /** Formatted cell for one lap, or `null` when this lap has no value. */
  cell: (lap: ActivityLap) => string | null;
  /** Whether this lap contributes a value — decides if the column survives. */
  has: (lap: ActivityLap) => boolean;
}

/** Pace for one lap: Garmin's own average speed first, else distance over time. */
export function lapPaceSecPerKm(lap: ActivityLap): number | null {
  const fromSpeed = paceFromMps(lap.avgSpeedMps ?? null);
  if (fromSpeed !== null) return fromSpeed;
  if (isNum(lap.distanceM) && isNum(lap.durationS) && lap.distanceM > 0 && lap.durationS > 0) {
    return (lap.durationS / lap.distanceM) * 1000;
  }
  return null;
}

/** Average speed for one lap in km/h. */
export function lapSpeedKmh(lap: ActivityLap): number | null {
  const direct = speedKmh(lap.avgSpeedMps ?? null);
  if (direct !== null) return direct;
  if (isNum(lap.distanceM) && isNum(lap.durationS) && lap.durationS > 0) {
    return (lap.distanceM / lap.durationS) * 3.6;
  }
  return null;
}

/**
 * The lap table for one activity. Returns `null` when there is nothing worth a table (no laps, or a
 * single lap that just repeats the activity summary).
 */
export function buildLapTable(laps: readonly ActivityLap[], sport: SportGroup): LapTable | null {
  if (laps.length < 2) return null;
  const paceSport = sport === 'run' || sport === 'walk' || sport === 'swim';

  const fields: LapField[] = [
    {
      key: 'index',
      label: 'Nr',
      numeric: true,
      cell: (l) => String(l.index),
      has: () => true
    },
    {
      key: 'distance',
      label: 'Dystans',
      numeric: true,
      cell: (l) => (isNum(l.distanceM) ? `${fmtNum(l.distanceM / 1000, 2)} km` : null),
      has: (l) => isNum(l.distanceM)
    },
    {
      key: 'duration',
      label: 'Czas',
      numeric: true,
      cell: (l) => (isNum(l.durationS) ? fmtDuration(l.durationS) : null),
      has: (l) => isNum(l.durationS)
    },
    paceSport
      ? {
          key: 'pace',
          label: 'Tempo',
          numeric: true,
          cell: (l) => {
            const pace = lapPaceSecPerKm(l);
            return pace === null ? null : `${fmtPace(pace)} /km`;
          },
          has: (l) => lapPaceSecPerKm(l) !== null
        }
      : {
          key: 'speed',
          label: 'Prędkość',
          numeric: true,
          cell: (l) => {
            const kmh = lapSpeedKmh(l);
            return kmh === null ? null : `${fmtNum(kmh, 1)} km/h`;
          },
          has: (l) => lapSpeedKmh(l) !== null
        },
    {
      key: 'avgHr',
      label: 'Śr. tętno',
      numeric: true,
      cell: (l) => (isNum(l.avgHr) ? `${fmtNum(l.avgHr)} bpm` : null),
      has: (l) => isNum(l.avgHr)
    },
    {
      key: 'maxHr',
      label: 'Maks. tętno',
      numeric: true,
      cell: (l) => (isNum(l.maxHr) ? `${fmtNum(l.maxHr)} bpm` : null),
      has: (l) => isNum(l.maxHr)
    },
    {
      key: 'avgPower',
      label: 'Śr. moc',
      numeric: true,
      cell: (l) => (isNum(l.avgPower) ? `${fmtNum(l.avgPower)} W` : null),
      has: (l) => isNum(l.avgPower)
    },
    {
      key: 'cadence',
      label: 'Kadencja',
      numeric: true,
      cell: (l) => (isNum(l.avgRunCadenceSpm) ? fmtNum(l.avgRunCadenceSpm) : null),
      has: (l) => isNum(l.avgRunCadenceSpm)
    },
    {
      key: 'elevation',
      label: 'Podejście',
      numeric: true,
      cell: (l) => (isNum(l.elevationGainM) ? `${fmtNum(l.elevationGainM)} m` : null),
      has: (l) => isNum(l.elevationGainM)
    },
    {
      key: 'calories',
      label: 'Kalorie',
      numeric: true,
      cell: (l) => (isNum(l.calories) ? `${fmtNum(l.calories)} kcal` : null),
      has: (l) => isNum(l.calories)
    }
  ];

  const kept = fields.filter((f) => laps.some((lap) => f.has(lap)));
  return {
    columns: kept.map(({ key, label, numeric }) => ({ key, label, numeric })),
    rows: laps.map((lap) => ({
      key: String(lap.index),
      cells: kept.map((f) => f.cell(lap))
    }))
  };
}

/* --------------------------------------------------------------------- *
 * Typed splits (run / walk / stand, interval work / rest)
 * --------------------------------------------------------------------- */

export interface SplitSummary {
  readonly key: string;
  readonly label: string;
  readonly seconds: number;
  /** How many separate stretches Garmin folded into this row. */
  readonly count: number | null;
  readonly distanceM: number | null;
  readonly paceSecPerKm: number | null;
  readonly color: string;
}

const SPLIT_COLORS: Readonly<Record<string, string>> = {
  RWD_RUN: 'var(--lane-green)',
  RWD_WALK: 'var(--lane-amber)',
  RWD_STAND: 'var(--color-text-subtle)',
  INTERVAL_ACTIVE: 'var(--lane-orange)',
  INTERVAL_REST: 'var(--lane-cyan)',
  INTERVAL_WARMUP: 'var(--lane-teal)',
  INTERVAL_COOLDOWN: 'var(--lane-indigo)'
};

/**
 * Garmin's typed splits are AGGREGATES, not a sequence: one row per class, with `count` stretches
 * folded into it. That is why the page shows them as a composition bar and a summary list, and never
 * as a timeline — we do not know the order, and drawing one would be an invention.
 */
export function buildSplitSummary(splits: readonly ActivityLap[]): SplitSummary[] {
  const byType = new Map<
    string,
    { seconds: number; count: number; distanceM: number; hasCount: boolean; hasDistance: boolean }
  >();
  for (const split of splits) {
    if (!isNum(split.durationS) || split.durationS <= 0) continue;
    const type = (split.type ?? 'OTHER').toUpperCase();
    const acc = byType.get(type) ?? {
      seconds: 0,
      count: 0,
      distanceM: 0,
      hasCount: false,
      hasDistance: false
    };
    acc.seconds += split.durationS;
    if (isNum(split.count)) {
      acc.count += split.count;
      acc.hasCount = true;
    }
    if (isNum(split.distanceM)) {
      acc.distanceM += split.distanceM;
      acc.hasDistance = true;
    }
    byType.set(type, acc);
  }

  return [...byType.entries()]
    .sort((a, b) => b[1].seconds - a[1].seconds)
    .map(([type, acc]) => ({
      key: type,
      label: splitLabel(type),
      seconds: Math.round(acc.seconds),
      count: acc.hasCount ? acc.count : null,
      distanceM: acc.hasDistance ? acc.distanceM : null,
      paceSecPerKm:
        acc.hasDistance && acc.distanceM > 0 && acc.seconds > 0 ? (acc.seconds / acc.distanceM) * 1000 : null,
      color: SPLIT_COLORS[type] ?? 'var(--lane-violet)'
    }));
}
