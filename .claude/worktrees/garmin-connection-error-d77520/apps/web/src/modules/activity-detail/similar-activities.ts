/**
 * "Have I done this EFFORT before?" (spec 065) — the sibling of matched routes, which answers "have I
 * done this ROUTE before?". Two different questions, and the route answer cannot stand in for this
 * one: a 40 km ride down a new road matches no route at all, yet the athlete has ridden forty
 * kilometres eighty times and wants to know where today lands. Route matching is also blind without
 * GPS, so it never answers anything for a treadmill run or a trainer session.
 *
 * PURE: target + candidates in, ranked matches out. No store, no clock, no Garmin — so the entire
 * matching policy is a unit test rather than an integration test.
 *
 * ## What "similar" means here, and why it is fixed
 *
 * Same sport family, distance within ±15%, duration within ±15%. Both axes, because either alone
 * admits the wrong thing: distance alone calls a 40 km recovery spin similar to a 40 km time trial,
 * and duration alone calls a two-hour hill grind similar to a two-hour flat cruise.
 *
 * The tolerance does NOT widen when nothing matches. A search that always returns five results would
 * make "similar" mean something different on every activity, with nothing on screen to say so — the
 * reader could not tell that today's five matches are 30% off when yesterday's were 4% off. An empty
 * list is a real answer: this session was unusual for you.
 */

/** How far distance and duration may deviate, as a fraction. */
export const SIMILAR_TOLERANCE = 0.15;

/** Most matches shown. Beyond this the list stops being scannable and starts being a log. */
export const SIMILAR_LIMIT = 6;

/** What matching needs to know about any activity — the current one or a candidate. */
export interface SimilarCandidate {
  readonly activityId: string;
  /** Local day `YYYY-MM-DD`. */
  readonly day: string;
  readonly name: string | null;
  readonly distanceM: number | null;
  /** Moving time where the watch reports it, else elapsed. */
  readonly durationS: number | null;
  readonly avgHr: number | null;
  readonly avgPower: number | null;
  readonly elevationGainM: number | null;
}

/** A signed comparison against the current session. `null` when either side lacks the number. */
export interface SimilarDelta {
  /** Percent difference vs the current session; negative = the candidate is lower. */
  readonly pct: number | null;
  /** Absolute difference in the metric's own unit. */
  readonly abs: number | null;
}

export interface SimilarEntry extends SimilarCandidate {
  /** Seconds per km; `null` without a usable distance/duration pair. */
  readonly paceSecPerKm: number | null;
  /** Combined relative deviation from the current session — 0 is identical. Ranking key. */
  readonly closeness: number;
  /**
   * How this candidate compares to the CURRENT session. Read them as "this older session was X":
   * a negative `pace.pct` means the candidate was faster (fewer seconds per km).
   */
  readonly pace: SimilarDelta;
  readonly hr: SimilarDelta;
  readonly power: SimilarDelta;
  readonly distance: SimilarDelta;
  readonly duration: SimilarDelta;
}

export interface SimilarActivities {
  /** Closest first, capped at `SIMILAR_LIMIT`. May be empty — that is a real answer. */
  readonly entries: readonly SimilarEntry[];
  /** Candidates actually examined, so the card can say how wide the search was. */
  readonly comparedCount: number;
  /** The tolerance applied, as a percent, so the empty state can name it. */
  readonly tolerancePct: number;
  /** False when the scan hit its bound and so may not have seen the athlete's whole history. */
  readonly coversAllHistory: boolean;
}

/** Seconds per km, or null when either input is missing or zero. */
export function paceOf(distanceM: number | null, durationS: number | null): number | null {
  if (distanceM === null || durationS === null) return null;
  if (distanceM <= 0 || durationS <= 0) return null;
  return Math.round(durationS / (distanceM / 1000));
}

/** `(candidate - current) / current`, or null when either side is missing or the base is zero. */
function relative(current: number | null, candidate: number | null): number | null {
  if (current === null || candidate === null || current === 0) return null;
  return (candidate - current) / current;
}

function delta(current: number | null, candidate: number | null): SimilarDelta {
  const rel = relative(current, candidate);
  return {
    pct: rel === null ? null : Math.round(rel * 1000) / 10,
    abs: current === null || candidate === null ? null : Math.round((candidate - current) * 10) / 10
  };
}

/** Whether an activity has the two axes matching is defined over. */
export function isComparable(a: Pick<SimilarCandidate, 'distanceM' | 'durationS'>): boolean {
  return a.distanceM !== null && a.distanceM > 0 && a.durationS !== null && a.durationS > 0;
}

export interface SimilarOptions {
  readonly tolerance?: number;
  readonly limit?: number;
  /** False when the caller's scan was truncated by its own bound. */
  readonly coversAllHistory?: boolean;
}

/**
 * Rank `candidates` by how close they are to `current`.
 *
 * Returns `null` when the current activity has no distance/duration axis at all — a strength session
 * or a malformed row. That is deliberately distinct from "no matches": the card says "this session
 * cannot be compared" rather than "nothing was similar", because those mean different things and only
 * one of them is about the athlete's history.
 *
 * Callers must pre-filter to the same sport family and exclude the current activity; both are cheap
 * for a caller that already has the rows, and neither is this function's business.
 */
export function findSimilarActivities(
  current: Pick<SimilarCandidate, 'activityId' | 'distanceM' | 'durationS' | 'avgHr' | 'avgPower'>,
  candidates: readonly SimilarCandidate[],
  options: SimilarOptions = {}
): SimilarActivities | null {
  if (!isComparable(current)) return null;

  const tolerance = options.tolerance ?? SIMILAR_TOLERANCE;
  const limit = options.limit ?? SIMILAR_LIMIT;
  const currentPace = paceOf(current.distanceM, current.durationS);

  const matched: SimilarEntry[] = [];
  let comparedCount = 0;

  for (const c of candidates) {
    // A candidate that is the activity itself would always rank first, at a closeness of zero, and
    // tell the reader nothing.
    if (c.activityId === current.activityId) continue;
    if (!isComparable(c)) continue;
    comparedCount += 1;

    const dDistance = relative(current.distanceM, c.distanceM);
    const dDuration = relative(current.durationS, c.durationS);
    if (dDistance === null || dDuration === null) continue;
    if (Math.abs(dDistance) > tolerance || Math.abs(dDuration) > tolerance) continue;

    matched.push({
      ...c,
      paceSecPerKm: paceOf(c.distanceM, c.durationS),
      closeness: Math.abs(dDistance) + Math.abs(dDuration),
      pace: delta(currentPace, paceOf(c.distanceM, c.durationS)),
      hr: delta(current.avgHr, c.avgHr),
      power: delta(current.avgPower, c.avgPower),
      distance: delta(current.distanceM, c.distanceM),
      duration: delta(current.durationS, c.durationS)
    });
  }

  // Closest first; ties broken by recency so the list is stable and the newest comparable is on top.
  matched.sort((a, b) => a.closeness - b.closeness || b.day.localeCompare(a.day));

  return {
    entries: matched.slice(0, limit),
    comparedCount,
    tolerancePct: Math.round(tolerance * 100),
    coversAllHistory: options.coversAllHistory ?? true
  };
}
