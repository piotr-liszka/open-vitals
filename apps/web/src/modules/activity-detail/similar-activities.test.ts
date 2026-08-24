import { describe, it, expect } from 'vitest';
import {
  SIMILAR_LIMIT,
  SIMILAR_TOLERANCE,
  findSimilarActivities,
  isComparable,
  paceOf,
  type SimilarCandidate
} from './similar-activities';

/** The session under test: 40 km in 4000 s (100 s/km), 150 bpm, 200 W. */
const CURRENT = {
  activityId: 'today',
  distanceM: 40_000,
  durationS: 4000,
  avgHr: 150,
  avgPower: 200
};

function candidate(over: Partial<SimilarCandidate> & { activityId: string }): SimilarCandidate {
  return {
    day: '2026-01-01',
    name: null,
    distanceM: 40_000,
    durationS: 4000,
    avgHr: 150,
    avgPower: 200,
    elevationGainM: 100,
    ...over
  };
}

const ids = (r: { entries: readonly { activityId: string }[] } | null): string[] =>
  (r?.entries ?? []).map((e) => e.activityId);

describe('paceOf', () => {
  it('is seconds per kilometre', () => {
    expect(paceOf(40_000, 4000)).toBe(100);
    expect(paceOf(5000, 1500)).toBe(300);
  });

  it('is null without a usable pair — never Infinity or NaN', () => {
    expect(paceOf(null, 4000)).toBeNull();
    expect(paceOf(40_000, null)).toBeNull();
    expect(paceOf(0, 4000)).toBeNull();
    expect(paceOf(40_000, 0)).toBeNull();
  });
});

describe('isComparable', () => {
  it('needs a positive distance AND duration', () => {
    expect(isComparable({ distanceM: 40_000, durationS: 4000 })).toBe(true);
    expect(isComparable({ distanceM: null, durationS: 4000 })).toBe(false);
    expect(isComparable({ distanceM: 40_000, durationS: null })).toBe(false);
    expect(isComparable({ distanceM: 0, durationS: 4000 })).toBe(false);
  });
});

