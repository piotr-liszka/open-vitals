/**
 * Turn an activity's raw streams into the chart specs the UI renders (spec 026). Pure and
 * client-safe: input in, plain data out — no I/O, no clock, no `$lib/server` runtime import.
 *
 * Two ideas carry the whole file:
 *
 * 1. **One shared lattice.** Every chart on the page reads the SAME list of sample indices, so a
 *    pinned read-out at index k means the same moment in every chart. The lattice is chosen to be
 *    uniform in the selected axis: evenly spaced in elapsed time, or evenly spaced in distance
 *    covered. Resampling onto a distance lattice (rather than relabelling a time lattice with
 *    kilometres) is what keeps a "per-kilometre" axis honest when the athlete stood still.
 * 2. **Only what was recorded.** A chart exists only when its stream exists and carries at least two
 *    real samples. A watch without a running-dynamics pod leaves no empty frames behind.
 *
 * Decimation note: the lattice is capped (`DEFAULT_TARGET_POINTS`), so a chart shows a subset of the
 * samples. Exact extremes always come from the stat groups, never from reading a chart.
 */
import { cardiacCostStream } from '$lib/analytics/efficiency';
import { gradeAdjustedStream } from '$lib/analytics/pace-model';
import { cumulativeDistance, elapsedSeconds, streamLength } from '$lib/analytics/stream-axes';
import type { SportGroup } from '$lib/sport-labels';
import { paceFromMps } from './activity-format';
import type { ActivityStreams } from './activity-detail.types';

/** What the x axis measures. `time` is always available; `distance` needs a speed stream. */
export type ChartAxisMode = 'time' | 'distance';

/** How a chart's values are formatted in ticks, tooltips and the read-out strip. */
export type ChartValueKind = 'int' | 'decimal' | 'pace';

/** Chart stacks are grouped so a run page reads as four short lists, not sixteen loose frames. */
export type ChartGroupKey = 'effort' | 'terrain' | 'physiology' | 'dynamics';

export interface ChartSeriesSpec {
  readonly name: string;
  readonly values: number[];
  readonly color: string;
}

export interface ActivityChartSpec {
  readonly key: string;
  readonly title: string;
  /** Printed once above the y axis. */
  readonly unit: string;
  /** Short clarification under the title, e.g. that a higher pace line means slower. */
  readonly note?: string;
  readonly color: string;
  readonly group: ChartGroupKey;
  readonly kind: ChartValueKind;
  /** Single-series values on the shared lattice; empty when `series` is set. */
  readonly values: number[];
  /** Two or more named series on the shared lattice (stamina: current vs potential). */
  readonly series?: ChartSeriesSpec[];
  readonly area: boolean;
}

export interface ActivityChartSet {
  readonly axis: ChartAxisMode;
  /** Source-stream indices behind each lattice point. */
  readonly indices: number[];
  /** X tick labels, index-for-index with the lattice. */
  readonly labels: string[];
  /** Elapsed seconds at each lattice point (for the read-out heading). */
  readonly elapsedS: number[];
  /** Metres covered at each lattice point; `null` when no speed stream exists. */
  readonly distanceM: number[] | null;
  /** False when the activity has no speed stream, so the axis switch stays hidden. */
  readonly canUseDistance: boolean;
  readonly charts: readonly ActivityChartSpec[];
}

/** Roughly one point per 2 px of a wide chart — dense enough to keep shape, cheap to hover. */
export const DEFAULT_TARGET_POINTS = 600;

const SECTION_TITLES: Readonly<Record<ChartGroupKey, string>> = {
  effort: 'Wysiłek',
  terrain: 'Teren i warunki',
  physiology: 'Fizjologia',
  dynamics: 'Dynamika biegu'
};

export function chartGroupTitle(group: ChartGroupKey): string {
  return SECTION_TITLES[group];
}

/** Sports whose natural readout is minutes per kilometre rather than km/h. */
export function isPaceSport(group: SportGroup): boolean {
  return group === 'run' || group === 'walk' || group === 'swim';
}

