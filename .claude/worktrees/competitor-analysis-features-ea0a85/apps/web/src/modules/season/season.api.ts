/**
 * Season goals handler (spec 060) — the one prospective surface in the app.
 *
 * Reads only the local store and answers, per goal: how far away is it, which phase of the block is
 * today, what CTL does the current ramp land on by the start of the taper, and (for a run race with
 * a distance) what time does spec 043 predict against the one the athlete wants.
 *
 * Pure over injected deps (store + settings + clock + random): no live Garmin, no `Date.now()`,
 * no env. Never throws on an empty-history condition — it degrades to an
 * honest payload, the same contract `loadInsights` follows.
 */
import type { Clock } from '$lib/server/clock';
import type { Random } from '$lib/server/random';
import type { SettingsRepo } from '$lib/server/repo/types';
import {
  DuplicateGoalError,
  type ActivitySummary,
  type LocalStore,
  type SeasonGoal
} from '$lib/server/store/types';
import { activityLoad, buildTrainingLoad, type LoadActivity } from '$lib/server/analytics/training-load';
import { buildPowerProfile, type PowerActivity } from '$lib/server/analytics/power-profile';
import { loadRisk } from '$lib/server/analytics/load-risk';
import { personalBests, type RunSummary } from '$lib/server/analytics/running-profile';
import { criticalSpeed, mergeSpeedCurves, speedDurationCurve } from '$lib/analytics/pace-model';
import { predictRaces, RACE_TARGETS } from '$lib/analytics/race-predictor';
import {
  daysOutTo,
  goalPhase,
  goalStatus,
  projectCtl,
  requiredRamp,
  taperCheck,
  TAPER_DAYS
} from '$lib/server/analytics/season';
import { addDays, toDayKey, todayKey } from '$lib/date';
import { sportGroup, sportGroupLabel, sportGroupLane, sportKeysInGroup } from '$lib/sport-labels';
import { parseGoalPatch, parseNewGoal } from './season.validate';
import type {
  GoalPrediction,
  GoalStatus,
  GoalSuggestion,
  HandlerResult,
  SeasonData,
  SeasonRequest
} from './season.types';

export interface SeasonDeps {
  store: LocalStore;
  settings: SettingsRepo;
  clock: Clock;
  random: Random;
}

/**
 * How far back the activity read reaches. Same 540 days the training overview uses and for the same
 * reason: CTL's 42-day time constant means older sessions cannot move today's number, and the extra
 * history is only there to warm the curve up.
 */
export const HISTORY_DAYS = 540;
/** Goals further out than this are past the horizon anything here could say something useful about. */
export const MAX_HORIZON_DAYS = 730;
/** Past goals kept on the page — the season just gone, not the whole archive. */
export const PAST_GOALS_SHOWN = 5;
/** Recent runs the speed–duration curve is built from, matching the running page's cap. */
const SPEED_STREAM_CAP = 40;

const PHASE_LABELS: Readonly<Record<string, string>> = {
  done: 'Po starcie',
  'race-week': 'Tydzień startowy',
  taper: 'Tapering',
  peak: 'Szczyt formy',
  build: 'Budowanie',
  base: 'Baza',
  far: 'Daleko'
};

const round1 = (n: number): number => Math.round(n * 10) / 10;

function numberSetting(settings: Record<string, unknown>, key: string): number | null {
  const v = settings[key];
  return typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : null;
}

/**
 * The verdict in one Polish sentence.
 *
 * Kept beside the band rather than in the view so the words and the number can never disagree, and
 * so `get_goal_plan` says the same thing over MCP that the card says on screen.
 */
