import { describe, it, expect } from 'vitest';
import { GARMIN_TOOLS, interpretHealthMessages, type ToolContext } from './tools';
import { createGarminMock } from '../server/garmin/mock-adapter';
import { METRICS } from '../server/garmin/metric-specs';
import { fixedClock } from '../server/clock';

// Shapes mirror the sidecar's real Garmin payloads (nested summaries / arrays).
const READINESS_METRICS = {
  body_battery: { bodyBatteryValuesArray: [[0, 'MEASURED', 45, 0]] },
  sleep: { dailySleepDTO: { sleepTimeSeconds: 25_200 } },
  hrv: { hrvSummary: { lastNightAvg: 30 } },
  resting_heart_rate: { restingHeartRate: 52 }
} as const;

function tool(name: string) {
  const t = GARMIN_TOOLS.find((x) => x.name === name);
  if (!t) throw new Error(`tool ${name} not found`);
  return t;
}

describe('garmin MCP tools', () => {
  it('exposes stable, prefixed tool names', () => {
    const names = GARMIN_TOOLS.map((t) => t.name);
    expect(names).toContain('get_status');
    expect(names).toContain('get_health_snapshot');
    expect(names).toContain('get_sleep');
    expect(names.every((n) => n.startsWith('get_'))).toBe(true);
  });

  it('get_status returns the current status as text', async () => {
    const garmin = createGarminMock({ status: { authenticated: true, displayName: 'Ada' } });
    const res = await tool('get_status').handler(garmin, {});
    expect(res.isError).toBeFalsy();
    expect(res.content[0]!.text).toContain('"authenticated": true');
    expect(res.content[0]!.text).toContain('Ada');
  });

  it('metric tools return data and forward the date', async () => {
    const garmin = createGarminMock({ status: { authenticated: true }, metrics: { sleep: { score: 82 } } });
    const res = await tool('get_sleep').handler(garmin, { date: '2026-08-01' });
    expect(res.content[0]!.text).toContain('82');
    expect(garmin.calls.getMetric).toContainEqual({ name: 'sleep', date: '2026-08-01' });
  });

  it('returns a friendly tool error when Garmin is not connected', async () => {
    const garmin = createGarminMock({ status: { authenticated: false } });
    const res = await tool('get_steps').handler(garmin, {});
    expect(res.isError).toBe(true);
    expect(res.content[0]!.text).toMatch(/not connected/i);
  });

  it('get_health_snapshot aggregates several metrics', async () => {
    const garmin = createGarminMock({
      status: { authenticated: true },
      metrics: { sleep: { score: 82 }, steps: { total: 9000 } }
    });
    const res = await tool('get_health_snapshot').handler(garmin, { date: '2026-08-01' });
    const text = res.content[0]!.text;
    expect(text).toContain('sleep');
    expect(text).toContain('steps');
    expect(text).toContain('body_battery');
  });

  it('exposes the extended metric tools (spec 008)', () => {
    const names = GARMIN_TOOLS.map((t) => t.name);
    for (const n of ['get_spo2', 'get_respiration', 'get_calories', 'get_body_composition']) {
      expect(names).toContain(n);
    }
  });

  it('get_metric_range returns one entry per day and forwards the range (spec 009)', async () => {
    const garmin = createGarminMock({
      status: { authenticated: true },
      metrics: { steps: { totalSteps: 8000 } }
    });
    const res = await tool('get_metric_range').handler(garmin, {
      metric: 'steps',
      start: '2026-08-01',
      end: '2026-08-03'
    });
    expect(res.isError).toBeFalsy();
    const payload = JSON.parse(res.content[0]!.text) as { days: Array<{ date: string }> };
    expect(payload.days.map((d) => d.date)).toEqual(['2026-08-01', '2026-08-02', '2026-08-03']);
    expect(garmin.calls.getMetricRange).toContainEqual({
      name: 'steps',
      start: '2026-08-01',
      end: '2026-08-03'
    });
  });

  it('get_metric_range surfaces a friendly error when not connected', async () => {
    const garmin = createGarminMock({ status: { authenticated: false } });
    const res = await tool('get_metric_range').handler(garmin, {
      metric: 'hrv',
      start: '2026-08-01',
      end: '2026-08-02'
    });
    expect(res.isError).toBe(true);
    expect(res.content[0]!.text).toMatch(/not connected/i);
  });

  it('exposes the insights tools (spec 013)', () => {
    const names = GARMIN_TOOLS.map((t) => t.name);
    expect(names).toContain('get_readiness');
    expect(names).toContain('get_insights');
  });

  it('get_readiness returns a score and drivers over a window', async () => {
    const garmin = createGarminMock({ status: { authenticated: true }, metrics: { ...READINESS_METRICS } });
    const res = await tool('get_readiness').handler(garmin, { window: 30 });
    expect(res.isError).toBeFalsy();
    const payload = JSON.parse(res.content[0]!.text) as { score: number; drivers: unknown[] };
    expect(typeof payload.score).toBe('number');
    expect(payload.drivers.length).toBe(4);
  });

  it('get_readiness reports insufficient_data when fewer than two contributors qualify', async () => {
    const garmin = createGarminMock({
      status: { authenticated: true },
      metrics: { body_battery: { bodyBatteryValuesArray: [[0, 'MEASURED', 45, 0]] } }
    });
    const res = await tool('get_readiness').handler(garmin, { window: 30 });
    expect(res.isError).toBeFalsy();
    expect(res.content[0]!.text).toContain('insufficient_data');
  });

  it('get_readiness surfaces a friendly error when not connected', async () => {
    const garmin = createGarminMock({ status: { authenticated: false } });
    const res = await tool('get_readiness').handler(garmin, {});
    expect(res.isError).toBe(true);
    expect(res.content[0]!.text).toMatch(/not connected/i);
  });

  it('get_insights returns the full computed payload with compact chart summaries', async () => {
    const garmin = createGarminMock({ status: { authenticated: true }, metrics: { ...READINESS_METRICS } });
    const res = await tool('get_insights').handler(garmin, { window: 7 });
    expect(res.isError).toBeFalsy();
    const payload = JSON.parse(res.content[0]!.text) as {
      window: number;
      readiness: unknown;
      trends: unknown[];
      anomalies: unknown[];
      correlations: unknown[];
      charts: Array<{ key: string; n: number; days?: unknown }>;
    };
    expect(payload.window).toBe(7);
    expect(payload.readiness).not.toBeNull();
    expect(Array.isArray(payload.trends)).toBe(true);
    expect(payload.charts.length).toBe(METRICS.length);
    // Full day arrays are omitted; only compact summaries are returned.
    expect(payload.charts[0]!.days).toBeUndefined();
    expect(typeof payload.charts[0]!.n).toBe('number');
  });

  it('get_insights clamps an unsupported window to the nearest supported one', async () => {
    const garmin = createGarminMock({ status: { authenticated: true }, metrics: { ...READINESS_METRICS } });
    const res = await tool('get_insights').handler(garmin, { window: 45 });
    const payload = JSON.parse(res.content[0]!.text) as { window: number };
    expect(payload.window).toBe(30); // 45 → nearest of {7,30,90,365}
  });
});