describe('findSimilarActivities (spec 065)', () => {
  it('keeps a session inside both tolerances', () => {
    // +10% distance, +10% duration — comfortably inside ±15% on both axes.
    const r = findSimilarActivities(CURRENT, [
      candidate({ activityId: 'a', distanceM: 44_000, durationS: 4400 })
    ]);
    expect(ids(r)).toEqual(['a']);
  });

  it('rejects a session outside EITHER tolerance, not just both', () => {
    const r = findSimilarActivities(CURRENT, [
      // Same distance, 40% longer: a recovery spin over the same route is not a similar effort.
      candidate({ activityId: 'slow', durationS: 5600 }),
      // Same duration, twice the distance.
      candidate({ activityId: 'far', distanceM: 80_000 })
    ]);
    expect(ids(r)).toEqual([]);
  });

  it('treats the tolerance as inclusive at the boundary', () => {
    const r = findSimilarActivities(CURRENT, [
      candidate({ activityId: 'edge', distanceM: 40_000 * (1 + SIMILAR_TOLERANCE), durationS: 4000 })
    ]);
    expect(ids(r)).toEqual(['edge']);
  });

  it('ranks by combined deviation, closest first', () => {
    const r = findSimilarActivities(CURRENT, [
      candidate({ activityId: 'far', distanceM: 45_000, durationS: 4500 }), // ~12.5% + 12.5%
      candidate({ activityId: 'near', distanceM: 40_400, durationS: 4040 }), // 1% + 1%
      candidate({ activityId: 'mid', distanceM: 42_000, durationS: 4200 }) // 5% + 5%
    ]);
    expect(ids(r)).toEqual(['near', 'mid', 'far']);
  });

  it('breaks ties by recency, so the list is stable and the newest is on top', () => {
    const r = findSimilarActivities(CURRENT, [
      candidate({ activityId: 'old', day: '2024-03-02' }),
      candidate({ activityId: 'new', day: '2026-03-02' })
    ]);
    expect(ids(r)).toEqual(['new', 'old']);
  });

  it('never matches the activity against itself', () => {
    const r = findSimilarActivities(CURRENT, [candidate({ activityId: 'today' })]);
    // A self-match would rank first at a closeness of zero and tell the reader nothing.
    expect(ids(r)).toEqual([]);
    expect(r?.comparedCount).toBe(0);
  });

  it('skips a candidate with no distance or duration, and does not count it as compared', () => {
    const r = findSimilarActivities(CURRENT, [
      candidate({ activityId: 'nodist', distanceM: null }),
      candidate({ activityId: 'nodur', durationS: null }),
      candidate({ activityId: 'ok' })
    ]);
    expect(ids(r)).toEqual(['ok']);
    expect(r?.comparedCount).toBe(1);
  });

  it('caps the list', () => {
    const many = Array.from({ length: SIMILAR_LIMIT + 5 }, (_, i) =>
      candidate({ activityId: `a${i}`, distanceM: 40_000 + i * 10 })
    );
    expect(ids(findSimilarActivities(CURRENT, many))).toHaveLength(SIMILAR_LIMIT);
  });

  it('counts every comparable candidate examined, not just the ones that matched', () => {
    const r = findSimilarActivities(CURRENT, [
      candidate({ activityId: 'match' }),
      candidate({ activityId: 'miss', distanceM: 90_000, durationS: 9000 })
    ]);
    // The reader needs to know the search was wide before believing "nothing was similar".
    expect(r?.comparedCount).toBe(2);
    expect(ids(r)).toEqual(['match']);
  });

  /**
   * `null` and an empty list are DIFFERENT answers and the card says different things for each: one
   * is about the session, the other about the athlete's history.
   */
  it('returns null when the current session has no axis to match on', () => {
    expect(
      findSimilarActivities({ ...CURRENT, distanceM: null }, [candidate({ activityId: 'a' })])
    ).toBeNull();
    expect(findSimilarActivities({ ...CURRENT, durationS: 0 }, [candidate({ activityId: 'a' })])).toBeNull();
  });

  it('returns an empty list, not null, when the session is comparable but nothing matched', () => {
    const r = findSimilarActivities(CURRENT, [
      candidate({ activityId: 'a', distanceM: 5000, durationS: 500 })
    ]);
    expect(r).not.toBeNull();
    expect(r!.entries).toEqual([]);
    expect(r!.tolerancePct).toBe(15);
  });

  it('reports when the scan was truncated, so the card can stop claiming completeness', () => {
    expect(findSimilarActivities(CURRENT, [], { coversAllHistory: false })?.coversAllHistory).toBe(false);
    expect(findSimilarActivities(CURRENT, [])?.coversAllHistory).toBe(true);
  });

  describe('deltas are signed from the CANDIDATE towards the current session', () => {
    it('reports a faster older session as a lower pace', () => {
      // 40 km in 3800 s = 95 s/km against today's 100 s/km.
      const r = findSimilarActivities(CURRENT, [candidate({ activityId: 'a', durationS: 3800 })]);
      const e = r!.entries[0]!;
      expect(e.paceSecPerKm).toBe(95);
      expect(e.pace.abs).toBe(-5);
      expect(e.pace.pct).toBe(-5);
    });

    it('reports heart rate and power deltas independently', () => {
      const r = findSimilarActivities(CURRENT, [candidate({ activityId: 'a', avgHr: 160, avgPower: 180 })]);
      const e = r!.entries[0]!;
      expect(e.hr.abs).toBe(10);
      expect(e.power.abs).toBe(-20);
      expect(e.power.pct).toBe(-10);
    });

    it('leaves a delta null when either side lacks the metric', () => {
      const r = findSimilarActivities({ ...CURRENT, avgPower: null }, [
        candidate({ activityId: 'a', avgHr: null })
      ]);
      const e = r!.entries[0]!;
      expect(e.hr).toEqual({ pct: null, abs: null });
      expect(e.power).toEqual({ pct: null, abs: null });
      // The axes it CAN compare still work.
      expect(e.distance.abs).toBe(0);
    });
  });
});