function verdictNote(
  status: GoalStatus['status'],
  daysOut: number,
  requiredRampPerWeek: number | null,
  taper: GoalStatus['taper']
): string {
  if (daysOut < 0) return 'Cel jest już za Tobą.';

  // Inside the taper the trajectory is settled; the only live question is whether load is falling.
  if (taper) {
    return taper.tapering
      ? `Obciążenie spadło do ${Math.round(taper.ratio * 100)}% poziomu sprzed taperingu — to prawdziwy tapering. Forma z ostatnich tygodni zdąży wyjść na wierzch.`
      : `Obciążenie trzyma się na ${Math.round(taper.ratio * 100)}% poziomu sprzed taperingu. To zwykły tydzień pod nazwą taperingu — na starcie zostaniesz ze zmęczeniem, nie z formą.`;
  }

  switch (status) {
    case 'at-risk':
      return 'Forma rośnie szybciej, niż baza jest w stanie unieść. To najczęstsza droga do kontuzji przeciążeniowej — zanim dołożysz cokolwiek do planu, wpleć lżejszy tydzień.';
    case 'behind':
      return requiredRampPerWeek === null
        ? 'Obecne tempo nie dowozi celu, a na budowanie nie ma już czasu. Realniejszy jest cel skromniejszy niż plan, który się nie domknie.'
        : `Obecne tempo nie dowozi celu. Potrzeba około ${requiredRampPerWeek} pkt CTL tygodniowo — dokładaj stopniowo, nie jednym mocnym tygodniem.`;
    case 'ahead':
      return 'Jesteś przed planem. Nie ma powodu dokładać — nadmiar formy przed czasem zwykle kończy się przetrenowaniem, nie lepszym startem.';
    case 'on-track':
      return 'Obecne tempo dowozi cel na start taperingu. Utrzymaj kierunek i pilnuj tygodni odciążających.';
    default:
      return 'Za mało ciągłej historii treningowej, aby ocenić trajektorię do tego celu. Wskaźniki liczone z niepełnej bazy tylko straszą.';
  }
}

/**
 * The predicted finish for a run race, against the one the athlete wants.
 *
 * Only ever computed for `run` + a distance: spec 043's models are run-specific, and offering a
 * predicted ride time would be a number with nothing behind it.
 */
function buildPrediction(
  goal: SeasonGoal,
  runs: readonly ActivitySummary[],
  speedCurve: ReturnType<typeof mergeSpeedCurves>
): GoalPrediction | null {
  if (goal.sport !== 'run' || goal.distanceM === null || runs.length === 0) return null;

  const bests = personalBests(
    runs.map((a): RunSummary => ({
      activityId: a.activityId,
      day: toDayKey(a.startTimeLocal),
      distanceM: a.distanceM,
      durationS: a.durationS,
      movingS: a.movingS
    }))
  );
  if (bests.length === 0) return null;

  const critical = criticalSpeed(speedCurve);
  /*
   * The goal's own distance is the target, not one of spec 043's four standard ones — an athlete
   * with a 12 km race wants a 12 km prediction. `predictRaces` takes the target list, so the goal
   * supplies a list of exactly one.
   */
  const target = RACE_TARGETS.find((t) => Math.abs(t.metres - goal.distanceM!) < 1) ?? {
    key: 'goal',
    label: goal.title,
    metres: goal.distanceM
  };
  const [prediction] = predictRaces(
    bests.map((b) => ({ metres: b.meters, timeS: b.timeS, label: b.label, day: b.day })),
    {
      csMps: critical?.speedMps ?? null,
      dPrimeM: critical?.dPrimeM ?? null,
      targets: [target]
    }
  );
  if (!prediction) return null;

  // Riegel is the headline (it rests on the athlete's own bests); critical speed only fills in when
  // no best was close enough for Riegel to say anything.
  const predicted = prediction.riegelS ?? prediction.criticalSpeedS;
  return {
    riegelS: prediction.riegelS,
    criticalSpeedS: prediction.criticalSpeedS,
    fromLabel: prediction.fromLabel,
    fromDay: prediction.fromDay,
    confident: prediction.confident,
    gapS: goal.targetTimeS !== null && predicted !== null ? Math.round(goal.targetTimeS - predicted) : null
  };
}

