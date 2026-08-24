/**
 * API-integration tests for the timeline handler (spec 022). Calls `loadTimeline` with MOCK
 * adapters only — the in-memory `LocalStore` fake, a fixed clock, and a stub `PlannedWorkoutSource`
 * — and asserts the JSON contract the page and any future endpoint depend on. Offline, no Garmin.
 */
import { describe, it, expect } from 'vitest';
import { createMemoryStore } from '$lib/server/store/memory';
import { fixedClock } from '$lib/server/clock';
import type { ActivitySummary, LocalStore } from '$lib/server/store/types';
import {
  DEFAULT_FUTURE_DAYS,
  DEFAULT_LIMIT,
  DEFAULT_PAST_DAYS,
  MAX_LIMIT,
  MAX_PAST_DAYS,
  limitForWindow,
  loadTimeline,
  type PlannedWorkoutSource,
  type TimelineDeps
} from './timeline.api';
import type { HealthSignalInput, PlannedEvent } from './timeline.types';

const USER = 'user-1';
const OTHER = 'user-2';
/** 2026-08-07 in Europe/Warsaw (UTC+2) — the local day the whole suite pins to. */
const clock = fixedClock(new Date('2026-08-07T10:00:00.000Z'));

function deps(over: Partial<TimelineDeps> = {}): TimelineDeps & { store: LocalStore } {
  return { store: createMemoryStore(), clock, ...over };
}

function act(id: string, over: Partial<ActivitySummary> = {}): ActivitySummary {
  return {
    userId: USER,
    activityId: id,
    sport: 'cycling',
    name: null,
    startTime: '2026-08-05T07:00:00Z',
    startTimeLocal: '2026-08-05 09:00:00',
    distanceM: 42_000,
    durationS: 5400,
    movingS: 5400,
    elevationGainM: 320,
    avgHr: 142,
    maxHr: 171,
    avgPower: 205,
    maxPower: 620,
    normPower: 216,
    calories: 1100,
    trainingLoad: 140,
    hasGps: true,
    garminWorkoutId: null,
    raw: {},
    ...over
  };
}

const hrvCrash: HealthSignalInput = {
  key: 'hrv',
  label: 'HRV',
  accent: 'green',
  date: '2026-08-06',
  value: 31,
  z: -3.2,
  direction: 'down',
  severity: 'strong'
};

function plannedSource(events: PlannedEvent[], available = true): PlannedWorkoutSource {
  return { listPlanned: async () => ({ available, events }) };
}

function plan(over: Partial<PlannedEvent> & { id: string; day: string }): PlannedEvent {
  return {
    time: null,
    kind: 'workout',
    title: 'Interwały 5×3 min',
    sport: 'running',
    description: null,
    estimatedDurationS: 3600,
    estimatedDistanceM: 12_000,
    targetLoad: 95,
    source: 'garmin',
    ...over
  };
}

