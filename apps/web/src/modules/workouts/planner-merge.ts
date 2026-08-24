/**
 * Pairing an authored workout with its own Garmin echo (spec 093) — a RENDERING-only merge. Pure, so
 * every rule here is testable without a store, exactly like `$lib/session-match.ts` next door.
 *
 * ## Why this is NOT `$lib/session-match.ts`
 *
 * That file pairs a plan against a completed ACTIVITY — a different shape, and shared because two
 * separate modules (the week review and this planner) ask the same "was this done?" question of it.
 * This file pairs a plan against ANOTHER PLAN. It has exactly one consumer — `workouts.api.ts`'s
 * `loadPlanner` — so per AGENTS.md §5 it stays in the module that owns it rather than inventing a
 * second, drifting definition of "plan" in `$lib/`.
 *
 * ## The id premise (read before trusting the id-match path)
 *
 * `AuthoredWorkout.garminScheduleId` (from `scheduleWorkout`, spec 092) and `garminWorkoutId` (from
 * `createWorkout`, spec 050) are the two ids a push already writes. Whether either one reappears as a
 * `synced_planned_events.id` once Garmin echoes the session back has **not been confirmed** against a
 * real payload in this checkout (no NAS/production database access here) — see spec 093's Closeout.
 * `garmy_client.py`'s own `_planned_event` tries `item.id`, then `item.scheduleId`, then
 * `item.workoutId`, and that ordering is itself an `# ASSUMPTION:`-tagged guess from spec 024. The id
 * path below is cheap and correct WHEN it lines up, and does no harm when it never fires — every test
 * that actually exercises merging in practice should be able to rely on the day+discipline+title
 * fallback alone.
 *
 * ## Per-day only
 *
 * Unlike `session-match.ts`'s activity matching, there is no day-shift tolerance: an echo of a pushed
 * workout appears on the sync that follows the push, on the SAME day the workout was scheduled for.
 * A plan that moved days is a different question this file does not ask.
 */
import { sportGroup } from '$lib/sport-labels';

/** What the matcher needs from an authored workout. */
export interface AuthoredMergeCandidate {
  readonly id: string;
  readonly day: string;
  /** Garmin `typeKey` — always present on an authored row. */
  readonly sport: string;
  readonly title: string;
  readonly garminScheduleId: string | null;
  readonly garminWorkoutId: string | null;
}

/** What the matcher needs from a synced planned event. */
export interface PlannedMergeCandidate {
  readonly id: string;
  readonly day: string;
  /** Garmin `typeKey`, or null for a plan that names no sport — never a heuristic match then. */
  readonly sport: string | null;
  readonly title: string;
}

export interface PlannerMergeResult {
  /** Authored workout id -> the planned event id it was paired with. */
  readonly syncedBackByWorkoutId: ReadonlyMap<string, string>;
  /** Planned event ids folded into an authored workout — excluded from any further "theirs" rendering. */
  readonly matchedPlannedIds: ReadonlySet<string>;
}

const EMPTY_RESULT: PlannerMergeResult = {
  syncedBackByWorkoutId: new Map(),
  matchedPlannedIds: new Set()
};

function groupByDay<T extends { readonly day: string }>(rows: readonly T[]): Map<string, T[]> {
  const out = new Map<string, T[]>();
  for (const row of rows) {
    const bucket = out.get(row.day);
    if (bucket) bucket.push(row);
    else out.set(row.day, [row]);
  }
  return out;
}

/**
 * How close two titles are: `0` identical (trimmed, case-insensitive), `1` one contains the other,
 * `null` not close enough to call a match. Deliberately narrow — Garmin echoes the athlete's own title
 * back verbatim in every observed instance so far, so this never needs to be a similarity library.
 */
function titleCloseness(a: string, b: string): 0 | 1 | null {
  const an = a.trim().toLowerCase();
  const bn = b.trim().toLowerCase();
  if (an.length === 0 || bn.length === 0) return null;
  if (an === bn) return 0;
  if (an.includes(bn) || bn.includes(an)) return 1;
  return null;
}

/**
 * Id-match one day's authored workouts against its planned events. Mutates `usedAuthored` /
 * `usedPlanned` for whatever it claims; everything left over falls through to the heuristic pass.
 *
 * Per authored workout, `garminScheduleId` is tried before `garminWorkoutId` (both are just "the id a
 * push wrote"; trying both is what the spec calls for since the premise check could not confirm which
 * one, if either, Garmin echoes back as its own `id`). The first same-day planned event whose `id`
 * equals one of them wins — deterministic, and no discipline/title check needed once an id lines up.
 */