/*
 * The sample-count and axis helpers now live in `$lib/analytics/stream-axes.ts` (spec 054): the sync
 * engine derives stored best efforts from the same two axes, and `lib/server` may not import from a
 * module folder. Re-exported here so every existing caller — and the charts below — is unchanged.
 */
export { cumulativeDistance, elapsedSeconds, streamLength };

/**
 * `count` sample indices spread evenly over a monotonic non-decreasing axis (elapsed seconds or
 * metres). Where the axis stalls — a red light on a distance axis — consecutive lattice points land
 * on the same sample, which is exactly right: no distance passed, so no chart width is spent.
 */
export function latticeOverAxis(axis: readonly number[], count: number): number[] {
  const n = axis.length;
  if (n === 0) return [];
  if (n <= count) return axis.map((_, i) => i);
  const first = axis[0] ?? 0;
  const last = axis[n - 1] ?? 0;
  const span = last - first;
  if (span <= 0) return uniformLattice(n, count);

  const out: number[] = [];
  let j = 0;
  for (let k = 0; k < count; k++) {
    const target = first + (span * k) / (count - 1);
    while (j + 1 < n && (axis[j + 1] ?? last) <= target) j++;
    out.push(j);
  }
  // The last lattice point must be the final sample, or the chart quietly loses the finish.
  out[out.length - 1] = n - 1;
  return out;
}

/** Evenly spaced sample ordinals — the fallback when an axis carries no usable span. */
export function uniformLattice(n: number, count: number): number[] {
  if (n <= 0) return [];
  if (n <= count) return Array.from({ length: n }, (_, i) => i);
  const out: number[] = [];
  for (let k = 0; k < count; k++) out.push(Math.round((k * (n - 1)) / (count - 1)));
  return out;
}

/** Read one stream at the lattice indices; anything non-numeric becomes a gap (`NaN`). */
export function sampleAt(values: readonly number[] | undefined, indices: readonly number[]): number[] {
  if (!values) return [];
  return indices.map((i) => {
    const v = values[i];
    return typeof v === 'number' && Number.isFinite(v) ? v : Number.NaN;
  });
}

/** How many real (non-gap) samples a resampled series carries. */
function definedCount(values: readonly number[]): number {
  let c = 0;
  for (const v of values) if (Number.isFinite(v)) c++;
  return c;
}

interface ChartInput {
  key: string;
  title: string;
  unit: string;
  color: string;
  group: ChartGroupKey;
  kind: ChartValueKind;
  source: readonly number[] | undefined;
  area?: boolean;
  note?: string;
  transform?: (v: number) => number | null;
}

/**
 * Build every chart the streams can support, in reading order. Charts whose stream is absent — or
 * which resample to fewer than two real points — are simply not returned.
 */
