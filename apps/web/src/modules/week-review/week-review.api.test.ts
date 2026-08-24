/**
 * Week-review handler integration (spec 078) — against mock adapters.
 */
import { describe, it, expect } from 'vitest';
import { createMemoryStore } from '$lib/server/store/memory';
import { fixedClock } from '$lib/server/clock';
import type { ActivitySummary, LocalStore } from '$lib/server/store/types';
import type { WorkoutStep } from '$lib/workouts';
import { loadWeekReview, resolveWeekStart, type WeekReviewDeps } from './week-review.api';

const USER = 'u1';
/** Wednesday. The week under review runs Mon 2026-08-17 → Sun 2026-08-23. */
const TODAY = '2026-08-19';
const clock = fixedClock(new Date(`${TODAY}T18:00:00.000Z`));

function deps(store: LocalStore = createMemoryStore()): WeekReviewDeps {
  return { store, clock, timeZone: 'Europe/Warsaw' };
}

/** A distance step, so the workout has an estimate the matcher can judge against. */
function steps(distanceM: number): WorkoutStep[] {
  return [
    {
      kind: 'work',
      durationType: 'distance',
      durationValue: distanceM,
      target: null,
      repeats: null,
      steps: null,
      note: null
    }
  ];
}

async function planSession(
  store: LocalStore,
  id: string,
  day: string,
  title: string,
  distanceM: number,
  sport = 'running'
): Promise<void> {
  await store.createWorkout(USER, {
    id,
    day,
    time: null,
    sport,
    title,
    steps: steps(distanceM),
    note: null,
    createdAt: '2026-08-15T09:00:00.000Z'
  });
}

function act(id: string, day: string, distanceM: number, sport = 'running'): ActivitySummary {
  return {
    userId: USER,
    activityId: id,
    sport,
    name: 'Bieg',
    startTime: `${day}T09:00:00Z`,
    startTimeLocal: `${day} 09:00:00`,
    distanceM,
    durationS: 3000,
    movingS: 3000,
    elevationGainM: null,
    avgHr: 150,
    maxHr: 170,
    avgPower: null,
    maxPower: null,
    normPower: null,
    calories: null,
    trainingLoad: 60,
    hasGps: false,
    garminWorkoutId: null,
    raw: {}
  };
}

describe('resolveWeekStart', () => {
  it('snaps any day inside a week to its Monday, and defaults to today', () => {
    const d = deps();
    expect(resolveWeekStart(d)).toBe('2026-08-17');
    expect(resolveWeekStart(d, '2026-08-23')).toBe('2026-08-17'); // Sunday
    expect(resolveWeekStart(d, '2026-08-17')).toBe('2026-08-17'); // Monday itself
    expect(resolveWeekStart(d, '2026-08-10')).toBe('2026-08-10'); // a week back
  });
});

