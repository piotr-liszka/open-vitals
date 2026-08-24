import { describe, it, expect } from 'vitest';
import {
  CELL_METRES,
  LENGTH_TOLERANCE,
  MIN_SIMILARITY,
  MIN_TRACK_M,
  cellOf,
  decimate,
  distanceM,
  lengthsMatch,
  matchRoutes,
  routeFingerprint,
  similarity,
  type TrackPoint
} from './route-match';

/** A straight line north from `[lat, lng]`, `count` points `stepM` apart. */
function line(lat: number, lng: number, count: number, stepM = 25): TrackPoint[] {
  const dLat = stepM / 111_320;
  return Array.from({ length: count }, (_, i) => [lat + i * dLat, lng] as TrackPoint);
}

/**
 * The same physical path recorded on another day: a smooth sideways drift of up to `metres`. Real GPS
 * error wanders slowly — it does not alternate sides every second — and the distinction matters here,
 * because a zigzag genuinely visits more cells than a drift does (see the test for that below).
 */
function drift(track: readonly TrackPoint[], metres: number): TrackPoint[] {
  const d = metres / 111_320;
  return track.map((p, i) => {
    const wobble = Math.sin((i / track.length) * Math.PI) * d;
    return [p[0], p[1] + wobble] as TrackPoint;
  });
}

/**
 * A GPS reading that flips SIDEWAYS every sample. The offset is in longitude, i.e. perpendicular to a
 * north-running track — an offset along the direction of travel would just land in cells the track
 * already visits and would prove nothing.
 */
function zigzag(track: readonly TrackPoint[], metres: number): TrackPoint[] {
  const d = metres / 111_320;
  return track.map((p, i) => [p[0], p[1] + (i % 2 === 0 ? d : -d)] as TrackPoint);
}

const LOOP = line(52.2, 21.0, 80); // ~2 km

describe('cellOf', () => {
  it('puts nearby points in the same cell and distant ones apart', () => {
    expect(cellOf(52.2, 21.0)).toBe(cellOf(52.2001, 21.0));
    expect(cellOf(52.2, 21.0)).not.toBe(cellOf(52.3, 21.0));
  });

  it('keeps longitude cells roughly square by widening them with latitude', () => {
    // The same longitude delta spans more cells near the equator than near the pole.
    const equator = new Set([cellOf(0, 0), cellOf(0, 0.002)]);
    const north = new Set([cellOf(70, 0), cellOf(70, 0.002)]);
    expect(equator.size).toBeGreaterThanOrEqual(north.size);
  });

  it('does not blow up at the pole', () => {
    expect(() => cellOf(90, 0)).not.toThrow();
    expect(cellOf(90, 0)).toMatch(/^-?\d+:-?\d+$/);
  });
});

describe('distanceM', () => {
  it('measures a known separation', () => {
    // 0.01° of latitude ≈ 1113 m.
    expect(distanceM([52, 21], [52.01, 21])).toBeCloseTo(1113, -1);
  });

  it('is zero for the same point', () => {
    expect(distanceM([52, 21], [52, 21])).toBe(0);
  });
});

describe('routeFingerprint', () => {
  it('reduces a track to cells, ends and length', () => {
    const fp = routeFingerprint(LOOP)!;
    expect(fp.points).toBe(80);
    expect(fp.lengthM).toBeCloseTo(79 * 25, -1);
    expect(fp.cells.length).toBeGreaterThan(1);
    expect(fp.startCell).toBe(cellOf(LOOP[0]![0], LOOP[0]![1]));
    expect(fp.endCell).toBe(cellOf(LOOP[79]![0], LOOP[79]![1]));
  });

  it('sorts and de-duplicates the cells so two fingerprints are comparable', () => {
    const fp = routeFingerprint([...LOOP, ...LOOP])!;
    expect([...fp.cells].sort()).toEqual(fp.cells);
    expect(new Set(fp.cells).size).toBe(fp.cells.length);
  });

  it('refuses a track too short for a match to mean anything', () => {
    // A 200 m walk matches every other 200 m walk from the same door: true and useless.
    expect(routeFingerprint(line(52.2, 21.0, 9))).toBeNull();
  });

  it('refuses tracks it cannot use at all', () => {
    expect(routeFingerprint(null)).toBeNull();
    expect(routeFingerprint(undefined)).toBeNull();
    expect(routeFingerprint([])).toBeNull();
    expect(routeFingerprint([[52, 21]])).toBeNull();
  });

  it('skips unusable samples instead of failing on them', () => {
    const dirty = [[Number.NaN, 21] as TrackPoint, ...LOOP, [999, 21] as TrackPoint, [52, 999] as TrackPoint];
    const fp = routeFingerprint(dirty)!;
    expect(fp.points).toBe(80);
    expect(fp.lengthM).toBeCloseTo(routeFingerprint(LOOP)!.lengthM, -1);
  });

  it('ignores an altitude third element', () => {
    const withAlt = LOOP.map((p) => [p[0], p[1], 120] as TrackPoint);
    expect(routeFingerprint(withAlt)!.cells).toEqual(routeFingerprint(LOOP)!.cells);
  });
});