export function buildActivityCharts(
  streams: ActivityStreams,
  sport: SportGroup,
  indices: readonly number[]
): ActivityChartSpec[] {
  const pace = isPaceSport(sport);
  const inputs: ChartInput[] = [
    {
      key: 'heartRate',
      title: 'Tętno',
      unit: 'bpm',
      color: 'var(--lane-red)',
      group: 'effort',
      kind: 'int',
      source: streams.heartRate,
      area: true
    },
    pace
      ? {
          key: 'pace',
          title: 'Tempo',
          unit: 'min/km',
          note: 'Wyżej na wykresie = wolniej.',
          color: 'var(--lane-orange)',
          group: 'effort',
          kind: 'pace',
          source: streams.speed,
          transform: paceFromMps
        }
      : {
          key: 'speed',
          title: 'Prędkość',
          unit: 'km/h',
          color: 'var(--lane-orange)',
          group: 'effort',
          kind: 'decimal',
          source: streams.speed,
          transform: (v) => (v >= 0 ? v * 3.6 : null)
        },
    // Derived, not recorded (spec 042): the flat-ground pace this effort was worth. Only offered for
    // pace sports and only when a grade stream exists, so a flat run never gets a duplicate of its pace
    // chart.
    ...(pace && streams.grade
      ? [
          {
            key: 'gradeAdjustedPace',
            title: 'Tempo skorygowane o nachylenie',
            unit: 'min/km',
            note: 'Tempo, jakie ten wysiłek dałby na płasko. Na podbiegu szybsze od rzeczywistego, na zbiegu wolniejsze.',
            color: 'var(--lane-lime)',
            group: 'effort' as ChartGroupKey,
            kind: 'pace' as ChartValueKind,
            source: gradeAdjustedStream(streams.speed, streams.grade),
            transform: paceFromMps
          }
        ]
      : []),
    {
      key: 'power',
      title: 'Moc',
      unit: 'W',
      color: 'var(--lane-amber)',
      group: 'effort',
      kind: 'int',
      source: streams.power,
      area: true
    },
    {
      key: 'cadence',
      title: 'Kadencja',
      unit: pace ? 'kroki/min' : 'obr./min',
      color: 'var(--lane-violet)',
      group: 'effort',
      kind: 'int',
      source: streams.cadence
    },
    {
      key: 'elevation',
      title: 'Wysokość',
      unit: 'm n.p.m.',
      color: 'var(--lane-green)',
      group: 'terrain',
      kind: 'int',
      source: streams.elevation,
      area: true
    },
    {
      key: 'grade',
      title: 'Nachylenie',
      unit: '%',
      color: 'var(--lane-lime)',
      group: 'terrain',
      kind: 'decimal',
      source: streams.grade
    },
    {
      key: 'temperature',
      title: 'Temperatura',
      unit: '°C',
      color: 'var(--lane-sky)',
      group: 'terrain',
      kind: 'decimal',
      source: streams.temperature
    },
    {
      // Derived, not recorded (spec 038): the cost of each moment rather than of the whole session.
      // Drawn in the physiology group because it is a body measure, not an effort the athlete chose.
      key: 'cardiacCost',
      title: 'Koszt sercowy',
      unit: 'uderzeń/km',
      note: 'Uderzenia serca na kilometr. Niżej = taniej. Rośnie, gdy tętno dryfuje przy tym samym tempie.',
      color: 'var(--lane-red)',
      group: 'physiology',
      kind: 'int',
      source: cardiacCostStream(streams.speed, streams.heartRate)
    },
    {
      key: 'respirationRate',
      title: 'Oddech',
      unit: 'odd./min',
      color: 'var(--lane-teal)',
      group: 'physiology',
      kind: 'decimal',
      source: streams.respirationRate
    },
    {
      key: 'performanceCondition',
      title: 'Kondycja fizyczna',
      unit: 'pkt',
      color: 'var(--lane-cyan)',
      group: 'physiology',
      kind: 'int',
      source: streams.performanceCondition
    },
    {
      key: 'verticalRatio',
      title: 'Stosunek pionowy',
      unit: '%',
      color: 'var(--lane-indigo)',
      group: 'dynamics',
      kind: 'decimal',
      source: streams.verticalRatio
    },
    {
      key: 'verticalOscillation',
      title: 'Oscylacja pionowa',
      unit: 'cm',
      color: 'var(--lane-violet)',
      group: 'dynamics',
      kind: 'decimal',
      source: streams.verticalOscillation
    },
    {
      key: 'groundContactTime',
      title: 'Czas kontaktu z podłożem',
      unit: 'ms',
      color: 'var(--lane-amber)',
      group: 'dynamics',
      kind: 'int',
      source: streams.groundContactTime
    },
    {
      key: 'groundContactBalance',
      title: 'Balans kontaktu z podłożem',
      unit: '% L',
      note: '50% = równo między nogami.',
      color: 'var(--lane-cyan)',
      group: 'dynamics',
      kind: 'decimal',
      source: streams.groundContactBalance
    },
    {
      key: 'strideLength',
      title: 'Długość kroku',
      unit: 'cm',
      color: 'var(--lane-green)',
      group: 'dynamics',
      kind: 'int',
      source: streams.strideLength
    }
  ];

  const charts: ActivityChartSpec[] = [];
  for (const input of inputs) {
    const raw = sampleAt(input.source, indices);
    const values = input.transform
      ? raw.map((v) => (Number.isFinite(v) ? (input.transform!(v) ?? Number.NaN) : Number.NaN))
      : raw;
    if (definedCount(values) < 2) continue;
    charts.push({
      key: input.key,
      title: input.title,
      unit: input.unit,
      ...(input.note === undefined ? {} : { note: input.note }),
      color: input.color,
      group: input.group,
      kind: input.kind,
      values,
      area: input.area ?? false
    });
  }

  const stamina = staminaChart(streams, indices);
  if (stamina) charts.push(stamina);

  return charts;
}

