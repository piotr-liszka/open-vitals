/**
 * Turning stored efforts into the leaderboard (spec 054). PURE: rows in, ranked sections out.
 *
 * The store already ranks in SQL, but this function re-sorts and re-caps anyway. Ranking is the whole
 * claim the card makes — "this is your fastest 5 km ever" — so it must not depend on which adapter
 * answered. Cheap too: at most a few dozen rows.
 *
 * Ordering rules, both deliberate:
 *  - fastest first, and
 *  - a tie goes to the EARLIER day. Two identical times are not the same result; the record belongs
 *    to whoever set it first, and demoting it because it is older would be backwards.
 */
import { EFFORT_DISTANCES } from '$lib/analytics/best-efforts';
import type { BestEffortDistance, BestEffortEntry, BestEffortRow } from './best-efforts.types';

function faster(a: BestEffortRow, b: BestEffortRow): number {
  return a.durationS - b.durationS || a.day.localeCompare(b.day) || a.activityId.localeCompare(b.activityId);
}

/**
 * Group rows by standard distance (shortest first) and number them 1..`topN`.
 *
 * Distances with no rows are absent, never an empty section — the same honesty as the engine itself,
 * which never extrapolates a distance the athlete has not covered. A key that is not in
 * `EFFORT_DISTANCES` (a storage row left over from an older distance set) is dropped rather than
 * rendered without a label.
 */
export function rankBestEfforts(rows: readonly BestEffortRow[], topN: number): BestEffortDistance[] {
  if (topN <= 0) return [];
  const byKey = new Map<string, BestEffortRow[]>();
  for (const row of rows) {
    const bucket = byKey.get(row.key);
    if (bucket) bucket.push(row);
    else byKey.set(row.key, [row]);
  }

  const out: BestEffortDistance[] = [];
  // Iterating EFFORT_DISTANCES (not the map) is what fixes the section order to shortest-first.
  for (const distance of EFFORT_DISTANCES) {
    const bucket = byKey.get(distance.key);
    if (!bucket || bucket.length === 0) continue;
    const entries: BestEffortEntry[] = [...bucket]
      .sort(faster)
      .slice(0, topN)
      .map((row, i) => ({ ...row, rank: i + 1 }));
    out.push({
      key: distance.key,
      label: distance.label,
      metres: distance.metres,
      entries
    });
  }
  return out;
}
