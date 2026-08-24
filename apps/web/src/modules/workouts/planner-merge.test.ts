/**
 * Unit tests for the planner's own-echo matcher (spec 093). Pure — no store, no clock.
 */
import { describe, it, expect } from 'vitest';
import { matchPlannedEcho, type AuthoredMergeCandidate, type PlannedMergeCandidate } from './planner-merge';

const authored = (over: Partial<AuthoredMergeCandidate> = {}): AuthoredMergeCandidate => ({
  id: 'w-1',
  day: '2026-08-20',
  sport: 'running',
  title: 'Interwały 5×1 km',
  garminScheduleId: null,
  garminWorkoutId: null,
  ...over
});

const planned = (over: Partial<PlannedMergeCandidate> = {}): PlannedMergeCandidate => ({
  id: 'p-1',
  day: '2026-08-20',
  sport: 'running',
  title: 'Interwały 5×1 km',
  ...over
});

describe('matchPlannedEcho (spec 093)', () => {
  it('pairs by id — garminScheduleId equal to the planned event id, regardless of title/discipline', () => {
    const a = authored({ id: 'w-1', garminScheduleId: 'p-1', title: 'Cokolwiek', sport: 'cycling' });
    const p = planned({ id: 'p-1', title: 'Zupełnie inny tytuł', sport: 'running' });

    const result = matchPlannedEcho([a], [p]);

    expect(result.syncedBackByWorkoutId.get('w-1')).toBe('p-1');
    expect(result.matchedPlannedIds.has('p-1')).toBe(true);
  });

  it('pairs by garminWorkoutId too, when no scheduleId is set', () => {
    const a = authored({ id: 'w-1', garminScheduleId: null, garminWorkoutId: 'p-9' });
    const p = planned({ id: 'p-9' });

    const result = matchPlannedEcho([a], [p]);

    expect(result.syncedBackByWorkoutId.get('w-1')).toBe('p-9');
  });

  it('falls back to same day + same discipline + closest title when no id matches', () => {
    // Exact title match (closeness 0) beats a candidate that merely contains the planned title as a
    // substring (closeness 1) — "closest", not "any match".
    const exact = authored({ id: 'w-exact', title: 'Interwały tempo' });
    const partial = authored({ id: 'w-partial', title: 'Interwały tempo długie' });
    const p = planned({ title: 'Interwały tempo' });

    const result = matchPlannedEcho([exact, partial], [p]);

    expect(result.syncedBackByWorkoutId.get('w-exact')).toBe('p-1');
    expect(result.syncedBackByWorkoutId.has('w-partial')).toBe(false);
  });

  it('leaves ties unmerged — two equally-close same-day, same-discipline candidates', () => {
    const a1 = authored({ id: 'w-1', title: 'Bieg' });
    const a2 = authored({ id: 'w-2', title: 'Bieg' });
    const p = planned({ title: 'Zupełnie coś innego' }); // neither contains/matches -> no closest at all

    const result = matchPlannedEcho([a1, a2], [p]);

    expect(result.syncedBackByWorkoutId.size).toBe(0);
    expect(result.matchedPlannedIds.size).toBe(0);
  });

  it('leaves ties unmerged — two candidates equally close by containment', () => {
    const a1 = authored({ id: 'w-1', title: 'Trening' });
    const a2 = authored({ id: 'w-2', title: 'Trening' });
    const p = planned({ title: 'Trening wieczorny' }); // both a1/a2 are contained equally closely

    const result = matchPlannedEcho([a1, a2], [p]);

    expect(result.syncedBackByWorkoutId.size).toBe(0);
  });

  it('never pairs across disciplines, id or no id', () => {
    const a = authored({ id: 'w-1', sport: 'cycling', title: 'Interwały 5×1 km' });
    const p = planned({ sport: 'running', title: 'Interwały 5×1 km' });

    const result = matchPlannedEcho([a], [p]);

    expect(result.syncedBackByWorkoutId.size).toBe(0);
  });

  it('never pairs across days, even with matching ids — the per-day rule', () => {
    const a = authored({ id: 'w-1', day: '2026-08-20', garminScheduleId: 'p-1' });
    const p = planned({ id: 'p-1', day: '2026-08-21' });

    const result = matchPlannedEcho([a], [p]);

    expect(result.syncedBackByWorkoutId.size).toBe(0);
    expect(result.matchedPlannedIds.size).toBe(0);
  });

  it('a planned event with no same-day authored workout at all is returned unmatched', () => {
    const a = authored({ day: '2026-08-19' });
    const p = planned({ day: '2026-08-20' });

    const result = matchPlannedEcho([a], [p]);

    expect(result.matchedPlannedIds.size).toBe(0);
    expect(result.syncedBackByWorkoutId.size).toBe(0);
  });

  it('is empty when either side is empty', () => {
    expect(matchPlannedEcho([], [planned()]).matchedPlannedIds.size).toBe(0);
    expect(matchPlannedEcho([authored()], []).syncedBackByWorkoutId.size).toBe(0);
  });

  it('two distinct authored sessions of different disciplines both echo back independently', () => {
    const run = authored({ id: 'w-run', sport: 'running', title: 'Bieg' });
    const ride = authored({ id: 'w-ride', sport: 'cycling', title: 'Rower' });
    const pRun = planned({ id: 'p-run', sport: 'running', title: 'Bieg' });
    const pRide = planned({ id: 'p-ride', sport: 'cycling', title: 'Rower' });

    const result = matchPlannedEcho([run, ride], [pRun, pRide]);

    expect(result.syncedBackByWorkoutId.get('w-run')).toBe('p-run');
    expect(result.syncedBackByWorkoutId.get('w-ride')).toBe('p-ride');
    expect(result.matchedPlannedIds).toEqual(new Set(['p-run', 'p-ride']));
  });
});
