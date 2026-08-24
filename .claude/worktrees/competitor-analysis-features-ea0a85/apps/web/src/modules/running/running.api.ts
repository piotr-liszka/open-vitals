/**
 * Running (Bieg) data handler (spec 018). Reads only the local store: filters running activities,
 * derives totals / personal bests / weekly mileage (pure) and aggregates HR time-in-zone from the
 * streams of recent runs. Pure over injected deps — no live Garmin.
 */
import type { SettingsRepo } from '$lib/server/repo/types';
import type { LocalStore } from '$lib/server/store/types';
import { hrZones, type ZoneBucket } from '$lib/server/analytics/activity-power';
import {
  personalBests,
  runningTotals,
  type RunSummary,
  type WeekMileage
} from '$lib/server/analytics/running-profile';
import { runnerProfile } from '$lib/server/analytics/runner-profile';
import { monthlyEfficiency, type EfficiencySession } from '$lib/analytics/efficiency';
import { criticalSpeed, mergeSpeedCurves, speedDurationCurve } from '$lib/analytics/pace-model';
import { predictRaces, withPredictionTrend } from '$lib/analytics/race-predictor';
import { knownBestsFrom, trendCutoff } from './race-trend';
import { sportKeysInGroup } from '$lib/sport-labels';
import { lastMonths, monthKeyOf, toDayKey, todayKey } from '$lib/date';
import { DEFAULT_RANGE, resolveRange, type ResolvedRange } from '$lib/range';
import { bucketLattice, bucketStart, volumeBucket } from '$lib/series';
import type { RunningData, RunningRequest } from './running.types';

export interface RunningDeps {
  store: LocalStore;
  settings: SettingsRepo;
  clock: { now(): Date };
}

/** How many recent runs to pull streams for when building the aggregate HR-zone split. */
const HR_STREAM_CAP = 120;
/** Months the aerobic-efficiency trend covers — long enough for a slope, short enough to read. */
export const EFFICIENCY_MONTHS = 24;
/** Recent runs whose speed streams build the speed–duration curve. Bounded like the HR-zone read. */
export const SPEED_STREAM_CAP = 120;

function numberSetting(settings: Record<string, unknown>, key: string): number | null {
  const v = settings[key];
  return typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : null;
}

/** Sum HR-zone buckets across runs (recompute pct on the merged totals). */
function mergeZones(all: ZoneBucket[][]): ZoneBucket[] {
  const secs = new Map<number, { label: string; seconds: number }>();
  for (const buckets of all) {
    for (const b of buckets) {
      const cur = secs.get(b.zone) ?? { label: b.label, seconds: 0 };
      cur.seconds += b.seconds;
      secs.set(b.zone, cur);
    }
  }
  const total = [...secs.values()].reduce((a, b) => a + b.seconds, 0);
  return [...secs.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([zone, v]) => ({
      zone,
      label: v.label,
      seconds: v.seconds,
      pct: total > 0 ? Math.round((v.seconds / total) * 1000) / 10 : 0
    }));
}

/**
 * Mileage per bucket across a resolved range (spec 047) — the range-aware counterpart to
 * `weeklyMileage`, which sized itself to a fixed 12 weeks. Weekly buckets, or monthly once the range
 * is long enough, so "cały czas" charts ~60 columns rather than ~280.
 *
 * An empty bucket is a real zero: a week without a run is 0 km, not missing data.
 */
function mileageBuckets(runs: readonly RunSummary[], range: ResolvedRange): WeekMileage[] {
  const bucket = volumeBucket(range);
  const lattice = bucketLattice(range.start, range.end, bucket);
  const totals = new Map<string, { m: number; runs: number }>();
  for (const r of runs) {
    if (!r.distanceM) continue;
    const key = bucketStart(r.day, bucket);
    const slot = totals.get(key) ?? { m: 0, runs: 0 };
    slot.m += r.distanceM;
    slot.runs += 1;
    totals.set(key, slot);
  }
  return lattice.map((week) => {
    const slot = totals.get(week);
    return { week, km: Math.round(((slot?.m ?? 0) / 1000) * 10) / 10, runs: slot?.runs ?? 0 };
  });
}

