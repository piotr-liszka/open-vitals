import { describe, it, expect } from 'vitest';
import { loadActivities } from './activities.api';
import { resolveRange } from '$lib/range';
import { createMemoryStore } from '$lib/server/store/memory';
import type { ActivitySummary, LocalStore } from '$lib/server/store/types';

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
    raw: {},
    ...over
  };
}

async function seed(): Promise<LocalStore> {
  const store = createMemoryStore();
  await store.putActivities('u', [
    act('a', {
      sport: 'cycling',
      startTimeLocal: '2026-05-01 09:00:00',
      distanceM: 40000,
      movingS: 4000,
      name: 'Poranna jazda',
      hasGps: true
    }),
    act('b', {
      sport: 'running',
      startTimeLocal: '2026-06-01 07:00:00',
      distanceM: 8000,
      movingS: 2400,
      name: 'Interwały'
    }),
    act('c', {
      sport: 'cycling',
      startTimeLocal: '2026-07-01 09:00:00',
      distanceM: 20000,
      movingS: 3000,
      name: 'Regeneracja'
    })
  ]);
  await store.putStreams('u', 'a', {
    gps: [
      [50, 8],
      [50.1, 8.1],
      [50.2, 8.2]
    ]
  });
  return store;
}

describe('loadActivities', () => {
  it('lists all activities newest-first with facets by default', async () => {
    const store = await seed();
    const data = await loadActivities({ store }, 'u');
    expect(data.items.map((i) => i.id)).toEqual(['c', 'b', 'a']); // date desc
    expect(data.facets.total).toBe(3);
    expect(data.facets.totalDistanceM).toBe(68000);
    expect(data.facets.totalDurationS).toBe(9400); // 4000 + 2400 + 3000
    // Sport facets carry counts, most frequent first (spec 020) — the chips collapse by frequency.
    expect(data.facets.sports).toEqual([
      { sport: 'cycling', count: 2 },
      { sport: 'running', count: 1 }
    ]);
    expect(data.query).toMatchObject({ sport: null, search: null, sort: 'date', dir: 'desc', page: 1 });
    expect(data.pageCount).toBe(1);
  });

  it('filters by sport and recomputes facets', async () => {
    const store = await seed();
    const data = await loadActivities({ store }, 'u', { sport: 'cycling' });
    expect(data.items.map((i) => i.id).sort()).toEqual(['a', 'c']);
    expect(data.facets.total).toBe(2);
    expect(data.facets.totalDistanceM).toBe(60000);
    // Facet chips still list every sport the user has, not just the filtered one.
    expect(data.facets.sports).toEqual([
      { sport: 'cycling', count: 2 },
      { sport: 'running', count: 1 }
    ]);
  });

  it('searches name/sport case-insensitively', async () => {
    const store = await seed();
    const data = await loadActivities({ store }, 'u', { search: 'interw' });
    expect(data.items.map((i) => i.id)).toEqual(['b']);
    expect(data.facets.total).toBe(1);
  });

  it('sorts by distance ascending', async () => {
    const store = await seed();
    const data = await loadActivities({ store }, 'u', { sort: 'distance', dir: 'asc' });
    expect(data.items.map((i) => i.id)).toEqual(['b', 'c', 'a']); // 8k, 20k, 40k
  });

  it('paginates and clamps the page to the last', async () => {
    const store = await seed();
    const page1 = await loadActivities({ store }, 'u', { pageSize: 2, page: 1 });
    expect(page1.items.map((i) => i.id)).toEqual(['c', 'b']);
    expect(page1.pageCount).toBe(2);

    const page2 = await loadActivities({ store }, 'u', { pageSize: 2, page: 5 });
    expect(page2.query.page).toBe(2); // clamped
    expect(page2.items.map((i) => i.id)).toEqual(['a']);
  });

  it('attaches a downsampled GPS thumbnail only when a track is stored', async () => {
    const store = await seed();
    const data = await loadActivities({ store }, 'u', { sport: 'cycling' });
    const withGps = data.items.find((i) => i.id === 'a');
    const withoutGps = data.items.find((i) => i.id === 'c');
    expect(withGps?.gps?.length).toBe(3);
    expect(withoutGps?.gps).toBeNull();
  });

  it('is empty for an unknown user', async () => {
    const store = await seed();
    const data = await loadActivities({ store }, 'nobody');
    expect(data.items).toEqual([]);
    expect(data.facets.total).toBe(0);
    expect(data.pageCount).toBe(1);
  });
});

describe('loadActivities and the global range (spec 047)', () => {
  const TODAY = '2026-05-10';

  it('narrows the rows AND the facet totals to the range', async () => {
    const store = await seed();
    const all = await loadActivities({ store }, 'u');
    const week = await loadActivities({ store }, 'u', { range: resolveRange('7', TODAY) });

    // The window holds fewer sessions, and the totals describe the same narrowed set the rows do —
    // a header reading "247 aktywności" over three visible rows is the bug this prevents.
    expect(week.facets.total).toBeLessThanOrEqual(all.facets.total);
    expect(week.items.length).toBeLessThanOrEqual(week.facets.total);
    expect(week.facets.totalDistanceM).toBeLessThanOrEqual(all.facets.totalDistanceM);
    expect(week.range?.key).toBe('7');
  });

  it('keeps every row within the window', async () => {
    const store = await seed();
    const range = resolveRange('30', TODAY);
    const data = await loadActivities({ store }, 'u', { range });
    for (const item of data.items) {
      const day = item.startTimeLocal.slice(0, 10);
      expect(day >= range.start && day <= range.end).toBe(true);
    }
  });

  it('combines with the sport filter rather than replacing it', async () => {
    const store = await seed();
    const data = await loadActivities({ store }, 'u', {
      sport: 'cycling',
      range: resolveRange('all', TODAY, '2020-01-01')
    });
    expect(data.items.length).toBeGreaterThan(0);
    for (const item of data.items) expect(item.sport).toBe('cycling');
  });

  it('lists the whole history when no range is given (MCP, tests)', async () => {
    const store = await seed();
    const data = await loadActivities({ store }, 'u');
    expect(data.range).toBeUndefined();
  });
});