function matchByIdForDay(
  authored: readonly AuthoredMergeCandidate[],
  planned: readonly PlannedMergeCandidate[],
  usedAuthored: Set<string>,
  usedPlanned: Set<string>,
  out: Map<string, string>
): void {
  for (const a of authored) {
    if (usedAuthored.has(a.id)) continue;
    const wanted = [a.garminScheduleId, a.garminWorkoutId].filter((id): id is string => id !== null);
    if (wanted.length === 0) continue;

    const match = planned.find((p) => !usedPlanned.has(p.id) && wanted.includes(p.id));
    if (!match) continue;

    usedAuthored.add(a.id);
    usedPlanned.add(match.id);
    out.set(a.id, match.id);
  }
}

/**
 * Heuristic fallback for one day: same day (already guaranteed by the caller), same discipline
 * (`sportGroup`), closest title. Only runs on whatever the id pass above did not already claim.
 *
 * A planned event with no sport at all never gets a heuristic pairing — "same discipline" cannot be
 * confirmed against an unknown one, and under-merging is the acceptable failure mode here, not
 * over-merging.
 */
function matchByHeuristicForDay(
  authored: readonly AuthoredMergeCandidate[],
  planned: readonly PlannedMergeCandidate[],
  usedAuthored: Set<string>,
  usedPlanned: Set<string>,
  out: Map<string, string>
): void {
  for (const p of planned) {
    if (usedPlanned.has(p.id)) continue;
    if (p.sport === null) continue;
    const plannedFamily = sportGroup(p.sport);

    let best: AuthoredMergeCandidate | null = null;
    let bestCloseness: 0 | 1 = 1;
    let tie = false;

    for (const a of authored) {
      if (usedAuthored.has(a.id)) continue;
      if (sportGroup(a.sport) !== plannedFamily) continue;
      const closeness = titleCloseness(a.title, p.title);
      if (closeness === null) continue;

      if (best === null || closeness < bestCloseness) {
        best = a;
        bestCloseness = closeness;
        tie = false;
      } else if (closeness === bestCloseness) {
        // A second candidate exactly as close as the current best — ambiguous, not guessed.
        tie = true;
      }
    }

    // Ties, and "no clear closest title at all", both leave the event unmerged.
    if (best !== null && !tie) {
      usedAuthored.add(best.id);
      usedPlanned.add(p.id);
      out.set(best.id, p.id);
    }
  }
}

/**
 * Pair each day's authored workouts against that day's synced planned events (spec 093). Never across
 * days. At most one pairing per row on either side.
 *
 * Preferred pairing: an id match (`garminScheduleId` or `garminWorkoutId` equal to a same-day planned
 * event's `id`) wins unconditionally. Falling back, for whatever neither side matched by id: same day
 * (guaranteed by the per-day grouping) + same discipline + closest title, with ties and "no confident
 * closest" both left unmerged.
 */
export function matchPlannedEcho(
  authored: readonly AuthoredMergeCandidate[],
  planned: readonly PlannedMergeCandidate[]
): PlannerMergeResult {
  if (authored.length === 0 || planned.length === 0) return EMPTY_RESULT;

  const authoredByDay = groupByDay(authored);
  const plannedByDay = groupByDay(planned);

  const syncedBackByWorkoutId = new Map<string, string>();
  const matchedPlannedIds = new Set<string>();

  for (const [day, dayAuthored] of authoredByDay) {
    const dayPlanned = plannedByDay.get(day);
    if (!dayPlanned || dayPlanned.length === 0) continue;

    const usedAuthored = new Set<string>();
    const usedPlanned = new Set<string>();
    const pairs = new Map<string, string>();

    matchByIdForDay(dayAuthored, dayPlanned, usedAuthored, usedPlanned, pairs);
    matchByHeuristicForDay(dayAuthored, dayPlanned, usedAuthored, usedPlanned, pairs);

    for (const [workoutId, plannedId] of pairs) {
      syncedBackByWorkoutId.set(workoutId, plannedId);
      matchedPlannedIds.add(plannedId);
    }
  }

  return { syncedBackByWorkoutId, matchedPlannedIds };
}
