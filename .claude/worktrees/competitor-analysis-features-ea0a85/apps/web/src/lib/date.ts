/**
 * Shared date helpers (spec 018) — the single source of truth for day keys and Polish formatting.
 *
 * Two kinds of value exist in this app and they must never be confused:
 *
 *  - **Day key** (`DayKey`, `YYYY-MM-DD`): a *calendar day* as Garmin reports it — already resolved
 *    in the wearer's local zone. Day maths here is pure integer arithmetic on the civil date; it
 *    never round-trips through `Date`/`toISOString()`, so it cannot drift by a timezone.
 *  - **Instant** (ISO-8601 with an offset, or a `Date`): a real point in time. Rendering one needs an
 *    explicit timezone, otherwise SSR (container = UTC) and the browser disagree and hydration warns.
 *
 * Everything here is pure: the caller passes the clock and the timezone, so units stay deterministic
 * (AGENTS.md §4/§7). Nothing in this module reads `Date.now()` or `process.env`.
 *
 * NOTE: no `$lib/server` imports — this file is used by Svelte components too, and SvelteKit forbids
 * client code from importing `src/lib/server`. `NowSource` is the structural shape of `Clock`.
 */

/** A calendar day, `YYYY-MM-DD`. */
export type DayKey = string;

/**
 * Timezone the app resolves "today" and formats instants in. App-scoped (single deployment, one
 * household) — overridable via `APP_TIMEZONE`, see `lib/server/config.ts`. Used as the default here
 * so client-side rendering matches SSR without shipping config into the browser.
 */
export const DEFAULT_TIME_ZONE = 'Europe/Warsaw';

/** Minimal structural clock — `Clock` from `$lib/server/clock` satisfies it. */
export interface NowSource {
  now(): Date;
}

/** Thrown when a string that should be a `YYYY-MM-DD` day key is not one. */
export class InvalidDayKeyError extends Error {
  constructor(readonly value: string) {
    super(`invalid day key: ${JSON.stringify(value)} (expected YYYY-MM-DD)`);
    this.name = 'InvalidDayKeyError';
  }
}

const DAY_KEY_RE = /^\d{4}-\d{2}-\d{2}$/;

interface CivilDate {
  year: number;
  month: number;
  day: number;
}

/* ------------------------------------------------------------------ *
 * Day-key arithmetic (pure integer civil-date maths, no Date objects)
 * ------------------------------------------------------------------ */

/** Days since 1970-01-01 for a civil date (Howard Hinnant's `days_from_civil`). */
function daysFromCivil({ year, month, day }: CivilDate): number {
  const y = year - (month <= 2 ? 1 : 0);
  const era = Math.floor(y / 400);
  const yoe = y - era * 400;
  const doy = Math.floor((153 * (month + (month > 2 ? -3 : 9)) + 2) / 5) + day - 1;
  const doe = yoe * 365 + Math.floor(yoe / 4) - Math.floor(yoe / 100) + doy;
  return era * 146097 + doe - 719468;
}

