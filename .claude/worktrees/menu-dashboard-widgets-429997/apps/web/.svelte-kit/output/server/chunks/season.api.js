import { D as DuplicateGoalError } from "./types3.js";
import { b as buildTrainingLoad } from "./training-load.js";
import { b as buildPowerProfile } from "./power-profile.js";
import { M as MIN_HISTORY_DAYS, R as RAMP_HIGH, l as loadRisk } from "./load-risk.js";
import { a as personalBests } from "./running-profile.js";
import { a as mergeSpeedCurves, s as speedDurationCurve, c as criticalSpeed } from "./pace-model.js";
import { R as RACE_TARGETS, p as predictRaces } from "./race-predictor.js";
import { d as daysBetween, i as isDayKey, a as todayKey, c as addDays, t as toDayKey } from "./date.js";
import { i as isSportGroup, s as sportKeysInGroup, a as sportGroup, d as sportGroupLane, e as sportGroupLabel } from "./sport-labels.js";
import { A as ADVANCED_FEATURE } from "./tier.js";
const RACE_WEEK_DAYS = 7;
const TAPER_DAYS = 14;
const PEAK_DAYS = 28;
const BUILD_DAYS = 84;
const BASE_DAYS = 168;
const TAPER_MAX_RATIO = 0.8;
const CTL_TOLERANCE = 3;
const round1$1 = (n) => Math.round(n * 10) / 10;
function goalPhase(daysOut) {
  if (daysOut < 0) return "done";
  if (daysOut < RACE_WEEK_DAYS) return "race-week";
  if (daysOut < TAPER_DAYS) return "taper";
  if (daysOut < PEAK_DAYS) return "peak";
  if (daysOut < BUILD_DAYS) return "build";
  if (daysOut < BASE_DAYS) return "base";
  return "far";
}
function inTaperWindow(daysOut) {
  return daysOut >= 0 && daysOut < TAPER_DAYS;
}
function requiredRamp(currentCtl, targetCtl, daysOut) {
  if (currentCtl === null || targetCtl === null) return null;
  if (!Number.isFinite(currentCtl) || !Number.isFinite(targetCtl)) return null;
  const buildDays = daysOut - TAPER_DAYS;
  if (buildDays <= 0) return null;
  const gap = targetCtl - currentCtl;
  if (gap <= 0) return 0;
  return round1$1(gap / buildDays * 7);
}
function projectCtl(currentCtl, rampPerWeek, daysOut) {
  if (currentCtl === null || !Number.isFinite(currentCtl)) return null;
  const buildDays = Math.max(0, daysOut - TAPER_DAYS);
  const ramp = rampPerWeek ?? 0;
  if (!Number.isFinite(ramp)) return null;
  return round1$1(Math.max(0, currentCtl + ramp * buildDays / 7));
}
function taperCheck(series, daysOut, today) {
  if (!inTaperWindow(daysOut)) return null;
  const upTo = series.filter((p) => p.day <= today);
  if (upTo.length < 35) return null;
  const recent = upTo.slice(-7);
  const baseline = upTo.slice(-35, -7);
  if (recent.length < 7 || baseline.length < 28) return null;
  const mean = (points) => points.reduce((sum, p) => sum + p.tss, 0) / points.length;
  const recentDailyLoad = round1$1(mean(recent));
  const baselineDailyLoad = round1$1(mean(baseline));
  if (baselineDailyLoad <= 0) return null;
  const ratio = round1$1(recentDailyLoad / baselineDailyLoad);
  return {
    recentDailyLoad,
    baselineDailyLoad,
    ratio,
    tapering: ratio <= TAPER_MAX_RATIO
  };
}
function goalStatus(input) {
  const { daysOut, currentCtl, targetCtl, projectedCtl, risk } = input;
  if (daysOut < 0) return "unknown";
  if (currentCtl === null || risk === null || risk.historyDays < MIN_HISTORY_DAYS) return "unknown";
  const ramp = risk.rampRatePerWeek;
  if (ramp !== null && ramp > RAMP_HIGH) return "at-risk";
  if (targetCtl === null || projectedCtl === null) return "unknown";
  if (projectedCtl >= targetCtl + CTL_TOLERANCE) return "ahead";
  if (projectedCtl >= targetCtl - CTL_TOLERANCE) return "on-track";
  return "behind";
}
function daysOutTo(today, day) {
  return daysBetween(today, day);
}
const MAX_TITLE = 120;
const MAX_NOTE = 500;
const MAX_DISTANCE_M = 1e6;
const MAX_TARGET_TIME_S = 36e4;
const MAX_TARGET_CTL = 200;
const KINDS = ["race", "fitness"];
const PRIORITIES = ["a", "b", "c"];
const fail = (error) => ({ ok: false, error });
function asRecord(body) {
  return typeof body === "object" && body !== null && !Array.isArray(body) ? body : null;
}
function optionalNumber(value, max, label) {
  if (value === void 0 || value === null || value === "") return { ok: true, value: null };
  const n = typeof value === "string" ? Number(value) : value;
  if (typeof n !== "number" || !Number.isFinite(n)) return fail(`${label} musi być liczbą`);
  if (n <= 0) return fail(`${label} musi być większe od zera`);
  if (n > max) return fail(`${label} jest poza dopuszczalnym zakresem`);
  return { ok: true, value: n };
}
function optionalText(value, max, label) {
  if (value === void 0 || value === null) return { ok: true, value: null };
  if (typeof value !== "string") return fail(`${label} musi być tekstem`);
  const trimmed = value.trim();
  if (trimmed.length === 0) return { ok: true, value: null };
  if (trimmed.length > max) return fail(`${label} jest za długie`);
  return { ok: true, value: trimmed };
}
function parseNewGoal(body) {
  const b = asRecord(body);
  if (!b) return fail("oczekiwano obiektu JSON");
  if (!isDayKey(b.day)) return fail("data celu musi być w formacie RRRR-MM-DD");
  if (!isSportGroup(b.sport)) return fail("nieznana dyscyplina");
  const title = typeof b.title === "string" ? b.title.trim() : "";
  if (title.length === 0) return fail("nazwa celu jest wymagana");
  if (title.length > MAX_TITLE) return fail("nazwa celu jest za długa");
  const kind = b.kind === void 0 ? "race" : b.kind;
  if (!KINDS.includes(kind)) return fail("nieznany rodzaj celu");
  const priority = b.priority === void 0 ? "a" : b.priority;
  if (!PRIORITIES.includes(priority)) return fail("nieznany priorytet");
  const distance = optionalNumber(b.distanceM, MAX_DISTANCE_M, "dystans");
  if (!distance.ok) return distance;
  const targetTime = optionalNumber(b.targetTimeS, MAX_TARGET_TIME_S, "czas docelowy");
  if (!targetTime.ok) return targetTime;
  const targetCtl = optionalNumber(b.targetCtl, MAX_TARGET_CTL, "docelowa forma (CTL)");
  if (!targetCtl.ok) return targetCtl;
  const note = optionalText(b.note, MAX_NOTE, "notatka");
  if (!note.ok) return note;
  const eventId = optionalText(b.garminEventId, MAX_TITLE, "identyfikator wydarzenia");
  if (!eventId.ok) return eventId;
  if (targetTime.value !== null && distance.value === null) {
    return fail("czas docelowy wymaga podania dystansu");
  }
  return {
    ok: true,
    value: {
      day: b.day,
      sport: b.sport,
      title,
      kind,
      priority,
      distanceM: distance.value,
      targetTimeS: targetTime.value,
      targetCtl: targetCtl.value,
      note: note.value,
      garminEventId: eventId.value
    }
  };
}
function parseGoalPatch(body) {
  const b = asRecord(body);
  if (!b) return fail("oczekiwano obiektu JSON");
  const out = {};
  if (b.day !== void 0) {
    if (!isDayKey(b.day)) return fail("data celu musi być w formacie RRRR-MM-DD");
    out.day = b.day;
  }
  if (b.sport !== void 0) {
    if (!isSportGroup(b.sport)) return fail("nieznana dyscyplina");
    out.sport = b.sport;
  }
  if (b.title !== void 0) {
    const title = typeof b.title === "string" ? b.title.trim() : "";
    if (title.length === 0) return fail("nazwa celu jest wymagana");
    if (title.length > MAX_TITLE) return fail("nazwa celu jest za długa");
    out.title = title;
  }
  if (b.kind !== void 0) {
    if (!KINDS.includes(b.kind)) return fail("nieznany rodzaj celu");
    out.kind = b.kind;
  }
  if (b.priority !== void 0) {
    if (!PRIORITIES.includes(b.priority)) return fail("nieznany priorytet");
    out.priority = b.priority;
  }
  if (b.distanceM !== void 0) {
    const d = optionalNumber(b.distanceM, MAX_DISTANCE_M, "dystans");
    if (!d.ok) return d;
    out.distanceM = d.value;
  }
  if (b.targetTimeS !== void 0) {
    const t = optionalNumber(b.targetTimeS, MAX_TARGET_TIME_S, "czas docelowy");
    if (!t.ok) return t;
    out.targetTimeS = t.value;
  }
  if (b.targetCtl !== void 0) {
    const c = optionalNumber(b.targetCtl, MAX_TARGET_CTL, "docelowa forma (CTL)");
    if (!c.ok) return c;
    out.targetCtl = c.value;
  }
  if (b.note !== void 0) {
    const n = optionalText(b.note, MAX_NOTE, "notatka");
    if (!n.ok) return n;
    out.note = n.value;
  }
  if (Object.keys(out).length === 0) return fail("brak pól do zmiany");
  return { ok: true, value: out };
}
const MAX_HORIZON_DAYS = 730;
const PAST_GOALS_SHOWN = 5;
const SPEED_STREAM_CAP = 40;
const PHASE_LABELS = {
  done: "Po starcie",
  "race-week": "Tydzień startowy",
  taper: "Tapering",
  peak: "Szczyt formy",
  build: "Budowanie",
  base: "Baza",
  far: "Daleko"
};
const round1 = (n) => Math.round(n * 10) / 10;
function numberSetting(settings, key) {
  const v = settings[key];
  return typeof v === "number" && Number.isFinite(v) && v > 0 ? v : null;
}
function verdictNote(status, daysOut, requiredRampPerWeek, taper) {
  if (daysOut < 0) return "Cel jest już za Tobą.";
  if (taper) {
    return taper.tapering ? `Obciążenie spadło do ${Math.round(taper.ratio * 100)}% poziomu sprzed taperingu — to prawdziwy tapering. Forma z ostatnich tygodni zdąży wyjść na wierzch.` : `Obciążenie trzyma się na ${Math.round(taper.ratio * 100)}% poziomu sprzed taperingu. To zwykły tydzień pod nazwą taperingu — na starcie zostaniesz ze zmęczeniem, nie z formą.`;
  }
  switch (status) {
    case "at-risk":
      return "Forma rośnie szybciej, niż baza jest w stanie unieść. To najczęstsza droga do kontuzji przeciążeniowej — zanim dołożysz cokolwiek do planu, wpleć lżejszy tydzień.";
    case "behind":
      return requiredRampPerWeek === null ? "Obecne tempo nie dowozi celu, a na budowanie nie ma już czasu. Realniejszy jest cel skromniejszy niż plan, który się nie domknie." : `Obecne tempo nie dowozi celu. Potrzeba około ${requiredRampPerWeek} pkt CTL tygodniowo — dokładaj stopniowo, nie jednym mocnym tygodniem.`;
    case "ahead":
      return "Jesteś przed planem. Nie ma powodu dokładać — nadmiar formy przed czasem zwykle kończy się przetrenowaniem, nie lepszym startem.";
    case "on-track":
      return "Obecne tempo dowozi cel na start taperingu. Utrzymaj kierunek i pilnuj tygodni odciążających.";
    default:
      return "Za mało ciągłej historii treningowej, aby ocenić trajektorię do tego celu. Wskaźniki liczone z niepełnej bazy tylko straszą.";
  }
}
function buildPrediction(goal, runs, speedCurve) {
  if (goal.sport !== "run" || goal.distanceM === null || runs.length === 0) return null;
  const bests = personalBests(
    runs.map((a) => ({
      activityId: a.activityId,
      day: toDayKey(a.startTimeLocal),
      distanceM: a.distanceM,
      durationS: a.durationS,
      movingS: a.movingS
    }))
  );
  if (bests.length === 0) return null;
  const critical = criticalSpeed(speedCurve);
  const target = RACE_TARGETS.find((t) => Math.abs(t.metres - goal.distanceM) < 1) ?? {
    key: "goal",
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
async function loadSeason(deps, req) {
  const today = todayKey(deps.clock);
  if (!await deps.consent.isEnabled(ADVANCED_FEATURE)) {
    return { enabled: false, today, goals: [], suggestions: [], hasData: false, sports: [] };
  }
  const historyStart = addDays(today, -539);
  const [goals, activities, userSettings, sportCounts] = await Promise.all([
    deps.store.listGoals(req.userId),
    deps.store.listActivities(req.userId, { from: historyStart, limit: 2e4 }),
    deps.settings.get(req.userId),
    deps.store.listSports(req.userId)
  ]);
  const needsStream = activities.filter((a) => a.trainingLoad == null || a.trainingLoad <= 0);
  const streamById = await deps.store.getStreamField(
    req.userId,
    needsStream.map((a) => a.activityId),
    "power"
  );
  let ftpWatts = numberSetting(userSettings, "ftpWatts");
  if (ftpWatts == null) {
    const powerActs = needsStream.flatMap((a) => {
      const power = streamById.get(a.activityId);
      return power ? [{ activityId: a.activityId, day: toDayKey(a.startTimeLocal), power }] : [];
    });
    if (powerActs.length > 0) ftpWatts = buildPowerProfile(powerActs, { weightKg: null }).ftpWatts;
  }
  const loadOpts = { ftpWatts, endDay: today };
  const toLoadActivity = (a) => ({
    day: toDayKey(a.startTimeLocal),
    durationS: a.movingS ?? a.durationS,
    trainingLoad: a.trainingLoad,
    avgHr: a.avgHr,
    maxHr: a.maxHr,
    power: a.trainingLoad != null && a.trainingLoad > 0 ? null : streamById.get(a.activityId) ?? null
  });
  const families = new Set(goals.map((g) => g.sport));
  const pmcByFamily = /* @__PURE__ */ new Map();
  for (const family of families) {
    const keys = new Set(sportKeysInGroup(family));
    const own = activities.filter((a) => keys.has(a.sport) || sportGroup(a.sport) === family);
    pmcByFamily.set(family, buildTrainingLoad(own.map(toLoadActivity), loadOpts));
  }
  const runs = activities.filter((a) => sportGroup(a.sport) === "run");
  const needsPrediction = goals.some(
    (g) => g.sport === "run" && g.kind === "race" && g.distanceM !== null && daysOutTo(today, g.day) >= 0
  );
  let speedCurve = mergeSpeedCurves([]);
  if (needsPrediction && runs.length > 0) {
    const curveRuns = [...runs].sort((a, b) => a.startTimeLocal < b.startTimeLocal ? 1 : -1).slice(0, SPEED_STREAM_CAP);
    const speedById = await deps.store.getStreamField(
      req.userId,
      curveRuns.map((a) => a.activityId),
      "speed"
    );
    speedCurve = mergeSpeedCurves(
      curveRuns.flatMap((a) => {
        const speed = speedById.get(a.activityId);
        return speed && speed.length > 0 ? [speedDurationCurve(speed)] : [];
      })
    );
  }
  const statuses = goals.map((goal) => {
    const daysOut = daysOutTo(today, goal.day);
    const phase = goalPhase(daysOut);
    const pmc = pmcByFamily.get(goal.sport);
    const hasFamilyData = pmc !== void 0 && pmc.hasData;
    const risk = hasFamilyData ? loadRisk(pmc.series) : null;
    const past2 = daysOut < 0;
    const ctl = hasFamilyData ? pmc.ctl : null;
    const rampPerWeek = past2 ? null : risk?.rampRatePerWeek ?? null;
    const projectedCtl = past2 ? null : projectCtl(ctl, rampPerWeek, daysOut);
    const requiredRampPerWeek = past2 ? null : requiredRamp(ctl, goal.targetCtl, daysOut);
    const taper = past2 || !hasFamilyData ? null : taperCheck(pmc.series, daysOut, today);
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
      prediction: past2 ? null : buildPrediction(goal, runs, speedCurve),
      status,
      note: verdictNote(status, daysOut, requiredRampPerWeek, taper)
    };
  });
  const future = statuses.filter((s) => s.daysOut >= 0).sort((a, b) => a.daysOut - b.daysOut);
  const past = statuses.filter((s) => s.daysOut < 0).sort((a, b) => b.daysOut - a.daysOut).slice(0, PAST_GOALS_SHOWN);
  return {
    enabled: true,
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
async function loadSuggestions(deps, userId, today, goals) {
  const events = await deps.store.listPlannedEvents(userId, today, addDays(today, MAX_HORIZON_DAYS));
  const adopted = new Set(goals.flatMap((g) => g.garminEventId === null ? [] : [g.garminEventId]));
  return events.filter((e) => e.kind === "race" && !adopted.has(e.id)).map((e) => {
    const group = e.sport === null ? "other" : sportGroup(e.sport);
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
async function createGoal(deps, userId, body) {
  const parsed = parseNewGoal(body);
  if (!parsed.ok) return { ok: false, status: 400, error: parsed.error };
  const now = deps.clock.now().toISOString();
  try {
    const goal = await deps.store.createGoal(userId, {
      // id and createdAt come from the injected ports, never from the caller's body.
      id: deps.random.token(12),
      ...parsed.value,
      source: parsed.value.garminEventId === null ? "manual" : "garmin",
      createdAt: now
    });
    return { ok: true, goal };
  } catch (err) {
    if (err instanceof DuplicateGoalError) {
      return { ok: false, status: 409, error: "ten start jest już dodany jako cel" };
    }
    throw err;
  }
}
async function updateGoal(deps, userId, id, body) {
  const parsed = parseGoalPatch(body);
  if (!parsed.ok) return { ok: false, status: 400, error: parsed.error };
  const goal = await deps.store.updateGoal(userId, id, {
    ...parsed.value,
    updatedAt: deps.clock.now().toISOString()
  });
  if (goal === null) return { ok: false, status: 404, error: "nie znaleziono celu" };
  return { ok: true, goal };
}
async function deleteGoal(deps, userId, id) {
  const goal = await deps.store.deleteGoal(userId, id);
  if (goal === null) return { ok: false, status: 404, error: "nie znaleziono celu" };
  return { ok: true, deleted: true };
}
export {
  createGoal as c,
  deleteGoal as d,
  loadSeason as l,
  updateGoal as u
};
