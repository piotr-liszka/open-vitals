/**
 * Matched routes (spec 041) — "you have run this loop 14 times; today was your third fastest".
 *
 * Strava calls the same idea Matched Runs. This is the **route**-level version, deliberately not the
 * segment-level one, and that choice is the whole design:
 *
 *  · A route match asks "is this the same outing as that one?" — one comparison per candidate, no
 *    index, no per-segment bookkeeping, and it answers the question athletes actually ask about their
 *    regular loops.
 *  · Segment matching asks "does this activity pass through that stretch?", which needs a segment
 *    catalogue and a spatial index to be affordable. It is a later spec, and it can be built on the
 *    same cell primitives below.
 *
 * PURE: GPS arrays in, matches out. No store, no clock, no Garmin. Lives in `lib/analytics/` so the
 * view can share its types.
 *
 * ## How the match works
 *
 * Each track is reduced to the SET of ~50 m grid cells it visits, plus its start and end cell and its
 * length. Two tracks match when
 *
 *   1. their cell sets overlap enough (Jaccard ≥ `MIN_SIMILARITY`), and
 *   2. their lengths are within `LENGTH_TOLERANCE`.
 *
 * Jaccard rather than a curve distance (Fréchet, DTW) because it is O(cells) instead of O(n·m), needs
 * no alignment, and is symmetric and direction-agnostic — an out-and-back run in reverse visits the same
 * cells and should match. Where that matters, `sameStart` / `sameEnd` are reported separately so a
 * caller can be stricter without the engine baking a policy in.
 *
 * ## Why the length gate is not optional
 *
 * Jaccard alone would match a 5 km loop against the 10 km double-loop containing it — the shorter track's
 * cells are almost a subset, and intersection-over-union stays high when one set is small. The length gate
 * is what keeps "the same route" from meaning "one route inside another".
 *
 * ## Honesty
 *
 * · Cell quantisation means a match is a *probable* same route, not a proof. Similarity is reported with
 *   every match so a view can show how close it is rather than implying certainty.
 * · Tracks shorter than `MIN_TRACK_M` are not fingerprinted at all: a 200 m walk to the shop matches
 *   every other 200 m walk from the same door, which is true and useless.
 */

/** Grid resolution. 50 m is finer than consumer GPS noise on a road and coarse enough to tolerate it. */
export const CELL_METRES = 50;
/** Cell-set overlap two tracks need to be called the same route. */
export const MIN_SIMILARITY = 0.7;
/** Fractional length difference allowed between two tracks of "the same" route. */
export const LENGTH_TOLERANCE = 0.15;
/** Below this a track is too short for a route match to mean anything. */
export const MIN_TRACK_M = 800;

/** Metres per degree of latitude. Constant enough at any latitude for a 50 m grid. */
const M_PER_DEG_LAT = 111_320;

/** A GPS sample: `[lat, lng]`, optionally with an altitude this module ignores. */
export type TrackPoint = readonly [number, number] | readonly [number, number, number];

export interface RouteFingerprint {
  /** Sorted, de-duplicated grid cells the track visits. */
  readonly cells: readonly string[];
  readonly startCell: string;
  readonly endCell: string;
  /** Great-circle length along the track, in metres. */
  readonly lengthM: number;
  /** Usable samples behind the fingerprint. */
  readonly points: number;
}

/**
 * Quantise a coordinate to a grid cell id. Longitude cells widen with latitude (`/cos φ`) so a cell is
 * about `CELL_METRES` on both sides everywhere rather than collapsing to a sliver near the poles.
 *
 * The longitude step is derived from the QUANTISED latitude band, not from the raw latitude. That is
 * what makes the grid stationary: with the raw value, two points at the same longitude a few metres
 * apart in latitude get slightly different longitude steps and can land in different longitude cells,
 * which inflates the cell count and makes the fingerprint depend on sample spacing. Within a band the
 * step is now constant, so a cell is a fixed patch of ground.
 */
export function cellOf(lat: number, lng: number): string {
  const latStep = CELL_METRES / M_PER_DEG_LAT;
  const latIndex = Math.round(lat / latStep);
  // Guard the pole: cos φ → 0 would make the longitude step infinite.
  const cos = Math.max(0.01, Math.cos((latIndex * latStep * Math.PI) / 180));
  const lngStep = latStep / cos;
  return `${latIndex}:${Math.round(lng / lngStep)}`;
}

/** Great-circle metres between two coordinates (haversine). */
export function distanceM(a: TrackPoint, b: TrackPoint): number {
  const toRad = Math.PI / 180;
  const dLat = (b[0] - a[0]) * toRad;
  const dLng = (b[1] - a[1]) * toRad;
  const lat1 = a[0] * toRad;
  const lat2 = b[0] * toRad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * 6_371_000 * Math.asin(Math.min(1, Math.sqrt(h)));
}