/** Inverse of `daysFromCivil` (Hinnant's `civil_from_days`). */
function civilFromDays(serial: number): CivilDate {
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

function pad(n: number, width: number): string {
  return String(n).padStart(width, '0');
}

function keyOf({ year, month, day }: CivilDate): DayKey {
  return `${pad(year, 4)}-${pad(month, 2)}-${pad(day, 2)}`;
}

/** True when `value` is a syntactically valid, real calendar day (`2026-02-30` is rejected). */
export function isDayKey(value: unknown): value is DayKey {
  if (typeof value !== 'string' || !DAY_KEY_RE.test(value)) return false;
  const parts = rawParts(value);
  return keyOf(civilFromDays(daysFromCivil(parts))) === value;
}

function rawParts(value: string): CivilDate {
  return {
    year: Number(value.slice(0, 4)),
    month: Number(value.slice(5, 7)),
    day: Number(value.slice(8, 10))
  };
}

/** Parse a validated day key into its civil parts. Throws `InvalidDayKeyError`. */
export function parseDayKey(value: string): CivilDate {
  if (!isDayKey(value)) throw new InvalidDayKeyError(value);
  return rawParts(value);
}

/**
 * Take the day key out of an ISO instant (`2026-08-03T22:10:00Z`) or a local wall-clock string
 * (`2026-08-03 22:10:00`, as Garmin returns for `startTimeLocal`). Pure string work: the day is used
 * exactly as written, never re-resolved through a timezone. Throws on anything else.
 */
export function toDayKey(value: string): DayKey {
  const head = value.slice(0, 10);
  if (!isDayKey(head)) throw new InvalidDayKeyError(value);
  return head;
}

/** `key` shifted by `n` days (negative goes back). */
export function addDays(key: DayKey, n: number): DayKey {
  return civilKey(daysFromCivil(parseDayKey(key)) + Math.trunc(n));
}

function civilKey(serial: number): DayKey {
  return keyOf(civilFromDays(serial));
}

/** Whole days from `from` to `to` (negative when `to` is earlier). */
export function daysBetween(from: DayKey, to: DayKey): number {
  return daysFromCivil(parseDayKey(to)) - daysFromCivil(parseDayKey(from));
}

/** `-1 | 0 | 1` ordering of two day keys. */
export function compareDays(a: DayKey, b: DayKey): number {
  const d = daysBetween(b, a);
  return d === 0 ? 0 : d < 0 ? -1 : 1;
}

/** The earlier of two day keys. */
export function minDay(a: DayKey, b: DayKey): DayKey {
  return compareDays(a, b) <= 0 ? a : b;
}

/** The later of two day keys. */
export function maxDay(a: DayKey, b: DayKey): DayKey {
  return compareDays(a, b) >= 0 ? a : b;
}

/* ------------------------------------------------------------------ *
 * Calendar months and years (spec 037)
 *
 * Months are the unit athletes actually think in ("how far did I run in July?")
 * and the one this module was missing: everything above works in days and ISO
 * weeks, which cannot express "this month" without drifting.
 * ------------------------------------------------------------------ */

/** A calendar month, `YYYY-MM`. Nominal like `DayKey` — always produced by this module. */
export type MonthKey = string;

const MONTH_KEY_RE = /^\d{4}-\d{2}$/;

/** True when `value` is a syntactically valid month key with a real month number. */
export function isMonthKey(value: unknown): value is MonthKey {
  if (typeof value !== 'string' || !MONTH_KEY_RE.test(value)) return false;
  const month = Number(value.slice(5, 7));
  return month >= 1 && month <= 12;
}

/** Thrown when a month key cannot be parsed. Mirrors `InvalidDayKeyError`. */
export class InvalidMonthKeyError extends Error {
  constructor(value: unknown) {
    super(`Invalid month key: ${String(value)}`);
    this.name = 'InvalidMonthKeyError';
  }
}

function parseMonthKey(value: string): { year: number; month: number } {
  if (!isMonthKey(value)) throw new InvalidMonthKeyError(value);
  return { year: Number(value.slice(0, 4)), month: Number(value.slice(5, 7)) };
}

/** The month a day belongs to. */
export function monthKeyOf(key: DayKey): MonthKey {
  const { year, month } = parseDayKey(key);
  return `${pad(year, 4)}-${pad(month, 2)}`;
}

/** First day of the month containing `key`. */
export function startOfMonth(key: DayKey): DayKey {
  const { year, month } = parseDayKey(key);
  return keyOf({ year, month, day: 1 });
}

/** Last day of the month containing `key` — leap years included, no 31-day assumption. */
export function endOfMonth(key: DayKey): DayKey {
  return addDays(firstDayOf(addMonths(monthKeyOf(key), 1)), -1);
}

/** First day of a month key. */
export function firstDayOf(month: MonthKey): DayKey {
  const { year, month: m } = parseMonthKey(month);
  return keyOf({ year, month: m, day: 1 });
}

/** `month` shifted by `n` whole months (negative goes back). */
export function addMonths(month: MonthKey, n: number): MonthKey {
  const { year, month: m } = parseMonthKey(month);
  // Work in absolute months so the year rolls without a branch per direction.
  const total = year * 12 + (m - 1) + Math.trunc(n);
  const y = Math.floor(total / 12);
  const mm = total - y * 12 + 1;
  return `${pad(y, 4)}-${pad(mm, 2)}`;
}

/** Whole months from `from` to `to` (negative when `to` is earlier). */
export function monthsBetween(from: MonthKey, to: MonthKey): number {
  const a = parseMonthKey(from);
  const b = parseMonthKey(to);
  return (b.year - a.year) * 12 + (b.month - a.month);
}

/** Inclusive list of month keys from `start` to `end` (empty when `end` precedes `start`). */
export function monthRange(start: MonthKey, end: MonthKey): MonthKey[] {
  const span = monthsBetween(start, end);
  if (span < 0) return [];
  const out: MonthKey[] = [];
  for (let i = 0; i <= span; i++) out.push(addMonths(start, i));
  return out;
}

/** The last `count` month keys ending at (and including) `end`, oldest first. */
export function lastMonths(end: MonthKey, count: number): MonthKey[] {
  if (count <= 0) return [];
  return monthRange(addMonths(end, -(count - 1)), end);
}

/** Calendar year of a day key. */
export function yearOf(key: DayKey): number {
  return parseDayKey(key).year;
}

/** 1-based day of the calendar year: 1 for 1 January, 366 on a leap-year 31 December. */
export function dayOfYear(key: DayKey): number {
  const { year } = parseDayKey(key);
  return daysBetween(keyOf({ year, month: 1, day: 1 }), key) + 1;
}

/** Days in a calendar year — 365, or 366 in a leap year. */
export function daysInYear(year: number): number {
  return daysBetween(keyOf({ year, month: 1, day: 1 }), keyOf({ year: year + 1, month: 1, day: 1 }));
}

/** Weekday index of a day key, ISO style: 0 = Monday … 6 = Sunday. */
export function dayOfWeek(key: DayKey): number {
  const serial = daysFromCivil(parseDayKey(key));
  return (((serial + 3) % 7) + 7) % 7; // 1970-01-01 was a Thursday
}

/** Monday of the ISO week containing `key`. */
export function startOfWeek(key: DayKey): DayKey {
  return addDays(key, -dayOfWeek(key));
}

/** Inclusive list of day keys from `start` to `end` (empty when `end` precedes `start`). */
export function dayRange(start: DayKey, end: DayKey): DayKey[] {
  const span = daysBetween(start, end);
  if (span < 0) return [];
  const out: DayKey[] = [];
  for (let i = 0; i <= span; i++) out.push(addDays(start, i));
  return out;
}

/** The last `count` day keys ending at (and including) `end`, oldest first. */
export function lastDays(end: DayKey, count: number): DayKey[] {
  if (count <= 0) return [];
  return dayRange(addDays(end, -(count - 1)), end);
}

/* ------------------------------------------------------------------ *
 * Instant → day key (timezone-explicit)
 * ------------------------------------------------------------------ */

const dayKeyFormatters = new Map<string, Intl.DateTimeFormat>();

function dayKeyFormatter(timeZone: string): Intl.DateTimeFormat {
  let fmt = dayKeyFormatters.get(timeZone);
  if (!fmt) {
    // en-CA renders ISO-ordered numeric dates, so the parts assemble straight into a day key.
    fmt = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' });
    dayKeyFormatters.set(timeZone, fmt);
  }
  return fmt;
}

/** The calendar day an instant falls on **in `timeZone`** (not UTC). */
export function dayKeyOf(instant: Date, timeZone: string = DEFAULT_TIME_ZONE): DayKey {
  const parts = dayKeyFormatter(timeZone).formatToParts(instant);
  const get = (type: Intl.DateTimeFormatPartTypes): string => parts.find((p) => p.type === type)?.value ?? '';
  const key = `${get('year')}-${get('month')}-${get('day')}`;
  if (!isDayKey(key)) throw new InvalidDayKeyError(key);
  return key;
}

/**
 * Today's day key in `timeZone`. This is the app's definition of "today" — deliberately local, not
 * UTC: between local midnight and 02:00 a UTC "today" is still yesterday, which made the dashboard
 * ask for the wrong day.
 */
export function todayKey(clock: NowSource, timeZone: string = DEFAULT_TIME_ZONE): DayKey {
  return dayKeyOf(clock.now(), timeZone);
}

/** `offset` days before today in `timeZone` (`offset = 0` is today). */
export function daysAgoKey(clock: NowSource, offset: number, timeZone: string = DEFAULT_TIME_ZONE): DayKey {
  return addDays(todayKey(clock, timeZone), -offset);
}

/* ------------------------------------------------------------------ *
 * Formatting (pl-PL via Intl — no hand-rolled month tables)
 * ------------------------------------------------------------------ */

const LOCALE = 'pl-PL';

/**
 * How to render a calendar day:
 * `short` "3 sie" · `shortYear` "3 sie 2026" · `long` "3 sierpnia" · `longYear` "3 sierpnia 2026" ·
 * `numeric` "3.08.2026" · `dayMonth` "03.08" · `weekday` "pon., 3 sie" · `iso` "2026-08-03".
 */
export type DayStyle =
  'short' | 'shortYear' | 'long' | 'longYear' | 'numeric' | 'dayMonth' | 'weekday' | 'iso';

const DAY_STYLE_OPTIONS: Record<Exclude<DayStyle, 'iso'>, Intl.DateTimeFormatOptions> = {
  short: { day: 'numeric', month: 'short' },
  shortYear: { day: 'numeric', month: 'short', year: 'numeric' },
  long: { day: 'numeric', month: 'long' },
  longYear: { day: 'numeric', month: 'long', year: 'numeric' },
  numeric: { day: 'numeric', month: '2-digit', year: 'numeric' },
  dayMonth: { day: '2-digit', month: '2-digit' },
  weekday: { weekday: 'short', day: 'numeric', month: 'short' }
};

/**
 * How to render an instant:
 * `time` "16:05" · `timeSeconds` "16:05:09" · `date` "3 sie 2026" · `numeric` "3.08.2026" ·
 * `dateTime` "3 sie 2026, 16:05".
 */
export type InstantStyle = 'time' | 'timeSeconds' | 'date' | 'numeric' | 'dateTime';

const INSTANT_STYLE_OPTIONS: Record<InstantStyle, Intl.DateTimeFormatOptions> = {
  time: { hour: '2-digit', minute: '2-digit' },
  timeSeconds: { hour: '2-digit', minute: '2-digit', second: '2-digit' },
  date: { dateStyle: 'medium' },
  numeric: { day: 'numeric', month: '2-digit', year: 'numeric' },
  dateTime: { dateStyle: 'medium', timeStyle: 'short' }
};

const formatters = new Map<string, Intl.DateTimeFormat>();

function formatter(
  timeZone: string,
  style: string,
  options: Intl.DateTimeFormatOptions
): Intl.DateTimeFormat {
  const cacheKey = `${timeZone}|${style}`;
  let fmt = formatters.get(cacheKey);
  if (!fmt) {
    fmt = new Intl.DateTimeFormat(LOCALE, { timeZone, ...options });
    formatters.set(cacheKey, fmt);
  }
  return fmt;
}

/**
 * Render a calendar day in Polish. The key is pinned to UTC midnight and formatted in UTC, so the
 * output is identical on the server and in the browser regardless of either one's timezone.
 */
export function formatDay(key: DayKey, style: DayStyle = 'short'): string {
  const { year, month, day } = parseDayKey(key);
  if (style === 'iso') return key;
  const at = new Date(Date.UTC(year, month - 1, day));
  if (year >= 0 && year < 100) at.setUTCFullYear(year); // Date.UTC maps 0..99 into 1900+
  return formatter('UTC', `day:${style}`, DAY_STYLE_OPTIONS[style]).format(at);
}

/** How to render a month: `short` "sie", `long` "sierpień", `shortYear` "sie 2026". */
export type MonthStyle = 'short' | 'long' | 'shortYear' | 'longYear';

const MONTH_STYLE_OPTIONS: Record<MonthStyle, Intl.DateTimeFormatOptions> = {
  short: { month: 'short' },
  long: { month: 'long' },
  shortYear: { month: 'short', year: 'numeric' },
  longYear: { month: 'long', year: 'numeric' }
};

/**
 * Render a calendar month in Polish. Pinned to UTC midnight on the 1st and formatted in UTC, so the
 * output is identical on the server and in the browser — the same rule `formatDay` follows.
 */
export function formatMonth(month: MonthKey, style: MonthStyle = 'short'): string {
  const { year, month: m } = parseMonthKey(month);
  const at = new Date(Date.UTC(year, m - 1, 1));
  if (year >= 0 && year < 100) at.setUTCFullYear(year);
  return formatter('UTC', `month:${style}`, MONTH_STYLE_OPTIONS[style]).format(at);
}

/**
 * Render a real instant in Polish, in an explicit timezone (default: the app timezone). Returns `''`
 * for input that is not a parseable instant, so a bad timestamp degrades to blank instead of
 * "Invalid Date". Never pass a bare `YYYY-MM-DD` here — use `formatDay`.
 */
export function formatInstant(
  value: string | Date,
  style: InstantStyle = 'dateTime',
  timeZone: string = DEFAULT_TIME_ZONE
): string {
  const at = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(at.getTime())) return '';
  return formatter(timeZone, `instant:${style}`, INSTANT_STYLE_OPTIONS[style]).format(at);
}

/**
 * The browser's own timezone, or `undefined` when it cannot be resolved (or on the server, where the
 * caller must not use it — resolving it during SSR is exactly what causes hydration mismatches).
 */
export function resolveBrowserTimeZone(): string | undefined {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || undefined;
  } catch {
    return undefined;
  }
}
