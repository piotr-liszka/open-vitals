import { c as cardiacCostStream } from './efficiency.js-DJ-LuYeW.js';
import { g as gradeAdjustedStream } from './pace-model.js-DDe_pC8X.js';
import { s as streamLength, e as elapsedSeconds, c as cumulativeDistance } from './stream-axes.js-Dkquxzlu.js';

const BAND_LABELS = {
  fresh: "świeżość",
  optimal: "forma optymalna",
  neutral: "równowaga",
  fatigued: "zmęczenie",
  "very-fatigued": "duże zmęczenie"
};
function bandLabel(band) {
  return BAND_LABELS[band];
}
const VERDICT_LABELS = {
  easy: "Lżejszy niż zwykle",
  steady: "Typowa sesja",
  hard: "Mocniejszy niż zwykle",
  peak: "Najmocniejszy od tygodni",
  unknown: "Brak porównania"
};
function verdictLabel(verdict) {
  return VERDICT_LABELS[verdict];
}
const DASH = "—";
const LOCALE = "pl-PL";
const formatters = /* @__PURE__ */ new Map();
function numberFormat(digits) {
  let fmt = formatters.get(digits);
  if (!fmt) {
    fmt = new Intl.NumberFormat(LOCALE, { maximumFractionDigits: digits, minimumFractionDigits: 0 });
    formatters.set(digits, fmt);
  }
  return fmt;
}
function isNum(value) {
  return typeof value === "number" && Number.isFinite(value);
}
function fmtNum(value, digits = 0) {
  return isNum(value) ? numberFormat(digits).format(value) : DASH;
}
function fmtSigned(value, digits = 0) {
  if (!isNum(value)) return DASH;
  const body = numberFormat(digits).format(Math.abs(value));
  if (value > 0) return `+${body}`;
  if (value < 0) return `−${body}`;
  return body;
}
function pad(n) {
  return String(n).padStart(2, "0");
}
function fmtDuration(seconds) {
  if (!isNum(seconds) || seconds < 0) return DASH;
  const total = Math.floor(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor(total % 3600 / 60);
  const s = total % 60;
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}
function fmtClock(seconds) {
  if (!isNum(seconds) || seconds < 0) return DASH;
  const total = Math.round(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor(total % 3600 / 60);
  const s = total % 60;
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}
const MAX_SENSIBLE_PACE_S = 30 * 60;
function fmtPace(secPerKm) {
  if (!isNum(secPerKm) || secPerKm <= 0 || secPerKm > MAX_SENSIBLE_PACE_S) return DASH;
  const total = Math.round(secPerKm);
  return `${Math.floor(total / 60)}:${pad(total % 60)}`;
}
function paceFromMps(speedMps) {
  if (!isNum(speedMps) || speedMps <= 0) return null;
  const pace = 1e3 / speedMps;
  return pace > MAX_SENSIBLE_PACE_S ? null : pace;
}
function speedKmh(speedMps) {
  return isNum(speedMps) && speedMps >= 0 ? speedMps * 3.6 : null;
}
function toKm(metres) {
  return isNum(metres) ? metres / 1e3 : null;
}
function fmtKm(metres, digits = 2) {
  return fmtNum(toKm(metres), digits);
}
const SIMILAR_METRICS = [
  { key: "pace", noun: "tempo", unit: "pace", lowerIsBetter: true },
  { key: "hr", noun: "tętno", unit: "bpm", lowerIsBetter: true },
  // More power for the same distance and time is more work done, so up is the good direction.
  { key: "power", noun: "moc", unit: "W", lowerIsBetter: false }
];
const SAME_PCT = 0.5;
function similarDeltaBadge(delta, metric) {
  if (delta.abs === null || delta.pct === null) return null;
  if (Math.abs(delta.pct) < SAME_PCT) {
    return {
      direction: "same",
      arrow: "none",
      value: "bez zmian",
      label: `${metric.noun} bez zmian względem tego treningu`
    };
  }
  const todayDelta = -delta.abs;
  const todayIsLower = todayDelta < 0;
  const magnitude = metric.unit === "pace" ? fmtPace(Math.abs(todayDelta)) : `${fmtNum(Math.abs(todayDelta))} ${metric.unit}`;
  return {
    direction: todayIsLower === metric.lowerIsBetter ? "better" : "worse",
    arrow: todayIsLower ? "down" : "up",
    value: magnitude,
    label: `dziś ${metric.noun} ${todayIsLower ? "niżej" : "wyżej"} o ${magnitude} niż w tym treningu`
  };
}
const BENEFIT_LABELS = {
  RECOVERY: "Regeneracja",
  BASE: "Baza tlenowa",
  AEROBIC_BASE: "Baza tlenowa",
  TEMPO: "Tempo",
  THRESHOLD: "Próg mleczanowy",
  LACTATE_THRESHOLD: "Próg mleczanowy",
  VO2MAX: "VO2 max",
  VO2_MAX: "VO2 max",
  ANAEROBIC_CAPACITY: "Wydolność beztlenowa",
  ANAEROBIC: "Beztlenowy",
  SPEED: "Szybkość",
  SPRINT: "Sprint",
  MAINTAINING: "Podtrzymanie",
  IMPACT_NONE: "Bez wpływu",
  UNKNOWN: "Nieokreślony",
  NO_BENEFIT: "Bez wyraźnej korzyści"
};
function benefitLabel(raw) {
  if (!raw) return null;
  const key = raw.toUpperCase();
  const known = BENEFIT_LABELS[key];
  if (known) return known;
  return key.split(/[_\s]+/).filter((w) => w.length > 0).map((w) => w.charAt(0) + w.slice(1).toLowerCase()).join(" ");
}
const SPLIT_LABELS = {
  RWD_RUN: "Bieg",
  RWD_WALK: "Marsz",
  RWD_STAND: "Postój",
  INTERVAL_ACTIVE: "Interwał",
  INTERVAL_REST: "Przerwa",
  INTERVAL_WARMUP: "Rozgrzewka",
  INTERVAL_COOLDOWN: "Schłodzenie",
  RUN: "Bieg",
  WALK: "Marsz",
  STAND: "Postój",
  REST: "Odpoczynek"
};
function splitLabel(raw) {
  if (!raw) return "Odcinek";
  return SPLIT_LABELS[raw.toUpperCase()] ?? benefitLabel(raw) ?? "Odcinek";
}
const DEFAULT_TARGET_POINTS = 600;
const SECTION_TITLES = {
  effort: "Wysiłek",
  terrain: "Teren i warunki",
  physiology: "Fizjologia",
  dynamics: "Dynamika biegu"
};
function chartGroupTitle(group) {
  return SECTION_TITLES[group];
}
function isPaceSport(group) {
  return group === "run" || group === "walk" || group === "swim";
}
function latticeOverAxis(axis, count) {
  const n = axis.length;
  if (n === 0) return [];
  if (n <= count) return axis.map((_, i) => i);
  const first = axis[0] ?? 0;
  const last = axis[n - 1] ?? 0;
  const span = last - first;
  if (span <= 0) return uniformLattice(n, count);
  const out = [];
  let j = 0;
  for (let k = 0; k < count; k++) {
    const target = first + span * k / (count - 1);
    while (j + 1 < n && (axis[j + 1] ?? last) <= target) j++;
    out.push(j);
  }
  out[out.length - 1] = n - 1;
  return out;
}
function uniformLattice(n, count) {
  if (n <= 0) return [];
  if (n <= count) return Array.from({ length: n }, (_, i) => i);
  const out = [];
  for (let k = 0; k < count; k++) out.push(Math.round(k * (n - 1) / (count - 1)));
  return out;
}
function sampleAt(values, indices) {
  if (!values) return [];
  return indices.map((i) => {
    const v = values[i];
    return typeof v === "number" && Number.isFinite(v) ? v : Number.NaN;
  });
}
function definedCount(values) {
  let c = 0;
  for (const v of values) if (Number.isFinite(v)) c++;
  return c;
}
function buildActivityCharts(streams, sport, indices) {
  const pace = isPaceSport(sport);
  const inputs = [
    {
      key: "heartRate",
      title: "Tętno",
      unit: "bpm",
      color: "var(--lane-red)",
      group: "effort",
      kind: "int",
      source: streams.heartRate,
      area: true
    },
    pace ? {
      key: "pace",
      title: "Tempo",
      unit: "min/km",
      note: "Wyżej na wykresie = wolniej.",
      color: "var(--lane-orange)",
      group: "effort",
      kind: "pace",
      source: streams.speed,
      transform: paceFromMps
    } : {
      key: "speed",
      title: "Prędkość",
      unit: "km/h",
      color: "var(--lane-orange)",
      group: "effort",
      kind: "decimal",
      source: streams.speed,
      transform: (v) => v >= 0 ? v * 3.6 : null
    },
    // Derived, not recorded (spec 042): the flat-ground pace this effort was worth. Only offered for
    // pace sports and only when a grade stream exists, so a flat run never gets a duplicate of its pace
    // chart.
    ...pace && streams.grade ? [
      {
        key: "gradeAdjustedPace",
        title: "Tempo skorygowane o nachylenie",
        unit: "min/km",
        note: "Tempo, jakie ten wysiłek dałby na płasko. Na podbiegu szybsze od rzeczywistego, na zbiegu wolniejsze.",
        color: "var(--lane-lime)",
        group: "effort",
        kind: "pace",
        source: gradeAdjustedStream(streams.speed, streams.grade),
        transform: paceFromMps
      }
    ] : [],
    {
      key: "power",
      title: "Moc",
      unit: "W",
      color: "var(--lane-amber)",
      group: "effort",
      kind: "int",
      source: streams.power,
      area: true
    },
    {
      key: "cadence",
      title: "Kadencja",
      unit: pace ? "kroki/min" : "obr./min",
      color: "var(--lane-violet)",
      group: "effort",
      kind: "int",
      source: streams.cadence
    },
    {
      key: "elevation",
      title: "Wysokość",
      unit: "m n.p.m.",
      color: "var(--lane-green)",
      group: "terrain",
      kind: "int",
      source: streams.elevation,
      area: true
    },
    {
      key: "grade",
      title: "Nachylenie",
      unit: "%",
      color: "var(--lane-lime)",
      group: "terrain",
      kind: "decimal",
      source: streams.grade
    },
    {
      key: "temperature",
      title: "Temperatura",
      unit: "°C",
      color: "var(--lane-sky)",
      group: "terrain",
      kind: "decimal",
      source: streams.temperature
    },
    {
      // Derived, not recorded (spec 038): the cost of each moment rather than of the whole session.
      // Drawn in the physiology group because it is a body measure, not an effort the athlete chose.
      key: "cardiacCost",
      title: "Koszt sercowy",
      unit: "uderzeń/km",
      note: "Uderzenia serca na kilometr. Niżej = taniej. Rośnie, gdy tętno dryfuje przy tym samym tempie.",
      color: "var(--lane-red)",
      group: "physiology",
      kind: "int",
      source: cardiacCostStream(streams.speed, streams.heartRate)
    },
    {
      key: "respirationRate",
      title: "Oddech",
      unit: "odd./min",
      color: "var(--lane-teal)",
      group: "physiology",
      kind: "decimal",
      source: streams.respirationRate
    },
    {
      key: "performanceCondition",
      title: "Kondycja fizyczna",
      unit: "pkt",
      color: "var(--lane-cyan)",
      group: "physiology",
      kind: "int",
      source: streams.performanceCondition
    },
    {
      key: "verticalRatio",
      title: "Stosunek pionowy",
      unit: "%",
      color: "var(--lane-indigo)",
      group: "dynamics",
      kind: "decimal",
      source: streams.verticalRatio
    },
    {
      key: "verticalOscillation",
      title: "Oscylacja pionowa",
      unit: "cm",
      color: "var(--lane-violet)",
      group: "dynamics",
      kind: "decimal",
      source: streams.verticalOscillation
    },
    {
      key: "groundContactTime",
      title: "Czas kontaktu z podłożem",
      unit: "ms",
      color: "var(--lane-amber)",
      group: "dynamics",
      kind: "int",
      source: streams.groundContactTime
    },
    {
      key: "groundContactBalance",
      title: "Balans kontaktu z podłożem",
      unit: "% L",
      note: "50% = równo między nogami.",
      color: "var(--lane-cyan)",
      group: "dynamics",
      kind: "decimal",
      source: streams.groundContactBalance
    },
    {
      key: "strideLength",
      title: "Długość kroku",
      unit: "cm",
      color: "var(--lane-green)",
      group: "dynamics",
      kind: "int",
      source: streams.strideLength
    }
  ];
  const charts = [];
  for (const input of inputs) {
    const raw = sampleAt(input.source, indices);
    const values = input.transform ? raw.map((v) => Number.isFinite(v) ? input.transform(v) ?? Number.NaN : Number.NaN) : raw;
    if (definedCount(values) < 2) continue;
    charts.push({
      key: input.key,
      title: input.title,
      unit: input.unit,
      ...input.note === void 0 ? {} : { note: input.note },
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
function staminaChart(streams, indices) {
  const current = sampleAt(streams.stamina, indices);
  const potential = sampleAt(streams.staminaPotential, indices);
  const series = [];
  if (definedCount(current) >= 2)
    series.push({ name: "Dostępna", values: current, color: "var(--lane-lime)" });
  if (definedCount(potential) >= 2)
    series.push({ name: "Potencjalna", values: potential, color: "var(--lane-teal)" });
  if (series.length === 0) return null;
  return {
    key: "stamina",
    title: "Stamina",
    unit: "%",
    color: series[0].color,
    group: "physiology",
    kind: "int",
    values: [],
    series,
    area: false
  };
}
function buildChartSet(streams, sport, axis = "time", target = DEFAULT_TARGET_POINTS) {
  const n = streamLength(streams);
  if (n === 0) {
    return {
      axis: "time",
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
  const effectiveAxis = axis === "distance" && canUseDistance ? "distance" : "time";
  const indices = latticeOverAxis(effectiveAxis === "distance" ? distance : elapsed, target);
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
function axisLabels(axis, elapsed, distance, indices) {
  if (axis === "distance" && distance) {
    return indices.map((i) => `${((distance[i] ?? 0) / 1e3).toFixed(1).replace(".", ",")} km`);
  }
  return indices.map((i) => clockLabel(elapsed[i] ?? 0));
}
function clockLabel(seconds) {
  const total = Math.max(0, Math.round(seconds));
  const h = Math.floor(total / 3600);
  const m = Math.floor(total % 3600 / 60);
  const s = total % 60;
  const mm = String(m).padStart(2, "0");
  const ss = String(s).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

export { DASH as D, SIMILAR_METRICS as S, isNum as a, bandLabel as b, fmtDuration as c, fmtPace as d, fmtNum as e, fmtKm as f, fmtSigned as g, fmtClock as h, isPaceSport as i, benefitLabel as j, similarDeltaBadge as k, buildChartSet as l, chartGroupTitle as m, splitLabel as n, paceFromMps as p, speedKmh as s, verdictLabel as v };
//# sourceMappingURL=activity-charts.js-F9H2TYGl.js.map
