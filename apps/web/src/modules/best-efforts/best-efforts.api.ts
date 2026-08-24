/**
 * All-time best-efforts leaderboard handler (spec 054). Reads the efforts the sync engine derived and
 * stored — never a stream, never Garmin — so "my three fastest 5 km ever" costs one indexed query
 * instead of a stream blob per activity.
 *
 * Pure over injected deps: the store port comes in, data comes out. The store is narrowed to the one
 * method used, so a test can hand this handler a two-line fake and nothing else.
 */
import { sportKeysInGroup } from '$lib/sport-labels';
import type { LocalStore } from '$lib/server/store/types';
import { rankBestEfforts } from './best-efforts.rank';
import {
  BEST_EFFORTS_DEFAULT_GROUP,
  BEST_EFFORTS_TOP_N,
  type BestEffortsData,
  type BestEffortsRequest
} from './best-efforts.types';

export interface BestEffortsDeps {
  store: Pick<LocalStore, 'listTopBestEfforts'>;
}

export async function loadBestEfforts(
  deps: BestEffortsDeps,
  req: BestEffortsRequest
): Promise<BestEffortsData> {
  // Clamped, not trusted: `topN` reaches this handler from a caller, and an unbounded limit would
  // turn a card into an unpaged history dump.
  const topN =
    req.topN !== undefined && Number.isInteger(req.topN) && req.topN > 0
      ? Math.min(req.topN, 10)
      : BEST_EFFORTS_TOP_N;
  const group = req.group ?? BEST_EFFORTS_DEFAULT_GROUP;

  // Scoped to the authenticated user by the store port (AGENTS.md §2 rule 2) and to one sport family
  // in the query, so the database does the filtering rather than the page.
  const rows = await deps.store.listTopBestEfforts(req.userId, {
    limit: topN,
    sports: sportKeysInGroup(group)
  });

  const distances = rankBestEfforts(rows, topN);
  return { distances, topN, hasData: distances.length > 0 };
}
