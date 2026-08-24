import { j as formatMonth, k as monthKeyOf, g as formatDay, e as dayRange, s as startOfWeek, p as parseDayKey } from "./date.js";
function bucketStart(day, bucket) {
  if (bucket === "day") return day;
  if (bucket === "week") return startOfWeek(day);
  const { year, month } = parseDayKey(day);
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-01`;
}
function bucketLattice(start, end, bucket) {
  const out = [];
  let last = null;
  for (const day of dayRange(start, end)) {
    const key = bucketStart(day, bucket);
    if (key !== last) {
      out.push(key);
      last = key;
    }
  }
  return out;
}
function volumeBucket(range) {
  return range.bucket === "month" ? "month" : "week";
}
function bucketSeries(days, values, bucket, aggregate = "mean") {
  if (bucket === "day") {
    return { days: [...days], values: days.map((_, i) => normalize(values[i])) };
  }
  const order = [];
  const totals = /* @__PURE__ */ new Map();
  for (let i = 0; i < days.length; i++) {
    const day = days[i];
    if (day === void 0) continue;
    const key = bucketStart(day, bucket);
    let slot = totals.get(key);
    if (slot === void 0) {
      slot = { sum: 0, count: 0 };
      totals.set(key, slot);
      order.push(key);
    }
    const value = normalize(values[i]);
    if (value === null) continue;
    slot.sum += value;
    slot.count += 1;
  }
  return {
    days: order,
    values: order.map((key) => {
      const slot = totals.get(key);
      if (slot === void 0 || slot.count === 0) return null;
      return aggregate === "sum" ? slot.sum : slot.sum / slot.count;
    })
  };
}
function normalize(value) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}
function bucketNoun(bucket) {
  switch (bucket) {
    case "week":
      return "tydzień";
    case "month":
      return "miesiąc";
    default:
      return "dzień";
  }
}
function bucketAxisLabel(day, bucket) {
  return bucket === "month" ? formatMonth(monthKeyOf(day), "shortYear") : formatDay(day, "dayMonth");
}
export {
  bucketNoun as a,
  bucketSeries as b,
  bucketAxisLabel as c,
  bucketLattice as d,
  bucketStart as e,
  volumeBucket as v
};
