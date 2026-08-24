import { describe, it, expect } from 'vitest';
import { normalizeActivity, streamsFromDetails, workoutIdOf } from './normalize';
import { STREAMS_SCHEMA_VERSION } from '../store/types';
import type { GarminActivityDetails } from '../interfaces';

describe('normalizeActivity', () => {
  it('lifts the queryable columns out of a raw Garmin summary and keeps the payload', () => {
    const raw = {
      activityId: 111,
      activityName: 'Tempo Run',
      activityType: { typeKey: 'running' },
      startTimeLocal: '2026-08-01 09:00:00',
      startTimeGMT: '2026-08-01 07:00:00',
      distance: 10000,
      duration: 3000,
      averageHR: 152,
      hasPolyline: true
    };
    const a = normalizeActivity('u', raw)!;

    expect(a.activityId).toBe('111');
    expect(a.sport).toBe('running');
    expect(a.startTime).toBe('2026-08-01T07:00:00.000Z');
    expect(a.avgHr).toBe(152);
    expect(a.hasGps).toBe(true);
    expect(a.raw).toBe(raw); // the rich fields stay available for the stats projection
  });

  it('returns null for anything without an activity id', () => {
    expect(normalizeActivity('u', null)).toBeNull();
    expect(normalizeActivity('u', { activityName: 'no id' })).toBeNull();
  });
});

describe('streamsFromDetails', () => {
  const details: GarminActivityDetails = {
    activityId: 'a1',
    summary: { averageHR: 150 },
    gps: [
      [52.1, 21],
      [52.2, 21.1]
    ],
    time: [0, 1],
    heartRate: [140, 145],
    power: [210, 215],
    cadence: [85, 86],
    speed: [3.5, 3.6],
    elevation: [100, 102],
    grade: [1.5, 2],
    temperature: [21, 21.5],
    respirationRate: [16, 17],
    verticalRatio: [7.5, 7.6],
    verticalOscillation: [9.1, 9.2],
    groundContactTime: [250, 252],
    groundContactBalance: [49.5, 49.8],
    strideLength: [118, 119],
    stamina: [82, 80],
    staminaPotential: [95, 95],
    performanceCondition: [3, 2],
    fractionalCadence: [0.5, 0.5],
    movingDuration: [0, 1],
    moving: [1, 1],
    laps: [{ index: 1, distanceM: 1000 }],
    typedSplits: [{ index: 1, type: 'RWD_RUN', durationS: 480 }]
  };

  it('persists EVERY stream the sidecar sent — heartRate above all', () => {
    const s = streamsFromDetails(details);

    // The regression that motivated spec 023: HR must survive the sidecar → store hop.
    expect(s.heartRate).toEqual([140, 145]);
    expect(s.gps).toEqual([
      [52.1, 21],
      [52.2, 21.1]
    ]);
    expect(s.respirationRate).toEqual([16, 17]);
    expect(s.verticalRatio).toEqual([7.5, 7.6]);
    expect(s.verticalOscillation).toEqual([9.1, 9.2]);
    expect(s.groundContactTime).toEqual([250, 252]);
    expect(s.groundContactBalance).toEqual([49.5, 49.8]);
    expect(s.strideLength).toEqual([118, 119]);
    expect(s.temperature).toEqual([21, 21.5]);
    expect(s.grade).toEqual([1.5, 2]);
    expect(s.stamina).toEqual([82, 80]);
    expect(s.staminaPotential).toEqual([95, 95]);
    expect(s.performanceCondition).toEqual([3, 2]);
    expect(s.fractionalCadence).toEqual([0.5, 0.5]);
    expect(s.moving).toEqual([1, 1]);
    expect(s.laps).toEqual([{ index: 1, distanceM: 1000 }]);
    expect(s.typedSplits).toEqual([{ index: 1, type: 'RWD_RUN', durationS: 480 }]);
  });

  it('stamps the schema version so a later contract change can invalidate the row', () => {
    expect(streamsFromDetails(details).v).toBe(STREAMS_SCHEMA_VERSION);
  });

  it('stores nothing but the version for an activity with no streams', () => {
    expect(streamsFromDetails({ activityId: 'a1' })).toEqual({ v: STREAMS_SCHEMA_VERSION });
    // Empty arrays are dropped rather than persisted as noise.
    expect(streamsFromDetails({ activityId: 'a1', heartRate: [], laps: [] })).toEqual({
      v: STREAMS_SCHEMA_VERSION
    });
  });
});

/**
 * Spec 081 — the workout id an activity was executed from. Garmin sends it as a number on this
 * athlete's account and as a string elsewhere; the column it joins against is text, so the
 * normalizer has exactly one job here and must never throw doing it.
 */
describe('normalizeActivity — garminWorkoutId (spec 081)', () => {
  const base = {
    activityId: 111,
    activityType: { typeKey: 'running' },
    startTimeLocal: '2026-08-18 09:00:00'
  };

  it('coerces a numeric workoutId to a string', () => {
    const a = normalizeActivity('u', { ...base, workoutId: 1668504046 })!;
    expect(a.garminWorkoutId).toBe('1668504046');
  });

  it('keeps a string workoutId as it is, trimmed', () => {
    expect(normalizeActivity('u', { ...base, workoutId: '1668504046' })!.garminWorkoutId).toBe('1668504046');
    expect(normalizeActivity('u', { ...base, workoutId: ' 42 ' })!.garminWorkoutId).toBe('42');
  });

  it('is null when the field is absent or null — the normal case for a plain "start run"', () => {
    expect(normalizeActivity('u', base)!.garminWorkoutId).toBeNull();
    expect(normalizeActivity('u', { ...base, workoutId: null })!.garminWorkoutId).toBeNull();
  });

  it('is null for a non-scalar or unusable value, and never throws', () => {
    for (const workoutId of [{}, [], true, false, '', '   ', Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(normalizeActivity('u', { ...base, workoutId })!.garminWorkoutId).toBeNull();
    }
  });

  it('leaves the rest of the summary untouched when the id is unusable', () => {
    // Degrading on one field must not cost the activity: a gap, never a dropped session.
    const a = normalizeActivity('u', { ...base, workoutId: { id: 7 }, distance: 10_000 })!;
    expect(a.activityId).toBe('111');
    expect(a.distanceM).toBe(10_000);
    expect(a.garminWorkoutId).toBeNull();
  });
});

describe('workoutIdOf', () => {
  it('reads only the top-level workoutId key', () => {
    expect(workoutIdOf({ workoutId: 5 })).toBe('5');
    expect(workoutIdOf({ workout: { workoutId: 5 } })).toBeNull();
  });
});
