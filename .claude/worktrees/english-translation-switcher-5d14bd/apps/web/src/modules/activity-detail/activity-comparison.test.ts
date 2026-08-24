import { describe, it, expect } from 'vitest';
import {
  buildPlannedComparison,
  buildTrainingComparison,
  matchPlanned,
  median,
  summarize,
  verdictFor,
  type ComparableActivity,
  type PlannedCandidate
} from './activity-comparison';

/** A planned cycling hour: 40 km, load 100 — the yardstick every plan test bends. */
const plan = (over: Partial<PlannedCandidate>): PlannedCandidate => ({
  id: 'p1',
  day: '2026-05-01',
  kind: 'workout',
  title: 'Interwały 4×8',
  sport: 'cycling',
  description: null,
  estimatedDurationS: 3600,
  estimatedDistanceM: 40000,
  targetLoad: 100,
  ...over
});

const session = (day: string, trainingLoad: number | null): ComparableActivity => ({
  day,
  durationS: 3600,
  trainingLoad,
  avgHr: 150,
  maxHr: 180
});

/** `count` sessions of equal load, one per day, ending the day before `day`. */
function history(day: string, count: number, load: number): ComparableActivity[] {
  const base = new Date(`${day}T00:00:00Z`).getTime();
  return Array.from({ length: count }, (_, i) =>
    session(new Date(base - (i + 1) * 86_400_000).toISOString().slice(0, 10), load)
  );
}

describe('median', () => {
  it('handles odd and even lengths', () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([4, 1, 3, 2])).toBe(2.5);
    expect(median([])).toBeNull();
  });
});

describe('verdictFor', () => {
  it('buckets by the recent norm when there is one', () => {
    expect(verdictFor(60, null)).toBe('peak');
    expect(verdictFor(20, null)).toBe('hard');
    expect(verdictFor(0, null)).toBe('steady');
    expect(verdictFor(-40, null)).toBe('easy');
  });

  it('falls back to load against fitness when there is no norm', () => {
    expect(verdictFor(null, 1.6)).toBe('peak');
    expect(verdictFor(null, 1.1)).toBe('hard');
    expect(verdictFor(null, 0.7)).toBe('steady');
    expect(verdictFor(null, 0.2)).toBe('easy');
  });

  it('is unknown with neither', () => {
    expect(verdictFor(null, null)).toBe('unknown');
  });
});

describe('buildTrainingComparison', () => {
  it('scores the session against the median of the last six weeks', () => {
    const result = buildTrainingComparison({
      day: '2026-05-01',
      activity: session('2026-05-01', 150),
      history: history('2026-05-01', 10, 100)
    });
    expect(result.load).toBe(150);
    expect(result.loadMethod).toBe('garmin');
    expect(result.recentMedianLoad).toBe(100);
    expect(result.recentCount).toBe(10);
    expect(result.vsRecentPct).toBe(50);
    expect(result.verdict).toBe('peak');
    expect(result.summary).toContain('50%');
  });

  it('reports fitness and form as they stood the evening before', () => {
    const result = buildTrainingComparison({
      day: '2026-05-01',
      activity: session('2026-05-01', 100),
      history: history('2026-05-01', 40, 100)
    });
    expect(result.ctlBefore).toBeGreaterThan(0);
    expect(result.atlBefore).toBeGreaterThan(0);
    expect(result.tsbBefore).toBeCloseTo(result.ctlBefore! - result.atlBefore!, 5);
    expect(result.bandBefore).not.toBeNull();
    expect(result.loadRatio).toBeCloseTo(100 / result.ctlBefore!, 2);
  });

  it('ignores anything that happened on or after the activity’s own day', () => {
    const later = [session('2026-05-01', 500), session('2026-05-05', 500)];
    const result = buildTrainingComparison({
      day: '2026-05-01',
      activity: session('2026-05-01', 100),
      history: [...history('2026-05-01', 5, 100), ...later]
    });
    expect(result.recentCount).toBe(5);
    expect(result.recentMedianLoad).toBe(100);
  });

  it('ignores sessions older than the six-week norm window', () => {
    const result = buildTrainingComparison({
      day: '2026-05-01',
      activity: session('2026-05-01', 100),
      history: [session('2026-01-01', 400), ...history('2026-05-01', 3, 100)]
    });
    expect(result.recentCount).toBe(3);
    expect(result.recentMedianLoad).toBe(100);
  });

  it('says so honestly when there is nothing to compare against', () => {
    const result = buildTrainingComparison({
      day: '2026-05-01',
      activity: session('2026-05-01', 120),
      history: []
    });
    expect(result.recentCount).toBe(0);
    expect(result.vsRecentPct).toBeNull();
    expect(result.ctlBefore).toBeNull();
    expect(result.summary).toContain('pierwsza porównywalna sesja');
  });

  it('estimates the load from heart rate when Garmin reports none', () => {
    const result = buildTrainingComparison({
      day: '2026-05-01',
      activity: { day: '2026-05-01', durationS: 3600, trainingLoad: null, avgHr: 150, maxHr: 185 },
      history: [],
      hrMax: 190
    });
    expect(result.loadMethod).toBe('hr');
    expect(result.load).toBeGreaterThan(0);
  });

  it('refuses to score a session with neither a Garmin load nor heart rate', () => {
    const result = buildTrainingComparison({
      day: '2026-05-01',
      activity: { day: '2026-05-01', durationS: 3600, trainingLoad: null, avgHr: null, maxHr: null },
      history: history('2026-05-01', 5, 100)
    });
    expect(result.load).toBeNull();
    expect(result.loadMethod).toBe('none');
    expect(result.verdict).toBe('unknown');
    expect(result.summary).toContain('Nie da się ocenić');
  });

  it('cannot claim anything about a plan when no calendar is available', () => {
    const result = buildTrainingComparison({
      day: '2026-05-01',
      activity: session('2026-05-01', 100),
      history: history('2026-05-01', 5, 100)
    });
    expect(result.plannedWorkout).toBeNull();
    expect(result.plannedWorkoutStatus).toBe('not-synced');
  });

  it('distinguishes "nothing was planned" from "no calendar synced"', () => {
    const result = buildTrainingComparison({
      day: '2026-05-01',
      activity: session('2026-05-01', 100),
      history: [],
      planned: { sameDay: [], calendarHasData: true, sport: 'cycling' }
    });
    expect(result.plannedWorkout).toBeNull();
    expect(result.plannedWorkoutStatus).toBe('none-scheduled');
  });

  it('links the plan scheduled for that day and scores it', () => {
    const result = buildTrainingComparison({
      day: '2026-05-01',
      activity: session('2026-05-01', 100),
      history: [],
      planned: { sameDay: [plan({})], calendarHasData: true, sport: 'cycling' },
      actual: { durationS: 3600, distanceM: 40000, load: 100 }
    });
    expect(result.plannedWorkoutStatus).toBe('linked');
    expect(result.plannedWorkout?.name).toBe('Interwały 4×8');
    expect(result.plannedWorkout?.compliancePct).toBe(100);
    expect(result.plannedWorkout?.steps.every((s) => s.met)).toBe(true);
  });
});

