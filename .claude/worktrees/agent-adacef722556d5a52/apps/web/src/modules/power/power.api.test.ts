import { describe, it, expect } from 'vitest';
import { createMemoryStore } from '$lib/server/store/memory';
import type { SettingsRepo, UserSettings } from '$lib/server/repo/types';
import type { ActivitySummary } from '$lib/server/store/types';
import { loadPower, type PowerDeps } from './power.api';

const USER = 'u1';

function act(id: string, over: Partial<ActivitySummary>): ActivitySummary {
  return {
    userId: USER,
    activityId: id,
    sport: 'cycling',
    name: null,
    startTime: '2026-06-01T09:00:00Z',
    startTimeLocal: '2026-06-01 09:00:00',
    distanceM: 30000,
    durationS: 3600,
    movingS: 3600,
    elevationGainM: 100,
    avgHr: 150,
    maxHr: 180,
    avgPower: 200,
    maxPower: 500,
    normPower: 210,
    calories: 600,
    trainingLoad: 60,
    hasGps: false,
    raw: {},
    ...over
  };
}

function fakeSettings(bag: UserSettings): SettingsRepo {
  return {
    async get() {
      return bag;
    },
    async set() {
      /* no-op */
    }
  };
}

function deps(bag: UserSettings = {}): PowerDeps {
  return { store: createMemoryStore(), settings: fakeSettings(bag) };
}

describe('loadPower', () => {
  it('degrades gracefully when no activity has power', async () => {
    const d = deps();
    await d.store.putActivities(USER, [act('a', {})]);
    const data = await loadPower(d, { userId: USER });
    expect(data.hasPower).toBe(false);
    expect(data.bests).toEqual([]);
    expect(data.ftpWatts).toBeNull();
    expect(data.weightSource).toBeNull();
  });

  it('builds bests, FTP estimate and zones from power streams', async () => {
    const d = deps();
    await d.store.putActivities(USER, [act('a', { startTimeLocal: '2026-06-01 09:00:00' })]);
    await d.store.putStreams(USER, 'a', { power: new Array(3600).fill(250) });
    const data = await loadPower(d, { userId: USER });
    expect(data.hasPower).toBe(true);
    expect(data.best20MinWatts).toBe(250);
    expect(data.ftpWatts).toBe(238); // round(0.95 * 250)
    expect(data.ftpSource).toBe('estimated');
    expect(data.zones).toHaveLength(7);
    expect(data.bests.find((b) => b.durationS === 5)!.watts).toBe(250);
  });

  it('derives weight from the latest weigh-in when settings omit it', async () => {
    const d = deps();
    await d.store.putActivities(USER, [act('a', {})]);
    await d.store.putStreams(USER, 'a', { power: new Array(3600).fill(300) });
    await d.store.putWeight(USER, [
      { day: '2026-01-01', weightKg: 72, source: 'garmin' },
      { day: '2026-05-01', weightKg: 70, source: 'garmin' }
    ]);
    const data = await loadPower(d, { userId: USER });
    expect(data.weightKg).toBe(70);
    expect(data.weightSource).toBe('measured');
    // W/kg present on the radar/bests once weight is known.
    expect(data.radar.find((a) => a.key === 'endurance')!.wattsPerKg).toBeCloseTo(300 / 70, 2);
  });

  it('prefers settings weight + FTP over derived values', async () => {
    const d = deps({ weightKg: 65, ftpWatts: 300 });
    await d.store.putActivities(USER, [act('a', {})]);
    await d.store.putStreams(USER, 'a', { power: new Array(3600).fill(250) });
    await d.store.putWeight(USER, [{ day: '2026-01-01', weightKg: 80, source: 'withings' }]);
    const data = await loadPower(d, { userId: USER });
    expect(data.weightKg).toBe(65);
    expect(data.weightSource).toBe('settings');
    expect(data.ftpWatts).toBe(300);
    expect(data.ftpSource).toBe('settings');
  });

  it('scopes the profile to one sport family when asked (spec 025)', async () => {
    const d = deps();
    await d.store.putActivities(USER, [
      act('ride', { sport: 'gravel_cycling' }),
      act('run', { activityId: 'run', sport: 'running', startTimeLocal: '2026-06-02 07:00:00' })
    ]);
    await d.store.putStreams(USER, 'ride', { power: new Array(3600).fill(200) });
    // Running power is a different physiological scale; before the family filter it landed in the
    // cycling rider-type radar and inflated every sprint/punch axis.
    await d.store.putStreams(USER, 'run', { power: new Array(3600).fill(400) });

    const cycling = await loadPower(d, { userId: USER, group: 'ride' });
    expect(cycling.bests.find((b) => b.durationS === 5)!.watts).toBe(200);
    expect(cycling.radar.every((a) => a.watts <= 200)).toBe(true);

    // Without a group the handler still considers every sport (the pre-025 behaviour).
    const everything = await loadPower(d, { userId: USER });
    expect(everything.bests.find((b) => b.durationS === 5)!.watts).toBe(400);
  });

  it('builds per-year curves across multiple seasons', async () => {
    const d = deps();
    await d.store.putActivities(USER, [
      act('a', { startTimeLocal: '2025-06-01 09:00:00' }),
      act('b', { activityId: 'b', startTimeLocal: '2026-06-01 09:00:00' })
    ]);
    await d.store.putStreams(USER, 'a', { power: new Array(3600).fill(200) });
    await d.store.putStreams(USER, 'b', { power: new Array(3600).fill(260) });
    const data = await loadPower(d, { userId: USER });
    expect(data.years).toEqual([2026, 2025]);
    expect(data.yearCurves.map((c) => c.year)).toEqual([2026, 2025]);
  });
});
