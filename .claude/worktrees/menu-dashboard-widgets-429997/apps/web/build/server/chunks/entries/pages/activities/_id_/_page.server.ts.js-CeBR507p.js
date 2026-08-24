import { M as redirect, B as error } from '../../../../chunks/utils.js-D6eaf5bT.js';
import { m as meanMaxCurve, e as estimateFtpFromCurve, n as normalizedPower, p as powerZones, t as totalWorkKj, a as trainingStressScore, i as intensityFactor, h as hrZones, s as sampleIntervalS } from '../../../../chunks/activity-power.js-595LPO8p.js';
import { b as addDays, e as compareDays, j as isDayKey, d as daysBetween } from '../../../../chunks/date.js-Cf0GyZI8.js';
import { b as sportGroup, s as sportKeysInGroup } from '../../../../chunks/sport-labels.js-BKqMzU19.js';
import { a as activityLoad, b as buildTrainingLoad } from '../../../../chunks/training-load.js-DHd0MMKR.js';
import { i as isPaceSport, b as bandLabel } from '../../../../chunks/activity-charts.js-F9H2TYGl.js';
import { a as cardiacCost, p as powerEfficiencyFactor, e as efficiencyFactor, b as aerobicDecoupling } from '../../../../chunks/efficiency.js-DJ-LuYeW.js';
import { b as bestEfforts } from '../../../../chunks/best-efforts.js-D1Is-85D.js';
import { m as meanGradeAdjustedSpeed } from '../../../../chunks/pace-model.js-DDe_pC8X.js';
import { s as streamLength, e as elapsedSeconds, c as cumulativeDistance } from '../../../../chunks/stream-axes.js-Dkquxzlu.js';

