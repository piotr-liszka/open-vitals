/**
 * The volume page's period filter (spec 070) — pure, client-safe, no I/O and no clock.
 *
 * Three blocks on the page answer the same question at three resolutions: the monthly bars, the
 * consistency grid and the month table. They used to disagree about which span they covered — the
 * bars showed a rolling 24 months, the grid showed the calendar year, the table showed the bars'
 * 24 — so "Regularność 2026" sat between two blocks that were not about 2026. One control now
 * governs all three, and this module is the arithmetic behind it.
 *
 * The loader ships every month and every active day in the whole four-year window, so switching
 * period is a slice, not a round trip — the same reason the measure switch is client-side.
 */
import type { MonthKey } from '$lib/date';
import type { MessageKey } from '$lib/i18n';
import type { MonthVolume } from './volume.types';

/** `last12`, or a calendar year as its own string (`'2026'`). */
export type VolumePeriod = string;

export const LAST_12: VolumePeriod = 'last12';

export interface VolumePeriodOption {
  readonly value: VolumePeriod;
  /**
   * Fallback label, kept in Polish so callers that ignore i18n (unit tests) still get sane text.
   * A caller rendering to the reader should prefer `labelKey`/`shortKey` when set (spec 076) — this
   * module stays locale-oblivious like `$lib/range` and `$lib/series`, so it carries message KEYS,
   * not translated words.
   */
  readonly label: string;
  /** Compact label for narrow screens, the way `SegmentedControl` expects it. */
  readonly short: string;
  /** Message key for `label`; `null` for a calendar year, whose label is the year itself. */
  readonly labelKey: MessageKey | null;
  /** Message key for `short`; `null` for a calendar year. */
  readonly shortKey: MessageKey | null;
}

/**
 * The rolling window first — it is the answer to "how has training been going lately", which is
 * what someone opening the page usually wants — then each calendar year present, newest first.
 */
export function periodOptions(years: readonly number[]): VolumePeriodOption[] {
  const sorted = [...new Set(years)].sort((a, b) => b - a);
  return [
    {
      value: LAST_12,
      label: 'Ostatnie 12 miesięcy',
      short: '12 mies.',
      labelKey: 'volume.period.last12',
      shortKey: 'volume.period.last12Short'
    },
    ...sorted.map((y) => ({
      value: String(y),
      label: String(y),
      short: String(y),
      labelKey: null,
      shortKey: null
    }))
  ];
}

export interface PeriodSlice {
  /** Month keys inside the period, oldest first. A subset of the loader's `months`. */
  readonly months: MonthKey[];
  /** Indices of those months in the loader's `months`, so every parallel series slices identically. */
  readonly indices: number[];
  /** First day the consistency grid draws. */
  readonly from: string;
  /** Last day it draws — never past today, so a year in progress has no empty tail. */
  readonly to: string;
  /**
   * Fallback label, e.g. `2025` or `ostatnie 12 miesięcy` — see `VolumePeriodOption.label` for why
   * this stays Polish rather than translated here.
   */
  readonly label: string;
  /** Message key for `label`; `null` when `label` is a calendar year and needs no translation. */
  readonly labelKey: MessageKey | null;
}

/** Whole months only, so a period boundary never cuts a bar in half. */
const MONTHS_IN_ROLLING_WINDOW = 12;

/**
 * Resolve a period against the loader's month lattice.
 *
 * An unknown or stale value (a year that has dropped out of the window since it was remembered)
 * falls back to the rolling window rather than rendering an empty page.
 */
export function slicePeriod(months: readonly MonthKey[], period: VolumePeriod, today: string): PeriodSlice {
  const year = /^\d{4}$/.test(period) ? period : null;
  const indices = year ? months.map((m, i) => (m.startsWith(`${year}-`) ? i : -1)).filter((i) => i >= 0) : [];

  if (year === null || indices.length === 0) {
    const start = Math.max(0, months.length - MONTHS_IN_ROLLING_WINDOW);
    const rolling = months.slice(start);
    return {
      months: rolling,
      indices: rolling.map((_, i) => start + i),
      from: `${rolling[0] ?? today.slice(0, 7)}-01`,
      to: today,
      label: 'ostatnie 12 miesięcy',
      labelKey: 'volume.period.last12Lower'
    };
  }

  const picked = indices.map((i) => months[i]!);
  return {
    months: picked,
    indices,
    from: `${year}-01-01`,
    // A year still in progress stops at today; a finished one runs to 31 December.
    to: today.startsWith(`${year}-`) ? today : `${year}-12-31`,
    label: year,
    labelKey: null
  };
}

/**
 * Mean distance per COMPLETE month in the slice; null when none completed. The month in progress is
 * excluded for the same reason its bar is hatched — on the 2nd of a month it would drag the average
 * down and read as a collapse in training.
 */
export function avgCompleteDistanceM(totals: readonly MonthVolume[]): number | null {
  const complete = totals.filter((m) => !m.partial && m.activities > 0);
  if (complete.length === 0) return null;
  return Math.round(complete.reduce((s, m) => s + m.distanceM, 0) / complete.length);
}

/** Best COMPLETE month by distance in the slice; null when none completed. */
export function bestCompleteMonth(totals: readonly MonthVolume[]): MonthVolume | null {
  const complete = totals.filter((m) => !m.partial && m.activities > 0);
  if (complete.length === 0) return null;
  return complete.reduce((best, m) => (m.distanceM > best.distanceM ? m : best));
}