export async function loadRunning(deps: RunningDeps, req: RunningRequest): Promise<RunningData> {
  const [runsAll, userSettings] = await Promise.all([
    // Sport family from the shared taxonomy (spec 020), applied IN the store query (spec 025) —
    // this page used to read every activity ever synced and drop the non-runs in memory.
    deps.store.listActivities(req.userId, { sports: sportKeysInGroup('run'), limit: 100000 }),
    deps.settings.get(req.userId)
  ]);

  const runs: RunSummary[] = runsAll.map((a) => ({
    activityId: a.activityId,
    day: toDayKey(a.startTimeLocal),
    distanceM: a.distanceM,
    durationS: a.durationS,
    movingS: a.movingS
  }));

  const today = todayKey(deps.clock);
  const range = req.range ?? resolveRange(DEFAULT_RANGE, today);

  /*
   * What the global range does and does not narrow (spec 047):
   *  - `totals` and `weekly` ARE windowed — "how much did I run" is a question about a period.
   *  - `bests` are NOT: a personal best is over a career, and a windowed "PB" is a different claim.
   *  - `profile` is NOT: the archetype carries its own multi-week window by design (spec 033), and it
   *    needs enough history to place a runner at all.
   */
  const windowRuns = runs.filter((r) => r.day >= range.start && r.day <= range.end);
  const totals = runningTotals(windowRuns);
  /*
   * Even-pace projections over whole runs. Since spec 054 these are NO LONGER SHOWN as records — the
   * page's "Rekordy życiowe" card now comes from real stored best efforts. They stay here for two
   * consumers: the runner archetype (spec 033) scores endurance from them, and since spec 057 they are
   * the race predictor's per-distance FALLBACK for anyone whose efforts backfill has not landed yet.
   */
  const bests = personalBests(runs);
  const weekly = mileageBuckets(windowRuns, range);
  // No extra store read: the profile is derived from the same run array (spec 033).
  const profile = runnerProfile(runs, { today });

  // Nor does the efficiency trend need one (spec 038) — EF and cardiac cost both fall out of the
  // summary, so a two-year trend costs nothing beyond the activity read already done above.
  const efficiencySessions: EfficiencySession[] = runsAll.map((a) => ({
    day: toDayKey(a.startTimeLocal),
    distanceM: a.distanceM,
    durationS: a.movingS ?? a.durationS,
    avgHr: a.avgHr
  }));
  const efficiency = monthlyEfficiency(efficiencySessions, lastMonths(monthKeyOf(today), EFFICIENCY_MONTHS));

  // Max HR: explicit setting, else the highest observed max/avg HR across runs.
  const maxHr =
    numberSetting(userSettings, 'maxHrBpm') ??
    runsAll.reduce<number | null>((m, a) => Math.max(m ?? 0, a.maxHr ?? a.avgHr ?? 0) || null, null);

  // Aggregate HR zones from the most recent runs' streams (bounded to keep the read cheap).
  let hrZoneBuckets: ZoneBucket[] = [];
  if (maxHr) {
    const windowIds = new Set(windowRuns.map((r) => r.activityId));
    const recent = runsAll
      .filter((a) => windowIds.has(a.activityId))
      .sort((a, b) => (a.startTimeLocal < b.startTimeLocal ? 1 : -1))
      .slice(0, HR_STREAM_CAP);
    // One batched HR-only query (no full blobs). Zones use a 1 Hz assumption (no time stream loaded);
    // the aggregate split is unaffected in practice.
    const hrById = await deps.store.getStreamField(
      req.userId,
      recent.map((a) => a.activityId),
      'heartRate'
    );
    const perRun = recent.map((a) => {
      const hr = hrById.get(a.activityId);
      return hr && hr.length > 0 ? hrZones(hr, maxHr) : [];
    });
    hrZoneBuckets = mergeZones(perRun.filter((z) => z.length > 0));
  }

  /*
   * The athlete's speed–duration curve (spec 042): the running twin of the power curve. One batched
   * speed-only read over the same bounded set of recent runs the HR zones use, then the ENVELOPE across
   * them — one session shows a day's shape, the envelope shows the runner.
   *
   * The 1 Hz assumption is the same one the zone split already makes: no time stream is loaded, so a
   * sample is taken to be a second. A watch recording every 4 s would place the short end of the curve
   * too optimistically, which is why the view says the curve comes from recent runs rather than quoting it
   * as a test result.
   */
  const curveRuns = [...runsAll]
    .sort((a, b) => (a.startTimeLocal < b.startTimeLocal ? 1 : -1))
    .slice(0, SPEED_STREAM_CAP);
  const speedById = await deps.store.getStreamField(
    req.userId,
    curveRuns.map((a) => a.activityId),
    'speed'
  );
  const speedCurve = mergeSpeedCurves(
    curveRuns.flatMap((a) => {
      const speed = speedById.get(a.activityId);
      return speed && speed.length > 0 ? [speedDurationCurve(speed)] : [];
    })
  );
  const critical = criticalSpeed(speedCurve);

  /*
   * Race predictions (spec 043) from BOTH methods, because they rest on different assumptions: Riegel
   * extrapolates the athlete's own bests, critical speed comes from the curve above. Where they agree the
   * number means something; where they diverge, that divergence is the finding.
   *
   * Since spec 057 Riegel eats REAL measured efforts (spec 054's stored table) wherever the athlete has
   * one, and falls back per distance to the even-pace projections above. Two indexed reads, no streams:
   * the all-time podium and the same podium as it stood at the cutoff. `limit: 1` because the predictor
   * only ever uses the fastest effort per distance.
   */
  const cutoff = trendCutoff(today);
  const runSports = sportKeysInGroup('run');
  const [effortsNow, effortsThen] = await Promise.all([
    deps.store.listTopBestEfforts(req.userId, { limit: 1, sports: runSports }),
    deps.store.listTopBestEfforts(req.userId, { limit: 1, sports: runSports, until: cutoff })
  ]);

  const currentPredictions = predictRaces(knownBestsFrom(effortsNow, bests), {
    csMps: critical?.speedMps ?? null,
    dPrimeM: critical?.dPrimeM ?? null
  });
  /*
   * The as-of half: the SAME engine over only what existed on or before the cutoff, which is what makes
   * the badge a recomputation rather than a stored guess. Deliberately without a critical speed — the
   * past curve would need up to SPEED_STREAM_CAP speed streams re-read for the runs that existed then,
   * doubling the heaviest read on this page for a number the trend does not use anyway (spec 057).
   */
  const previousPredictions = predictRaces(
    knownBestsFrom(effortsThen, personalBests(runs.filter((r) => r.day <= cutoff)))
  );
  const predictions = withPredictionTrend(currentPredictions, previousPredictions, cutoff);

  return {
    range,
    totals,
    weekly,
    efficiency,
    speedCurve,
    criticalSpeed: critical,
    predictions,
    hrZones: hrZoneBuckets,
    maxHr,
    profile,
    // "Do I have runs at all" is an all-time question — a range with no runs is an empty window, not
    // an empty account, and the view needs to tell those apart.
    hasData: runs.length > 0,
    hasWindowData: windowRuns.length > 0
  };
}
