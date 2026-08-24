import { describe, it, expect } from 'vitest';
import { matchWeek, DONE_RATIO, type CompletedActivity, type PlannedSession } from './session-match';

function plan(over: Partial<PlannedSession> = {}): PlannedSession {
  return {
    id: 'w1',
    day: '2026-08-18',
    family: 'run',
    title: 'Próg 2×10 min',
    estimatedDistanceM: 10_000,
    estimatedDurationS: null,
    garminWorkoutId: null,
    ...over
  };
}

function done(over: Partial<CompletedActivity> = {}): CompletedActivity {
  return {
    id: 'a1',
    day: '2026-08-18',
    family: 'run',
    name: 'Bieg',
    distanceM: 10_000,
    durationS: 3000,
    garminWorkoutId: null,
    ...over
  };
}

describe('matchWeek', () => {
  it('matches a session done on its own day', () => {
    const result = matchWeek([plan()], [done()]);
    expect(result.matched).toHaveLength(1);
    expect(result.matched[0]).toMatchObject({ adherence: 'done', adherenceRatio: 1, dayShift: 0 });
    expect(result.missed).toEqual([]);
    expect(result.unplanned).toEqual([]);
  });

  it('matches a session moved by a day and SAYS it moved', () => {
    // Otherwise a good week reads as a missed session plus an unplanned one.
    const result = matchWeek([plan()], [done({ day: '2026-08-19' })]);
    expect(result.matched).toHaveLength(1);
    expect(result.matched[0]?.dayShift).toBe(1);
    expect(result.missed).toEqual([]);
  });

  it('reports a session moved backwards as a negative shift', () => {
    const result = matchWeek([plan()], [done({ day: '2026-08-17' })]);
    expect(result.matched[0]?.dayShift).toBe(-1);
  });

  it('does not match a session two days away', () => {
    const result = matchWeek([plan()], [done({ day: '2026-08-20' })]);
    expect(result.matched).toEqual([]);
    expect(result.missed).toHaveLength(1);
    expect(result.unplanned).toHaveLength(1);
  });

  it('makes EVERY same-day match before considering any shifted one', () => {
    /*
     * The bug this guards: matching greedily in one pass lets Monday's session claim Tuesday's
     * activity — it is within a day — while Tuesday's own session, which that activity actually was,
     * falls to `missed`.
     */
    const monday = plan({ id: 'w-mon', day: '2026-08-17', title: 'Poniedziałek' });
    const tuesday = plan({ id: 'w-tue', day: '2026-08-18', title: 'Wtorek' });
    const tuesdayRun = done({ id: 'a-tue', day: '2026-08-18' });

    const result = matchWeek([monday, tuesday], [tuesdayRun]);

    expect(result.matched).toHaveLength(1);
    expect(result.matched[0]?.planned.id).toBe('w-tue');
    expect(result.missed.map((m) => m.id)).toEqual(['w-mon']);
  });

  it('matches on sport FAMILY, so a treadmill run fulfils a planned run', () => {
    const result = matchWeek([plan()], [done({ family: 'run' })]);
    expect(result.matched).toHaveLength(1);

    // …but a ride does not fulfil a planned run.
    const wrong = matchWeek([plan()], [done({ family: 'ride' })]);
    expect(wrong.matched).toEqual([]);
    expect(wrong.unplanned).toHaveLength(1);
  });

  it('pairs a double correctly instead of letting both plans claim one run', () => {
    const easy = plan({ id: 'w-easy', title: 'Spokojny', estimatedDistanceM: 6000 });
    const long = plan({ id: 'w-long', title: 'Długi', estimatedDistanceM: 18_000 });
    const shortRun = done({ id: 'a-short', distanceM: 6200 });
    const longRun = done({ id: 'a-long', distanceM: 17_500 });

    const result = matchWeek([easy, long], [shortRun, longRun]);

    expect(result.matched).toHaveLength(2);
    const byPlan = Object.fromEntries(result.matched.map((m) => [m.planned.id, m.completed.id]));
    expect(byPlan['w-easy']).toBe('a-short');
    expect(byPlan['w-long']).toBe('a-long');
    expect(result.unplanned).toEqual([]);
  });

  it('never uses one activity for two plans', () => {
    const a = plan({ id: 'w-a' });
    const b = plan({ id: 'w-b' });
    const result = matchWeek([a, b], [done()]);

    expect(result.matched).toHaveLength(1);
    expect(result.missed).toHaveLength(1);
  });

  it('calls it shortened below the threshold and done at it', () => {
    const atThreshold = matchWeek([plan()], [done({ distanceM: 10_000 * DONE_RATIO })]);
    expect(atThreshold.matched[0]).toMatchObject({ adherence: 'done', adherenceRatio: 0.9 });

    const under = matchWeek([plan()], [done({ distanceM: 6000 })]);
    expect(under.matched[0]).toMatchObject({ adherence: 'shortened', adherenceRatio: 0.6 });

    // Over-delivering is still `done`, with a ratio that says by how much.
    const over = matchWeek([plan()], [done({ distanceM: 13_000 })]);
    expect(over.matched[0]).toMatchObject({ adherence: 'done', adherenceRatio: 1.3 });
  });

  it('judges a time-based plan on duration', () => {
    const timed = plan({ estimatedDistanceM: null, estimatedDurationS: 3600 });
    const result = matchWeek([timed], [done({ durationS: 1800, distanceM: 99_999 })]);
    // The distance is irrelevant: the plan was an hour, and half of it was run.
    expect(result.matched[0]).toMatchObject({ adherence: 'shortened', adherenceRatio: 0.5 });
  });

  it('refuses to judge a plan with no axis at all', () => {
    // A lap-button session has nothing to be a share OF. Reporting 0 % would be a lie.
    const lapButton = plan({ estimatedDistanceM: null, estimatedDurationS: null });
    const result = matchWeek([lapButton], [done()]);
    expect(result.matched[0]).toMatchObject({ adherence: 'done', adherenceRatio: null });
  });

  it('reports both sides when nothing lines up', () => {
    const result = matchWeek([plan({ family: 'ride' })], [done({ family: 'run' })]);
    expect(result.matched).toEqual([]);
    expect(result.missed).toHaveLength(1);
    expect(result.unplanned).toHaveLength(1);
  });

  it('handles an empty week on either side', () => {
    expect(matchWeek([], [])).toEqual({ matched: [], missed: [], unplanned: [] });
    expect(matchWeek([], [done()]).unplanned).toHaveLength(1);
    expect(matchWeek([plan()], []).missed).toHaveLength(1);
  });

  it('returns matches in planned-day order', () => {
    const wed = plan({ id: 'w-wed', day: '2026-08-19' });
    const mon = plan({ id: 'w-mon', day: '2026-08-17' });
    const result = matchWeek(
      [wed, mon],
      [done({ id: 'a-wed', day: '2026-08-19' }), done({ id: 'a-mon', day: '2026-08-17' })]
    );
    expect(result.matched.map((m) => m.planned.id)).toEqual(['w-mon', 'w-wed']);
  });
});

