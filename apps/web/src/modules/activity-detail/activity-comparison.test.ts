import { describe, it, expect } from 'vitest';
import { createTranslator } from '$lib/i18n';
import {
  buildTrainingComparison,
  median,
  summarize,
  verdictFor,
  type ActualEffort,
  type ComparableActivity,
  type PlannedCandidate
} from './activity-comparison';

const t = createTranslator('pl');

/** A planned cycling hour: 40 km, load 100 — the yardstick every plan test bends. */
const plan = (over: Partial<PlannedCandidate>): PlannedCandidate => ({
  id: 'p1',
  day: '2026-05-01',
  kind: 'workout',
  origin: 'garmin',
  title: 'Interwały 4×8',
  sport: 'cycling',
  description: null,
  estimatedDurationS: 3600,
  estimatedDistanceM: 40000,
  targetLoad: 100,
  steps: null,
  garminWorkoutId: null,
  ...over
});

/** What the session actually did. Intensity actuals default to "not recorded". */
const did = (over: Partial<ActualEffort>): ActualEffort => ({
  durationS: null,
  distanceM: null,
  load: null,
  paceSecPerKm: null,
  normPower: null,
  avgHr: null,
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
      t,
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
      t,
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
      t,
      day: '2026-05-01',
      activity: session('2026-05-01', 100),
      history: [...history('2026-05-01', 5, 100), ...later]
    });
    expect(result.recentCount).toBe(5);
    expect(result.recentMedianLoad).toBe(100);
  });

  it('ignores sessions older than the six-week norm window', () => {
    const result = buildTrainingComparison({
      t,
      day: '2026-05-01',
      activity: session('2026-05-01', 100),
      history: [session('2026-01-01', 400), ...history('2026-05-01', 3, 100)]
    });
    expect(result.recentCount).toBe(3);
    expect(result.recentMedianLoad).toBe(100);
  });

  it('says so honestly when there is nothing to compare against', () => {
    const result = buildTrainingComparison({
      t,
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
      t,
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
      t,
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
      t,
      day: '2026-05-01',
      activity: session('2026-05-01', 100),
      history: history('2026-05-01', 5, 100)
    });
    expect(result.plannedWorkout).toBeNull();
    expect(result.plannedWorkoutStatus).toBe('not-synced');
  });

  it('distinguishes "nothing was planned" from "no calendar synced"', () => {
    const result = buildTrainingComparison({
      t,
      day: '2026-05-01',
      activity: session('2026-05-01', 100),
      history: [],
      planned: { sameDay: [], calendarHasData: true, sport: 'cycling', garminWorkoutId: null }
    });
    expect(result.plannedWorkout).toBeNull();
    expect(result.plannedWorkoutStatus).toBe('none-scheduled');
  });

  it('links the plan scheduled for that day and scores it', () => {
    const result = buildTrainingComparison({
      t,
      day: '2026-05-01',
      activity: session('2026-05-01', 100),
      history: [],
      planned: { sameDay: [plan({})], calendarHasData: true, sport: 'cycling', garminWorkoutId: null },
      actual: did({ durationS: 3600, distanceM: 40000, load: 100 })
    });
    expect(result.plannedWorkoutStatus).toBe('linked');
    expect(result.plannedWorkout?.name).toBe('Interwały 4×8');
    expect(result.plannedWorkout?.compliancePct).toBe(100);
    expect(result.plannedWorkout?.steps.every((s) => s.met)).toBe(true);
    // Nothing to say for next time when the plan was met exactly (spec 085).
    expect(result.plannedTakeaways).toEqual([]);
  });

  it('carries the plan takeaways alongside the comparison (spec 085)', () => {
    const result = buildTrainingComparison({
      t,
      day: '2026-05-01',
      activity: session('2026-05-01', 100),
      history: [],
      planned: {
        sameDay: [plan({ estimatedDistanceM: null, targetLoad: null })],
        calendarHasData: true,
        sport: 'cycling',
        garminWorkoutId: null
      },
      // Half the planned hour.
      actual: did({ durationS: 1800 })
    });
    expect(result.plannedTakeaways).toEqual([{ key: 'plan.takeaway.under', metric: 'duration', pct: 50 }]);
  });

  it('has no takeaways when there is no plan at all', () => {
    const result = buildTrainingComparison({
      t,
      day: '2026-05-01',
      activity: session('2026-05-01', 100),
      history: []
    });
    expect(result.plannedTakeaways).toEqual([]);
  });
});

describe('buildTrainingComparison — determinism', () => {
  it('gives the same verdict for the same inputs, every time', () => {
    const input = {
      t,
      day: '2026-05-01',
      activity: session('2026-05-01', 130),
      history: history('2026-05-01', 8, 100)
    };
    expect(buildTrainingComparison(input)).toEqual(buildTrainingComparison(input));
  });
});

describe('summarize', () => {
  it('calls a session on the norm "on the level of" rather than a rounding difference', () => {
    const text = summarize(t, {
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
    const text = summarize(t, {
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
