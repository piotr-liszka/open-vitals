/**
 * The global data range (spec 047) — ONE definition of "how far back am I looking", shared by the
 * topbar switch, every page loader and every card that follows it.
 *
 * Before this, two switches disagreed: the start page offered 7/14/30 via `?trend=` (spec 028) and
 * Wnioski offered 7/30/90/365 via `?window=`, while every other surface had its window hardcoded in
 * its loader. A range is now a single key in the URL, resolved once per request into concrete day
 * bounds.
 *
 * Pure and client-safe: no `Date.now()`, no `process.env`, no `$lib/server` import (the topbar
 * switch imports this too). Day maths goes through `$lib/date`, so it is integer civil-date
 * arithmetic and cannot drift by a timezone (spec 018).
 */
import { addDays, compareDays, daysBetween, type DayKey } from './date';
import type { MessageKey, Translator } from './i18n/translate';

/** The offered ranges, narrowest first. `all` means "everything I have synced". */
export const RANGE_KEYS = ['7', '14', '30', '365', 'all'] as const;
export type RangeKey = (typeof RANGE_KEYS)[number];

/** What a page shows when nothing asked for anything else. */
export const DEFAULT_RANGE: RangeKey = '7';

/** The query parameter carrying the range on every range-aware page. */
export const RANGE_PARAM = 'range';

/** `localStorage` key remembering the last choice for this device (see `lib/ui/pref.ts`). */
export const RANGE_PREF_KEY = 'openvitals.range';

/** How a series is aggregated before it is drawn. */
export type RangeBucket = 'day' | 'week' | 'month';

/**
 * A range carries message KEYS, not words (spec 076): this module is imported by loaders that run
 * before any language is known, and by the topbar switch that re-renders when the language changes.
 * The keys are derived from the range key itself, so adding a range cannot forget to add a label —
 * `range.<key>` and `range.<key>.short` must exist, and TypeScript checks that they do.
 */
export interface RangeOption {
  value: RangeKey;
  /** Full label, used wherever there is room. */
  labelKey: MessageKey;
  /** Compact label for the phone topbar (spec 034 gutters leave no room for "cały czas"). */
  shortKey: MessageKey;
}

export const RANGE_OPTIONS: readonly RangeOption[] = RANGE_KEYS.map((value) => ({
  value,
  labelKey: `range.${value}` as const,
  shortKey: `range.${value}.short` as const
}));

/** Nominal day span of a key. `all` has no nominal span — it is resolved against real data. */
const NOMINAL_DAYS: Record<Exclude<RangeKey, 'all'>, number> = {
  '7': 7,
  '14': 14,
  '30': 30,
  '365': 365
};

/**
 * Hard ceiling on a resolved window, in days (~15 years). `all` is bounded by the earliest synced
 * day, but a corrupt/absurd coverage row must not turn into a query for 10 000 buckets.
 */
export const MAX_RANGE_DAYS = 5480;

export interface ResolvedRange {
  key: RangeKey;
  /** Inclusive first day of the window. */
  start: DayKey;
  /** Inclusive last day — the user's local today. */
  end: DayKey;
  /** Inclusive day count (`start`..`end`), always ≥ 1. */
  days: number;
  bucket: RangeBucket;
  /** True when `all` was narrowed to the earliest synced day rather than run unbounded. */
  clamped: boolean;
}

/**
 * Read a range key off a query parameter. Anything unrecognised — absent, junk, a hand-typed
 * `?range=9999` — yields the default rather than 400-ing or widening the window.
 */
export function parseRange(raw: string | null | undefined): RangeKey {
  return (RANGE_KEYS as readonly string[]).includes(raw ?? '') ? (raw as RangeKey) : DEFAULT_RANGE;
}

/** Is this a range key? Narrowing guard for values arriving from outside (settings, prefs). */
export function isRangeKey(value: unknown): value is RangeKey {
  return typeof value === 'string' && (RANGE_KEYS as readonly string[]).includes(value);
}

/** The switch's own label for a key (no data needed) — used by the control and the pref. */
export function rangeKeyLabel(t: Translator, key: RangeKey): string {
  return t(`range.${key}`);
}

/**
 * How a RESOLVED range describes itself: "30 dni", or "cały czas (od 2021-03-04)" once `all` has
 * been narrowed to the earliest day actually synced — the start date is the whole point of that
 * label, so it only appears when there is a real one.
 */
export function rangeLabel(t: Translator, range: Pick<ResolvedRange, 'key' | 'start' | 'clamped'>): string {
  if (range.key === 'all' && range.clamped) return t('range.allFrom', { start: range.start });
  return rangeKeyLabel(t, range.key);
}

