/**
 * Dashboard data handler (spec 010): composes today's snapshot with the windowed
 * multi-day trends into design-system-ready tiles. Pure over the injected container.
 *
 * Garmin payload field names are not fully confirmed (the sidecar marks them as assumptions), so
 * each extractor tries a few candidate keys and degrades to null rather than throwing — the tile
 * then renders "—" instead of breaking the page.
 */
import type { Clock } from '$lib/server/clock';
import { DEFAULT_TIME_ZONE, dayRange, todayKey } from '$lib/date';
import { DEFAULT_RANGE, resolveRange, type ResolvedRange } from '$lib/range';
import { bucketSeries } from '$lib/series';
import {
  GarminNotAuthenticatedError,
  GarminUnavailableError,
  type GarminMetricName,
  type GarminService
} from '$lib/server/interfaces';
import { extractMetricValue, maxOfArray } from '$lib/server/garmin/metric-specs';
import { formatMetricValue, type MetricFormat } from './dashboard.format';
import type { DashboardData, Lane, MetricTile } from './dashboard.types';

/** Per-user dependencies for the dashboard loader (spec 012). */
export interface DashboardDeps {
  garmin: GarminService;
  clock: Clock;
  /** IANA zone "today" resolves in (spec 018). Defaults to the app timezone. */
  timeZone?: string;
}

/** Caller-chosen view options (spec 028, globalised in spec 047). */
export interface DashboardOptions {
  /**
   * The global range to build the trend series over, already resolved against the user's today and
   * their earliest synced day (`$lib/server/range-context`). Defaults to the default window, so a
   * caller that does not care (tests, the MCP path) needs no range at all.
   */
  range?: ResolvedRange;
}

interface TileSpec {
  key: GarminMetricName;
  label: string;
  accent: Lane;
  unit: string;
  format: MetricFormat;
  /** Which direction is healthy for this metric. */
  goodWhen: 'up' | 'down';
  /** Candidate paths within the metric's `data` payload, most-preferred first (flat or dotted). */
  keys: string[];
  /** Custom reducer for array-shaped payloads (Body Battery); takes precedence over `keys`. */
  extract?: (data: Record<string, unknown>) => number | null;
}

const SNAPSHOT: TileSpec[] = [
  {
    key: 'steps',
    label: 'Kroki',
    accent: 'orange',
    unit: '',
    format: 'int',
    goodWhen: 'up',
    keys: ['totalSteps']
  },
  {
    key: 'resting_heart_rate',
    label: 'Tętno spoczynkowe',
    accent: 'red',
    unit: 'bpm',
    format: 'int',
    goodWhen: 'down',
    keys: ['restingHeartRate']
  },
  {
    key: 'body_battery',
    label: 'Body Battery',
    accent: 'cyan',
    unit: '',
    format: 'int',
    goodWhen: 'up',
    keys: [],
    extract: (data) => maxOfArray(data['bodyBatteryValuesArray'], 2)
  },
  {
    key: 'sleep',
    label: 'Sen',
    accent: 'indigo',
    unit: '',
    format: 'duration',
    goodWhen: 'up',
    keys: ['dailySleepDTO.sleepTimeSeconds']
  },
  {
    key: 'hrv',
    label: 'HRV',
    accent: 'green',
    unit: 'ms',
    format: 'int',
    goodWhen: 'up',
    keys: ['hrvSummary.lastNightAvg', 'hrvSummary.weeklyAvg']
  },
  {
    key: 'stress',
    label: 'Stres',
    accent: 'amber',
    unit: '',
    format: 'int',
    goodWhen: 'down',
    keys: ['avgStressLevel']
  }
];

/**
 * Percent change between the first and last day that actually HAVE data (spec 028). Reading the raw
 * array ends is what made the old delta meaningless: with gaps, `series[0]` could be a `null` slot or
 * a day from the wrong end of the window.
 */
function deltaPct(series: (number | null)[]): number | null {
  const defined = series.filter((v): v is number => v !== null);
  if (defined.length < 2) return null;
  const first = defined[0]!;
  const last = defined[defined.length - 1]!;
  if (first === 0) return null;
  return Math.round(((last - first) / Math.abs(first)) * 100);
}

/** Newest value in the window, or null when the whole window is empty. */
function headlineOf(series: (number | null)[]): number | null {
  for (let i = series.length - 1; i >= 0; i--) {
    const v = series[i];
    if (v !== null && v !== undefined) return v;
  }
  return null;
}

async function buildTile(
  garmin: GarminService,
  spec: TileSpec,
  range: ResolvedRange,
  /** The window's full day lattice, oldest → newest — one slot per calendar day. */
  dayLattice: string[]
): Promise<MetricTile> {
  const base: MetricTile = {
    key: spec.key,
    label: spec.label,
    accent: spec.accent,
    value: null,
    unit: spec.unit,
    delta: null,
    goodWhen: spec.goodWhen,
    format: spec.format,
    series: []
  };
  try {
    const read = await garmin.getMetricRange(spec.key, range.start, range.end);
    // Index BY DAY KEY, never by array position: the store/sidecar may return fewer days than the
    // window asked for, and a positional map would then slide every value onto the wrong date.
    const byDay = new Map<string, number>();
    for (const d of read.days) {
      const value = extractMetricValue(spec, d.data);
      if (value !== null) byDay.set(d.date, value);
    }
    const daily = dayLattice.map((day) => byDay.get(day) ?? null);
    /*
     * Bucket for the CHART only, and always by mean — a year of daily points is unreadable and a
     * weekly *sum* of steps would sit on a different scale from the headline right above it. The
     * headline stays the newest single reading, so the tile reads "here is now, here is the shape
     * of the window"; the delta reads the bucketed ends, which is the whole reason to smooth.
     */
    const series = bucketSeries(dayLattice, daily, range.bucket, 'mean').values;
    return {
      ...base,
      value: formatMetricValue(headlineOf(daily), spec.format),
      series,
      delta: deltaPct(series)
    };
  } catch (err) {
    // A single flaky metric must not blank the whole dashboard.
    if (err instanceof GarminUnavailableError || err instanceof GarminNotAuthenticatedError) return base;
    throw err;
  }
}

export async function loadDashboard(
  deps: DashboardDeps,
  opts: DashboardOptions = {}
): Promise<DashboardData> {
  const { garmin, clock, timeZone = DEFAULT_TIME_ZONE } = deps;
  // "Today" is the user's local day, not UTC: before 02:00 local a UTC day key still says yesterday.
  const today = todayKey(clock, timeZone);
  const range = opts.range ?? resolveRange(DEFAULT_RANGE, today);
  // The window's day lattice — every tile's raw series is indexed against it, so a gap stays on its
  // own day before any bucketing happens.
  const dayLattice = dayRange(range.start, range.end);
  // What the CHART's x axis is: one key per bucket. Identical to the lattice for a daily range.
  const days = bucketSeries(dayLattice, [], range.bucket).days;

  let connected = false;
  try {
    connected = (await garmin.getStatus()).authenticated;
  } catch (err) {
    if (!(err instanceof GarminUnavailableError)) throw err;
  }

  if (!connected) {
    return { connected: false, date: today, range, days, tiles: [] };
  }

  const tiles = await Promise.all(SNAPSHOT.map((spec) => buildTile(garmin, spec, range, dayLattice)));
  return { connected: true, date: today, range, days, tiles };
}