describe('similarity', () => {
  it('is 1 for the same track', () => {
    const fp = routeFingerprint(LOOP)!;
    expect(similarity(fp, fp)).toBe(1);
  });

  it('stays high through GPS noise smaller than a cell', () => {
    const a = routeFingerprint(LOOP)!;
    const b = routeFingerprint(drift(LOOP, CELL_METRES / 4))!;
    expect(similarity(a, b)).toBeGreaterThan(MIN_SIMILARITY);
  });

  it('is 0 for routes in different places', () => {
    const a = routeFingerprint(LOOP)!;
    const b = routeFingerprint(line(50.0, 19.9, 80))!;
    expect(similarity(a, b)).toBe(0);
  });

  it('is symmetric', () => {
    const a = routeFingerprint(LOOP)!;
    const b = routeFingerprint(drift(LOOP, 10))!;
    expect(similarity(a, b)).toBe(similarity(b, a));
  });

  it('does not care which direction the route was run', () => {
    const a = routeFingerprint(LOOP)!;
    const b = routeFingerprint([...LOOP].reverse())!;
    expect(similarity(a, b)).toBe(1);
  });
});

describe('lengthsMatch', () => {
  it('accepts a difference inside the tolerance and rejects one outside', () => {
    expect(lengthsMatch(10_000, 10_000 * (1 + LENGTH_TOLERANCE * 0.5))).toBe(true);
    expect(lengthsMatch(10_000, 20_000)).toBe(false);
  });

  it('rejects a zero length rather than dividing by it', () => {
    expect(lengthsMatch(0, 0)).toBe(false);
  });
});

describe('matchRoutes', () => {
  const target = routeFingerprint(LOOP)!;

  const candidate = (id: string, track: readonly TrackPoint[]) => {
    const fingerprint = routeFingerprint(track);
    return fingerprint ? [{ value: id, fingerprint }] : [];
  };

  it('finds the same route run again, closest match first', () => {
    const matches = matchRoutes(target, [
      ...candidate('noisy', drift(LOOP, CELL_METRES / 3)),
      ...candidate('identical', LOOP)
    ]);
    expect(matches.map((m) => m.value)).toEqual(['identical', 'noisy']);
    expect(matches[0]!.similarity).toBe(1);
    expect(matches[0]!.sameStart).toBe(true);
    expect(matches[0]!.sameEnd).toBe(true);
  });

  it('rejects a route somewhere else entirely', () => {
    expect(matchRoutes(target, candidate('elsewhere', line(50.0, 19.9, 80)))).toEqual([]);
  });

  it('rejects the double-loop that CONTAINS the route — the reason the length gate exists', () => {
    // Same start, same cells, twice as far. Overlap alone would call this a match.
    const doubled = [...LOOP, ...[...LOOP].reverse()];
    const matches = matchRoutes(target, candidate('doubled', doubled));
    expect(matches).toEqual([]);
  });

  it('rejects an overlapping but shorter route', () => {
    const half = LOOP.slice(0, 40);
    expect(matchRoutes(target, candidate('half', half))).toEqual([]);
  });

  it('reports whether the ends coincide, without making it a requirement', () => {
    // The same route run the other way: identical cells and length, ends swapped. It IS the same route,
    // so it must match — and the flags must say the ends do not line up, so a caller can be stricter.
    const matches = matchRoutes(target, candidate('reversed', [...LOOP].reverse()));
    expect(matches).toHaveLength(1);
    expect(matches[0]!.similarity).toBe(1);
    expect(matches[0]!.sameStart).toBe(false);
    expect(matches[0]!.sameEnd).toBe(false);
  });

  it('honours a caller‘s stricter threshold', () => {
    const noisy = candidate('noisy', drift(LOOP, CELL_METRES / 3));
    expect(matchRoutes(target, noisy)).toHaveLength(1);
    expect(matchRoutes(target, noisy, { minSimilarity: 0.999 })).toEqual([]);
  });

  it('honours a caller‘s looser length tolerance', () => {
    const longer = line(52.2, 21.0, 100); // 25% further
    expect(matchRoutes(target, candidate('longer', longer))).toEqual([]);
    expect(matchRoutes(target, candidate('longer', longer), { lengthTolerance: 0.4 })).toHaveLength(1);
  });

  it('returns nothing for an empty candidate list', () => {
    expect(matchRoutes(target, [])).toEqual([]);
  });

  it('carries each match‘s own length so a view can show it', () => {
    const matches = matchRoutes(target, candidate('identical', LOOP));
    expect(matches[0]!.lengthM).toBe(target.lengthM);
  });
});