describe('loadTimeline', () => {
  it('returns a safe, empty-but-shaped payload for a brand-new user', async () => {
    const data = await loadTimeline(deps(), { userId: USER, locale: 'pl' });

    expect(data.today).toBe('2026-08-07');
    expect(data.past).toMatchObject({ from: '2026-07-25', to: '2026-08-07', primaryCount: 0, totalCount: 0 });
    expect(data.past.events).toEqual([]);
    expect(data.planned).toMatchObject({
      from: '2026-08-08',
      to: '2026-08-14',
      status: 'not_synced',
      events: []
    });
  });

  it('spans the default 14 days back and 7 days forward', async () => {
    const data = await loadTimeline(deps(), { userId: USER, locale: 'pl' });
    const back =
      (Date.parse(`${data.past.to}T00:00:00Z`) - Date.parse(`${data.past.from}T00:00:00Z`)) / 86_400_000;
    const forward =
      (Date.parse(`${data.planned.to}T00:00:00Z`) - Date.parse(`${data.planned.from}T00:00:00Z`)) /
      86_400_000;
    expect(back + 1).toBe(DEFAULT_PAST_DAYS);
    expect(forward + 1).toBe(DEFAULT_FUTURE_DAYS);
  });

  it('merges activities and health signals into one newest-first stream', async () => {
    const d = deps();
    await d.store.putActivities(USER, [
      act('ride', { startTimeLocal: '2026-08-05 09:00:00' }),
      act('run', {
        sport: 'running',
        startTimeLocal: '2026-08-07 06:30:00',
        distanceM: 10_000,
        durationS: 2700,
        movingS: 2700
      })
    ]);

    const data = await loadTimeline(d, { userId: USER, locale: 'pl', signals: [hrvCrash] });

    expect(data.past.events.map((e) => `${e.day}:${e.kind}`)).toEqual([
      '2026-08-07:activity',
      '2026-08-06:health',
      '2026-08-05:activity'
    ]);
    expect(data.past.totalCount).toBe(3);
    const health = data.past.events.find((e) => e.kind === 'health');
    expect(health).toMatchObject({
      metric: 'hrv',
      signal: 'hrv_drop',
      severity: 'strong',
      favourable: false
    });
  });

  it('ignores activities outside the window but still uses them for records', async () => {
    const d = deps();
    // Four older rides establish the baseline; the in-window one beats them all.
    await d.store.putActivities(USER, [
      act('h1', { startTimeLocal: '2026-01-05 09:00:00', distanceM: 30_000 }),
      act('h2', { startTimeLocal: '2026-02-05 09:00:00', distanceM: 40_000 }),
      act('h3', { startTimeLocal: '2026-03-05 09:00:00', distanceM: 50_000 }),
      act('h4', { startTimeLocal: '2026-04-05 09:00:00', distanceM: 45_000 }),
      act('pb', { startTimeLocal: '2026-08-02 09:00:00', distanceM: 160_000 })
    ]);

    const data = await loadTimeline(d, { userId: USER, locale: 'pl' });

    expect(data.past.events.filter((e) => e.kind === 'activity').map((e) => e.day)).toEqual(['2026-08-02']);
    const milestone = data.past.events.find((e) => e.kind === 'milestone');
    expect(milestone).toMatchObject({ milestone: 'longest_distance', activityId: 'pb', day: '2026-08-02' });
  });

  it('caps the collapsed view by importance while returning the full stream', async () => {
    const d = deps();
    const walks = Array.from({ length: 6 }, (_, i) =>
      act(`walk-${i}`, {
        sport: 'casual_walking',
        startTimeLocal: `2026-08-0${i + 1} 12:00:00`,
        distanceM: 2500,
        durationS: 1800,
        movingS: 1800,
        trainingLoad: null,
        avgPower: null
      })
    );
    await d.store.putActivities(USER, walks);

    const data = await loadTimeline(d, { userId: USER, locale: 'pl', signals: [hrvCrash], limit: 2 });

    expect(data.past.totalCount).toBe(7);
    expect(data.past.primaryCount).toBe(2);
    expect(data.past.events.filter((e) => e.primary).some((e) => e.kind === 'health')).toBe(true);
  });

  it('never leaks another user’s activities', async () => {
    const d = deps();
    await d.store.putActivities(OTHER, [
      act('theirs', { userId: OTHER, startTimeLocal: '2026-08-05 09:00:00' })
    ]);
    const data = await loadTimeline(d, { userId: USER, locale: 'pl' });
    expect(data.past.events).toEqual([]);
  });

  it('reports `not_synced` for the forward half while no planned-workout source is injected', async () => {
    const data = await loadTimeline(deps(), { userId: USER, locale: 'pl' });
    expect(data.planned.status).toBe('not_synced');
    expect(data.planned.events).toEqual([]);
  });

  it('reports `empty` once a source exists but the user has nothing scheduled', async () => {
    const data = await loadTimeline(deps({ plannedWorkouts: plannedSource([]) }), {
      userId: USER,
      locale: 'pl'
    });
    expect(data.planned.status).toBe('empty');
    expect(data.planned.events).toEqual([]);
  });

  it('renders real plans, sorted, once a source supplies them — the UI needs no change', async () => {
    const source = plannedSource([
      plan({ id: 'p2', day: '2026-08-11', time: '18:00', title: 'Długi bieg' }),
      plan({ id: 'p1', day: '2026-08-09', time: '07:30' })
    ]);
    const data = await loadTimeline(deps({ plannedWorkouts: source }), { userId: USER, locale: 'pl' });

    expect(data.planned.status).toBe('ok');
    expect(data.planned.events.map((e) => e.id)).toEqual(['p1', 'p2']);
    expect(data.planned.events[0]).toMatchObject({ day: '2026-08-09', sport: 'running', source: 'garmin' });
  });

  it('reports `not_synced`, not `empty`, when the upstream calendar could not be read', async () => {
    const unreadable = plannedSource([plan({ id: 'ignored', day: '2026-08-09' })], false);
    const data = await loadTimeline(deps({ plannedWorkouts: unreadable }), { userId: USER, locale: 'pl' });
    expect(data.planned.status).toBe('not_synced');
    expect(data.planned.events).toEqual([]);
  });

  it('drops planned items that fall outside the requested window', async () => {
    const source = plannedSource([
      plan({ id: 'far', day: '2026-09-30' }),
      plan({ id: 'past', day: '2026-08-01' })
    ]);
    const data = await loadTimeline(deps({ plannedWorkouts: source }), { userId: USER, locale: 'pl' });
    expect(data.planned.events).toEqual([]);
    expect(data.planned.status).toBe('empty');
  });

  /* ---- authored sessions in the forward half (spec 050) ---- */

  /** Store a session the athlete composed here, on `day`. */
  async function authored(
    store: LocalStore,
    over: {
      id?: string;
      day: string;
      title?: string;
      garminWorkoutId?: string | null;
      pushState?: 'pending' | 'pushed' | 'failed' | 'unsupported';
    }
  ): Promise<void> {
    const id = over.id ?? 'a1';
    await store.createWorkout(USER, {
      id,
      day: over.day,
      time: '18:00',
      sport: 'cycling',
      title: over.title ?? '4x8 FTP',
      steps: [
        {
          kind: 'work',
          durationType: 'time',
          durationValue: 480,
          target: { type: 'power', low: 250, high: 265 },
          repeats: null,
          steps: null,
          note: null
        }
      ],
      note: null,
      createdAt: '2026-08-07T09:00:00.000Z'
    });
    if (over.pushState || over.garminWorkoutId !== undefined) {
      await store.updateWorkout(USER, id, {
        ...(over.pushState ? { pushState: over.pushState } : {}),
        ...(over.garminWorkoutId !== undefined ? { garminWorkoutId: over.garminWorkoutId } : {}),
        updatedAt: '2026-08-07T09:30:00.000Z'
      });
    }
  }

  it('shows an authored session even with no Garmin calendar source, flagged with its push state', async () => {
    const d = deps();
    await authored(d.store, { day: '2026-08-09' });

    const data = await loadTimeline(d, { userId: USER, locale: 'pl' });

    // A local session is never "not synced" — it exists, it just has not reached Garmin yet.
    expect(data.planned.status).toBe('ok');
    expect(data.planned.events).toHaveLength(1);
    expect(data.planned.events[0]).toMatchObject({
      title: '4x8 FTP',
      authored: true,
      push: 'pending',
      estimatedDurationS: 480
    });
  });

  it('does not list a pushed session twice when Garmin serves it back', async () => {
    const d = deps({
      plannedWorkouts: plannedSource([
        // The same session, as Garmin's calendar now reports it.
        plan({ id: 'g-1', day: '2026-08-09', title: '4x8 FTP' }),
        plan({ id: 'g-other', day: '2026-08-10', title: 'Plan z Garmina' })
      ])
    });
    await authored(d.store, { day: '2026-08-09', garminWorkoutId: 'g-1', pushState: 'pushed' });

    const data = await loadTimeline(d, { userId: USER, locale: 'pl' });

    expect(data.planned.events.map((e) => e.title)).toEqual(['4x8 FTP', 'Plan z Garmina']);
    // The surviving copy is the LOCAL row: only it knows the session is already on the watch.
    expect(data.planned.events[0]).toMatchObject({ authored: true, push: 'pushed' });
    expect(data.planned.events[1]?.authored).toBeUndefined();
  });

  it('keeps authored sessions inside the forward window and out of other users’ timelines', async () => {
    const d = deps();
    await authored(d.store, { id: 'in', day: '2026-08-09' });
    await authored(d.store, { id: 'far', day: '2026-09-30' });

    const mine = await loadTimeline(d, { userId: USER, locale: 'pl' });
    const theirs = await loadTimeline(d, { userId: OTHER, locale: 'pl' });

    expect(mine.planned.events).toHaveLength(1);
    expect(theirs.planned.events).toEqual([]);
    expect(theirs.planned.status).toBe('not_synced');
  });

  it('clamps out-of-range window and limit requests instead of trusting them', async () => {
    const data = await loadTimeline(deps(), {
      userId: USER,
      locale: 'pl',
      pastDays: 9999,
      futureDays: -3,
      limit: 0
    });
    // MAX_PAST_DAYS = 400 since spec 047: the global range reaches a year, and clamping that to 60
    // would have shown two months while the switch claimed twelve.
    expect(data.past.from).toBe('2025-07-04'); // 400 days back, the cap
    expect(data.planned.to).toBe('2026-08-08'); // 1 day forward, the floor
    expect(data.planned.status).toBe('not_synced');
  });

  it('scales the collapsed event count with the window, bounded (spec 047)', () => {
    // A 7-day window keeps the tight 8-event view; a year earns more rows without listing everything.
    expect(limitForWindow(7)).toBe(DEFAULT_LIMIT);
    expect(limitForWindow(14)).toBe(DEFAULT_LIMIT);
    expect(limitForWindow(365)).toBe(27);
    expect(limitForWindow(MAX_PAST_DAYS)).toBe(29);
    // Never past the ceiling, however absurd the window.
    expect(limitForWindow(100_000)).toBe(MAX_LIMIT);
  });

  it('honours a pinned `today` and ignores a malformed one', async () => {
    const pinned = await loadTimeline(deps(), { userId: USER, locale: 'pl', today: '2026-03-15' });
    expect(pinned.today).toBe('2026-03-15');
    const bogus = await loadTimeline(deps(), { userId: USER, locale: 'pl', today: '2026-02-30' });
    expect(bogus.today).toBe('2026-08-07');
  });

  it('resolves today in the app timezone, not UTC', async () => {
    // 00:30 local on the 8th in Warsaw is still 22:30 UTC on the 7th.
    const lateNight = fixedClock(new Date('2026-08-07T22:30:00.000Z'));
    const data = await loadTimeline(deps({ clock: lateNight }), { userId: USER, locale: 'pl' });
    expect(data.today).toBe('2026-08-08');
  });
});
