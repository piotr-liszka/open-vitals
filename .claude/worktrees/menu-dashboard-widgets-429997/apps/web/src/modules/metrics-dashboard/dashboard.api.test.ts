import { describe, it, expect } from 'vitest';
import { createTestContainer } from '$lib/server/container';
import { createGarminMock } from '$lib/server/garmin/mock-adapter';
import { fixedClock } from '$lib/server/clock';
import { resolveRange } from '$lib/range';
import { loadDashboard } from './dashboard.api';

const clock = fixedClock(new Date('2026-08-07T10:00:00.000Z'));
/** The clock's local day (Europe/Warsaw) — the anchor every range in this file resolves against. */
const TODAY = '2026-08-07';
const USER = 'user-1';

// Shapes mirror the sidecar's real Garmin payloads (nested summaries / arrays).
const METRICS = {
  steps: { totalSteps: 9000 },
  resting_heart_rate: { restingHeartRate: 52 },
  body_battery: { bodyBatteryValuesArray: [[0, 'MEASURED', 61, 0]] },
  sleep: { dailySleepDTO: { sleepTimeSeconds: 25560 } }, // 7h 06m
  hrv: { hrvSummary: { lastNightAvg: 64 } },
  stress: { avgStressLevel: 33 }
} as const;

/** A per-user set of dashboard deps over a scriptable Garmin mock + in-memory consent. */
function deps(opts: { authenticated: boolean; metrics?: Record<string, unknown> }) {
  const c = createTestContainer({
    clock,
    garmin: createGarminMock({
      status: { authenticated: opts.authenticated },
      metrics: opts.metrics ?? { ...METRICS }
    })
  });
  return { c, garmin: c.garminFor(USER), consent: c.consentFor(USER), clock };
}

describe('loadDashboard', () => {
  it('reports not-connected with no tiles when Garmin is disconnected', async () => {
    const data = await loadDashboard(deps({ authenticated: false }));
    expect(data.connected).toBe(false);
    expect(data.tiles).toEqual([]);
  });

  it('renders the ungated snapshot with formatted values and no trends when analytics is off', async () => {
    const data = await loadDashboard(deps({ authenticated: true }));
    expect(data.connected).toBe(true);
    expect(data.analyticsEnabled).toBe(false);
    const steps = data.tiles.find((t) => t.key === 'steps');
    expect(steps?.value).toBe('9000'); // int, locale-formatted
    expect(steps?.series).toEqual([]);
    expect(steps?.delta).toBeNull();
    const sleep = data.tiles.find((t) => t.key === 'sleep');
    expect(sleep?.value).toBe('7h 06m'); // duration formatting
  });

  it('includes trend series + delta once detailed_analytics is consented', async () => {
    const d = deps({ authenticated: true });
    await d.consent.accept('detailed_analytics', '1.0');
    const data = await loadDashboard(d);
    expect(data.analyticsEnabled).toBe(true);
    expect(data.range.key).toBe('7'); // default window
    expect(data.days.length).toBe(7);
    const steps = data.tiles.find((t) => t.key === 'steps');
    expect(steps?.series.length).toBe(7); // 7-day range
    expect(steps?.value).toBe('9000');
    expect(steps?.delta).toBe(0); // flat mock series
  });

  it('honours a wider global range and reports its day lattice (spec 028/035)', async () => {
    const d = deps({ authenticated: true });
    await d.consent.accept('detailed_analytics', '1.0');
    const data = await loadDashboard(d, { range: resolveRange('30', TODAY) });
    expect(data.range.key).toBe('30');
    expect(data.days.length).toBe(30);
    expect(data.days.at(-1)).toBe(data.date); // window ends on "today"
    for (const tile of data.tiles) expect(tile.series.length).toBe(30);
  });

  it('buckets a year into weeks so the tile chart stays readable (spec 047)', async () => {
    const d = deps({ authenticated: true });
    await d.consent.accept('detailed_analytics', '1.0');
    const data = await loadDashboard(d, { range: resolveRange('365', TODAY) });
    expect(data.range.bucket).toBe('week');
    // 365 days spans 53 ISO weeks; every tile's series is index-aligned with that lattice.
    expect(data.days.length).toBe(53);
    for (const tile of data.tiles) expect(tile.series.length).toBe(data.days.length);
    // The headline is still the newest single reading, not a weekly mean.
    expect(data.tiles.find((t) => t.key === 'steps')?.value).toBe('9000');
  });

  it('buckets an all-time range by month', async () => {
    const d = deps({ authenticated: true });
    await d.consent.accept('detailed_analytics', '1.0');
    const data = await loadDashboard(d, { range: resolveRange('all', TODAY, '2024-01-15') });
    expect(data.range.bucket).toBe('month');
    expect(data.days.every((k) => k.endsWith('-01'))).toBe(true);
    for (const tile of data.tiles) expect(tile.series.length).toBe(data.days.length);
  });

  it('keeps a missing day as a gap on its own slot instead of collapsing the line (spec 028)', async () => {
    const c = createTestContainer({
      clock,
      // Steps land only on the two window ends; the five days between them have no payload at all.
      garmin: createGarminMock({
        status: { authenticated: true },
        metrics: { ...METRICS },
        rangeDays: {
          steps: { '2026-08-01': { totalSteps: 8000 }, '2026-08-07': { totalSteps: 12000 } }
        }
      })
    });
    const d = { garmin: c.garminFor(USER), consent: c.consentFor(USER), clock };
    await d.consent.accept('detailed_analytics', '1.0');
    const data = await loadDashboard(d);
    const steps = data.tiles.find((t) => t.key === 'steps');
    expect(steps?.series).toEqual([8000, null, null, null, null, null, 12000]);
    // Headline + delta come from the defined ends, not from array position 0.
    expect(steps?.value).toBe((12000).toLocaleString('pl-PL'));
    expect(steps?.delta).toBe(50);
  });

  it('exposes the per-metric format so the chart read-out matches the tile', async () => {
    const data = await loadDashboard(deps({ authenticated: true }));
    expect(data.tiles.find((t) => t.key === 'sleep')?.format).toBe('duration');
    expect(data.tiles.find((t) => t.key === 'steps')?.format).toBe('int');
  });

  it('renders "—" (null value) when a metric payload lacks the expected fields', async () => {
    const data = await loadDashboard(deps({ authenticated: true, metrics: { steps: { unrelated: 1 } } }));
    expect(data.tiles.find((t) => t.key === 'steps')?.value).toBeNull();
  });
});