describe('decimate', () => {
  it('keeps every step-th point plus the last one', () => {
    const track = line(52, 21, 10);
    const thinned = decimate(track, 4);
    expect(thinned).toHaveLength(4); // indices 0, 4, 8 + the last
    expect(thinned.at(-1)).toBe(track.at(-1));
  });

  it('is a no-op for a step of 1 or a tiny track', () => {
    const track = line(52, 21, 10);
    expect(decimate(track, 1)).toEqual(track);
    expect(decimate(track.slice(0, 2), 5)).toEqual(track.slice(0, 2));
  });

  it('leaves the fingerprint‘s cells unchanged while the thinned spacing stays well under a cell', () => {
    // 10 m samples decimated by 2 → 20 m apart. Comfortably under the 50 m grid: a sample cannot step
    // over a whole cell. (At 40 m it can, which is the next test.)
    const dense = line(52.2, 21.0, 300, 10); // 3 km
    const full = routeFingerprint(dense)!;
    const thinned = routeFingerprint(decimate(dense, 2))!;
    expect(thinned.cells).toEqual(full.cells);
    expect(similarity(full, thinned)).toBe(1);
  });

  it('stays similar enough to match even when thinned past the cell size', () => {
    // 120 m apart against a 50 m grid: cells WILL be skipped, but not enough to break a match, which is
    // what makes decimating a long ride before fingerprinting a safe optimisation.
    const dense = line(52.2, 21.0, 300, 10);
    const full = routeFingerprint(dense)!;
    const coarse = routeFingerprint(decimate(dense, 12))!;
    expect(coarse.cells.length).toBeLessThan(full.cells.length);
    expect(similarity(full, coarse)).toBeGreaterThan(0.4);
  });
});

describe('the limits, stated', () => {
  it('never fingerprints a track under the minimum length', () => {
    const short = line(52.2, 21.0, 20, 10); // ~200 m
    expect(routeFingerprint(short)).toBeNull();
    expect(MIN_TRACK_M).toBeGreaterThan(0);
  });

  it('sits right on the threshold for worst-case sideways noise, and well under it for wide noise', () => {
    const a = routeFingerprint(LOOP)!;
    const narrow = similarity(a, routeFingerprint(zigzag(LOOP, CELL_METRES / 3))!);
    const wide = similarity(a, routeFingerprint(zigzag(LOOP, CELL_METRES * 1.2))!);

    // Recorded deliberately: per-sample alternation of ±17 m across a cell boundary lands at ~0.69 —
    // just under the 0.7 gate. That is the worst case, not the typical one: real GPS error is
    // correlated between consecutive samples (see the `drift` tests, which pass comfortably). If this
    // ever needs loosening, loosen `MIN_SIMILARITY` knowingly rather than by widening a fixture.
    expect(narrow).toBeGreaterThan(0.6);
    expect(narrow).toBeLessThan(MIN_SIMILARITY + 0.1);

    // Noise wider than a cell walks into ground the original never covered, and overlap collapses.
    expect(wide).toBeLessThan(MIN_SIMILARITY);
    expect(wide).toBeLessThan(narrow);
  });
});