/**
 * Spec 081 — the hard link. Everything below is about `garminWorkoutId`; everything above is the
 * spec-078 heuristic, unchanged, and is left exactly as it was on purpose.
 */
describe('matchWeek — workout id (spec 081)', () => {
  it('labels every heuristic pairing as inferred', () => {
    const result = matchWeek([plan()], [done()]);
    expect(result.matched[0]?.matchedBy).toBe('heuristic');
  });

  it('an id match beats a same-day candidate that belongs to another session', () => {
    /*
     * Two runs on one day, two sessions planned, and the sizes deliberately point the heuristic at
     * the WRONG pairing: `w-tempo` is 10 km and the 10 km run is the one the watch says was the easy
     * session. Without pass 0 the tempo plan claims it on size alone.
     */
    const tempo = plan({ id: 'w-tempo', title: 'Tempo', estimatedDistanceM: 10_000 });
    const easy = plan({
      id: 'w-easy',
      title: 'Rozbieganie',
      estimatedDistanceM: 6000,
      garminWorkoutId: '1668504046'
    });
    const big = done({ id: 'a-big', distanceM: 10_000, garminWorkoutId: '1668504046' });
    const small = done({ id: 'a-small', distanceM: 6100, garminWorkoutId: null });

    const result = matchWeek([tempo, easy], [big, small]);

    const byPlan = Object.fromEntries(result.matched.map((m) => [m.planned.id, m]));
    expect(byPlan['w-easy']?.completed.id).toBe('a-big');
    expect(byPlan['w-easy']?.matchedBy).toBe('workout-id');
    // The tempo session still gets the run the id did not claim, by the usual heuristic.
    expect(byPlan['w-tempo']?.completed.id).toBe('a-small');
    expect(byPlan['w-tempo']?.matchedBy).toBe('heuristic');
    expect(result.unplanned).toEqual([]);
  });

  it('an id match survives a shift larger than MAX_DAY_SHIFT and reports the real dayShift', () => {
    const session = plan({ day: '2026-08-17', garminWorkoutId: 'g-7' });
    const late = done({ day: '2026-08-20', garminWorkoutId: 'g-7' });

    const result = matchWeek([session, plan({ id: 'other', day: '2026-08-30' })], [late]);

    expect(result.matched).toHaveLength(1);
    expect(result.matched[0]).toMatchObject({ dayShift: 3, matchedBy: 'workout-id' });
    expect(result.unplanned).toEqual([]);
  });

  it('an id match ignores sport family — the watch knows better than the guess', () => {
    // A session logged under the wrong activity type is still that session if the watch says so.
    const session = plan({ family: 'run', garminWorkoutId: 'g-7' });
    const result = matchWeek([session], [done({ family: 'ride', garminWorkoutId: 'g-7' })]);
    expect(result.matched[0]?.matchedBy).toBe('workout-id');
  });

  it('gives one id to the activity nearest the planned day and leaves the other unplanned', () => {
    // The scheduled session was started twice (abandoned, then run properly).
    const session = plan({ day: '2026-08-18', garminWorkoutId: 'g-7', estimatedDistanceM: 10_000 });
    const aborted = done({ id: 'a-aborted', day: '2026-08-20', distanceM: 900, garminWorkoutId: 'g-7' });
    const real = done({ id: 'a-real', day: '2026-08-18', distanceM: 10_100, garminWorkoutId: 'g-7' });

    const result = matchWeek([session], [aborted, real]);

    expect(result.matched).toHaveLength(1);
    expect(result.matched[0]?.completed.id).toBe('a-real');
    expect(result.unplanned.map((a) => a.id)).toEqual(['a-aborted']);
  });

  it('does not match an id against a session that carries none', () => {
    // Null is not a value: two sessions with no id must never be "the same workout".
    const result = matchWeek(
      [plan({ day: '2026-08-10', garminWorkoutId: null })],
      [done({ day: '2026-08-20', garminWorkoutId: null })]
    );
    expect(result.matched).toEqual([]);
    expect(result.missed).toHaveLength(1);
    expect(result.unplanned).toHaveLength(1);
  });

  it('ignores an id the other side does not share', () => {
    const result = matchWeek([plan({ garminWorkoutId: 'g-1' })], [done({ garminWorkoutId: 'g-2' })]);
    // Different ids: pass 0 claims nothing, and the same-day heuristic takes over as before.
    expect(result.matched[0]?.matchedBy).toBe('heuristic');
  });

  /**
   * THE DEGRADATION TEST. The premise of spec 081 — that Garmin stamps `workoutId` on this
   * athlete's activities — is confirmed only by what arrives in production. If it never arrives,
   * every id below is null and this feature must be a no-op, not a regression. That is asserted
   * here rather than hoped for.
   */
  it('id absent everywhere: results identical to the spec-078 heuristic, nothing regresses', () => {
    // The same fixtures the spec-078 suite above uses, in one week: a double, a session moved by a
    // day, a session missed entirely and an activity nobody planned.
    const planned = [
      plan({ id: 'w-easy', day: '2026-08-17', title: 'Spokojny', estimatedDistanceM: 6000 }),
      plan({ id: 'w-long', day: '2026-08-17', title: 'Długi', estimatedDistanceM: 18_000 }),
      plan({ id: 'w-moved', day: '2026-08-19', title: 'Próg' }),
      plan({ id: 'w-missed', day: '2026-08-21', title: 'Siła', family: 'ride' })
    ];
    const activities = [
      done({ id: 'a-short', day: '2026-08-17', distanceM: 6200 }),
      done({ id: 'a-long', day: '2026-08-17', distanceM: 17_500 }),
      done({ id: 'a-moved', day: '2026-08-20', distanceM: 9800 }),
      done({ id: 'a-swim', day: '2026-08-22', family: 'swim' })
    ];

    const result = matchWeek(planned, activities);

    expect(result.matched.map((m) => [m.planned.id, m.completed.id, m.dayShift])).toEqual([
      ['w-easy', 'a-short', 0],
      ['w-long', 'a-long', 0],
      ['w-moved', 'a-moved', 1]
    ]);
    expect(result.missed.map((s) => s.id)).toEqual(['w-missed']);
    expect(result.unplanned.map((a) => a.id)).toEqual(['a-swim']);
    // Not one pairing claims to be known: with no ids, every answer here is still a guess.
    expect(result.matched.every((m) => m.matchedBy === 'heuristic')).toBe(true);
  });
});

