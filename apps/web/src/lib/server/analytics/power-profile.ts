/**
 * Power profile (PWRX §5). PURE compute over resolved local power streams — no I/O, no clock. The
 * module handler resolves each activity's power stream from the LocalStore and hands them here.
 *
 * Produces: a mean-max best-power curve aggregated across activities, all-time bests (with the
 * source activity + date), per-year curves, an FTP estimate (0.95 × 20-min best) + Coggan zones,
 * and a rider-type radar (W/kg on five signature durations). Degrades gracefully with no power.
 */
import { createTranslator, DEFAULT_LOCALE, type Translator } from '$lib/i18n';

/** Fallback translator (Polish) for the ~90 non-web callers that predate spec 076's locale threading. */
const DEFAULT_TRANSLATOR = createTranslator(DEFAULT_LOCALE);

/** Standard mean-max durations in seconds (5 s … 2 h). */
export const STANDARD_DURATIONS: readonly number[] = [
  1, 5, 10, 15, 30, 60, 120, 180, 300, 480, 600, 900, 1200, 1800, 2700, 3600, 5400, 7200
];

export interface PowerCurvePoint {
  readonly durationS: number;
  readonly watts: number;
}

export interface BestPowerEntry {
  readonly durationS: number;
  readonly watts: number;
  readonly wattsPerKg: number | null;
  readonly activityId: string | null;
  /** Local day `YYYY-MM-DD` of the activity that set this best. */
  readonly day: string | null;
}

export interface YearCurve {
  readonly year: number;
  readonly activityCount: number;
  readonly points: PowerCurvePoint[];
}

export type RiderAxisKey = 'sprint' | 'punch' | 'climb' | 'tt' | 'endurance';

export interface RiderAxis {
  readonly key: RiderAxisKey;
  readonly label: string;
  readonly durationS: number;
  readonly watts: number;
  readonly wattsPerKg: number | null;
}

export interface PowerZone {
  readonly zone: number;
  readonly name: string;
  readonly minPct: number;
  /** Upper bound as a fraction of FTP, or null for the open-ended top zone. */
  readonly maxPct: number | null;
  readonly minW: number;
  readonly maxW: number | null;
}

export interface PowerProfile {
  readonly hasPower: boolean;
  readonly durations: number[];
  /** All-time best per duration (aggregated across every activity). */
  readonly bests: BestPowerEntry[];
  readonly allTimeCurve: PowerCurvePoint[];
  readonly yearCurves: YearCurve[];
  readonly years: number[];
  readonly ftpWatts: number | null;
  readonly ftpWattsPerKg: number | null;
  readonly ftpSource: 'settings' | 'estimated' | null;
  readonly best20MinWatts: number | null;
  readonly best60MinWatts: number | null;
  readonly zones: PowerZone[];
  readonly radar: RiderAxis[];
  readonly weightKg: number | null;
}

/** One activity reduced to its power stream + provenance. */
export interface PowerActivity {
  readonly activityId: string;
  /** Local day `YYYY-MM-DD`. */
  readonly day: string;
  /** Power samples (assumed ~1 Hz), or null when the activity has no power. */
  readonly power: number[] | null;
}

export interface PowerProfileOptions {
  readonly weightKg: number | null;
  /** FTP from user settings; when present it wins over the 20-min estimate. */
  readonly ftpOverride?: number | null;
  readonly durations?: readonly number[];
  /**
   * The reader's translator (spec 076). Optional so every non-web caller (tests, MCP tools) keeps
   * compiling and behaving unchanged, defaulting to the Polish catalog — the same fallback
   * `createTranslator` itself uses. Only the real web route passes the actual locale.
   */
  readonly t?: Translator;
}

/** Best average power sustained for `durationS` seconds within a single stream (null if too short). */
export function bestAverageForDuration(power: number[], durationS: number): number | null {
  const n = power.length;
  if (durationS <= 0 || n < durationS) return null;
  // Prefix sums for O(n) sliding window.
  const prefix = new Array<number>(n + 1);
  prefix[0] = 0;
  for (let i = 0; i < n; i++) prefix[i + 1] = prefix[i]! + (Number.isFinite(power[i]) ? power[i]! : 0);
  let best = -Infinity;
  for (let i = durationS; i <= n; i++) {
    const avg = (prefix[i]! - prefix[i - durationS]!) / durationS;
    if (avg > best) best = avg;
  }
  return best === -Infinity ? null : best;
}

const yearOf = (day: string): number => Number(day.slice(0, 4));

const ROUND = (n: number): number => Math.round(n);

function curveFor(activities: PowerActivity[], durations: readonly number[]): PowerCurvePoint[] {
  const points: PowerCurvePoint[] = [];
  for (const d of durations) {
    let best = -Infinity;
    for (const a of activities) {
      if (!a.power || a.power.length < d) continue;
      const avg = bestAverageForDuration(a.power, d);
      if (avg != null && avg > best) best = avg;
    }
    if (best > -Infinity) points.push({ durationS: d, watts: ROUND(best) });
  }
  return points;
}

