/**
 * Contracts for the per-sport weekly training summary card (spec 056) — "how much have I done this
 * week in MY sport, and is that normal for me?". Shared by the handler and the card.
 *
 * Self-contained on purpose: nothing here imports `$lib/server`, so the card can be rendered from any
 * route without dragging a server module into the client bundle.
 */
import type { SportGroup } from '$lib/sport-labels';
import type { Locale } from '$lib/i18n';

/**
 * How many weeks the card looks back. FIXED, deliberately: the card's whole claim is "this week
 * against my recent normal", and a normal is only a normal over a constant span — so this window
 * ignores the global range switch (spec 047). Twelve weeks is a training block, which is the unit an
 * athlete already thinks in.
 */
export const WEEKLY_SUMMARY_WEEKS = 12;

/**
 * The "every sport" selection (spec 089). Deliberately NOT a member of `SportGroup`: "all" is not a
 * sport — it has no lane colour, no Garmin key and no entry in the taxonomy — so adding it there
 * would hand every exhaustive switch over families a case it cannot honestly answer.
 */
export const ALL_SPORTS = 'all' as const;
export type AllSports = typeof ALL_SPORTS;

/** What the card can be showing: one family, or every family at once. */
export type WeeklySummarySelection = SportGroup | AllSports;

/** Totals for a span — a week, or the whole window. */
export interface WeeklySummaryTotals {
  readonly activities: number;
  readonly distanceM: number;
  readonly durationS: number;
  readonly elevationGainM: number;
}

/** One charted week of one family, index-aligned with `WeeklySummaryData.weekStarts`. */
export interface WeeklySummaryWeek extends WeeklySummaryTotals {
  /** Monday of the week, `YYYY-MM-DD`. */
  readonly week: string;
  /** True for the week in progress — its totals are week-to-date. */
  readonly partial: boolean;
}

/** Everything the card needs for one sport family. */
export interface WeeklySummarySport {
  readonly group: SportGroup;
  /** Polish family name, from the shared taxonomy. */
  readonly label: string;
  /** Lane token for the family — the same colour this sport has on every other chart in the app. */
  readonly color: string;
  /** Week-to-date totals for the week the athlete is standing in. */
  readonly thisWeek: WeeklySummaryTotals;
  /** Totals across the whole window — what orders the chips and sizes the "normal". */
  readonly window: WeeklySummaryTotals;
  /** One entry per week in the window, oldest first. Always `WEEKLY_SUMMARY_WEEKS` long. */
  readonly weekly: readonly WeeklySummaryWeek[];
}

/**
 * Every family added together (spec 089) — "how big was my week", before it is split by sport.
 *
 * `distanceM` is carried because `WeeklySummaryTotals` is ONE shape and forking it here would be a
 * worse contract than one field a view declines to render. It is not rendered: a ride's kilometres
 * added to a run's produce a number with no meaning. Time, climb and sessions do add up, and they
 * are what the question actually asks. The rule is enforced in the card, and pinned by a test.
 */
export interface WeeklySummaryCombined {
  /** Week-to-date totals across every family. */
  readonly thisWeek: WeeklySummaryTotals;
  /** Totals across the whole window, across every family. */
  readonly window: WeeklySummaryTotals;
  /** One entry per week in the window, index-aligned with `WeeklySummaryData.weekStarts`. */
  readonly weekly: readonly WeeklySummaryWeek[];
}

export interface WeeklySummaryData {
  /** How many weeks the window spans. The view says so rather than hardcoding "12". */
  readonly weeks: number;
  /** Monday of each week in the window, oldest first — the x lattice of every `weekly` series. */
  readonly weekStarts: readonly string[];
  /**
   * X-axis labels: the Polish short month name where the month changes, `''` elsewhere. `TrendChart`
   * drops empty labels and thins the rest, so this gives month ticks without twelve date stamps.
   */
  readonly monthLabels: readonly string[];
  /** Monday of the week in progress. */
  readonly currentWeekStart: string;
  /** How many days of the current week have been lived through, 1–7 (the week-to-date caption). */
  readonly currentWeekDays: number;
  /** One entry per family present in the window, busiest (by training time) first. */
  readonly sports: readonly WeeklySummarySport[];
  /**
   * All families folded into one series, or `null` when the athlete has fewer than two of them —
   * a "Wszystko" that can only ever mean "Bieg" is a second name for the same tab (spec 089).
   */
  readonly combined: WeeklySummaryCombined | null;
  /**
   * What the card opens on: every sport when there are several, otherwise the busiest family.
   * `null` when there is nothing to show.
   */
  readonly defaultGroup: WeeklySummarySelection | null;
  readonly hasData: boolean;
}

export interface WeeklySummaryRequest {
  readonly userId: string;
  /** Language this request renders in (spec 076) — sport names and month ticks follow it. */
  readonly locale: Locale;
}
