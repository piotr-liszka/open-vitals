/**
 * Activity-detail handler (PWRX §2). Reads the summary + streams from the local store, then computes
 * the mean-max curve, NP/IF/TSS and power/HR zones with the pure analytics functions. Pure over an
 * injected `LocalStore` + `SettingsRepo` — no live Garmin call.
 *
 * FTP resolution: prefer the user's stored `ftpWatts`; otherwise estimate from the 20-minute best in
 * the curve; if neither is available, FTP-dependent widgets (IF, TSS, power zones) degrade to null/
 * empty while NP, the curve and kJ still render. When there is no power stream at all, `power` is null.
 */
import type { LocalStore } from '$lib/server/store/types';
import type { SettingsRepo } from '$lib/server/repo/types';
import {
  estimateFtpFromCurve,
  hrZones,
  intensityFactor,
  meanMaxCurve,
  normalizedPower,
  powerZones,
  sampleIntervalS,
  totalWorkKj,
  trainingStressScore
} from '$lib/server/analytics/activity-power';
import {
  extractActivityStats,
  runWalkFromSplits,
  streamAverage,
  type ActivityStats
} from '$lib/server/analytics/activity-stats';
import type {
  ActivityLap,
  ActivitySummary,
  ActivityStreams,
  AuthoredWorkout,
  PlannedEvent
} from '$lib/server/store/types';
import { addDays, isDayKey } from '$lib/date';
import { estimateWorkoutDistanceM, estimateWorkoutDurationS } from '$lib/workouts';
import { sportGroup, sportKeysInGroup } from '$lib/sport-labels';
import {
  buildTrainingComparison,
  HISTORY_WINDOW_DAYS,
  type ComparableActivity,
  type PlannedInput
} from './activity-comparison';
import {
  alignPlannedStructure,
  flattenWorkoutSteps,
  matchPlanned,
  type PlannedCandidate
} from './activity-plan';
import { buildHighlights, buildSuspects, type HighlightActivity } from './activity-highlights';
import { findSimilarActivities, type SimilarActivities, type SimilarCandidate } from './similar-activities';
import {
  aerobicDecoupling,
  cardiacCost,
  efficiencyFactor,
  powerEfficiencyFactor
} from '$lib/analytics/efficiency';
import { bestEfforts } from '$lib/analytics/best-efforts';
import { decimate, matchRoutes, routeFingerprint, type RouteCandidate } from '$lib/analytics/route-match';
import { meanGradeAdjustedSpeed } from '$lib/analytics/pace-model';
import { pacing } from '$lib/analytics/pacing';
import { findClimbs } from '$lib/analytics/climbs';
import { cumulativeDistance, elapsedSeconds, isPaceSport, streamLength } from './activity-charts';
import type {
  ActivityDetailData,
  EfficiencyBlock,
  HrBlock,
  MatchedRoute,
  MatchedRouteEntry,
  PowerBlock
} from './activity-detail.types';

export interface ActivityDetailDeps {
  store: LocalStore;
  settings: SettingsRepo;
}

/** Narrow an untrusted settings bag value to a positive finite number, else null. */
function positiveNumber(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : null;
}

const meanOf = (xs: readonly number[]): number | null =>
  xs.length === 0 ? null : Math.round(xs.reduce((s, x) => s + x, 0) / xs.length);
const maxOf = (xs: readonly number[]): number | null =>
  xs.length === 0 ? null : Math.round(Math.max(...xs));

/** Duration (seconds) for TSS: prefer the summary, fall back to the stream span. */
function effectiveDuration(
  summaryDuration: number | null,
  power: number[] | undefined,
  time: number[] | undefined
): number | null {
  if (summaryDuration && summaryDuration > 0) return summaryDuration;
  if (time && time.length >= 2) return time[time.length - 1]! - time[0]!;
  if (power && power.length > 0) return power.length * sampleIntervalS(time);
  return null;
}

