/**
 * Deriving the all-time best-efforts leaderboard (spec 054). The sync engine is the only writer of
 * the local store, so this is where a per-activity effort set is computed and persisted — not at page
 * load, where "my fastest 5 km ever" would mean reading a stream blob per activity on every request.
 *
 * Two functions, both driven by injected deps only (a `LocalStore`; no clock, no Garmin, no fetch):
 *
 *  - `deriveBestEfforts` — pure: streams in, effort rows out, reusing spec 040's `bestEfforts()`
 *    unchanged over the same two axes the activity charts draw.
 *  - `backfillBestEfforts` — a BOUNDED, RESUMABLE pass over activities whose stored efforts are
 *    missing or stamped below `BEST_EFFORTS_VERSION`. It writes per activity (never one giant
 *    transaction), stops when its budget runs out, and reports what is left so the run detail can say
 *    so. Nothing about it is upstream work: it reads local streams and writes local rows, which is why
 *    the sync tick can also run it when the upstream probe says nothing changed.
 *
 * Sport scope: the `run` and `walk` families. A best effort is a pace-over-distance claim, so a ride's
 * "fastest kilometre" is a descent rather than a result — the same reasoning that limited spec 040's
 * per-activity card to pace sports.
 */
import { bestEfforts } from '$lib/analytics/best-efforts';
import { cumulativeDistance, elapsedSeconds, streamLength } from '$lib/analytics/stream-axes';
import { toDayKey } from '$lib/date';
import { sportKeysInGroup, type SportGroup } from '$lib/sport-labels';
import {
  BEST_EFFORTS_VERSION,
  type ActivityStreams,
  type LocalStore,
  type StoredBestEffort
} from '../store/types';

/** Sport families a best effort means something for. */
export const EFFORT_SPORT_GROUPS: readonly SportGroup[] = ['run', 'walk'];

/** Every Garmin sport key those families cover — the IN-list the store query filters on. */
export const EFFORT_SPORT_KEYS: readonly string[] = EFFORT_SPORT_GROUPS.flatMap((g) => sportKeysInGroup(g));

/** Upper bound on the activities one backfill pass may look at (guards the candidate read). */
const CANDIDATE_SCAN_LIMIT = 20_000;

/**
 * The fastest window per standard distance inside one activity. Empty when the streams carry no
 * usable distance axis — a treadmill session with no speed stream is not an estimate, it is nothing.
 */
export function deriveBestEfforts(streams: ActivityStreams): StoredBestEffort[] {
  const n = streamLength(streams);
  if (n < 2) return [];
  const elapsed = elapsedSeconds(streams, n);
  const distance = cumulativeDistance(streams, elapsed);
  if (!distance) return [];
  // `label` is deliberately dropped: it is display text owned by EFFORT_DISTANCES, not storage.
  return bestEfforts(distance, elapsed).map((e) => ({
    key: e.key,
    metres: e.metres,
    durationS: e.durationS,
    actualM: e.actualM,
    paceSecPerKm: e.paceSecPerKm,
    startS: e.startS,
    samples: e.samples
  }));
}

export interface BestEffortsBackfillResult {
  /** Activities derived and written this pass. */
  readonly computed: number;
  /** Activities still waiting after the budget ran out — the backlog the next tick picks up. */
  readonly pending: number;
}

/**
 * Derive and store efforts for up to `budget` activities, newest first (so a freshly synced session
 * shows up on the leaderboard the same run it arrived, even mid-backfill).
 *
 * Idempotent by construction: `putActivityBestEfforts` REPLACES an activity's set and stamps the
 * version, so a repeated call finds nothing to do and a repeated derivation writes identical rows.
 */
export async function backfillBestEfforts(
  store: LocalStore,
  userId: string,
  budget: number
): Promise<BestEffortsBackfillResult> {
  // A zero budget still counts the backlog rather than short-circuiting: "0 done, 0 left" and
  // "0 done, 900 left" are different things to report, and the run detail says which.
  const take = Math.max(0, budget);

  const versions = await store.listBestEffortVersions(userId);
  const activities = await store.listActivities(userId, {
    sports: EFFORT_SPORT_KEYS,
    limit: CANDIDATE_SCAN_LIMIT
  });
  // `versions` is keyed off STREAM rows: an activity absent from it has nothing to derive from, so
  // including it would burn a budget slot every tick, forever, and never make progress.
  const candidates = activities.filter(
    (a) => versions.has(a.activityId) && (versions.get(a.activityId) ?? 0) < BEST_EFFORTS_VERSION
  );

  let computed = 0;
  for (const activity of candidates.slice(0, take)) {
    const streams = await store.getStreams(userId, activity.activityId);
    // The row vanished between the two reads (a concurrent stream rewrite). Leave it for next time.
    if (!streams) continue;
    await store.putActivityBestEfforts(userId, {
      activityId: activity.activityId,
      sport: activity.sport,
      day: toDayKey(activity.startTimeLocal),
      version: BEST_EFFORTS_VERSION,
      efforts: deriveBestEfforts(streams)
    });
    computed++;
  }

  return { computed, pending: Math.max(0, candidates.length - computed) };
}
