/**
 * Contracts for the all-time best-efforts leaderboard (spec 054) — the boundary shared by the card
 * and the handler. Self-contained on purpose: nothing here imports `$lib/server`, so the card can be
 * rendered from anywhere without dragging a server module into the client bundle.
 */
import type { SportGroup } from '$lib/sport-labels';

/**
 * Efforts kept per distance. Three is the podium: it shows whether a record is a one-off or the top
 * of a cluster, without turning a card into a results table. Deliberately small — a fourth row adds
 * height, not insight.
 */
export const BEST_EFFORTS_TOP_N = 3;

/** Sport family the leaderboard covers by default. Best efforts are a pace idea (see the spec). */
export const BEST_EFFORTS_DEFAULT_GROUP: SportGroup = 'run';

/**
 * One stored effort as the ranker consumes it. Structurally the store's `RankedBestEffort`, restated
 * here so this file stays free of server imports.
 */
export interface BestEffortRow {
  /** `EFFORT_DISTANCES` key, e.g. `5k`. */
  readonly key: string;
  readonly durationS: number;
  readonly paceSecPerKm: number;
  /** Metres the fastest window actually covered (≥ the nominal distance). */
  readonly actualM: number;
  readonly activityId: string;
  readonly activityName: string | null;
  readonly sport: string;
  /** Local `YYYY-MM-DD` of the activity. */
  readonly day: string;
}

/** A ranked row on the leaderboard. `rank` 1 is the record. */
export interface BestEffortEntry extends BestEffortRow {
  readonly rank: number;
}

/** One distance section: the standard distance plus its podium. */
export interface BestEffortDistance {
  readonly key: string;
  /** Polish label from `EFFORT_DISTANCES`. */
  readonly label: string;
  readonly metres: number;
  readonly entries: readonly BestEffortEntry[];
}

export interface BestEffortsData {
  /** Only distances the athlete actually has an effort for, shortest first. */
  readonly distances: readonly BestEffortDistance[];
  /** How many rows a section can hold — the view says so rather than hardcoding "3". */
  readonly topN: number;
  /** False when nothing has been derived yet (no runs, or the backfill has not reached them). */
  readonly hasData: boolean;
}

export interface BestEffortsRequest {
  readonly userId: string;
  /** Sport family to rank within. Defaults to `run`. */
  readonly group?: SportGroup;
  /** Rows per distance. Defaults to `BEST_EFFORTS_TOP_N`. */
  readonly topN?: number;
}