/**
 * Fill the gaps the summary payload leaves using the stored streams/laps:
 *  - run/walk/standing seconds come ONLY from Garmin's typed splits;
 *  - average temperature is not in the activity list payload, but the temperature stream has it;
 *  - grade-adjusted pace is not in the payload AT ALL — Garmin does not compute it (spec 023's closeout
 *    said so). Since spec 042 we derive it from the speed and grade streams, which turns that row from a
 *    documented absence into a real number wherever a grade stream exists.
 * Everything read from the summary wins; this only adds what was missing.
 */
function withStreamFallbacks(
  stats: ActivityStats,
  streams: ActivityStreams | null,
  typedSplits: readonly ActivityLap[],
  elapsedS?: readonly number[]
): ActivityStats {
  const runWalk = runWalkFromSplits(typedSplits);
  const avgC = stats.temperature.avgC ?? streamAverage(streams?.temperature);
  const gapSpeed = meanGradeAdjustedSpeed(streams?.speed, streams?.grade, elapsedS);
  const gradeAdjustedSecPerKm =
    stats.pace.gradeAdjustedSecPerKm ??
    (gapSpeed !== null && gapSpeed > 0 ? Math.round(1000 / gapSpeed) : undefined);
  return {
    ...stats,
    ...(Object.keys(runWalk).length > 0 ? { runWalk } : {}),
    ...(avgC === undefined ? {} : { temperature: { ...stats.temperature, avgC } }),
    ...(gradeAdjustedSecPerKm === undefined ? {} : { pace: { ...stats.pace, gradeAdjustedSecPerKm } })
  };
}

/**
 * Average moving pace in seconds per kilometre — the actual behind a plan's `pace` band (spec 085).
 * `null` unless both axes are real and positive, so a strength session never gets a pace.
 */
function averagePaceSecPerKm(distanceM: number | null, movingS: number | null): number | null {
  if (distanceM === null || movingS === null) return null;
  if (!Number.isFinite(distanceM) || !Number.isFinite(movingS)) return null;
  if (distanceM <= 0 || movingS <= 0) return null;
  return Math.round(movingS / (distanceM / 1000));
}

/** The activity day as Garmin recorded it locally — `YYYY-MM-DD`, no timezone maths needed. */
function localDay(startTimeLocal: string): string {
  return startTimeLocal.slice(0, 10);
}

const comparable = (a: ActivitySummary): ComparableActivity => ({
  day: localDay(a.startTimeLocal),
  durationS: a.movingS ?? a.durationS,
  trainingLoad: a.trainingLoad,
  avgHr: a.avgHr,
  maxHr: a.maxHr
});

const forHighlights = (a: ActivitySummary): HighlightActivity => ({
  day: localDay(a.startTimeLocal),
  distanceM: a.distanceM,
  durationS: a.movingS ?? a.durationS,
  elevationGainM: a.elevationGainM,
  calories: a.calories,
  trainingLoad: a.trainingLoad,
  normPower: a.normPower
});

/**
 * Earlier sessions of the same family this one may be ranked against (spec 036). Bounded, and the
 * bound is the honesty signal: coming back with fewer rows than `HIGHLIGHT_LIMIT` is exactly what
 * proves the read reached the athlete's first comparable session, which is the only case in which a
 * superlative may be claimed. No second COUNT query needed.
 */
export const HIGHLIGHT_LIMIT = 2000;

interface HistoryReads {
  /** The recent window the training verdict is scored against (spec 026). */
  readonly comparable: ComparableActivity[];
  /** Everything we hold before this session, for ranking (spec 036). */
  readonly rankable: HighlightActivity[];
  readonly coversAllHistory: boolean;
}

/**
 * ONE store read serves both consumers. Rows come back newest-first, so the wide read always
 * contains the verdict's narrow window; slicing it in memory is free next to a second query.
 *
 * Bulk `listActivities` omits the heavy `raw` blob in both adapters, which is what makes reading
 * years of summaries here cheap enough to do on a detail page.
 */