const usable = (p: TrackPoint | undefined): p is TrackPoint =>
  Array.isArray(p) &&
  p.length >= 2 &&
  Number.isFinite(p[0]) &&
  Number.isFinite(p[1]) &&
  Math.abs(p[0]) <= 90 &&
  Math.abs(p[1]) <= 180;

/**
 * Reduce a track to its fingerprint. `null` when the track is unusable or shorter than `MIN_TRACK_M`
 * — the two cases where a match would be meaningless rather than merely uncertain.
 */
export function routeFingerprint(track: readonly TrackPoint[] | null | undefined): RouteFingerprint | null {
  if (!track || track.length < 2) return null;

  const cells = new Set<string>();
  let lengthM = 0;
  let previous: TrackPoint | null = null;
  let first: TrackPoint | null = null;
  let last: TrackPoint | null = null;
  let points = 0;

  for (const p of track) {
    if (!usable(p)) continue;
    points++;
    cells.add(cellOf(p[0], p[1]));
    if (previous) lengthM += distanceM(previous, p);
    if (!first) first = p;
    last = p;
    previous = p;
  }

  if (!first || !last || points < 2 || lengthM < MIN_TRACK_M) return null;

  return {
    cells: [...cells].sort(),
    startCell: cellOf(first[0], first[1]),
    endCell: cellOf(last[0], last[1]),
    lengthM: Math.round(lengthM),
    points
  };
}

/**
 * Jaccard overlap of two cell sets: |A ∩ B| / |A ∪ B|. 1 = identical coverage, 0 = disjoint.
 * Symmetric and direction-agnostic by construction.
 */
export function similarity(a: RouteFingerprint, b: RouteFingerprint): number {
  const smaller = a.cells.length <= b.cells.length ? a.cells : b.cells;
  const larger = new Set(a.cells.length <= b.cells.length ? b.cells : a.cells);
  let shared = 0;
  for (const cell of smaller) if (larger.has(cell)) shared++;
  const union = a.cells.length + b.cells.length - shared;
  return union === 0 ? 0 : round3(shared / union);
}

/** Whether two lengths are close enough to be the same route. */
export function lengthsMatch(a: number, b: number, tolerance = LENGTH_TOLERANCE): boolean {
  const longer = Math.max(a, b);
  return longer > 0 && Math.abs(a - b) / longer <= tolerance;
}

export interface RouteCandidate<T> {
  readonly value: T;
  readonly fingerprint: RouteFingerprint;
}

export interface RouteMatch<T> {
  readonly value: T;
  /** Cell-set overlap, 0–1. Reported so a view can show how close the match is. */
  readonly similarity: number;
  /** True when both tracks begin in the same grid cell. */
  readonly sameStart: boolean;
  /** True when both tracks end in the same grid cell. */
  readonly sameEnd: boolean;
  readonly lengthM: number;
}

export interface MatchOptions {
  readonly minSimilarity?: number;
  readonly lengthTolerance?: number;
}

/**
 * Candidates that are the same route as `target`, closest match first. The length gate runs BEFORE the
 * overlap so the cheap test rejects most candidates without walking their cell sets.
 */
export function matchRoutes<T>(
  target: RouteFingerprint,
  candidates: readonly RouteCandidate<T>[],
  opts: MatchOptions = {}
): RouteMatch<T>[] {
  const minSimilarity = opts.minSimilarity ?? MIN_SIMILARITY;
  const tolerance = opts.lengthTolerance ?? LENGTH_TOLERANCE;
  const out: RouteMatch<T>[] = [];

  for (const c of candidates) {
    if (!lengthsMatch(target.lengthM, c.fingerprint.lengthM, tolerance)) continue;
    const s = similarity(target, c.fingerprint);
    if (s < minSimilarity) continue;
    out.push({
      value: c.value,
      similarity: s,
      sameStart: target.startCell === c.fingerprint.startCell,
      sameEnd: target.endCell === c.fingerprint.endCell,
      lengthM: c.fingerprint.lengthM
    });
  }

  return out.sort((a, b) => b.similarity - a.similarity);
}

/**
 * Every `step`-th point of a track, first and last always kept. Fingerprinting a 1 Hz three-hour ride
 * means 10 000 haversine calls; at 50 m cells, every fourth point carries the same cell set, so the
 * caller can decimate before fingerprinting and lose nothing that matters.
 */
export function decimate(track: readonly TrackPoint[], step: number): TrackPoint[] {
  if (step <= 1 || track.length <= 2) return [...track];
  const out: TrackPoint[] = [];
  for (let i = 0; i < track.length; i += step) {
    const p = track[i];
    if (p) out.push(p);
  }
  const last = track[track.length - 1];
  if (last && out[out.length - 1] !== last) out.push(last);
  return out;
}

function round3(v: number): number {
  return Math.round(v * 1000) / 1000;
}