/*
 * The adherence AXIS. Before `estimateWorkoutDistanceM` learned to count paced time steps, a
 * time-prescribed session had no distance at all and was judged on duration by default. Once it had
 * one, the old "distance when there is one" rule silently started judging those sessions on ground
 * covered — so running the full prescribed time in the heat, at the +10–20 s/km the athlete's own
 * constraints call for, came out as `shortened`.
 */
describe('the axis a plan is judged on', () => {
  const plan = (over: Partial<PlannedSession> = {}): PlannedSession => ({
    id: 'p1',
    day: '2026-08-20',
    family: 'run',
    title: 'Easy 5 km + kadencja 166',
    estimatedDistanceM: 5100,
    estimatedDurationS: 1851,
    garminWorkoutId: null,
    ...over
  });

  // Full prescribed time, 8% less ground — exactly the hot-weather case.
  const ranFullTimeSlower: CompletedActivity = {
    id: 'a1',
    day: '2026-08-20',
    family: 'run',
    name: 'Run',
    distanceM: 4400,
    durationS: 1851,
    // No id on either side, so these pair through the heuristic — which is what puts the axis in play.
    garminWorkoutId: null
  };

  it('judges a time-prescribed session on its duration, not the ground it covered', () => {
    const { matched } = matchWeek([plan({ prescribedAxis: 'time' })], [ranFullTimeSlower]);
    expect(matched[0]?.adherence).toBe('done');
    expect(matched[0]?.adherenceRatio).toBe(1);
  });

  it('would have called that same session shortened on the distance axis', () => {
    // Not a wish — the guard. If this ever reports `done`, the axis has stopped being consulted and
    // the test above is passing for the wrong reason.
    const { matched } = matchWeek([plan({ prescribedAxis: 'distance' })], [ranFullTimeSlower]);
    expect(matched[0]?.adherence).toBe('shortened');
    expect(matched[0]?.adherenceRatio).toBeLessThan(DONE_RATIO);
  });

  it('still judges a distance-prescribed session on distance', () => {
    const long = plan({ title: 'Long run 10 km', estimatedDistanceM: 10_000, prescribedAxis: 'distance' });
    const cutShort: CompletedActivity = { ...ranFullTimeSlower, distanceM: 6000, durationS: 1851 };
    expect(matchWeek([long], [cutShort]).matched[0]?.adherence).toBe('shortened');
  });

  it('falls back to distance when the axis is absent, exactly as before', () => {
    const { matched } = matchWeek([plan()], [ranFullTimeSlower]);
    expect(matched[0]?.adherence).toBe('shortened');
  });
});