async function loadHistory(
  deps: ActivityDetailDeps,
  userId: string,
  activity: ActivitySummary
): Promise<HistoryReads> {
  const day = localDay(activity.startTimeLocal);
  const family = sportGroup(activity.sport);
  // Push the family filter into the store where it is exhaustive. `other` cannot be enumerated (an
  // unmapped Garmin key groups there), so that family is read wide and filtered below instead.
  const sports = family === 'other' ? [] : sportKeysInGroup(family);
  const rows = await deps.store.listActivities(userId, {
    to: day,
    limit: HIGHLIGHT_LIMIT,
    ...(sports.length > 0 ? { sports } : {})
  });
  const earlier = rows.filter((a) => a.activityId !== activity.activityId && sportGroup(a.sport) === family);
  const windowStart = addDays(day, -HISTORY_WINDOW_DAYS);
  return {
    comparable: earlier.filter((a) => localDay(a.startTimeLocal) >= windowStart).map(comparable),
    rankable: earlier.map(forHighlights),
    coversAllHistory: rows.length < HIGHLIGHT_LIMIT
  };
}

/**
 * How many same-family sessions the similar-effort search examines (spec 065). Bounded like
 * `HIGHLIGHT_LIMIT`, and reported the same way: a read that came back under its own bound is the proof
 * it saw the athlete's whole history, so `coversAllHistory` costs no second query.
 */
export const SIMILAR_SCAN_LIMIT = 2000;

/** Reduce a stored summary to what effort-matching and its table need. */
const forSimilar = (a: ActivitySummary): SimilarCandidate => ({
  activityId: a.activityId,
  day: localDay(a.startTimeLocal),
  name: a.name,
  distanceM: a.distanceM,
  durationS: a.movingS ?? a.durationS,
  avgHr: a.avgHr,
  avgPower: a.avgPower,
  elevationGainM: a.elevationGainM
});

/**
 * Sessions at a comparable distance AND duration (spec 065).
 *
 * Reads BOTH directions in time, unlike `loadHistory`. Spec 036's ranking is "best up to this point"
 * and must not see the future; "what is this comparable to" has no such constraint — opening a ride
 * from March should show the same June rides that June shows from March, or the two pages would
 * contradict each other.
 */
async function loadSimilarActivities(
  deps: ActivityDetailDeps,
  userId: string,
  activity: ActivitySummary
): Promise<SimilarActivities | null> {
  const family = sportGroup(activity.sport);
  // Same as `loadHistory`: push the family filter into the store where it is exhaustive, and read
  // `other` wide because an unmapped Garmin key cannot be enumerated.
  const sports = family === 'other' ? [] : sportKeysInGroup(family);
  const rows = await deps.store.listActivities(userId, {
    limit: SIMILAR_SCAN_LIMIT,
    ...(sports.length > 0 ? { sports } : {})
  });

  const candidates = rows.filter((a) => sportGroup(a.sport) === family).map(forSimilar);
  return findSimilarActivities(forSimilar(activity), candidates, {
    coversAllHistory: rows.length < SIMILAR_SCAN_LIMIT
  });
}

/**
 * Every sample this far apart is kept when fingerprinting a candidate track (spec 041). At 50 m cells a
 * 1 Hz recording is wildly over-sampled; thinning it cuts the haversine work per candidate by 4× and,
 * as the engine's tests show, leaves the cell set intact.
 */
const ROUTE_DECIMATION = 4;

/**
 * Earlier outings on the same route (spec 041), plus this activity's placing among them.
 *
 * ## The cost, stated
 *
 * This reads EVERY stored GPS track of the same sport family and fingerprints it — the same read the
 * heat map already does. It is affordable because `listGpsTracks` touches only the stream rows and each
 * candidate is decimated before any haversine runs, but it is linear in the athlete's history and it is
 * the first thing to move if this page ever slows down. The right fix is a `route_key` computed once at
 * sync time; that needs a schema change, so it is a spec of its own.
 */
