import { describe, expect, it, vi } from 'vitest';
import { createMemoryStore } from './store/memory';
import { fixedClock } from './clock';
import type { LocalStore } from './store/types';
import { loadRange, resolveRangeForUser } from './range-context';

const USER = 'u1';
// 22:30Z on 6 Aug = 00:30 local on 7 Aug in Warsaw — the case that catches a UTC day key.
const clock = fixedClock(new Date('2026-08-06T22:30:00.000Z'));

function deps(store: LocalStore = createMemoryStore()) {
  return { store, clock, timeZone: 'Europe/Warsaw' };
}

/** A store whose coverage reports a known earliest day, and counts how often it is asked. */
function coveredStore(earliest: string | null): { store: LocalStore; calls: () => number } {
  const store = createMemoryStore();
  const spy = vi.fn(async () => ({
    metrics: [],
    activities: { count: 0, withGps: 0, firstStart: null, lastStart: null, totalDistanceM: 0 },
    weight: { count: 0, firstDay: null, lastDay: null },
    earliest,
    storage: { totalBytes: 0, tables: [] }
  }));
  return { store: { ...store, coverage: spy } as unknown as LocalStore, calls: () => spy.mock.calls.length };
}

describe('resolveRangeForUser', () => {
  it('anchors the window on the user local day, not the UTC day (spec 018)', async () => {
    const local = await resolveRangeForUser(deps(), USER, '7');
    expect(local.end).toBe('2026-08-07');
    expect(local.start).toBe('2026-08-01');

    const utc = await resolveRangeForUser({ ...deps(), timeZone: 'UTC' }, USER, '7');
    expect(utc.end).toBe('2026-08-06');
  });

  it('reads coverage ONLY for the all-time range', async () => {
    for (const key of ['7', '14', '30', '365'] as const) {
      const { store, calls } = coveredStore('2021-03-04');
      await resolveRangeForUser(deps(store), USER, key);
      // The common path must not add a query per page load.
      expect(calls(), `range ${key} should not read coverage`).toBe(0);
    }

    const { store, calls } = coveredStore('2021-03-04');
    const all = await resolveRangeForUser(deps(store), USER, 'all');
    expect(calls()).toBe(1);
    expect(all.start).toBe('2021-03-04');
    expect(all.clamped).toBe(true);
  });

  it('degrades all-time to the default window when nothing is synced', async () => {
    const { store } = coveredStore(null);
    const all = await resolveRangeForUser(deps(store), USER, 'all');
    expect(all.key).toBe('all');
    expect(all.days).toBe(7);
    expect(all.clamped).toBe(false);
  });
});

describe('loadRange', () => {
  const url = (search: string): URL => new URL(`http://vagus.test/insights${search}`);

  it('resolves the range named in the query', async () => {
    const range = await loadRange(deps(), USER, url('?range=30'));
    expect(range.key).toBe('30');
    expect(range.days).toBe(30);
  });

  it('defaults when the parameter is absent', async () => {
    expect((await loadRange(deps(), USER, url(''))).key).toBe('7');
  });

  it('never lets a hand-typed value widen a store query', async () => {
    for (const raw of ['9999', 'all-time', '-1', 'abc', '']) {
      const range = await loadRange(deps(), USER, url(`?range=${raw}`));
      expect(range.key).toBe('7');
      expect(range.days).toBe(7);
    }
  });

  it('ignores the other query parameters on the page', async () => {
    const range = await loadRange(deps(), USER, url('?sport=running&sort=distance&range=365'));
    expect(range.key).toBe('365');
  });
});