/** Stamina reads as a pair — what is left vs what the day still allows — so it is one two-line chart. */
function staminaChart(streams: ActivityStreams, indices: readonly number[]): ActivityChartSpec | null {
  const current = sampleAt(streams.stamina, indices);
  const potential = sampleAt(streams.staminaPotential, indices);
  const series: ChartSeriesSpec[] = [];
  if (definedCount(current) >= 2)
    series.push({ name: 'Dostępna', values: current, color: 'var(--lane-lime)' });
  if (definedCount(potential) >= 2)
    series.push({ name: 'Potencjalna', values: potential, color: 'var(--lane-teal)' });
  if (series.length === 0) return null;
  return {
    key: 'stamina',
    title: 'Stamina',
    unit: '%',
    color: series[0]!.color,
    group: 'physiology',
    kind: 'int',
    values: [],
    series,
    area: false
  };
}

/**
 * Everything the charts panel needs for one axis choice. Call it again with the other axis to
 * re-lattice; the chart list is identical, only the sampling and the labels change.
 */
export function buildChartSet(
  streams: ActivityStreams,
  sport: SportGroup,
  axis: ChartAxisMode = 'time',
  target = DEFAULT_TARGET_POINTS
): ActivityChartSet {
  const n = streamLength(streams);
  if (n === 0) {
    return {
      axis: 'time',
      indices: [],
      labels: [],
      elapsedS: [],
      distanceM: null,
      canUseDistance: false,
      charts: []
    };
  }

  const elapsed = elapsedSeconds(streams, n);
  const distance = cumulativeDistance(streams, elapsed);
  const canUseDistance = distance !== null;
  const effectiveAxis: ChartAxisMode = axis === 'distance' && canUseDistance ? 'distance' : 'time';
  const indices = latticeOverAxis(effectiveAxis === 'distance' ? distance! : elapsed, target);

  return {
    axis: effectiveAxis,
    indices,
    labels: axisLabels(effectiveAxis, elapsed, distance, indices),
    elapsedS: indices.map((i) => elapsed[i] ?? 0),
    distanceM: distance ? indices.map((i) => distance[i] ?? 0) : null,
    canUseDistance,
    charts: buildActivityCharts(streams, sport, indices)
  };
}

/** X tick labels: `mm:ss`/`h:mm:ss` on a time axis, `x,x km` on a distance axis. */
export function axisLabels(
  axis: ChartAxisMode,
  elapsed: readonly number[],
  distance: readonly number[] | null,
  indices: readonly number[]
): string[] {
  if (axis === 'distance' && distance) {
    return indices.map((i) => `${((distance[i] ?? 0) / 1000).toFixed(1).replace('.', ',')} km`);
  }
  return indices.map((i) => clockLabel(elapsed[i] ?? 0));
}

function clockLabel(seconds: number): string {
  const total = Math.max(0, Math.round(seconds));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const mm = String(m).padStart(2, '0');
  const ss = String(s).padStart(2, '0');
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}