async function loadMatchedRoute(
  deps: ActivityDetailDeps,
  userId: string,
  activity: ActivitySummary,
  track: NonNullable<ActivityStreams['gps']> | null
): Promise<MatchedRoute | null> {
  if (!track) return null;
  const target = routeFingerprint(decimate(track, ROUTE_DECIMATION));
  if (!target) return null;

  const family = sportGroup(activity.sport);
  const tracks = await deps.store.listGpsTracks(userId);

  const candidates: RouteCandidate<{ id: string; day: string }>[] = [];
  for (const t of tracks) {
    if (t.activityId === activity.activityId) continue;
    if (sportGroup(t.sport) !== family) continue;
    const fingerprint = routeFingerprint(decimate(t.gps ?? [], ROUTE_DECIMATION));
    if (!fingerprint) continue;
    candidates.push({
      value: { id: t.activityId, day: localDay(t.startTimeLocal) },
      fingerprint
    });
  }

  const matches = matchRoutes(target, candidates);
  if (matches.length === 0) return null;

  // Only now go back for the summaries — one bounded read for the matched ids, not for every candidate.
  const summaries = await Promise.all(matches.map((m) => deps.store.getActivity(userId, m.value.id)));
  const similarityById = new Map(matches.map((m) => [m.value.id, m.similarity]));

  interface Row {
    readonly activityId: string;
    readonly day: string;
    readonly name: string | null;
    readonly distanceM: number | null;
    readonly durationS: number | null;
    readonly avgHr: number | null;
    readonly paceSecPerKm: number | null;
    readonly similarity: number;
    readonly isCurrent: boolean;
  }

  const rowOf = (a: ActivitySummary, similarity: number, isCurrent: boolean): Row => {
    const durationS = a.movingS ?? a.durationS;
    return {
      activityId: a.activityId,
      day: localDay(a.startTimeLocal),
      name: a.name,
      distanceM: a.distanceM,
      durationS,
      avgHr: a.avgHr,
      paceSecPerKm:
        a.distanceM !== null && a.distanceM > 0 && durationS !== null && durationS > 0
          ? Math.round(durationS / (a.distanceM / 1000))
          : null,
      similarity,
      isCurrent
    };
  };

  const rows: Row[] = [rowOf(activity, 1, true)];
  for (const s of summaries) {
    if (!s) continue;
    rows.push(rowOf(s, similarityById.get(s.activityId) ?? 0, false));
  }

  // Fastest first; an outing with no comparable pace sinks to the bottom rather than winning by default.
  rows.sort((a, b) => {
    if (a.paceSecPerKm === null) return b.paceSecPerKm === null ? 0 : 1;
    if (b.paceSecPerKm === null) return -1;
    return a.paceSecPerKm - b.paceSecPerKm;
  });

  const entries: MatchedRouteEntry[] = rows.map((r, i) => ({ ...r, rank: i + 1 }));
  const current = entries.find((e) => e.isCurrent);
  const paced = entries.filter((e) => e.paceSecPerKm !== null);

  return {
    entries,
    currentRank: current && current.paceSecPerKm !== null ? current.rank : null,
    previousCount: rows.length - 1,
    bestPaceSecPerKm: paced[0]?.paceSecPerKm ?? null,
    comparedCount: candidates.length
  };
}

/**
 * How far either side of the activity we look for plan data. Finding nothing in a two-month window
 * is what lets us say "nothing was scheduled" instead of "we never synced the calendar".
 */
const CALENDAR_PROBE_DAYS = 30;

/** A Garmin calendar entry as a candidate: a title and, if we are lucky, an estimate. No steps. */
const fromPlannedEvent = (e: PlannedEvent): PlannedCandidate => ({
  id: e.id,
  day: e.day,
  kind: e.kind,
  origin: 'garmin',
  title: e.title,
  sport: e.sport,
  description: e.description,
  estimatedDurationS: e.estimatedDurationS,
  estimatedDistanceM: e.estimatedDistanceM,
  targetLoad: e.targetLoad,
  steps: null
});