/** Built per-call from a `Translator` (spec 076) so the radar's spoke labels render in the reader's locale. */
function riderAxesFor(t: Translator): ReadonlyArray<{ key: RiderAxisKey; label: string; durationS: number }> {
  return [
    { key: 'sprint', label: t('powerProfile.rider.sprint'), durationS: 5 },
    { key: 'punch', label: t('powerProfile.rider.punch'), durationS: 60 },
    { key: 'climb', label: t('powerProfile.rider.climb'), durationS: 300 },
    { key: 'tt', label: t('powerProfile.rider.tt'), durationS: 1200 },
    { key: 'endurance', label: t('powerProfile.rider.endurance'), durationS: 3600 }
  ];
}

function zonesFromFtp(ftp: number, t: Translator): PowerZone[] {
  const spec: ReadonlyArray<{ zone: number; name: string; minPct: number; maxPct: number | null }> = [
    { zone: 1, name: t('powerProfile.zone.recovery'), minPct: 0, maxPct: 0.55 },
    { zone: 2, name: t('powerProfile.zone.endurance'), minPct: 0.56, maxPct: 0.75 },
    { zone: 3, name: t('powerProfile.zone.tempo'), minPct: 0.76, maxPct: 0.9 },
    { zone: 4, name: t('powerProfile.zone.threshold'), minPct: 0.91, maxPct: 1.05 },
    { zone: 5, name: t('powerProfile.zone.vo2max'), minPct: 1.06, maxPct: 1.2 },
    { zone: 6, name: t('powerProfile.zone.anaerobic'), minPct: 1.21, maxPct: 1.5 },
    { zone: 7, name: t('powerProfile.zone.neuromuscular'), minPct: 1.51, maxPct: null }
  ];
  return spec.map((z) => ({
    ...z,
    minW: ROUND(z.minPct * ftp),
    maxW: z.maxPct == null ? null : ROUND(z.maxPct * ftp)
  }));
}

/** Build the whole power profile. Returns an empty-but-valid shape when no activity has power. */
export function buildPowerProfile(activities: PowerActivity[], opts: PowerProfileOptions): PowerProfile {
  const t = opts.t ?? DEFAULT_TRANSLATOR;
  const durations = [...(opts.durations ?? STANDARD_DURATIONS)];
  const weightKg = opts.weightKg ?? null;
  const withPower = activities.filter(
    (a): a is PowerActivity & { power: number[] } => Array.isArray(a.power) && a.power.length > 0
  );

  const wkg = (w: number | null): number | null =>
    w != null && weightKg != null && weightKg > 0 ? Math.round((w / weightKg) * 100) / 100 : null;

  if (withPower.length === 0) {
    return {
      hasPower: false,
      durations,
      bests: [],
      allTimeCurve: [],
      yearCurves: [],
      years: [],
      ftpWatts: opts.ftpOverride ?? null,
      ftpWattsPerKg: wkg(opts.ftpOverride ?? null),
      ftpSource: opts.ftpOverride != null ? 'settings' : null,
      best20MinWatts: null,
      best60MinWatts: null,
      zones: opts.ftpOverride != null ? zonesFromFtp(opts.ftpOverride, t) : [],
      radar: [],
      weightKg
    };
  }

  // All-time bests per duration, tracking the activity that set each.
  const bests: BestPowerEntry[] = [];
  for (const d of durations) {
    let bestW = -Infinity;
    let bestAct: PowerActivity | null = null;
    for (const a of withPower) {
      const avg = bestAverageForDuration(a.power, d);
      if (avg != null && avg > bestW) {
        bestW = avg;
        bestAct = a;
      }
    }
    if (bestW > -Infinity && bestAct) {
      const watts = ROUND(bestW);
      bests.push({
        durationS: d,
        watts,
        wattsPerKg: wkg(watts),
        activityId: bestAct.activityId,
        day: bestAct.day
      });
    }
  }

  const allTimeCurve: PowerCurvePoint[] = bests.map((b) => ({ durationS: b.durationS, watts: b.watts }));

  const bestAt = (d: number): number | null => bests.find((b) => b.durationS === d)?.watts ?? null;
  const best20MinWatts = bestAt(1200);
  const best60MinWatts = bestAt(3600);

  const ftpEstimate = best20MinWatts != null ? ROUND(0.95 * best20MinWatts) : null;
  const ftpWatts = opts.ftpOverride ?? ftpEstimate;
  const ftpSource: PowerProfile['ftpSource'] =
    opts.ftpOverride != null ? 'settings' : ftpEstimate != null ? 'estimated' : null;

  // Per-year curves.
  const byYear = new Map<number, PowerActivity[]>();
  for (const a of withPower) {
    const y = yearOf(a.day);
    const list = byYear.get(y);
    if (list) list.push(a);
    else byYear.set(y, [a]);
  }
  const years = [...byYear.keys()].sort((x, y) => y - x);
  const yearCurves: YearCurve[] = years.map((year) => ({
    year,
    activityCount: byYear.get(year)!.length,
    points: curveFor(byYear.get(year)!, durations)
  }));

  const radar: RiderAxis[] = riderAxesFor(t).map((axis) => {
    const watts = bestAt(axis.durationS) ?? 0;
    return { key: axis.key, label: axis.label, durationS: axis.durationS, watts, wattsPerKg: wkg(watts) };
  });

  return {
    hasPower: true,
    durations,
    bests,
    allTimeCurve,
    yearCurves,
    years,
    ftpWatts,
    ftpWattsPerKg: wkg(ftpWatts),
    ftpSource,
    best20MinWatts,
    best60MinWatts,
    zones: ftpWatts != null ? zonesFromFtp(ftpWatts, t) : [],
    radar,
    weightKg
  };
}
