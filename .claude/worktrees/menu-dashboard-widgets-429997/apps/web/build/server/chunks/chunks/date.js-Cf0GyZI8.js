const DEFAULT_TIME_ZONE = "Europe/Warsaw";
class InvalidDayKeyError extends Error {
  constructor(value) {
    super(`invalid day key: ${JSON.stringify(value)} (expected YYYY-MM-DD)`);
    this.value = value;
    this.name = "InvalidDayKeyError";
  }
}
const DAY_KEY_RE = /^\d{4}-\d{2}-\d{2}$/;
function daysFromCivil({ year, month, day }) {
  const y = year - (month <= 2 ? 1 : 0);
  const era = Math.floor(y / 400);
  const yoe = y - era * 400;
  const doy = Math.floor((153 * (month + (month > 2 ? -3 : 9)) + 2) / 5) + day - 1;
  const doe = yoe * 365 + Math.floor(yoe / 4) - Math.floor(yoe / 100) + doy;
  return era * 146097 + doe - 719468;
}
function civilFromDays(serial) {
  const z = serial + 719468;
  const era = Math.floor(z / 146097);
  const doe = z - era * 146097;
  const yoe = Math.floor(
    (doe - Math.floor(doe / 1460) + Math.floor(doe / 36524) - Math.floor(doe / 146096)) / 365
  );
  const y = yoe + era * 400;
  const doy = doe - (365 * yoe + Math.floor(yoe / 4) - Math.floor(yoe / 100));
  const mp = Math.floor((5 * doy + 2) / 153);
  const day = doy - Math.floor((153 * mp + 2) / 5) + 1;
  const month = mp + (mp < 10 ? 3 : -9);
  return { year: y + (month <= 2 ? 1 : 0), month, day };
}
function pad(n, width) {
  return String(n).padStart(width, "0");
}
function keyOf({ year, month, day }) {
  return `${pad(year, 4)}-${pad(month, 2)}-${pad(day, 2)}`;
}
function isDayKey(value) {
  if (typeof value !== "string" || !DAY_KEY_RE.test(value)) return false;
  const parts = rawParts(value);
  return keyOf(civilFromDays(daysFromCivil(parts))) === value;
}
function rawParts(value) {
  return {
    year: Number(value.slice(0, 4)),
    month: Number(value.slice(5, 7)),
    day: Number(value.slice(8, 10))
  };
}
function parseDayKey(value) {
  if (!isDayKey(value)) throw new InvalidDayKeyError(value);
  return rawParts(value);
}
function toDayKey(value) {
  const head = value.slice(0, 10);
  if (!isDayKey(head)) throw new InvalidDayKeyError(value);
  return head;
}
function addDays(key, n) {
  return civilKey(daysFromCivil(parseDayKey(key)) + Math.trunc(n));
}
function civilKey(serial) {
  return keyOf(civilFromDays(serial));
}
function daysBetween(from, to) {
  return daysFromCivil(parseDayKey(to)) - daysFromCivil(parseDayKey(from));
}
function compareDays(a, b) {
  const d = daysBetween(b, a);
  return d === 0 ? 0 : d < 0 ? -1 : 1;
}
function minDay(a, b) {
  return compareDays(a, b) <= 0 ? a : b;
}
function maxDay(a, b) {
  return compareDays(a, b) >= 0 ? a : b;
}
const MONTH_KEY_RE = /^\d{4}-\d{2}$/;
function isMonthKey(value) {
  if (typeof value !== "string" || !MONTH_KEY_RE.test(value)) return false;
  const month = Number(value.slice(5, 7));
  return month >= 1 && month <= 12;
}
class InvalidMonthKeyError extends Error {
  constructor(value) {
    super(`Invalid month key: ${String(value)}`);
    this.name = "InvalidMonthKeyError";
  }
}
function parseMonthKey(value) {
  if (!isMonthKey(value)) throw new InvalidMonthKeyError(value);
  return { year: Number(value.slice(0, 4)), month: Number(value.slice(5, 7)) };
}
function monthKeyOf(key) {
  const { year, month } = parseDayKey(key);
  return `${pad(year, 4)}-${pad(month, 2)}`;
}
function firstDayOf(month) {
  const { year, month: m } = parseMonthKey(month);
  return keyOf({ year, month: m, day: 1 });
}
function addMonths(month, n) {
  const { year, month: m } = parseMonthKey(month);
  const total = year * 12 + (m - 1) + Math.trunc(n);
  const y = Math.floor(total / 12);
  const mm = total - y * 12 + 1;
  return `${pad(y, 4)}-${pad(mm, 2)}`;
}
function monthsBetween(from, to) {
  const a = parseMonthKey(from);
  const b = parseMonthKey(to);
  return (b.year - a.year) * 12 + (b.month - a.month);
}
function monthRange(start, end) {
  const span = monthsBetween(start, end);
  if (span < 0) return [];
  const out = [];
  for (let i = 0; i <= span; i++) out.push(addMonths(start, i));
  return out;
}
function lastMonths(end, count) {
  if (count <= 0) return [];
  return monthRange(addMonths(end, -(count - 1)), end);
}
function yearOf(key) {
  return parseDayKey(key).year;
}
function dayOfYear(key) {
  const { year } = parseDayKey(key);
  return daysBetween(keyOf({ year, month: 1, day: 1 }), key) + 1;
}
function daysInYear(year) {
  return daysBetween(keyOf({ year, month: 1, day: 1 }), keyOf({ year: year + 1, month: 1, day: 1 }));
}
function dayOfWeek(key) {
  const serial = daysFromCivil(parseDayKey(key));
  return ((serial + 3) % 7 + 7) % 7;
}
function startOfWeek(key) {
  return addDays(key, -dayOfWeek(key));
}
function dayRange(start, end) {
  const span = daysBetween(start, end);
  if (span < 0) return [];
  const out = [];
  for (let i = 0; i <= span; i++) out.push(addDays(start, i));
  return out;
}
const dayKeyFormatters = /* @__PURE__ */ new Map();
function dayKeyFormatter(timeZone) {
  let fmt = dayKeyFormatters.get(timeZone);
  if (!fmt) {
    fmt = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" });
    dayKeyFormatters.set(timeZone, fmt);
  }
  return fmt;
}
function dayKeyOf(instant, timeZone = DEFAULT_TIME_ZONE) {
  const parts = dayKeyFormatter(timeZone).formatToParts(instant);
  const get = (type) => parts.find((p) => p.type === type)?.value ?? "";
  const key = `${get("year")}-${get("month")}-${get("day")}`;
  if (!isDayKey(key)) throw new InvalidDayKeyError(key);
  return key;
}
function todayKey(clock, timeZone = DEFAULT_TIME_ZONE) {
  return dayKeyOf(clock.now(), timeZone);
}
const LOCALE = "pl-PL";
const DAY_STYLE_OPTIONS = {
  short: { day: "numeric", month: "short" },
  shortYear: { day: "numeric", month: "short", year: "numeric" },
  long: { day: "numeric", month: "long" },
  longYear: { day: "numeric", month: "long", year: "numeric" },
  numeric: { day: "numeric", month: "2-digit", year: "numeric" },
  dayMonth: { day: "2-digit", month: "2-digit" },
  weekday: { weekday: "short", day: "numeric", month: "short" }
};
const INSTANT_STYLE_OPTIONS = {
  time: { hour: "2-digit", minute: "2-digit" },
  timeSeconds: { hour: "2-digit", minute: "2-digit", second: "2-digit" },
  date: { dateStyle: "medium" },
  numeric: { day: "numeric", month: "2-digit", year: "numeric" },
  dateTime: { dateStyle: "medium", timeStyle: "short" }
};
const formatters = /* @__PURE__ */ new Map();
function formatter(timeZone, style, options) {
  const cacheKey = `${timeZone}|${style}`;
  let fmt = formatters.get(cacheKey);
  if (!fmt) {
    fmt = new Intl.DateTimeFormat(LOCALE, { timeZone, ...options });
    formatters.set(cacheKey, fmt);
  }
  return fmt;
}
function formatDay(key, style = "short") {
  const { year, month, day } = parseDayKey(key);
  if (style === "iso") return key;
  const at = new Date(Date.UTC(year, month - 1, day));
  if (year >= 0 && year < 100) at.setUTCFullYear(year);
  return formatter("UTC", `day:${style}`, DAY_STYLE_OPTIONS[style]).format(at);
}
const MONTH_STYLE_OPTIONS = {
  short: { month: "short" },
  long: { month: "long" },
  shortYear: { month: "short", year: "numeric" },
  longYear: { month: "long", year: "numeric" }
};
function formatMonth(month, style = "short") {
  const { year, month: m } = parseMonthKey(month);
  const at = new Date(Date.UTC(year, m - 1, 1));
  if (year >= 0 && year < 100) at.setUTCFullYear(year);
  return formatter("UTC", `month:${style}`, MONTH_STYLE_OPTIONS[style]).format(at);
}
function formatInstant(value, style = "dateTime", timeZone = DEFAULT_TIME_ZONE) {
  const at = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(at.getTime())) return "";
  return formatter(timeZone, `instant:${style}`, INSTANT_STYLE_OPTIONS[style]).format(at);
}

export { DEFAULT_TIME_ZONE as D, minDay as a, addDays as b, toDayKey as c, daysBetween as d, compareDays as e, dayRange as f, formatMonth as g, monthKeyOf as h, formatDay as i, isDayKey as j, firstDayOf as k, lastMonths as l, maxDay as m, dayOfYear as n, daysInYear as o, parseDayKey as p, isMonthKey as q, formatInstant as r, startOfWeek as s, todayKey as t, dayOfWeek as u, yearOf as y };
//# sourceMappingURL=date.js-Cf0GyZI8.js.map