/**
 * A workout the athlete AUTHORED here as a candidate (spec 050/066).
 *
 * This is the half that actually carries targets: duration, distance and per-step intensity bands
 * all come off the step tree, derived by the SAME estimators the planner and the MCP tools use, so
 * "how long is this session" has one answer everywhere. `targetLoad` stays null — an authored
 * workout prescribes work, not a training-load number.
 */
const fromAuthoredWorkout = (w: AuthoredWorkout): PlannedCandidate => ({
  id: w.id,
  day: w.day,
  kind: 'workout',
  origin: 'authored',
  title: w.title,
  sport: w.sport,
  description: w.note,
  estimatedDurationS: estimateWorkoutDurationS(w.steps),
  estimatedDistanceM: estimateWorkoutDistanceM(w.steps),
  targetLoad: null,
  steps: w.steps
});

/**
 * The scheduled side: what was planned for this day, from BOTH halves of the plan.
 *
 * Reading only `listPlannedEvents` was spec 085's first bug: Garmin's calendar entries are a title
 * and a description and rarely carry an estimate, while `authored_workouts` on the very same day
 * hold a full step tree. An athlete who plans only in OpenVitals was being told the calendar had
 * never been synced.
 */
async function loadPlanned(
  deps: ActivityDetailDeps,
  userId: string,
  activity: ActivitySummary
): Promise<PlannedInput> {
  const day = localDay(activity.startTimeLocal);
  // `startTimeLocal` comes from Garmin; a malformed one must degrade to "we know nothing" rather
  // than throw out of the whole page on an invalid day key.
  if (!isDayKey(day)) return { sameDay: [], calendarHasData: false, sport: activity.sport };

  const from = addDays(day, -CALENDAR_PROBE_DAYS);
  const to = addDays(day, CALENDAR_PROBE_DAYS);
  const [events, authored] = await Promise.all([
    deps.store.listPlannedEvents(userId, from, to),
    deps.store.listWorkouts(userId, { from, to })
  ]);

  return {
    sameDay: [
      ...events.filter((e) => e.day === day).map(fromPlannedEvent),
      ...authored.filter((w) => w.day === day).map(fromAuthoredWorkout)
    ],
    // Either source counts: an athlete who never used Garmin's calendar still has a synced plan.
    calendarHasData: events.length > 0 || authored.length > 0,
    sport: activity.sport
  };
}

/** The stream blob minus the pieces that already have their own top-level field (gps, laps). */
function chartStreams(streams: ActivityStreams | null): ActivityStreams {
  if (!streams) return {};
  const { gps: _gps, laps: _laps, typedSplits: _typedSplits, ...rest } = streams;
  return rest;
}