/**
 * Aggregation granularity for a span. A 5-year daily series is both unreadable and ~1 800 points of
 * payload; a year of weeks is 52 and five years of months is 60 — both draw cleanly.
 */
export function bucketFor(days: number): RangeBucket {
  if (days <= 45) return 'day';
  if (days <= 400) return 'week';
  return 'month';
}

/**
 * Resolve a key into concrete day bounds.
 *
 * @param today    the user's local today (`todayKey(clock, zone)`) — passed in, never read here.
 * @param earliest earliest synced day (`store.coverage().earliest`), or `null` when nothing is
 *                 synced yet. Only consulted for `all`.
 */
export function resolveRange(key: RangeKey, today: DayKey, earliest: DayKey | null = null): ResolvedRange {
  if (key === 'all') {
    // Nothing synced: there is no "all" to show, so fall back to the default window rather than
    // inventing a start date or querying unbounded.
    if (earliest === null) {
      const fallback = resolveRange(DEFAULT_RANGE, today);
      return { ...fallback, key: 'all', clamped: false };
    }
    // A coverage row ahead of today (clock skew, a bad import) would otherwise invert the window.
    const start = compareDays(earliest, today) > 0 ? today : clampFloor(earliest, today);
    const days = daysBetween(start, today) + 1;
    return {
      key,
      start,
      end: today,
      days,
      bucket: bucketFor(days),
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
    bucket: bucketFor(days),
    clamped: false
  };
}

/** Never let a window reach further back than `MAX_RANGE_DAYS` before `today`. */
function clampFloor(start: DayKey, today: DayKey): DayKey {
  const floor = addDays(today, -(MAX_RANGE_DAYS - 1));
  return compareDays(start, floor) < 0 ? floor : start;
}

/** Whole weeks needed to cover the window — what the week-bucketed surfaces size themselves by. */
export function rangeWeeks(range: ResolvedRange): number {
  return Math.max(1, Math.ceil(range.days / 7));
}

/**
 * Routes whose content follows the global range. `AppShell` consults this so the switch appears
 * without every page opting in — and, just as importantly, so it does NOT appear where nothing would
 * react to it. A switch that visibly changes nothing is worse than no switch: it teaches the reader
 * that the control is decorative.
 *
 * Deliberately absent, each for a reason:
 *  - `/activities/<id>` — one session. A session has no window.
 *  - `/heatmap` — a calendar-year grid; its own year picker IS its range.
 *  - `/training/ride` — an all-time mean-max power curve and rider profile. A "best 5-minute power"
 *    over 7 days is not a narrower best, it is a different and misleading number.
 *  - `/settings`, `/settings/integrations`, `/data`, `/login`, `/styleguide` — no windowed data.
 *
 * Listed exactly, not by prefix, so adding a page is a deliberate decision about whether its numbers
 * are windowed.
 */
const RANGE_AWARE_ROUTES: readonly string[] = [
  '/',
  '/dashboard',
  '/activities',
  '/training',
  '/training/run',
  '/training/walk',
  '/analytics',
  '/insights'
];

/** Does this pathname have anything that honours the range? */
export function routeSupportsRange(pathname: string): boolean {
  const path = pathname.length > 1 && pathname.endsWith('/') ? pathname.slice(0, -1) : pathname;
  return RANGE_AWARE_ROUTES.includes(path);
}

/**
 * Carry the active range along a navigation link.
 *
 * Without this, clicking "Trening" while looking at a year would land on the 7-day default; the
 * remembered preference would then correct it a beat later, so the reader watches the page render the
 * wrong window and then replace it. Putting the range straight into the href skips that flash.
 *
 * Only touches internal, range-aware destinations, and only when the current page actually carries a
 * range — so it never invents a parameter, and never appends one to a page that ignores it.
 *
 * @param href    the destination, e.g. `/training/run` (may already carry a query string).
 * @param current the URL being viewed.
 */
export function withRange(href: string, current: URL): string {
  const active = current.searchParams.get(RANGE_PARAM);
  if (active === null || !(RANGE_KEYS as readonly string[]).includes(active)) return href;
  // Leave absolute URLs and anchors alone — this is for in-app routes only.
  if (!href.startsWith('/')) return href;
  const [path, query] = href.split('?', 2);
  if (path === undefined || !routeSupportsRange(path)) return href;
  const params = new URLSearchParams(query);
  params.set(RANGE_PARAM, active);
  return `${path}?${params.toString()}`;
}