export async function loadSeason(deps: SeasonDeps, req: SeasonRequest): Promise<SeasonData> {
  const today = todayKey(deps.clock);

  const historyStart = addDays(today, -(HISTORY_DAYS - 1));
  const [goals, activities, userSettings, sportCounts] = await Promise.all([
    deps.store.listGoals(req.userId),
    deps.store.listActivities(req.userId, { from: historyStart, limit: 20000 }),
    deps.settings.get(req.userId),
    deps.store.listSports(req.userId)
  ]);

  // Streams only where Garmin gave us no load of its own — one batched, power-only query, exactly
  // as the training overview does it, so the two pages cannot disagree about an activity's TSS.
  const needsStream = activities.filter((a) => a.trainingLoad == null || a.trainingLoad <= 0);
  const streamById = await deps.store.getStreamField(
    req.userId,
    needsStream.map((a) => a.activityId),
    'power'
  );

  let ftpWatts = numberSetting(userSettings, 'ftpWatts');
  if (ftpWatts == null) {
    const powerActs: PowerActivity[] = needsStream.flatMap((a) => {
      const power = streamById.get(a.activityId);
      return power ? [{ activityId: a.activityId, day: toDayKey(a.startTimeLocal), power }] : [];
    });
    if (powerActs.length > 0) ftpWatts = buildPowerProfile(powerActs, { weightKg: null }).ftpWatts;
  }

  const loadOpts = { ftpWatts, endDay: today };
  const toLoadActivity = (a: ActivitySummary): LoadActivity => ({
    day: toDayKey(a.startTimeLocal),
    durationS: a.movingS ?? a.durationS,
    trainingLoad: a.trainingLoad,
    avgHr: a.avgHr,
    maxHr: a.maxHr,
    power: a.trainingLoad != null && a.trainingLoad > 0 ? null : (streamById.get(a.activityId) ?? null)
  });

  /*
   * Per-family PMCs, computed once per family that has a goal rather than once per goal — two half
   * marathons in the same season share a curve, and building it twice would be the same numbers at
   * twice the cost.
   */
  const families = new Set(goals.map((g) => g.sport));
  const pmcByFamily = new Map<string, ReturnType<typeof buildTrainingLoad>>();
  for (const family of families) {
    const keys = new Set(sportKeysInGroup(family));
    const own = activities.filter((a) => keys.has(a.sport) || sportGroup(a.sport) === family);
    pmcByFamily.set(family, buildTrainingLoad(own.map(toLoadActivity), loadOpts));
  }

  /*
   * The speed–duration curve backing critical speed, built once for the whole payload and only when
   * a run race actually needs it — it costs a stream read per run, and a season of ride goals must
   * not pay for it.
   */
  const runs = activities.filter((a) => sportGroup(a.sport) === 'run');
  const needsPrediction = goals.some(
    (g) => g.sport === 'run' && g.kind === 'race' && g.distanceM !== null && daysOutTo(today, g.day) >= 0
  );
  let speedCurve: ReturnType<typeof mergeSpeedCurves> = mergeSpeedCurves([]);
  if (needsPrediction && runs.length > 0) {
    const curveRuns = [...runs]
      .sort((a, b) => (a.startTimeLocal < b.startTimeLocal ? 1 : -1))
      .slice(0, SPEED_STREAM_CAP);
    const speedById = await deps.store.getStreamField(
      req.userId,
      curveRuns.map((a) => a.activityId),
      'speed'
    );
    speedCurve = mergeSpeedCurves(
      curveRuns.flatMap((a) => {
        const speed = speedById.get(a.activityId);
        return speed && speed.length > 0 ? [speedDurationCurve(speed)] : [];
      })
    );
  }

  const statuses: GoalStatus[] = goals.map((goal) => {
    const daysOut = daysOutTo(today, goal.day);
    const phase = goalPhase(daysOut);
    const pmc = pmcByFamily.get(goal.sport);
    const hasFamilyData = pmc !== undefined && pmc.hasData;
    const risk = hasFamilyData ? loadRisk(pmc.series) : null;

    // A goal already behind the athlete reports no trajectory at all: extrapolating a ramp past a
    // race that has been run is arithmetic about nothing.
    const past = daysOut < 0;
    const ctl = hasFamilyData ? pmc.ctl : null;
    const rampPerWeek = past ? null : (risk?.rampRatePerWeek ?? null);
    const projectedCtl = past ? null : projectCtl(ctl, rampPerWeek, daysOut);
    const requiredRampPerWeek = past ? null : requiredRamp(ctl, goal.targetCtl, daysOut);
    const taper = past || !hasFamilyData ? null : taperCheck(pmc.series, daysOut, today);

    const status = goalStatus({
      daysOut,
      currentCtl: ctl,
      targetCtl: goal.targetCtl,
      projectedCtl,
      risk
    });

    return {
      goal,
      daysOut,
      weeksOut: Math.trunc(daysOut / 7),
      phase,
      phaseLabel: PHASE_LABELS[phase] ?? phase,
      sportLabel: sportGroupLabel(goal.sport),
      color: sportGroupLane(goal.sport),
      ctl: ctl === null ? null : round1(ctl),
      projectedCtl,
      rampPerWeek,
      requiredRampPerWeek,
      taper,
      prediction: past ? null : buildPrediction(goal, runs, speedCurve),
      status,
      note: verdictNote(status, daysOut, requiredRampPerWeek, taper)
    };
  });

  /*
   * Future goals soonest-first — the season read forwards. Past goals follow, most recent first, and
   * only the last few: the page is a plan, not an archive.
   */
  const future = statuses.filter((s) => s.daysOut >= 0).sort((a, b) => a.daysOut - b.daysOut);
  const past = statuses
    .filter((s) => s.daysOut < 0)
    .sort((a, b) => b.daysOut - a.daysOut)
    .slice(0, PAST_GOALS_SHOWN);

  return {
    today,
    goals: [...future, ...past],
    suggestions: await loadSuggestions(deps, req.userId, today, goals),
    hasData: [...pmcByFamily.values()].some((p) => p.hasData) || activities.length > 0,
    sports: [...new Set(sportCounts.map((s) => sportGroup(s.sport)))].map((group) => ({
      group,
      label: sportGroupLabel(group)
    }))
  };
}

