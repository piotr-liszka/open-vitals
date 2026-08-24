import { e as compareDays, d as daysBetween, b as addDays } from './date.js-Cf0GyZI8.js';

const RANGE_KEYS = ["7", "14", "30", "365", "all"];
const DEFAULT_RANGE = "7";
const RANGE_PARAM = "range";
const RANGE_PREF_KEY = "vagus.range";
const RANGE_OPTIONS = [
  { value: "7", label: "7 dni", short: "7d" },
  { value: "14", label: "14 dni", short: "14d" },
  { value: "30", label: "30 dni", short: "30d" },
  { value: "365", label: "1 rok", short: "1r" },
  { value: "all", label: "cały czas", short: "∞" }
];
const NOMINAL_DAYS = {
  "7": 7,
  "14": 14,
  "30": 30,
  "365": 365
};
function parseRange(raw) {
  return RANGE_KEYS.includes(raw ?? "") ? raw : DEFAULT_RANGE;
}
function rangeKeyLabel(key) {
  return RANGE_OPTIONS.find((o) => o.value === key)?.label ?? key;
}
function bucketFor(days) {
  if (days <= 45) return "day";
  if (days <= 400) return "week";
  return "month";
}
function resolveRange(key, today, earliest = null) {
  if (key === "all") {
    if (earliest === null) {
      const fallback = resolveRange(DEFAULT_RANGE, today);
      return { ...fallback, key: "all", label: "cały czas", clamped: false };
    }
    const start2 = compareDays(earliest, today) > 0 ? today : clampFloor(earliest, today);
    const days2 = daysBetween(start2, today) + 1;
    return {
      key,
      start: start2,
      end: today,
      days: days2,
      label: `cały czas (od ${start2})`,
      bucket: bucketFor(days2),
      clamped: true
    };
  }
  const days = NOMINAL_DAYS[key];
  const start = addDays(today, -(days - 1));
  return {
    key,
    start,
    end: today,
    days,
    label: rangeKeyLabel(key),
    bucket: bucketFor(days),
    clamped: false
  };
}
function clampFloor(start, today) {
  const floor = addDays(today, -5479);
  return compareDays(start, floor) < 0 ? floor : start;
}
const RANGE_AWARE_ROUTES = [
  "/",
  "/dashboard",
  "/activities",
  "/training",
  "/training/bieg",
  "/training/marsz",
  "/analytics",
  "/insights"
];
function routeSupportsRange(pathname) {
  const path = pathname.length > 1 && pathname.endsWith("/") ? pathname.slice(0, -1) : pathname;
  return RANGE_AWARE_ROUTES.includes(path);
}
function withRange(href, current) {
  const active = current.searchParams.get(RANGE_PARAM);
  if (active === null || !RANGE_KEYS.includes(active)) return href;
  if (!href.startsWith("/")) return href;
  const [path, query] = href.split("?", 2);
  if (path === void 0 || !routeSupportsRange(path)) return href;
  const params = new URLSearchParams(query);
  params.set(RANGE_PARAM, active);
  return `${path}?${params.toString()}`;
}

export { DEFAULT_RANGE as D, RANGE_PARAM as R, routeSupportsRange as a, RANGE_OPTIONS as b, RANGE_PREF_KEY as c, parseRange as p, resolveRange as r, withRange as w };
//# sourceMappingURL=range.js-VDtVJAwH.js.map
