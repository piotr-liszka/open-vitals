import { describe, it, expect } from 'vitest';
import { matchWeek, DONE_RATIO, type CompletedActivity, type PlannedSession } from './week-review.match';

function plan(over: Partial<PlannedSession> = {}): PlannedSession {
  return {
    id: 'w1',
    day: '2026-08-18',
    family: 'run',
    title: 'Próg 2×10 min',
    estimatedDistanceM: 10_000,
    estimatedDurationS: null,
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