/** Future synced races (spec 024) that no goal has adopted yet. */
async function loadSuggestions(
  deps: SeasonDeps,
  userId: string,
  today: string,
  goals: readonly SeasonGoal[]
): Promise<GoalSuggestion[]> {
  const events = await deps.store.listPlannedEvents(userId, today, addDays(today, MAX_HORIZON_DAYS));
  const adopted = new Set(goals.flatMap((g) => (g.garminEventId === null ? [] : [g.garminEventId])));
  return events
    .filter((e) => e.kind === 'race' && !adopted.has(e.id))
    .map((e) => {
      const group = e.sport === null ? 'other' : sportGroup(e.sport);
      return {
        eventId: e.id,
        day: e.day,
        title: e.title,
        sport: group,
        sportLabel: sportGroupLabel(group),
        distanceM: e.estimatedDistanceM
      };
    });
}

/* ------------------------------------------------------------------------------------------------
 * Mutations. Each validates at the boundary and returns a typed result the route maps to a status.
 * ---------------------------------------------------------------------------------------------- */

export async function createGoal(
  deps: SeasonDeps,
  userId: string,
  body: unknown
): Promise<HandlerResult<{ goal: SeasonGoal }>> {
  const parsed = parseNewGoal(body);
  if (!parsed.ok) return { ok: false, status: 400, error: parsed.error };

  const now = deps.clock.now().toISOString();
  try {
    const goal = await deps.store.createGoal(userId, {
      // id and createdAt come from the injected ports, never from the caller's body.
      id: deps.random.token(12),
      ...parsed.value,
      source: parsed.value.garminEventId === null ? 'manual' : 'garmin',
      createdAt: now
    });
    return { ok: true, goal };
  } catch (err) {
    if (err instanceof DuplicateGoalError) {
      return { ok: false, status: 409, error: 'ten start jest już dodany jako cel' };
    }
    throw err;
  }
}

export async function updateGoal(
  deps: SeasonDeps,
  userId: string,
  id: string,
  body: unknown
): Promise<HandlerResult<{ goal: SeasonGoal }>> {
  const parsed = parseGoalPatch(body);
  if (!parsed.ok) return { ok: false, status: 400, error: parsed.error };

  const goal = await deps.store.updateGoal(userId, id, {
    ...parsed.value,
    updatedAt: deps.clock.now().toISOString()
  });
  // Null covers both "no such goal" and "not this user's goal", and must stay indistinguishable —
  // a different response for the second would confirm another user's id exists.
  if (goal === null) return { ok: false, status: 404, error: 'nie znaleziono celu' };
  return { ok: true, goal };
}

export async function deleteGoal(
  deps: SeasonDeps,
  userId: string,
  id: string
): Promise<HandlerResult<{ deleted: true }>> {
  const goal = await deps.store.deleteGoal(userId, id);
  if (goal === null) return { ok: false, status: 404, error: 'nie znaleziono celu' };
  return { ok: true, deleted: true };
}

export { TAPER_DAYS };
