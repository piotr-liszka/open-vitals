/**
 * PURE cross-reference matcher: given a Strava activity, find the Garmin activity that is "the same
 * workout" so we can attach the Strava permalink to it. No I/O, no clock, no randomness — every
 * input is passed in, so it's exhaustively unit-testable.
 *
 * Heuristic: a candidate matches when the start instants are within `startToleranceS` AND — for the
 * dimensions both sides report — duration and distance are within their tolerances. Among all
 * passing candidates we keep the one closest in start time. The score (0..1) blends how tight the
 * start, duration and distance agreement is, so the UI can show confidence.
 */
import type { ActivitySummary } from '../store/types';
import type { StravaActivityRef } from './types';

/** A resolved Strava↔Garmin link. `activityId` is the Garmin activity the permalink attaches to. */
export interface StravaLink {
  readonly activityId: string;
  readonly stravaId: string;
  readonly permalink: string;
  /** Match confidence, 0..1 (1 = perfect start/duration/distance agreement). */
  readonly matchScore: number;
  /** Absolute start-time delta in seconds (diagnostics / tie-breaking). */
  readonly startDeltaS: number;
}

export interface MatchOptions {
  /** Max absolute start-time gap in seconds. Default 180 (±3 min). */
  readonly startToleranceS?: number;
  /** Max relative duration difference. Default 0.1 (±10%). */
  readonly durationTolerancePct?: number;
  /** Max relative distance difference. Default 0.1 (±10%). */
  readonly distanceTolerancePct?: number;
}

const DEFAULTS: Required<MatchOptions> = {
  startToleranceS: 180,
  durationTolerancePct: 0.1,
  distanceTolerancePct: 0.1
};

/** Parse an ISO instant to epoch ms; returns NaN on garbage (callers guard). */
function toMs(iso: string): number {
  return new Date(iso).getTime();
}

/** Relative difference of two positive magnitudes; 0 when identical. */
function relDiff(a: number, b: number): number {
  const max = Math.max(Math.abs(a), Math.abs(b));
  if (max === 0) return 0;
  return Math.abs(a - b) / max;
}

/**
 * Try to match one Strava activity to the best Garmin candidate. Returns a link, or `null` when no
 * candidate clears the tolerances.
 */
export function matchStravaActivity(
  ref: StravaActivityRef,
  candidates: readonly ActivitySummary[],
  options: MatchOptions = {}
): StravaLink | null {
  const opts = { ...DEFAULTS, ...options };
  const refStart = toMs(ref.startTime);
  if (Number.isNaN(refStart)) return null;

  let best: StravaLink | null = null;

  for (const cand of candidates) {
    const candStart = toMs(cand.startTime);
    if (Number.isNaN(candStart)) continue;

    const startDeltaS = Math.abs(candStart - refStart) / 1000;
    if (startDeltaS > opts.startToleranceS) continue;

    // Duration: compare only when the candidate reports one; else skip that dimension.
    const candDuration = cand.durationS ?? cand.movingS;
    let durDiff: number | null = null;
    if (candDuration != null && ref.durationS > 0) {
      durDiff = relDiff(ref.durationS, candDuration);
      if (durDiff > opts.durationTolerancePct) continue;
    }

    // Distance: same conditional treatment.
    let distDiff: number | null = null;
    if (cand.distanceM != null && ref.distanceM > 0) {
      distDiff = relDiff(ref.distanceM, cand.distanceM);
      if (distDiff > opts.distanceTolerancePct) continue;
    }

    // Require at least one corroborating magnitude beyond the timestamp, so a bare coincidental
    // start time can't produce a false link.
    if (durDiff === null && distDiff === null) continue;

    const startScore = 1 - startDeltaS / opts.startToleranceS;
    const durScore = durDiff === null ? 1 : 1 - durDiff / opts.durationTolerancePct;
    const distScore = distDiff === null ? 1 : 1 - distDiff / opts.distanceTolerancePct;
    const matchScore = Number(((startScore + durScore + distScore) / 3).toFixed(4));

    const link: StravaLink = {
      activityId: cand.activityId,
      stravaId: ref.stravaId,
      permalink: ref.permalink,
      matchScore,
      startDeltaS: Number(startDeltaS.toFixed(3))
    };

    // Prefer the tightest start; break ties on the higher blended score.
    if (
      best === null ||
      link.startDeltaS < best.startDeltaS ||
      (link.startDeltaS === best.startDeltaS && link.matchScore > best.matchScore)
    ) {
      best = link;
    }
  }

  return best;
}

/**
 * Match many Strava references against one Garmin candidate pool. Each Garmin activity is claimed by
 * at most one Strava activity (the strongest match wins), so we never attach two permalinks to one
 * workout.
 */
export function matchAll(
  refs: readonly StravaActivityRef[],
  candidates: readonly ActivitySummary[],
  options: MatchOptions = {}
): StravaLink[] {
  const claimed = new Set<string>();
  const links: StravaLink[] = [];

  // Sort strongest-first so higher-confidence links claim their Garmin activity before weaker ones.
  const scored = refs
    .map((ref) => ({ ref, link: matchStravaActivity(ref, candidates, options) }))
    .filter((x): x is { ref: StravaActivityRef; link: StravaLink } => x.link !== null)
    .sort((a, b) => b.link.matchScore - a.link.matchScore || a.link.startDeltaS - b.link.startDeltaS);

  for (const { link } of scored) {
    if (claimed.has(link.activityId)) continue;
    claimed.add(link.activityId);
    links.push(link);
  }

  return links;
}
