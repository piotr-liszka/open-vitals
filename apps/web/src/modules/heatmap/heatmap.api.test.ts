import { describe, it, expect } from 'vitest';
import { loadHeatmap } from './heatmap.api';
import { createMemoryStore } from '$lib/server/store/memory';
import type { ActivitySummary } from '$lib/server/store/types';

function act(id: string, over: Partial<ActivitySummary>): ActivitySummary {
  return {
    userId: 'u',
    activityId: id,
    sport: 'cycling',
    name: null,
    startTime: '2026-01-01T00:00:00Z',
    startTimeLocal: '2026-01-01 09:00:00',
    distanceM: 10000,
    durationS: 3600,
    movingS: 3500,
    elevationGainM: 100,
    avgHr: 140,
    maxHr: 170,
    avgPower: 200,
    maxPower: 500,
    normPower: 210,
    calories: 500,
    trainingLoad: 50,
    hasGps: false,
    garminWorkoutId: null,
    raw: {},
    ...over
  };
}

describe('loadHeatmap', () => {
  it('returns GPS tracks + scoped stats + filter facets', async () => {
    const store = createMemoryStore();
    await store.putActivities('u', [
      act('a', { hasGps: true, sport: 'cycling', startTimeLocal: '2026-05-01 09:00:00', distanceM: 40000 }),
      act('b', { hasGps: true, sport: 'running', startTimeLocal: '2025-06-01 07:00:00', distanceM: 8000 }),
      act('c', { hasGps: false, sport: 'cycling', startTimeLocal: '2026-07-01 09:00:00', distanceM: 20000 })
    ]);
    await store.putStreams('u', 'a', {
      gps: [
        [50, 8],
        [50.1, 8.1]
      ]
    });
    await store.putStreams('u', 'b', { gps: [[48, 7]] });

    const all = await loadHeatmap({ store }, 'u');
    expect(all.tracks.map((t) => t.activityId).sort()).toEqual(['a', 'b']);
    expect(all.count).toBe(3);
    expect(all.totalDistanceM).toBe(68000);
    // Sport facets carry counts, most frequent first (spec 020).
    expect(all.sports).toEqual([
      { sport: 'cycling', count: 2 },
      { sport: 'running', count: 1 }
    ]);
    expect(all.years).toEqual([2026, 2025]);

    const cycling2026 = await loadHeatmap({ store }, 'u', { sport: 'cycling', year: 2026 });
    expect(cycling2026.tracks.map((t) => t.activityId)).toEqual(['a']); // only 'a' has GPS in 2026 cycling
    expect(cycling2026.count).toBe(2); // a + c match the filter
    expect(cycling2026.totalDistanceM).toBe(60000);
  });

  it('is empty for a user with no data', async () => {
    const store = createMemoryStore();
    const data = await loadHeatmap({ store }, 'nobody');
    expect(data.tracks).toEqual([]);
    expect(data.count).toBe(0);
    expect(data.years).toEqual([]);
  });
});