function asRecord(v) {
  return v !== null && typeof v === "object" && !Array.isArray(v) ? v : null;
}
function num(o, keys) {
  for (const k of keys) {
    const v = o[k];
    if (typeof v === "number" && Number.isFinite(v)) return v;
  }
  return void 0;
}
function int(o, keys) {
  const n = num(o, keys);
  return n === void 0 ? void 0 : Math.round(n);
}
function text(o, keys) {
  for (const k of keys) {
    const v = o[k];
    if (typeof v === "string" && v.length > 0) return v;
  }
  return void 0;
}
function compact(o) {
  const out = {};
  for (const [k, v] of Object.entries(o)) if (v !== void 0) out[k] = v;
  return out;
}
function paceSecPerKm(distanceM2, durationS) {
  if (!distanceM2 || !durationS || distanceM2 <= 0 || durationS <= 0) return void 0;
  return Math.round(durationS / distanceM2 * 1e3);
}
function paceFromSpeed(speedMps) {
  if (!speedMps || speedMps <= 0) return void 0;
  return Math.round(1e3 / speedMps);
}
function calorieSplit(total, resting) {
  if (total !== void 0 && resting !== void 0) {
    return {
      total: Math.round(total),
      resting: Math.round(resting),
      active: Math.max(0, Math.round(total - resting))
    };
  }
  if (total !== void 0) return { total: Math.round(total) };
  if (resting !== void 0) return { resting: Math.round(resting) };
  return {};
}
function idleSeconds(durationS, movingS) {
  if (durationS === void 0 || movingS === void 0) return void 0;
  return Math.max(0, Math.round(durationS - movingS));
}
function totalIntensityMinutes(moderate, vigorous) {
  if (moderate === void 0 && vigorous === void 0) return void 0;
  return Math.round((moderate ?? 0) + (vigorous ?? 0) * 2);
}
function runWalkFromSplits(splits) {
  if (!splits || splits.length === 0) return {};
  let runS;
  let walkS;
  let idleS;
  for (const split of splits) {
    const seconds = split.durationS;
    if (seconds === void 0 || !Number.isFinite(seconds)) continue;
    const type = (split.type ?? "").toUpperCase();
    if (type.includes("RUN")) runS = (runS ?? 0) + seconds;
    else if (type.includes("WALK")) walkS = (walkS ?? 0) + seconds;
    else if (type.includes("STAND") || type.includes("IDLE") || type.includes("REST"))
      idleS = (idleS ?? 0) + seconds;
  }
  return compact({
    runS: runS === void 0 ? void 0 : Math.round(runS),
    walkS: walkS === void 0 ? void 0 : Math.round(walkS),
    idleS: idleS === void 0 ? void 0 : Math.round(idleS)
  });
}
function streamAverage(values) {
  if (!values || values.length === 0) return void 0;
  let sum = 0;
  let n = 0;
  for (const v of values) {
    if (typeof v === "number" && Number.isFinite(v)) {
      sum += v;
      n++;
    }
  }
  return n === 0 ? void 0 : Math.round(sum / n * 10) / 10;
}
function hrZoneSeconds(o) {
  const zones = [1, 2, 3, 4, 5].map((z) => num(o, [`hrTimeInZone_${z}`, `hrTimeInZone${z}`]));
  return zones.some((z) => z !== void 0) ? zones.map((z) => Math.round(z ?? 0)) : void 0;
}
function extractActivityStats(raw) {
  const o = asRecord(raw) ?? {};
  const durationS = num(o, ["duration"]);
  const movingS = num(o, ["movingDuration"]);
  const elapsedS = num(o, ["elapsedDuration"]);
  const distanceM2 = num(o, ["distance", "distanceInMeters"]);
  const moderate = num(o, ["moderateIntensityMinutes"]);
  const vigorous = num(o, ["vigorousIntensityMinutes"]);
  const rpe = num(o, ["directWorkoutRpe", "workoutRpe"]);
  return {
    calories: calorieSplit(
      num(o, ["calories", "totalKilocalories"]),
      num(o, ["bmrCalories", "restingCalories"])
    ),
    hydration: compact({ sweatLossMl: int(o, ["waterEstimated", "sweatLoss"]) }),
    respiration: compact({
      avg: num(o, ["avgRespirationRate", "averageRespirationRate"]),
      min: num(o, ["minRespirationRate", "lowestRespirationRate"]),
      max: num(o, ["maxRespirationRate", "highestRespirationRate"])
    }),
    trainingEffect: compact({
      aerobic: num(o, ["aerobicTrainingEffect"]),
      anaerobic: num(o, ["anaerobicTrainingEffect"]),
      label: text(o, ["trainingEffectLabel", "primaryBenefit"]),
      load: num(o, ["activityTrainingLoad", "trainingLoad"])
    }),
    stamina: compact({
      beginPotential: num(o, ["beginPotentialStamina"]),
      endPotential: num(o, ["endPotentialStamina"]),
      min: num(o, ["minAvailableStamina"])
    }),
    hr: compact({
      avg: int(o, ["averageHR", "avgHr"]),
      max: int(o, ["maxHR", "maxHr"]),
      timeInZoneS: hrZoneSeconds(o)
    }),
    timing: compact({ durationS, movingS, elapsedS, idleS: idleSeconds(durationS, movingS) }),
    power: compact({
      avg: int(o, ["avgPower", "averagePower", "avgBikingPower"]),
      max: int(o, ["maxPower", "maxBikingPower"]),
      normalized: int(o, ["normPower", "normalizedPower"])
    }),
    elevation: compact({
      gainM: num(o, ["elevationGain", "totalElevationGain"]),
      lossM: num(o, ["elevationLoss", "totalElevationLoss"]),
      minM: num(o, ["minElevation"]),
      maxM: num(o, ["maxElevation"])
    }),
    pace: compact({
      avgSpeedMps: num(o, ["averageSpeed", "avgSpeed"]),
      maxSpeedMps: num(o, ["maxSpeed"]),
      avgSecPerKm: paceSecPerKm(distanceM2, durationS),
      avgMovingSecPerKm: paceSecPerKm(distanceM2, movingS),
      bestSecPerKm: paceFromSpeed(num(o, ["maxSpeed"])),
      gradeAdjustedSecPerKm: paceFromSpeed(num(o, ["avgGradeAdjustedSpeed", "averageGradeAdjustedSpeed"]))
    }),
    runningDynamics: compact({
      avgCadenceSpm: int(o, ["averageRunningCadenceInStepsPerMinute", "avgRunCadence", "avgDoubleCadence"]),
      maxCadenceSpm: int(o, ["maxRunningCadenceInStepsPerMinute", "maxRunCadence", "maxDoubleCadence"]),
      avgStrideLengthCm: num(o, ["avgStrideLength", "averageStrideLength"]),
      avgVerticalRatio: num(o, ["avgVerticalRatio"]),
      avgVerticalOscillationCm: num(o, ["avgVerticalOscillation"]),
      avgGroundContactBalancePct: num(o, ["avgGroundContactBalance"]),
      avgGroundContactTimeMs: num(o, ["avgGroundContactTime"])
    }),
    temperature: compact({
      avgC: num(o, ["avgTemperature", "averageTemperature"]),
      minC: num(o, ["minTemperature"]),
      maxC: num(o, ["maxTemperature"])
    }),
    intensityMinutes: compact({ moderate, vigorous, total: totalIntensityMinutes(moderate, vigorous) }),
    bodyBattery: compact({ difference: int(o, ["differenceBodyBattery"]) }),
    stress: compact({
      avg: int(o, ["avgStress", "averageStress"]),
      max: int(o, ["maxStress"]),
      start: int(o, ["startStress"]),
      end: int(o, ["endStress"]),
      difference: int(o, ["differenceStress"])
    }),
    selfEvaluation: compact({
      // Garmin stores RPE as 0–100 (effort × 10); surface the familiar 0–10 scale.
      perceivedEffort: rpe === void 0 ? void 0 : Math.round(rpe > 10 ? rpe / 10 : rpe),
      feel: int(o, ["directWorkoutFeel", "workoutFeel"])
    }),
    runWalk: {}
  };
}
const RECENT_WINDOW_DAYS = 42;
function median(values) {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[mid];
  return ((sorted[mid - 1] ?? 0) + (sorted[mid] ?? 0)) / 2;
}
function verdictFor(vsRecentPct, loadRatio) {
  if (vsRecentPct !== null) {
    if (vsRecentPct >= 50) return "peak";
    if (vsRecentPct >= 15) return "hard";
    if (vsRecentPct > -15) return "steady";
    return "easy";
  }
  if (loadRatio !== null) {
    if (loadRatio >= 1.5) return "peak";
    if (loadRatio >= 1) return "hard";
    if (loadRatio >= 0.5) return "steady";
    return "easy";
  }
  return "unknown";
}
const round = (n, digits = 0) => {
  const f = 10 ** digits;
  return Math.round(n * f) / f;
};
const PLAN_TOLERANCE = 0.1;
const finite = (n) => typeof n === "number" && Number.isFinite(n);
function matchPlanned(candidates, sport) {
  const family = sportGroup(sport);
  const kindRank = { workout: 0, race: 1, note: 2 };
  const targets = (c) => [c.estimatedDurationS, c.estimatedDistanceM, c.targetLoad].filter(finite).length;
  const matches = candidates.filter((c) => c.sport === null || sportGroup(c.sport) === family);
  if (matches.length === 0) return null;
  return [...matches].sort(
    (a, b) => kindRank[a.kind] - kindRank[b.kind] || targets(b) - targets(a) || a.id.localeCompare(b.id)
  )[0];
}
function step(key, label, target, actual) {
  return {
    key,
    label,
    target,
    actual,
    met: actual === null ? null : Math.abs(actual / target - 1) <= PLAN_TOLERANCE
  };
}
function complianceOf(steps) {
  const scored = steps.filter((s) => s.actual !== null && s.target > 0);
  if (scored.length === 0) return null;
  const total = scored.reduce((sum, s) => sum + Math.max(0, 1 - Math.abs(s.actual / s.target - 1)), 0);
  return Math.round(total / scored.length * 100);
}
function buildPlannedComparison(plan, actual) {
  const steps = [];
  if (finite(plan.estimatedDurationS) && plan.estimatedDurationS > 0) {
    steps.push(step("duration", "Czas", plan.estimatedDurationS, actual.durationS));
  }
  if (finite(plan.estimatedDistanceM) && plan.estimatedDistanceM > 0) {
    steps.push(step("distance", "Dystans", plan.estimatedDistanceM, actual.distanceM));
  }
  if (finite(plan.targetLoad) && plan.targetLoad > 0) {
    steps.push(step("load", "Obciążenie", plan.targetLoad, actual.load));
  }
  return {
    workoutId: plan.id,
    name: plan.title,
    scheduledDay: plan.day,
    kind: plan.kind,
    description: plan.description,
    targetDurationS: finite(plan.estimatedDurationS) ? plan.estimatedDurationS : null,
    targetDistanceM: finite(plan.estimatedDistanceM) ? plan.estimatedDistanceM : null,
    targetLoad: finite(plan.targetLoad) ? plan.targetLoad : null,
    steps,
    compliancePct: complianceOf(steps)
  };
}
function buildTrainingComparison(input) {
  const dayBefore = addDays(input.day, -1);
  const opts = {
    ftpWatts: null,
    endDay: dayBefore,
    ...input.hrRest === void 0 ? {} : { hrRest: input.hrRest },
    ...input.hrMax === void 0 ? {} : { hrMax: input.hrMax }
  };
  const scored = activityLoad({ ...input.activity, power: null }, opts);
  const load2 = scored.tss > 0 ? round(scored.tss) : null;
  const past = input.history.filter((a) => compareDays(a.day, input.day) < 0);
  const windowStart = addDays(input.day, -RECENT_WINDOW_DAYS);
  const recentLoads = [];
  for (const a of past) {
    if (compareDays(a.day, windowStart) < 0) continue;
    const { tss } = activityLoad({ ...a, power: null }, opts);
    if (tss > 0) recentLoads.push(tss);
  }
  const recentMedianRaw = median(recentLoads);
  const recentMedianLoad = recentMedianRaw === null ? null : round(recentMedianRaw);
  const pmc = buildTrainingLoad(
    past.map((a) => ({ ...a, power: null })),
    opts
  );
  const hasPmc = pmc.hasData && pmc.series.length > 0;
  const ctlBefore = hasPmc ? round(pmc.ctl, 1) : null;
  const atlBefore = hasPmc ? round(pmc.atl, 1) : null;
  const tsbBefore = ctlBefore !== null && atlBefore !== null ? round(ctlBefore - atlBefore, 1) : null;
  const bandBefore = tsbBefore === null ? null : bandForTsbLocal(tsbBefore);
  const vsRecentPct = load2 !== null && recentMedianRaw !== null && recentMedianRaw > 0 ? Math.round((load2 / recentMedianRaw - 1) * 100) : null;
  const loadRatio = load2 !== null && ctlBefore !== null && ctlBefore > 0 ? round(load2 / ctlBefore, 2) : null;
  const verdict = load2 === null ? "unknown" : verdictFor(vsRecentPct, loadRatio);
  const plan = input.planned ? matchPlanned(input.planned.sameDay, input.planned.sport) : null;
  const plannedWorkout = plan === null ? null : buildPlannedComparison(plan, input.actual ?? { durationS: null, distanceM: null, load: load2 });
  const plannedWorkoutStatus = plannedWorkout !== null ? "linked" : input.planned?.calendarHasData ? "none-scheduled" : "not-synced";
  return {
    load: load2,
    loadMethod: scored.method,
    recentMedianLoad,
    recentCount: recentLoads.length,
    vsRecentPct,
    ctlBefore,
    atlBefore,
    tsbBefore,
    bandBefore,
    loadRatio,
    verdict,
    summary: summarize({
      load: load2,
      method: scored.method,
      vsRecentPct,
      recentCount: recentLoads.length,
      tsbBefore,
      bandBefore
    }),
    windowDays: RECENT_WINDOW_DAYS,
    plannedWorkout,
    plannedWorkoutStatus
  };
}
function bandForTsbLocal(tsb) {
  if (tsb > 25) return "fresh";
  if (tsb >= 5) return "optimal";
  if (tsb >= -10) return "neutral";
  if (tsb >= -30) return "fatigued";
  return "very-fatigued";
}
function summarize(input) {
  const parts = [];
  if (input.load === null) {
    parts.push(
      "Nie da się ocenić obciążenia tej aktywności — nie ma ani obciążenia z Garmina, ani zapisu tętna."
    );
  } else if (input.vsRecentPct === null) {
    parts.push(
      input.recentCount === 0 ? "To pierwsza porównywalna sesja w ostatnich 6 tygodniach, więc nie ma jeszcze do czego jej odnieść." : "Brak wiarygodnej normy z ostatnich 6 tygodni."
    );
  } else {
    const pct = Math.abs(input.vsRecentPct);
    const norm = `typowej sesji z ostatnich 6 tygodni (${input.recentCount} porównywalnych)`;
    if (pct < 8) parts.push(`Obciążenie na poziomie ${norm}.`);
    else if (input.vsRecentPct > 0) parts.push(`O ${pct}% mocniejszy od ${norm}.`);
    else parts.push(`O ${pct}% lżejszy od ${norm}.`);
  }
  if (input.tsbBefore !== null && input.bandBefore !== null) {
    const sign = input.tsbBefore > 0 ? "+" : input.tsbBefore < 0 ? "−" : "";
    const value = Math.abs(input.tsbBefore).toFixed(0);
    parts.push(`Wchodziłeś w niego z formą ${sign}${value} (${bandLabel(input.bandBefore)}).`);
  }
  return parts.join(" ");
}
const MIN_COMPARABLE = 8;
const NOTABLE_MONTHS = 6;
const TOP_RANK = 3;
const DAYS_PER_MONTH = 30;
const SPEED_CEILING_KMH = {
  run: 32,
  walk: 15,
  ride: 100,
  swim: 12
};
const SPIKE_RATIO = 2.5;
const CLIMB_PER_KM_CEILING = 250;
const HR_CEILING_BPM = 220;
const HR_SPIKE_GAP_BPM = 75;
const SPEED_MISMATCH_PCT = 0.25;
const CADENCE_GAP_SAMPLES = 60;
const isNum = (v) => typeof v === "number" && Number.isFinite(v);
function fixed(v, digits) {
  return v.toLocaleString("pl-PL", { minimumFractionDigits: digits, maximumFractionDigits: digits });
}
function fmtPaceValue(secPerKm) {
  const total = Math.round(secPerKm);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}