export async function loadActivityDetail(
  deps: ActivityDetailDeps,
  userId: string,
  activityId: string
): Promise<ActivityDetailData | null> {
  const activity = await deps.store.getActivity(userId, activityId);
  if (!activity) return null;

  const [streams, settings, history, planned] = await Promise.all([
    deps.store.getStreams(userId, activityId),
    deps.settings.get(userId),
    loadHistory(deps, userId, activity),
    loadPlanned(deps, userId, activity)
  ]);

  const weightKg = positiveNumber(settings.weightKg);
  const power = streams?.power;
  const time = streams?.time;
  const hr = streams?.heartRate;

  const curve = meanMaxCurve(power, time);

  let ftp = positiveNumber(settings.ftpWatts);
  let ftpEstimated = false;
  if (ftp == null) {
    const est = estimateFtpFromCurve(curve);
    if (est != null) {
      ftp = est;
      ftpEstimated = true;
    }
  }

  let powerBlock: PowerBlock | null = null;
  if (power && power.length > 0) {
    const np = normalizedPower(power, time);
    const durationS = effectiveDuration(activity.durationS, power, time);
    powerBlock = {
      avg: activity.avgPower ?? meanOf(power),
      max: activity.maxPower ?? maxOf(power),
      np,
      if: intensityFactor(np, ftp),
      tss: trainingStressScore(durationS, np, ftp),
      kj: totalWorkKj(power, time),
      curve,
      zones: powerZones(power, ftp, time)
    };
  }

  let hrBlock: HrBlock | null = null;
  if (hr && hr.length > 0) {
    const maxHr = activity.maxHr ?? maxOf(hr);
    hrBlock = {
      avg: activity.avgHr ?? meanOf(hr),
      max: maxHr,
      zones: hrZones(hr, maxHr, time)
    };
  }

  const gps = streams?.gps && streams.gps.length > 0 ? streams.gps : null;
  const laps = streams?.laps ?? [];
  const typedSplits = streams?.typedSplits ?? [];

  const day = localDay(activity.startTimeLocal);
  const movingSeconds = activity.movingS ?? activity.durationS;
  // Anchored on the activity's own day, never on "today" — the verdict for a ride in March must not
  // change because it is now August.
  const trainingComparison = /^\d{4}-\d{2}-\d{2}$/.test(day)
    ? buildTrainingComparison({
        day,
        activity: comparable(activity),
        history: history.comparable,
        planned,
        actual: {
          durationS: movingSeconds,
          distanceM: activity.distanceM,
          load: activity.trainingLoad,
          // The intensity a plan's bands are scored against (spec 085). Pace is derived rather than
          // read: Garmin only reports an average SPEED, and only in the raw payload.
          paceSecPerKm: averagePaceSecPerKm(activity.distanceM, movingSeconds),
          normPower: activity.normPower ?? powerBlock?.np ?? null,
          avgHr: activity.avgHr ?? hrBlock?.avg ?? null,
          // …and the laps, so an interval plan is scored rep by rep rather than on that blended
          // average (spec 091). Empty is fine: the comparison then stays on the aggregates above.
          laps
        },
        hrMax: positiveNumber(settings.maxHrBpm)
      })
    : null;

  /*
   * The plan's own step sequence, for the Przebieg strip (spec 085), with each step's executed laps
   * attached (spec 091). `matchPlanned` and `alignPlannedStructure` are both pure and deterministic,
   * so asking them again costs a sort over a handful of candidates plus one small dynamic program,
   * and saves shipping the same array twice inside `trainingComparison`.
   *
   * Where the laps cannot be reconciled with the plan every step comes back with `alignment: null`,
   * which is exactly what the strip needs to draw no executed row rather than a wrong one.
   */
  const matchedPlan = trainingComparison?.plannedWorkout
    ? matchPlanned(planned.sameDay, planned.sport)
    : null;
  const flatSteps = matchedPlan?.steps ? flattenWorkoutSteps(matchedPlan.steps) : [];
  const plannedStructure = flatSteps.length > 0 ? alignPlannedStructure(flatSteps, laps).steps : null;

  // The elapsed axis is needed by three consumers below (grade-adjusted pace, best efforts and the
  // speed curve), so it is resolved once here rather than three times.
  const streamSampleCount = streamLength(chartStreams(streams));
  const elapsed = streams ? elapsedSeconds(streams, streamSampleCount) : [];

  const stats = withStreamFallbacks(extractActivityStats(activity.raw), streams, typedSplits, elapsed);
  const family = sportGroup(activity.sport);

  // Ranking is anchored on the activity's own day (the `to: day` read above), so a March run's
  // standing does not change because it is now August.
  const highlights = buildHighlights({
    sport: family,
    current: forHighlights(activity),
    history: history.rankable,
    coversAllHistory: history.coversAllHistory
  });

  // Data-quality flags need only this session, so they are computed even with no history at all.
  const suspects = buildSuspects({
    sport: family,
    distanceM: activity.distanceM,
    durationS: activity.durationS,
    movingS: activity.movingS,
    elevationGainM: activity.elevationGainM,
    avgSpeedMps: stats.pace.avgSpeedMps ?? null,
    maxSpeedMps: stats.pace.maxSpeedMps ?? null,
    avgHr: activity.avgHr,
    maxHr: activity.maxHr,
    cadence: streams?.cadence
  });

  // Aerobic efficiency (spec 038). Decoupling prefers POWER where a meter was fitted — Pw:HR is the
  // less noisy signal, because power does not care about wind or gradient the way pace does.
  //
  // Average speed falls back to distance ÷ moving time: Garmin's own `averageSpeed` is only in the raw
  // payload and some sports/watches omit it, which would silently drop EF on sessions that carry
  // everything needed to compute it. Same reasoning as the derived pace in spec 036.
  const derivedSpeed =
    activity.distanceM !== null && movingSeconds !== null && movingSeconds > 0
      ? activity.distanceM / movingSeconds
      : null;
  const avgSpeedMps = stats.pace.avgSpeedMps ?? derivedSpeed;
  const efficiency: EfficiencyBlock = {
    decoupling:
      power && power.length > 0
        ? aerobicDecoupling(power, hr, 'power')
        : aerobicDecoupling(streams?.speed, hr, 'pace'),
    ef: efficiencyFactor(avgSpeedMps, activity.avgHr),
    powerEf: powerEfficiencyFactor(activity.normPower ?? powerBlock?.np ?? null, activity.avgHr),
    cardiacCost: cardiacCost(activity.distanceM, movingSeconds, activity.avgHr)
  };

  /*
   * Best efforts inside this session (spec 040). Pace sports only: "the fastest 1 km of this ride" is a
   * descent, not a result, so offering it would be noise. The distance axis is integrated from the
   * speed stream by the same helper the charts use, so an effort's window matches what the chart draws.
   */
  const distanceAxis = streams ? cumulativeDistance(streams, elapsed) : null;
  const efforts = streams && isPaceSport(family) ? bestEfforts(distanceAxis, elapsed) : [];

  /*
   * Pace shape (spec 045). Offered for every sport with a distance axis: "did I pace this or blow up?" is
   * as real a question on a bike as on foot.
   */
  const pace = pacing(distanceAxis, elapsed);

  // Climbs along the route (spec 046). Needs all three axes; a treadmill run simply has none.
  const climbs = findClimbs(streams?.elevation, distanceAxis, elapsed);

  // Matched routes last: it is the heaviest read on the page, and it needs `gps` resolved above.
  // Similar EFFORTS ride alongside it (spec 065) — the other half of "what should I compare this to",
  // and the half that still works without a GPS track. Independent reads, so they run together.
  const [matchedRoute, similarActivities] = await Promise.all([
    loadMatchedRoute(deps, userId, activity, gps),
    loadSimilarActivities(deps, userId, activity)
  ]);

  return {
    stats,
    laps,
    typedSplits,
    streams: chartStreams(streams),
    activity: {
      id: activity.activityId,
      sport: activity.sport,
      name: activity.name,
      startTime: activity.startTime,
      startTimeLocal: activity.startTimeLocal,
      distanceM: activity.distanceM,
      durationS: activity.durationS,
      movingS: activity.movingS,
      elevationGainM: activity.elevationGainM,
      avgHr: activity.avgHr,
      maxHr: activity.maxHr,
      avgPower: activity.avgPower,
      maxPower: activity.maxPower,
      normPower: activity.normPower,
      calories: activity.calories,
      trainingLoad: activity.trainingLoad,
      hasGps: activity.hasGps
    },
    gps,
    trainingComparison,
    plannedStructure,
    highlights,
    suspects,
    efficiency,
    bestEfforts: efforts,
    pacing: pace,
    climbs,
    matchedRoute,
    similarActivities,
    ftp,
    ftpEstimated,
    weightKg,
    power: powerBlock,
    hr: hrBlock,
    stravaUrl: null
  };
}
