import { describe, it, expect } from 'vitest';
import { matchStravaActivity, matchAll } from './matching';
import type { ActivitySummary } from '../store/types';
import type { StravaActivityRef } from './types';

function activity(
  over: Partial<ActivitySummary> & Pick<ActivitySummary, 'activityId' | 'startTime'>
): ActivitySummary {
  return {
    userId: 'u1',
    sport: 'cycling',
    name: null,
    startTimeLocal: over.startTime.replace('T', ' ').replace('Z', ''),
    distanceM: 30000,
    durationS: 3600,
    movingS: 3500,
    elevationGainM: null,
    avgHr: null,
    maxHr: null,
    avgPower: null,
    maxPower: null,
    normPower: null,
    calories: null,
    trainingLoad: null,
    hasGps: true,
    raw: {},
    ...over
  };
}

const ride: StravaActivityRef = {
  stravaId: '9001',
  name: 'Morning Ride',
  startTime: '2026-08-01T07:00:00Z',
  durationS: 3600,
  distanceM: 30000,
  sport: 'ride',
  permalink: 'https://www.strava.com/activities/9001'
};

describe('matchStravaActivity', () => {
  it('matches a Garmin activity within start + duration + distance tolerance', () => {
    const cand = activity({ activityId: 'g1', startTime: '2026-08-01T07:01:00Z' }); // +60s
    const link = matchStravaActivity(ride, [cand]);
    expect(link).not.toBeNull();
    expect(link!.activityId).toBe('g1');
    expect(link!.permalink).toBe(ride.permalink);
    expect(link!.matchScore).toBeGreaterThan(0.5);
    expect(link!.startDeltaS).toBe(60);
  });

  it('rejects when the start time is outside tolerance', () => {
    const cand = activity({ activityId: 'g1', startTime: '2026-08-01T07:10:00Z' }); // +600s > 180
    expect(matchStravaActivity(ride, [cand])).toBeNull();
  });

  it('rejects when duration differs beyond tolerance', () => {
    const cand = activity({
      activityId: 'g1',
      startTime: '2026-08-01T07:00:30Z',
      durationS: 7200,
      movingS: 7200
    });
    expect(matchStravaActivity(ride, [cand])).toBeNull();
  });

  it('requires at least one magnitude beyond the timestamp', () => {
    const cand = activity({
      activityId: 'g1',
      startTime: '2026-08-01T07:00:30Z',
      durationS: null,
      movingS: null,
      distanceM: null
    });
    expect(matchStravaActivity(ride, [cand])).toBeNull();
  });

  it('picks the closest start among several candidates', () => {
    const near = activity({ activityId: 'near', startTime: '2026-08-01T07:00:20Z' });
    const far = activity({ activityId: 'far', startTime: '2026-08-01T07:02:00Z' });
    const link = matchStravaActivity(ride, [far, near]);
    expect(link!.activityId).toBe('near');
  });

  it('returns null for an empty candidate pool', () => {
    expect(matchStravaActivity(ride, [])).toBeNull();
  });
});

describe('matchAll', () => {
  it('claims each Garmin activity at most once (strongest wins)', () => {
    const run: StravaActivityRef = {
      ...ride,
      stravaId: '9002',
      startTime: '2026-08-01T07:00:40Z',
      permalink: 'https://www.strava.com/activities/9002'
    };
    const cand = activity({ activityId: 'shared', startTime: '2026-08-01T07:00:10Z' }); // closer to `ride`
    const links = matchAll([run, ride], [cand]);
    expect(links).toHaveLength(1);
    expect(links[0]!.stravaId).toBe('9001'); // ride is the tighter match
  });

  it('links multiple distinct activities', () => {
    const other: StravaActivityRef = {
      stravaId: '9002',
      name: 'Run',
      startTime: '2026-08-03T17:30:00Z',
      durationS: 1800,
      distanceM: 5000,
      sport: 'run',
      permalink: 'https://www.strava.com/activities/9002'
    };
    const c1 = activity({ activityId: 'g1', startTime: '2026-08-01T07:00:10Z' });
    const c2 = activity({
      activityId: 'g2',
      startTime: '2026-08-03T17:30:10Z',
      durationS: 1800,
      movingS: 1800,
      distanceM: 5000,
      sport: 'running'
    });
    const links = matchAll([ride, other], [c1, c2]);
    expect(links.map((l) => l.activityId).sort()).toEqual(['g1', 'g2']);
  });
});