function fmtDurationValue(seconds) {
  const total = Math.round(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor(total % 3600 / 60);
  const s = total % 60;
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}` : `${m}:${String(s).padStart(2, "0")}`;
}
function derivedPaceSecPerKm(a) {
  if (!isNum(a.distanceM) || !isNum(a.durationS)) return null;
  if (a.distanceM < 400 || a.durationS <= 0) return null;
  return a.durationS / (a.distanceM / 1e3);
}
function derivedSpeedKmh(a) {
  const pace = derivedPaceSecPerKm(a);
  return pace === null || pace <= 0 ? null : 3600 / pace;
}
const METRICS = [
  {
    key: "distance",
    label: "Dystans",
    unit: "km",
    goodWhen: "up",
    value: (a) => isNum(a.distanceM) && a.distanceM > 0 ? a.distanceM : null,
    format: (v) => fixed(v / 1e3, 2)
  },
  {
    key: "duration",
    label: "Czas w ruchu",
    goodWhen: "up",
    value: (a) => isNum(a.durationS) && a.durationS > 0 ? a.durationS : null,
    format: fmtDurationValue
  },
  {
    key: "elevation",
    label: "Przewyższenie",
    unit: "m",
    goodWhen: "up",
    value: (a) => isNum(a.elevationGainM) && a.elevationGainM > 0 ? a.elevationGainM : null,
    format: (v) => fixed(v, 0)
  },
  {
    key: "pace",
    label: "Średnie tempo",
    unit: "min/km",
    goodWhen: "down",
    sports: ["run", "walk", "swim"],
    value: derivedPaceSecPerKm,
    format: fmtPaceValue
  },
  {
    key: "speed",
    label: "Średnia prędkość",
    unit: "km/h",
    goodWhen: "up",
    sports: ["ride"],
    value: derivedSpeedKmh,
    format: (v) => fixed(v, 1)
  },
  {
    key: "load",
    label: "Obciążenie treningowe",
    goodWhen: "up",
    value: (a) => isNum(a.trainingLoad) && a.trainingLoad > 0 ? a.trainingLoad : null,
    format: (v) => fixed(v, 0)
  },
  {
    key: "calories",
    label: "Kalorie",
    unit: "kcal",
    goodWhen: "up",
    value: (a) => isNum(a.calories) && a.calories > 0 ? a.calories : null,
    format: (v) => fixed(v, 0)
  },
  {
    key: "normPower",
    label: "Moc znormalizowana",
    unit: "W",
    goodWhen: "up",
    value: (a) => isNum(a.normPower) && a.normPower > 0 ? a.normPower : null,
    format: (v) => fixed(v, 0)
  }
];
function monthsBetween(from, to) {
  if (!isDayKey(from) || !isDayKey(to)) return 0;
  const days = daysBetween(from, to);
  return days <= 0 ? 0 : Math.floor(days / DAYS_PER_MONTH);
}
function monthsText(n) {
  return n === 1 ? "1 miesiąca" : `${n} miesięcy`;
}
function spanText(history, day) {
  const days = history.map((h) => h.day).filter(isDayKey).sort();
  const oldest = days[0];
  if (oldest === void 0) return "zsynchronizowanej historii";
  const months = monthsBetween(oldest, day);
  if (months >= 24) return `${Math.floor(months / 12)} lat`;
  if (months >= 1) return monthsText(months);
  return "zsynchronizowanej historii";
}
const better = (a, b, goodWhen) => goodWhen === "up" ? a > b : a < b;
function place(current, earlier, goodWhen, day) {
  let strictlyBetter = 0;
  let tied = 0;
  let lastBetterDay = null;
  for (const e of earlier) {
    if (e.value === current) {
      tied++;
      continue;
    }
    if (!better(e.value, current, goodWhen)) continue;
    strictlyBetter++;
    if (lastBetterDay === null || e.day > lastBetterDay) lastBetterDay = e.day;
  }
  return {
    rank: strictlyBetter + 1,
    outOf: earlier.length + 1,
    tied,
    monthsSinceBetter: lastBetterDay === null ? null : monthsBetween(lastBetterDay, day)
  };
}
const MAX_TIES_FOR_BEST = 1;
function buildHighlights(input) {
  const { current, history, sport, coversAllHistory } = input;
  const out = [];
  for (const metric of METRICS) {
    if (metric.sports && !metric.sports.includes(sport)) continue;
    const value = metric.value(current);
    if (value === null) continue;
    const earlier = history.flatMap((h) => {
      const v = metric.value(h);
      return v === null ? [] : [{ value: v, day: h.day }];
    });
    if (earlier.length < MIN_COMPARABLE) continue;
    const { rank, outOf, tied, monthsSinceBetter } = place(value, earlier, metric.goodWhen, current.day);
    let kind = null;
    let text2 = "";
    if (rank === 1 && tied > MAX_TIES_FOR_BEST) {
      continue;
    } else if (rank === 1 && tied === 1) {
      kind = "notable";
      text2 = coversAllHistory ? "Wyrównany najlepszy wynik w historii" : `Wyrównany najlepszy wynik w ostatnich ${spanText(history, current.day)}`;
    } else if (rank === 1) {
      kind = "record";
      text2 = coversAllHistory ? "Rekord — najlepszy wynik w historii" : `Najlepszy wynik w ostatnich ${spanText(history, current.day)}`;
    } else if (monthsSinceBetter !== null && monthsSinceBetter >= NOTABLE_MONTHS) {
      kind = "notable";
      text2 = `Najlepszy od ${monthsText(monthsSinceBetter)}`;
    } else if (rank <= TOP_RANK) {
      kind = "notable";
      text2 = coversAllHistory ? `${rank}. najlepszy wynik w historii` : `${rank}. najlepszy wynik w ostatnich ${spanText(history, current.day)}`;
    }
    if (kind === null) continue;
    out.push({
      key: metric.key,
      label: metric.label,
      value: metric.format(value),
      ...metric.unit === void 0 ? {} : { unit: metric.unit },
      kind,
      text: text2,
      rank,
      outOf
    });
  }
  const order = new Map(METRICS.map((m, i) => [m.key, i]));
  return out.sort(
    (a, b) => Number(b.kind === "record") - Number(a.kind === "record") || a.rank - b.rank || (order.get(a.key) ?? 0) - (order.get(b.key) ?? 0)
  );
}
function longestZeroRun(stream) {
  if (!stream || stream.length === 0) return 0;
  let best = 0;
  let run = 0;
  for (const v of stream) {
    if (v === 0) {
      run++;
      if (run > best) best = run;
    } else if (Number.isFinite(v)) {
      run = 0;
    }
  }
  return best;
}
function buildSuspects(input) {
  const out = [];
  const {
    sport,
    distanceM: distanceM2,
    durationS,
    movingS,
    elevationGainM,
    avgSpeedMps,
    maxSpeedMps,
    avgHr,
    maxHr,
    cadence
  } = input;
  const maxKmh = isNum(maxSpeedMps) && maxSpeedMps > 0 ? maxSpeedMps * 3.6 : null;
  const avgKmh = isNum(avgSpeedMps) && avgSpeedMps > 0 ? avgSpeedMps * 3.6 : null;
  const ceiling = SPEED_CEILING_KMH[sport];
  const overCeiling = maxKmh !== null && ceiling !== void 0 && maxKmh > ceiling;
  if (overCeiling && maxKmh !== null && ceiling !== void 0) {
    out.push({
      key: "maxSpeedCeiling",
      label: "Maks. prędkość",
      value: `${fixed(maxKmh, 1)} km/h`,
      text: `Powyżej ${ceiling} km/h dla tego sportu — praktycznie zawsze skok GPS, nie rzeczywista prędkość. Średnie liczone ze strumienia prędkości też będą przez to zawyżone.`,
      severity: "warn"
    });
  } else if (maxKmh !== null && avgKmh !== null && avgKmh > 1 && maxKmh / avgKmh >= SPIKE_RATIO) {
    out.push({
      key: "maxSpeedSpike",
      label: "Maks. prędkość",
      value: `${fixed(maxKmh, 1)} km/h`,
      text: `${fixed(maxKmh / avgKmh, 1)}× więcej niż średnia ${fixed(avgKmh, 1)} km/h. Zwykle pojedynczy skok GPS, np. po wyjściu z tunelu albo spod drzew.`,
      severity: "info"
    });
  }
  if (isNum(elevationGainM) && isNum(distanceM2) && distanceM2 >= 1e3) {
    const km = distanceM2 / 1e3;
    const perKm = elevationGainM / km;
    if (perKm > CLIMB_PER_KM_CEILING) {
      out.push({
        key: "elevationPerKm",
        label: "Przewyższenie",
        value: `${fixed(elevationGainM, 0)} m / ${fixed(km, 2)} km`,
        text: `${fixed(perKm, 0)} m na kilometr. Powyżej ${CLIMB_PER_KM_CEILING} m/km to zwykle dryf barometru albo wysokość liczona z GPS, a nie taki podbieg.`,
        severity: "warn"
      });
    }
  }
  if (isNum(maxHr) && maxHr >= HR_CEILING_BPM) {
    out.push({
      key: "maxHrCeiling",
      label: "Maks. tętno",
      value: `${fixed(maxHr, 0)} bpm`,
      text: `${HR_CEILING_BPM} bpm i więcej to niemal zawsze artefakt paska — najczęściej złapana kadencja albo zakłócenie na starcie, zanim pasek się zwilżył.`,
      severity: "warn"
    });
  } else if (isNum(maxHr) && isNum(avgHr) && maxHr - avgHr >= HR_SPIKE_GAP_BPM) {
    out.push({
      key: "hrSpike",
      label: "Maks. tętno",
      value: `${fixed(maxHr, 0)} bpm`,
      text: `O ${fixed(maxHr - avgHr, 0)} bpm powyżej średniej ${fixed(avgHr, 0)} bpm. Przy treningu ciągłym taka różnica to raczej pojedynczy skok niż wysiłek.`,
      severity: "info"
    });
  }
  const timeForSpeed = isNum(movingS) && movingS > 0 ? movingS : durationS;
  if (isNum(distanceM2) && isNum(timeForSpeed) && timeForSpeed > 0 && avgKmh !== null) {
    const impliedKmh = distanceM2 / timeForSpeed * 3.6;
    const drift = Math.abs(impliedKmh - avgKmh) / avgKmh;
    if (drift > SPEED_MISMATCH_PCT) {
      out.push({
        key: "speedMismatch",
        label: "Dystans i czas",
        value: `${fixed(impliedKmh, 1)} vs ${fixed(avgKmh, 1)} km/h`,
        text: `Dystans podzielony przez czas daje ${fixed(impliedKmh, 1)} km/h, a zegarek raportuje średnią ${fixed(avgKmh, 1)} km/h — rozjazd ${fixed(drift * 100, 0)}%. Zwykle znaczy to, że część zapisu zginęła albo dystans pochodzi z innego źródła niż prędkość.`,
        severity: "info"
      });
    }
  }
  if (isNum(movingS) && isNum(durationS) && movingS > durationS + 5) {
    out.push({
      key: "movingOverElapsed",
      label: "Czas w ruchu",
      value: `${fmtDurationValue(movingS)} / ${fmtDurationValue(durationS)}`,
      text: "Czas w ruchu jest dłuższy od całkowitego, co nie jest możliwe. Najczęściej efekt sklejenia zapisu po pauzie albo wznowienia aktywności.",
      severity: "warn"
    });
  }
  if (sport === "run" || sport === "walk" || sport === "ride") {
    const gap = longestZeroRun(cadence);
    if (gap >= CADENCE_GAP_SAMPLES) {
      out.push({
        key: "cadenceGap",
        label: "Kadencja",
        value: `${fixed(gap, 0)} próbek zerowych`,
        text: `Najdłuższy ciąg zer to ${fixed(gap, 0)} próbek pod rząd. Przy zapisie sekundowym to około ${fixed(gap / 60, 0)} min bez sygnału — zwykle czujnik odpadł, a średnia kadencja jest przez to zaniżona.`,
        severity: "info"
      });
    }
  }
  return out.sort((a, b) => Number(b.severity === "warn") - Number(a.severity === "warn"));
}
const SIMILAR_TOLERANCE = 0.15;
const SIMILAR_LIMIT = 6;
function paceOf$1(distanceM2, durationS) {
  if (distanceM2 === null || durationS === null) return null;
  if (distanceM2 <= 0 || durationS <= 0) return null;
  return Math.round(durationS / (distanceM2 / 1e3));
}
function relative(current, candidate) {
  if (current === null || candidate === null || current === 0) return null;
  return (candidate - current) / current;
}
function delta(current, candidate) {
  const rel = relative(current, candidate);
  return {
    pct: rel === null ? null : Math.round(rel * 1e3) / 10,
    abs: current === null || candidate === null ? null : Math.round((candidate - current) * 10) / 10
  };
}
function isComparable(a) {
  return a.distanceM !== null && a.distanceM > 0 && a.durationS !== null && a.durationS > 0;
}
function findSimilarActivities(current, candidates, options = {}) {
  if (!isComparable(current)) return null;
  const tolerance = options.tolerance ?? SIMILAR_TOLERANCE;
  const limit = options.limit ?? SIMILAR_LIMIT;
  const currentPace = paceOf$1(current.distanceM, current.durationS);
  const matched = [];
  let comparedCount = 0;
  for (const c of candidates) {
    if (c.activityId === current.activityId) continue;
    if (!isComparable(c)) continue;
    comparedCount += 1;
    const dDistance = relative(current.distanceM, c.distanceM);
    const dDuration = relative(current.durationS, c.durationS);
    if (dDistance === null || dDuration === null) continue;
    if (Math.abs(dDistance) > tolerance || Math.abs(dDuration) > tolerance) continue;
    matched.push({
      ...c,
      paceSecPerKm: paceOf$1(c.distanceM, c.durationS),
      closeness: Math.abs(dDistance) + Math.abs(dDuration),
      pace: delta(currentPace, paceOf$1(c.distanceM, c.durationS)),
      hr: delta(current.avgHr, c.avgHr),
      power: delta(current.avgPower, c.avgPower),
      distance: delta(current.distanceM, c.distanceM),
      duration: delta(current.durationS, c.durationS)
    });
  }
  matched.sort((a, b) => a.closeness - b.closeness || b.day.localeCompare(a.day));
  return {
    entries: matched.slice(0, limit),
    comparedCount,
    tolerancePct: Math.round(tolerance * 100),
    coversAllHistory: options.coversAllHistory ?? true
  };
}
const CELL_METRES = 50;
const MIN_SIMILARITY = 0.7;
const LENGTH_TOLERANCE = 0.15;
const MIN_TRACK_M = 800;
const M_PER_DEG_LAT = 111320;
function cellOf(lat, lng) {
  const latStep = CELL_METRES / M_PER_DEG_LAT;
  const latIndex = Math.round(lat / latStep);
  const cos = Math.max(0.01, Math.cos(latIndex * latStep * Math.PI / 180));
  const lngStep = latStep / cos;
  return `${latIndex}:${Math.round(lng / lngStep)}`;
}
function distanceM(a, b) {
  const toRad = Math.PI / 180;
  const dLat = (b[0] - a[0]) * toRad;
  const dLng = (b[1] - a[1]) * toRad;
  const lat1 = a[0] * toRad;
  const lat2 = b[0] * toRad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371e3 * Math.asin(Math.min(1, Math.sqrt(h)));
}
const usable = (p) => Array.isArray(p) && p.length >= 2 && Number.isFinite(p[0]) && Number.isFinite(p[1]) && Math.abs(p[0]) <= 90 && Math.abs(p[1]) <= 180;
function routeFingerprint(track) {
  if (!track || track.length < 2) return null;
  const cells = /* @__PURE__ */ new Set();
  let lengthM = 0;
  let previous = null;
  let first = null;
  let last = null;
  let points = 0;
  for (const p of track) {
    if (!usable(p)) continue;
    points++;
    cells.add(cellOf(p[0], p[1]));
    if (previous) lengthM += distanceM(previous, p);
    if (!first) first = p;
    last = p;
    previous = p;
  }
  if (!first || !last || points < 2 || lengthM < MIN_TRACK_M) return null;
  return {
    cells: [...cells].sort(),
    startCell: cellOf(first[0], first[1]),
    endCell: cellOf(last[0], last[1]),
    lengthM: Math.round(lengthM),
    points
  };
}
function similarity(a, b) {
  const smaller = a.cells.length <= b.cells.length ? a.cells : b.cells;
  const larger = new Set(a.cells.length <= b.cells.length ? b.cells : a.cells);
  let shared = 0;
  for (const cell of smaller) if (larger.has(cell)) shared++;
  const union = a.cells.length + b.cells.length - shared;
  return union === 0 ? 0 : round3(shared / union);
}
function lengthsMatch(a, b, tolerance = LENGTH_TOLERANCE) {
  const longer = Math.max(a, b);
  return longer > 0 && Math.abs(a - b) / longer <= tolerance;
}
function matchRoutes(target, candidates, opts = {}) {
  const minSimilarity = opts.minSimilarity ?? MIN_SIMILARITY;
  const tolerance = opts.lengthTolerance ?? LENGTH_TOLERANCE;
  const out = [];
  for (const c of candidates) {
    if (!lengthsMatch(target.lengthM, c.fingerprint.lengthM, tolerance)) continue;
    const s = similarity(target, c.fingerprint);
    if (s < minSimilarity) continue;
    out.push({
      value: c.value,
      similarity: s,
      sameStart: target.startCell === c.fingerprint.startCell,
      sameEnd: target.endCell === c.fingerprint.endCell,
      lengthM: c.fingerprint.lengthM
    });
  }
  return out.sort((a, b) => b.similarity - a.similarity);
}
function decimate(track, step2) {
  if (track.length <= 2) return [...track];
  const out = [];
  for (let i = 0; i < track.length; i += step2) {
    const p = track[i];
    if (p) out.push(p);
  }
  const last = track[track.length - 1];
  if (last && out[out.length - 1] !== last) out.push(last);
  return out;
}
function round3(v) {
  return Math.round(v * 1e3) / 1e3;
}
const PACING_CHUNKS = 10;
const MIN_DISTANCE_M = 1500;
const SPLIT_TOLERANCE_PCT = 3;
const VARIABLE_CV_PCT = 12;
function pacing(cumulativeM, elapsedS) {
  if (!cumulativeM || !elapsedS) return null;
  const n = Math.min(cumulativeM.length, elapsedS.length);
  if (n < 4) return null;
  const startM = cumulativeM[0] ?? 0;
  const startT = elapsedS[0] ?? 0;
  const totalM = (cumulativeM[n - 1] ?? 0) - startM;
  const totalT = (elapsedS[n - 1] ?? 0) - startT;
  if (!(totalM >= MIN_DISTANCE_M) || !(totalT > 0)) return null;
  const timeAt = (metres) => {
    const target = startM + metres;
    for (let i = 1; i < n; i++) {
      const prevM = cumulativeM[i - 1] ?? 0;
      const hereM = cumulativeM[i] ?? 0;
      if (hereM < target) continue;
      const prevT = elapsedS[i - 1] ?? 0;
      const hereT = elapsedS[i] ?? 0;
      const span = hereM - prevM;
      const fraction = span > 0 ? (target - prevM) / span : 0;
      return prevT + (hereT - prevT) * fraction - startT;
    }
    return totalT;
  };
  const halfT = timeAt(totalM / 2);
  const firstHalfPace = paceOf(totalM / 2, halfT);
  const secondHalfPace = paceOf(totalM / 2, totalT - halfT);
  if (firstHalfPace === null || secondHalfPace === null) return null;
  const splitPct = round1$1((secondHalfPace - firstHalfPace) / firstHalfPace * 100);
  const chunkM = totalM / PACING_CHUNKS;
  const paces = [];
  let previousT = 0;
  for (let k = 1; k <= PACING_CHUNKS; k++) {
    const t = timeAt(chunkM * k);
    const pace = paceOf(chunkM, t - previousT);
    if (pace !== null) paces.push(pace);
    previousT = t;
  }
  const variabilityPct = coefficientOfVariation(paces);
  return {
    splitPct,
    firstHalfPaceSecPerKm: Math.round(firstHalfPace),
    secondHalfPaceSecPerKm: Math.round(secondHalfPace),
    variabilityPct,
    shape: shapeOf(splitPct, variabilityPct),
    chunks: paces.length
  };
}
function shapeOf(splitPct, variabilityPct) {
  if (variabilityPct > VARIABLE_CV_PCT) return "variable";
  if (splitPct > SPLIT_TOLERANCE_PCT) return "faded";
  if (splitPct < -SPLIT_TOLERANCE_PCT) return "negative-split";
  return "even";
}
function paceOf(metres, seconds) {
  if (!(metres > 0) || !(seconds > 0)) return null;
  return seconds / (metres / 1e3);
}
function coefficientOfVariation(values) {
  if (values.length < 2) return 0;
  const mean = values.reduce((s, v) => s + v, 0) / values.length;
  if (!(mean > 0)) return 0;
  const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length;
  return round1$1(Math.sqrt(variance) / mean * 100);
}
function round1$1(v) {
  return Math.round(v * 10) / 10;
}
const MAX_DROP_M = 10;
const MIN_GAIN_M = 30;
const MIN_GRADE_PCT = 2;
const CATEGORIES = [
  { key: "hc", label: "HC", minScore: 8e4 },
  { key: "c1", label: "1. kat.", minScore: 64e3 },
  { key: "c2", label: "2. kat.", minScore: 32e3 },
  { key: "c3", label: "3. kat.", minScore: 16e3 },
  { key: "c4", label: "4. kat.", minScore: 8e3 },
  { key: "uncat", label: "Bez kat.", minScore: 0 }
];
function categoryFor(score) {
  for (const c of CATEGORIES) {
    if (score >= c.minScore) return { key: c.key, label: c.label };
  }
  return { key: "uncat", label: "Bez kat." };
}
function findClimbs(elevation, cumulativeM, elapsedS) {
  if (!elevation || !cumulativeM || !elapsedS) return [];
  const n = Math.min(elevation.length, cumulativeM.length, elapsedS.length);
  if (n < 3) return [];
  const climbs = [];
  let open = null;
  const finish = (o) => {
    const gainM = o.peakElevation - o.startElevation;
    const distanceM2 = (cumulativeM[o.peakIndex] ?? 0) - (cumulativeM[o.startIndex] ?? 0);
    const durationS = (elapsedS[o.peakIndex] ?? 0) - (elapsedS[o.startIndex] ?? 0);
    if (!(gainM >= MIN_GAIN_M) || !(distanceM2 > 0) || !(durationS > 0)) return;
    const gradePct = gainM / distanceM2 * 100;
    if (!(gradePct >= MIN_GRADE_PCT)) return;
    const score = Math.round(gainM * gradePct);
    const category = categoryFor(score);
    climbs.push({
      index: climbs.length + 1,
      gainM: Math.round(gainM),
      distanceM: Math.round(distanceM2),
      durationS: Math.round(durationS),
      gradePct: round1(gradePct),
      // Metres per hour: the climb's rate of ascent, pauses included.
      vam: Math.round(gainM / durationS * 3600),
      startS: Math.round(elapsedS[o.startIndex] ?? 0),
      score,
      categoryKey: category.key,
      categoryLabel: category.label
    });
  };
  for (let i = 1; i < n; i++) {
    const here = elevation[i];
    const previous = elevation[i - 1];
    if (here === void 0 || previous === void 0) continue;
    if (!Number.isFinite(here) || !Number.isFinite(previous)) continue;
    if (here > previous) {
      if (!open) {
        open = {
          startIndex: i - 1,
          peakIndex: i,
          peakElevation: here,
          startElevation: previous
        };
      } else if (here > open.peakElevation) {
        open.peakElevation = here;
        open.peakIndex = i;
      }
      continue;
    }
    if (!open) continue;
    if (open.peakElevation - here > MAX_DROP_M) {
      finish(open);
      open = null;
    }
  }
  if (open) finish(open);
  return climbs;
}
function round1(v) {
  return Math.round(v * 10) / 10;
}
function positiveNumber(v) {
  return typeof v === "number" && Number.isFinite(v) && v > 0 ? v : null;
}
const meanOf = (xs) => xs.length === 0 ? null : Math.round(xs.reduce((s, x) => s + x, 0) / xs.length);
const maxOf = (xs) => xs.length === 0 ? null : Math.round(Math.max(...xs));
function effectiveDuration(summaryDuration, power, time) {
  if (summaryDuration && summaryDuration > 0) return summaryDuration;
  if (time && time.length >= 2) return time[time.length - 1] - time[0];
  if (power && power.length > 0) return power.length * sampleIntervalS(time);
  return null;
}
function withStreamFallbacks(stats, streams, typedSplits, elapsedS) {
  const runWalk = runWalkFromSplits(typedSplits);
  const avgC = stats.temperature.avgC ?? streamAverage(streams?.temperature);
  const gapSpeed = meanGradeAdjustedSpeed(streams?.speed, streams?.grade, elapsedS);
  const gradeAdjustedSecPerKm = stats.pace.gradeAdjustedSecPerKm ?? (gapSpeed !== null && gapSpeed > 0 ? Math.round(1e3 / gapSpeed) : void 0);
  return {
    ...stats,
    ...Object.keys(runWalk).length > 0 ? { runWalk } : {},
    ...avgC === void 0 ? {} : { temperature: { ...stats.temperature, avgC } },
    ...gradeAdjustedSecPerKm === void 0 ? {} : { pace: { ...stats.pace, gradeAdjustedSecPerKm } }
  };
}
function localDay(startTimeLocal) {
  return startTimeLocal.slice(0, 10);
}
const comparable = (a) => ({
  day: localDay(a.startTimeLocal),
  durationS: a.movingS ?? a.durationS,
  trainingLoad: a.trainingLoad,
  avgHr: a.avgHr,
  maxHr: a.maxHr
});
const forHighlights = (a) => ({
  day: localDay(a.startTimeLocal),
  distanceM: a.distanceM,
  durationS: a.movingS ?? a.durationS,
  elevationGainM: a.elevationGainM,
  calories: a.calories,
  trainingLoad: a.trainingLoad,
  normPower: a.normPower
});
const HIGHLIGHT_LIMIT = 2e3;
async function loadHistory(deps, userId, activity) {
  const day = localDay(activity.startTimeLocal);
  const family = sportGroup(activity.sport);
  const sports = family === "other" ? [] : sportKeysInGroup(family);
  const rows = await deps.store.listActivities(userId, {
    to: day,
    limit: HIGHLIGHT_LIMIT,
    ...sports.length > 0 ? { sports } : {}
  });
  const earlier = rows.filter((a) => a.activityId !== activity.activityId && sportGroup(a.sport) === family);
  const windowStart = addDays(day, -120);
  return {
    comparable: earlier.filter((a) => localDay(a.startTimeLocal) >= windowStart).map(comparable),
    rankable: earlier.map(forHighlights),
    coversAllHistory: rows.length < HIGHLIGHT_LIMIT
  };
}
const SIMILAR_SCAN_LIMIT = 2e3;
const forSimilar = (a) => ({
  activityId: a.activityId,
  day: localDay(a.startTimeLocal),
  name: a.name,
  distanceM: a.distanceM,
  durationS: a.movingS ?? a.durationS,
  avgHr: a.avgHr,
  avgPower: a.avgPower,
  elevationGainM: a.elevationGainM
});
async function loadSimilarActivities(deps, userId, activity) {
  const family = sportGroup(activity.sport);
  const sports = family === "other" ? [] : sportKeysInGroup(family);
  const rows = await deps.store.listActivities(userId, {
    limit: SIMILAR_SCAN_LIMIT,
    ...sports.length > 0 ? { sports } : {}
  });
  const candidates = rows.filter((a) => sportGroup(a.sport) === family).map(forSimilar);
  return findSimilarActivities(forSimilar(activity), candidates, {
    coversAllHistory: rows.length < SIMILAR_SCAN_LIMIT
  });
}
const ROUTE_DECIMATION = 4;
async function loadMatchedRoute(deps, userId, activity, track) {
  if (!track) return null;
  const target = routeFingerprint(decimate(track, ROUTE_DECIMATION));
  if (!target) return null;
  const family = sportGroup(activity.sport);
  const tracks = await deps.store.listGpsTracks(userId);
  const candidates = [];
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
  const summaries = await Promise.all(matches.map((m) => deps.store.getActivity(userId, m.value.id)));
  const similarityById = new Map(matches.map((m) => [m.value.id, m.similarity]));
  const rowOf = (a, similarity2, isCurrent) => {
    const durationS = a.movingS ?? a.durationS;
    return {
      activityId: a.activityId,
      day: localDay(a.startTimeLocal),
      name: a.name,
      distanceM: a.distanceM,
      durationS,
      avgHr: a.avgHr,
      paceSecPerKm: a.distanceM !== null && a.distanceM > 0 && durationS !== null && durationS > 0 ? Math.round(durationS / (a.distanceM / 1e3)) : null,
      similarity: similarity2,
      isCurrent
    };
  };
  const rows = [rowOf(activity, 1, true)];
  for (const s of summaries) {
    if (!s) continue;
    rows.push(rowOf(s, similarityById.get(s.activityId) ?? 0, false));
  }
  rows.sort((a, b) => {
    if (a.paceSecPerKm === null) return b.paceSecPerKm === null ? 0 : 1;
    if (b.paceSecPerKm === null) return -1;
    return a.paceSecPerKm - b.paceSecPerKm;
  });
  const entries = rows.map((r, i) => ({ ...r, rank: i + 1 }));
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
const CALENDAR_PROBE_DAYS = 30;
async function loadPlanned(deps, userId, activity) {
  const day = localDay(activity.startTimeLocal);
  const nearby = await deps.store.listPlannedEvents(
    userId,
    addDays(day, -CALENDAR_PROBE_DAYS),
    addDays(day, CALENDAR_PROBE_DAYS)
  );
  return {
    sameDay: nearby.filter((e) => e.day === day),
    calendarHasData: nearby.length > 0,
    sport: activity.sport
  };
}
function chartStreams(streams) {
  if (!streams) return {};
  const { gps: _gps, laps: _laps, typedSplits: _typedSplits, ...rest } = streams;
  return rest;
}
async function loadActivityDetail(deps, userId, activityId) {
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
  let powerBlock = null;
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
  let hrBlock = null;
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
  const trainingComparison = /^\d{4}-\d{2}-\d{2}$/.test(day) ? buildTrainingComparison({
    day,
    activity: comparable(activity),
    history: history.comparable,
    planned,
    actual: {
      durationS: activity.movingS ?? activity.durationS,
      distanceM: activity.distanceM,
      load: activity.trainingLoad
    },
    hrMax: positiveNumber(settings.maxHrBpm)
  }) : null;
  const streamSampleCount = streamLength(chartStreams(streams));
  const elapsed = streams ? elapsedSeconds(streams, streamSampleCount) : [];
  const stats = withStreamFallbacks(extractActivityStats(activity.raw), streams, typedSplits, elapsed);
  const family = sportGroup(activity.sport);
  const highlights = buildHighlights({
    sport: family,
    current: forHighlights(activity),
    history: history.rankable,
    coversAllHistory: history.coversAllHistory
  });
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
  const movingS = activity.movingS ?? activity.durationS;
  const derivedSpeed = activity.distanceM !== null && movingS !== null && movingS > 0 ? activity.distanceM / movingS : null;
  const avgSpeedMps = stats.pace.avgSpeedMps ?? derivedSpeed;
  const efficiency = {
    decoupling: power && power.length > 0 ? aerobicDecoupling(power, hr, "power") : aerobicDecoupling(streams?.speed, hr, "pace"),
    ef: efficiencyFactor(avgSpeedMps, activity.avgHr),
    powerEf: powerEfficiencyFactor(activity.normPower ?? powerBlock?.np ?? null, activity.avgHr),
    cardiacCost: cardiacCost(activity.distanceM, movingS, activity.avgHr)
  };
  const distanceAxis = streams ? cumulativeDistance(streams, elapsed) : null;
  const efforts = streams && isPaceSport(family) ? bestEfforts(distanceAxis, elapsed) : [];
  const pace = pacing(distanceAxis, elapsed);
  const climbs = findClimbs(streams?.elevation, distanceAxis, elapsed);
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
const DATA_PROCESSING = "detailed_analytics";
const load = async ({ locals, params }) => {
  const user = locals.user;
  if (!await locals.consent.isEnabled(DATA_PROCESSING)) throw redirect(303, "/");
  const container = locals.container;
  const detail = await loadActivityDetail(
    { store: container.store, settings: container.repo.settings },
    user.id,
    params.id
  );
  if (!detail) throw error(404, "Nie znaleziono aktywności");
  return { detail };
};

var _page_server_ts = /*#__PURE__*/Object.freeze({
  __proto__: null,
  load: load
});

export { _page_server_ts as _ };
//# sourceMappingURL=_page.server.ts.js-CeBR507p.js.map