describe('loadDashboard "today" resolution (spec 018)', () => {
  /** Deps with an arbitrary clock + timezone, reusing the same Garmin mock. */
  function tzDeps(at: string, timeZone?: string) {
    const c = createTestContainer({
      clock: fixedClock(new Date(at)),
      garmin: createGarminMock({ status: { authenticated: true }, metrics: { ...METRICS } })
    });
    const garmin = c.garminFor(USER) as ReturnType<typeof createGarminMock>;
    const consent = c.consentFor(USER);
    // `exactOptionalPropertyTypes`: only set timeZone when one was actually asked for.
    return { deps: { garmin, consent, clock: c.clock, ...(timeZone ? { timeZone } : {}) }, garmin, consent };
  }

  it('asks Garmin for the local day, not the UTC day, just after local midnight', async () => {
    // 22:30Z on 6 Aug is already 00:30 on 7 Aug in Warsaw — the old UTC key said 2026-08-06.
    const { deps: d, garmin } = tzDeps('2026-08-06T22:30:00.000Z');
    const data = await loadDashboard(d);
    expect(data.date).toBe('2026-08-07');
    expect(garmin.calls.getMetric.every((c) => c.date === '2026-08-07')).toBe(true);
  });

  it('honours an explicitly injected timezone', async () => {
    const { deps: d } = tzDeps('2026-08-06T22:30:00.000Z', 'UTC');
    expect((await loadDashboard(d)).date).toBe('2026-08-06');
  });

  it('anchors the 7-day trend window on the local day', async () => {
    const { deps: d, consent, garmin } = tzDeps('2026-08-06T22:30:00.000Z');
    await consent.accept('detailed_analytics', '1.0');
    await loadDashboard(d);
    expect(garmin.calls.getMetricRange[0]).toMatchObject({ start: '2026-08-01', end: '2026-08-07' });
  });
});
