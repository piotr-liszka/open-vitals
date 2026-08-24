/**
 * Contracts for the per-sport weekly training summary card (spec 056) — "how much have I done this
 * week in MY sport, and is that normal for me?". Shared by the handler and the card.
 *
 * Self-contained on purpose: nothing here imports `$lib/server`, so the card can be rendered from any
 * route without dragging a server module into the client bundle.
 */
import type { SportGroup } from '$lib/sport-labels';

/**
 * How many weeks the card looks back. FIXED, deliberately: the card's whole claim is "this week
 * against my recent normal", and a normal is only a normal over a constant span — so this window
 * ignores the global range switch (spec 047). Twelve weeks is a training block, which is the unit an
 * athlete already thinks in.
 */
export const WEEKLY_SUMMARY_WEEKS = 12;

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
  /** The family the card opens on — the busiest. `null` when there is nothing to show. */
  readonly defaultGroup: SportGroup | null;
  readonly hasData: boolean;
}

export interface WeeklySummaryRequest {
  readonly userId: string;
}