describe('loadWeekReview', () => {
  it('reports an empty week as empty rather than as a failure', async () => {
    const data = await loadWeekReview(deps(), USER);
    expect(data.weekStart).toBe('2026-08-17');
    expect(data.weekEnd).toBe('2026-08-23');
    expect(data.empty).toBe(true);
    expect(data.match.matched).toEqual([]);
  });

  it('reconciles a week: done, shortened, missed and unplanned', async () => {
    const store = createMemoryStore();
    await planSession(store, 'w1', '2026-08-17', 'Spokojny', 8000);
    await planSession(store, 'w2', '2026-08-19', 'Próg', 12_000);
    await planSession(store, 'w3', '2026-08-22', 'Długi', 20_000);
    await store.putActivities(USER, [
      act('a1', '2026-08-17', 8100), // done
      act('a2', '2026-08-19', 7000), // shortened
      act('a4', '2026-08-20', 5000) // never planned
      // w3 was never run → missed
    ]);

    const data = await loadWeekReview(deps(store), USER);

    expect(data.match.matched).toHaveLength(2);
    expect(data.match.matched[0]).toMatchObject({ adherence: 'done' });
    expect(data.match.matched[1]).toMatchObject({ adherence: 'shortened' });
    expect(data.match.missed.map((m) => m.title)).toEqual(['Długi']);
    expect(data.match.unplanned.map((u) => u.id)).toEqual(['a4']);
    expect(data.empty).toBe(false);
  });

  it('keeps the block target and the sum of session estimates apart', async () => {
    const store = createMemoryStore();
    await store.createBlock(USER, {
      id: 'tb1',
      goalId: null,
      name: 'Baza pod 5 km',
      startDay: '2026-08-17',
      weeks: 8,
      paces: {},
      constraints: [],
      note: null,
      createdAt: '2026-08-15T09:00:00.000Z'
    });
    await store.putBlockWeeks(USER, 'tb1', [{ weekNumber: 1, volumeTargetKm: 34, focus: '2×10 min @ próg' }]);
    await planSession(store, 'w1', '2026-08-17', 'Spokojny', 8000);
    await planSession(store, 'w2', '2026-08-19', 'Próg', 12_000);
    await store.putActivities(USER, [act('a1', '2026-08-17', 8000)]);

    const data = await loadWeekReview(deps(store), USER);

    // The target is what the week was FOR; the sum is what was actually written down. Conflating
    // them is how a review lies.
    expect(data.planned.volumeTargetKm).toBe(34);
    expect(data.planned.sessionsVolumeKm).toBe(20);
    expect(data.actual.volumeKm).toBe(8);
    expect(data.block).toMatchObject({ name: 'Baza pod 5 km', weekNumber: 1, focus: '2×10 min @ próg' });
  });

  it('has no block context for a week no block covers', async () => {
    const store = createMemoryStore();
    await planSession(store, 'w1', '2026-08-17', 'Spokojny', 8000);

    const data = await loadWeekReview(deps(store), USER);
    expect(data.block).toBeNull();
    expect(data.planned.volumeTargetKm).toBeNull();
  });

  it('reviews a week already over', async () => {
    const store = createMemoryStore();
    await planSession(store, 'w1', '2026-08-10', 'Spokojny', 8000);
    await store.putActivities(USER, [act('a1', '2026-08-10', 8000)]);

    const data = await loadWeekReview(deps(store), USER, '2026-08-12');
    expect(data.weekStart).toBe('2026-08-10');
    expect(data.match.matched).toHaveLength(1);
  });

  it('carries the RPE logged for a matched session', async () => {
    const store = createMemoryStore();
    await planSession(store, 'w1', '2026-08-19', 'Próg', 12_000);
    await store.putActivities(USER, [act('a1', '2026-08-19', 12_000)]);
    await store.putJournalEntry(USER, {
      id: 'j1',
      day: '2026-08-19',
      activityId: 'a1',
      rpe: 9,
      at: '2026-08-19T18:00:00.000Z'
    });

    const data = await loadWeekReview(deps(store), USER);
    expect(data.rpeByActivity).toEqual({ a1: 9 });
  });

  it('ignores a day-level journal entry, which belongs to no activity', async () => {
    const store = createMemoryStore();
    await store.putActivities(USER, [act('a1', '2026-08-19', 12_000)]);
    await store.putJournalEntry(USER, {
      id: 'j1',
      day: '2026-08-19',
      activityId: null,
      soreness: 6,
      at: '2026-08-19T18:00:00.000Z'
    });

    const data = await loadWeekReview(deps(store), USER);
    expect(data.rpeByActivity).toEqual({});
  });

  it("never reads another athlete's week", async () => {
    const store = createMemoryStore();
    await store.putActivities('someone-else', [act('theirs', '2026-08-19', 12_000)]);

    const data = await loadWeekReview(deps(store), USER);
    expect(data.empty).toBe(true);
  });
});

/**
 * Spec 081 — the JSON contract grows one field per matched pair, and the id is what fills it. These
 * go through the store on purpose: the id has to survive `createWorkout` → push → `listWorkouts` and
 * `putActivities` → `listActivities` before the matcher ever sees it.
 */
describe('loadWeekReview — workout id (spec 081)', () => {
  it('reports matchedBy on every pair, and says heuristic when nothing was linked', async () => {
    const store = createMemoryStore();
    await planSession(store, 'w1', '2026-08-19', 'Próg', 12_000);
    await store.putActivities(USER, [act('a1', '2026-08-19', 12_000)]);

    const data = await loadWeekReview(deps(store), USER);

    expect(data.match.matched).toHaveLength(1);
    expect(data.match.matched[0]?.matchedBy).toBe('heuristic');
  });

  it('links the session Garmin itself linked, three days late and past MAX_DAY_SHIFT', async () => {
    const store = createMemoryStore();
    await planSession(store, 'w1', '2026-08-17', 'Próg', 12_000);
    // What the push phase writes back once Garmin has created the workout (spec 050).
    await store.updateWorkout(USER, 'w1', {
      garminWorkoutId: '1668504046',
      pushState: 'pushed',
      updatedAt: '2026-09-01T10:00:00.000Z'
    });
    await store.putActivities(USER, [{ ...act('a1', '2026-08-20', 11_800), garminWorkoutId: '1668504046' }]);

    const data = await loadWeekReview(deps(store), USER);

    expect(data.match.matched).toHaveLength(1);
    expect(data.match.matched[0]).toMatchObject({
      matchedBy: 'workout-id',
      dayShift: 3,
      adherence: 'done'
    });
    expect(data.match.missed).toEqual([]);
    expect(data.match.unplanned).toEqual([]);
  });

  it('prefers the linked activity over a same-day lookalike', async () => {
    const store = createMemoryStore();
    await planSession(store, 'w1', '2026-08-19', 'Próg', 12_000);
    await store.updateWorkout(USER, 'w1', {
      garminWorkoutId: 'g-1',
      pushState: 'pushed',
      updatedAt: '2026-09-01T10:00:00.000Z'
    });
    await store.putActivities(USER, [
      act('a-lookalike', '2026-08-19', 12_000),
      { ...act('a-linked', '2026-08-19', 6000), garminWorkoutId: 'g-1' }
    ]);

    const data = await loadWeekReview(deps(store), USER);

    expect(data.match.matched[0]?.completed.id).toBe('a-linked');
    expect(data.match.matched[0]?.matchedBy).toBe('workout-id');
    // The size heuristic would have taken the 12 km run; it is simply unplanned instead.
    expect(data.match.unplanned.map((u) => u.id)).toEqual(['a-lookalike']);
  });
});