describe('date-aware tools resolve "today" from the injected context (spec 018)', () => {
  /** 22:30Z on 6 Aug 2026 is already 00:30 on 7 Aug in Warsaw. */
  const ctx = (timeZone: string): ToolContext => ({
    clock: fixedClock(new Date('2026-08-06T22:30:00.000Z')),
    timeZone
  });

  it('get_insights ends the window on the local day, not the UTC day', async () => {
    const garmin = createGarminMock({ status: { authenticated: true }, metrics: { ...READINESS_METRICS } });
    const res = await tool('get_insights').handler(garmin, { window: 7 }, ctx('Europe/Warsaw'));
    const payload = JSON.parse(res.content[0]!.text) as { start: string; end: string };
    expect(payload.end).toBe('2026-08-07');
    expect(payload.start).toBe('2026-08-01');
  });

  it('honours a different injected timezone', async () => {
    const garmin = createGarminMock({ status: { authenticated: true }, metrics: { ...READINESS_METRICS } });
    const res = await tool('get_insights').handler(garmin, { window: 7 }, ctx('UTC'));
    const payload = JSON.parse(res.content[0]!.text) as { start: string; end: string };
    expect(payload.end).toBe('2026-08-06');
    expect(payload.start).toBe('2026-07-31');
  });

  it('get_readiness works without a context (falls back to the system clock)', async () => {
    const garmin = createGarminMock({ status: { authenticated: true }, metrics: { ...READINESS_METRICS } });
    const res = await tool('get_readiness').handler(garmin, { window: 7 });
    expect(res.isError).toBeFalsy();
  });
});

describe('interpret_health prompt', () => {
  it('builds a guiding user message mentioning the tools and the window', () => {
    const messages = interpretHealthMessages('90');
    expect(messages.length).toBeGreaterThan(0);
    expect(messages[0]!.role).toBe('user');
    const text = messages[0]!.content.text;
    expect(text).toContain('get_readiness');
    expect(text).toContain('get_insights');
    expect(text).toContain('90');
    expect(text).toMatch(/not medical|medical advice/i);
  });

  it('defaults to a 30-day window and clamps unsupported values', () => {
    expect(interpretHealthMessages()[0]!.content.text).toContain('30');
    expect(interpretHealthMessages('45')[0]!.content.text).toContain('30');
  });
});