describe('matchPlanned', () => {
  it('ignores a plan for a different sport family on the same day', () => {
    expect(matchPlanned([plan({ sport: 'running' })], 'cycling')).toBeNull();
    expect(matchPlanned([plan({ sport: 'gravel_cycling' })], 'cycling')?.id).toBe('p1');
  });

  it('accepts a plan that names no sport at all', () => {
    expect(matchPlanned([plan({ sport: null })], 'cycling')?.id).toBe('p1');
  });

  it('prefers a workout over a race, and the most specific target over the vaguest', () => {
    const race = plan({ id: 'race', kind: 'race' });
    const workout = plan({ id: 'workout', kind: 'workout' });
    expect(matchPlanned([race, workout], 'cycling')?.id).toBe('workout');

    const vague = plan({ id: 'vague', estimatedDistanceM: null, targetLoad: null });
    const specific = plan({ id: 'specific' });
    expect(matchPlanned([vague, specific], 'cycling')?.id).toBe('specific');
  });
});

describe('buildPlannedComparison', () => {
  it('only scores the targets the plan actually set', () => {
    const result = buildPlannedComparison(plan({ estimatedDistanceM: null, targetLoad: null }), {
      durationS: 3600,
      distanceM: 40000,
      load: 100
    });
    expect(result.steps.map((s) => s.key)).toEqual(['duration']);
    expect(result.targetDistanceM).toBeNull();
  });

  it('marks a target missed once it is more than a tenth out', () => {
    const result = buildPlannedComparison(plan({}), {
      durationS: 1800, // half the planned hour
      distanceM: 40000,
      load: 100
    });
    expect(result.steps.find((s) => s.key === 'duration')?.met).toBe(false);
    expect(result.steps.find((s) => s.key === 'distance')?.met).toBe(true);
    expect(result.compliancePct).toBe(83); // (0.5 + 1 + 1) / 3
  });

  it('penalises overshooting as much as undershooting', () => {
    const over = buildPlannedComparison(plan({ estimatedDistanceM: null, targetLoad: null }), {
      durationS: 5400, // 150% of plan
      distanceM: null,
      load: null
    });
    expect(over.compliancePct).toBe(50);
    expect(over.steps[0]?.met).toBe(false);
  });

  it('leaves a target unscored when nothing comparable was recorded', () => {
    const result = buildPlannedComparison(plan({}), { durationS: null, distanceM: null, load: null });
    expect(result.steps.every((s) => s.met === null)).toBe(true);
    expect(result.compliancePct).toBeNull();
  });

  it('is deterministic — the same inputs always give the same verdict', () => {
    const input = {
      day: '2026-05-01',
      activity: session('2026-05-01', 130),
      history: history('2026-05-01', 8, 100)
    };
    expect(buildTrainingComparison(input)).toEqual(buildTrainingComparison(input));
  });
});

describe('summarize', () => {
  it('calls a session on the norm "on the level of" rather than a rounding difference', () => {
    const text = summarize({
      load: 103,
      method: 'garmin',
      vsRecentPct: 3,
      recentCount: 9,
      tsbBefore: null,
      bandBefore: null
    });
    expect(text).toContain('na poziomie');
    expect(text).not.toContain('3%');
  });

  it('names the direction and appends the form carried into the session', () => {
    const text = summarize({
      load: 60,
      method: 'hr',
      vsRecentPct: -40,
      recentCount: 6,
      tsbBefore: 12,
      bandBefore: 'optimal'
    });
    expect(text).toContain('O 40% lżejszy');
    expect(text).toContain('+12');
    expect(text).toContain('forma optymalna');
  });
});
