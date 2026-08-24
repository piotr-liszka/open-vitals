import { describe, it, expect } from 'vitest';
import { createTestContainer } from '$lib/server/container';
import { eachDate } from '$lib/server/garmin/mock-adapter';
import { fixedClock } from '$lib/server/clock';
import {
  GarminNotAuthenticatedError,
  GarminUnavailableError,
  type GarminMetricName,
  type GarminMetricRange,
  type GarminService
} from '$lib/server/interfaces';
import { METRICS } from '$lib/server/garmin/metric-specs';
import { resolveRange } from '$lib/range';
import { InvalidWindowError, loadInsights } from './insights.api';

const clock = fixedClock(new Date('2026-08-07T10:00:00.000Z'));
/** The clock's local day (Europe/Warsaw) — anchor for every range in this file. */
const TODAY = '2026-08-07';
const USER = 'user-1';

/** Deterministic per-day payload with variety (so std > 0), a steps spike anomaly, and a
 * sleep↔hrv linear relationship (r = 1). `i` is the day index within the window.
 * Shapes mirror the sidecar's real Garmin payloads (nested summaries / arrays). */
function payload(name: GarminMetricName, i: number): Record<string, unknown> {
  switch (name) {
    case 'steps':
      return { totalSteps: i === 15 ? 50_000 : 8000 + i * 10 };
    case 'resting_heart_rate':
      return { restingHeartRate: 50 + (i % 5) };
    case 'hrv':
      return { hrvSummary: { lastNightAvg: 25.2 + 0.06 * i } };
    case 'body_battery':
      // Per-reading array [epochMs, status, level, ...]; the reducer takes the day's max level.
      return { bodyBatteryValuesArray: [[0, 'MEASURED', 40 + (i % 7) * 3, 0]] };
    case 'sleep':
      return {
        dailySleepDTO: {
          sleepTimeSeconds: 25_200 + i * 60,
          deepSleepSeconds: 4500,
          lightSleepSeconds: 14_000,
          remSleepSeconds: 5500,
          awakeSleepSeconds: 900,
          sleepStartTimestampLocal: Date.UTC(2026, 6, 8 + i, 23, 10),
          sleepEndTimestampLocal: Date.UTC(2026, 6, 9 + i, 6, 40),
          sleepScores: { overall: { value: 80 } }
        }
      };
    case 'stress':
      return { avgStressLevel: 30 + (i % 4) };
    case 'spo2':
      return { averageSpo2: 96 };
    case 'respiration':
      return { avgWakingRespirationValue: 14 };
    case 'calories':
      return { totalKilocalories: 2000 + i * 5 };
    case 'training_readiness':
      // Garmin's own verdict (spec 059), camelCase as the sidecar passes it through — already
      // unwrapped from Garmin's single-item list. Deliberately far below our composite, which is
      // the real-world case this feature exists for.
      return {
        score: 12 + (i % 3),
        level: 'LOW',
        sleepScoreFactorPercent: 70,
        hrvFactorPercent: 40,
        recoveryTimeFactorPercent: 10,
        acwrFactorPercent: 65,
        stressHistoryFactorPercent: 55,
        hrvWeeklyAverage: 61,
        acuteLoad: 300,
        recoveryTime: 34,
        recoveryTimeChangePhrase: 'RECOVERY_TIME_DECREASED'
      };
    default:
      return {};
  }
}

interface FakeOpts {
  authenticated?: boolean;
  statusThrows?: 'unavailable';
  rangeThrows?: 'unavailable' | 'not_authenticated';
  /** Metrics this account has nothing for — every day comes back as a gap. */
  without?: GarminMetricName[];
}

function fakeGarmin(opts: FakeOpts = {}): GarminService & { rangeCalls: number } {
  const authenticated = opts.authenticated ?? true;
  const svc: GarminService & { rangeCalls: number } = {
    rangeCalls: 0,
    async login() {
      return { outcome: 'success', status: { authenticated } };
    },
    async getStatus() {
      if (opts.statusThrows === 'unavailable') throw new GarminUnavailableError();
      return { authenticated };
    },
    async getMetric() {
      return {};
    },
    async getMetricRange(name: GarminMetricName, start: string, end: string): Promise<GarminMetricRange> {
      svc.rangeCalls += 1;
      if (opts.rangeThrows === 'unavailable') throw new GarminUnavailableError();
      if (opts.rangeThrows === 'not_authenticated') throw new GarminNotAuthenticatedError();
      const missing = opts.without?.includes(name) ?? false;
      const days = eachDate(start, end).map((date, i) => ({
        date,
        data: missing ? null : payload(name, i)
      }));
      return { metric: name, start, end, days };
    },
    async disconnect() {}
  };
  return svc;
}

function deps(garmin: GarminService) {
  const c = createTestContainer({ clock, garmin });
  return { c, garmin: c.garminFor(USER), consent: c.consentFor(USER), clock };
}

describe('loadInsights', () => {
  it('degrades to empty flags when not connected (no throw)', async () => {
    const d = deps(fakeGarmin({ authenticated: false }));
    const data = await loadInsights(d, { window: 30 });
    expect(data.connected).toBe(false);
    expect(data.readiness).toBeNull();
    expect(data.charts).toEqual([]);
    expect(data.trends).toEqual([]);
    expect(data.condition).toBeNull();
  });

  it('gates on consent: connected but not consented → enabled false, empty', async () => {
    const d = deps(fakeGarmin({ authenticated: true }));
    const data = await loadInsights(d, { window: 30 });
    expect(data.connected).toBe(true);
    expect(data.enabled).toBe(false);
    expect(data.charts).toEqual([]);
    expect(data.readiness).toBeNull();
  });

  it('degrades when the sidecar status call is unavailable (no throw)', async () => {
    const d = deps(fakeGarmin({ statusThrows: 'unavailable' }));
    const data = await loadInsights(d, { window: 30 });
    expect(data.connected).toBe(false);
    expect(data.charts).toEqual([]);
  });

  it('returns a full populated payload once consented', async () => {
    const d = deps(fakeGarmin({ authenticated: true }));
    await d.consent.accept('detailed_analytics', '1.0');
    const data = await loadInsights(d, { window: 30 });

    expect(data.connected).toBe(true);
    expect(data.enabled).toBe(true);

    // Readiness: all four contributors present with variety → a real score.
    expect(data.readiness).not.toBeNull();
    expect(data.readiness!.drivers.length).toBe(4);
    expect(['low', 'moderate', 'high', 'peak']).toContain(data.readiness!.band);

    // Trends across the metrics.
    expect(data.trends.length).toBeGreaterThan(0);

    // The steps spike at day 15 is an anomaly.
    expect(data.anomalies.length).toBeGreaterThan(0);
    expect(data.anomalies.some((a) => a.key === 'steps')).toBe(true);

    // sleep ↔ hrv is a perfect linear relationship → a strong correlation.
    const sleepHrv = data.correlations.find((c) => c.a === 'sleep' && c.b === 'hrv');
    expect(sleepHrv).toBeDefined();
    expect(sleepHrv!.strength).toBe('strong');
    expect(sleepHrv!.r).toBe(1);

    // One chart per metric, each with 30 days. Counted from METRICS so adding a metric is a
    // one-line spec change, not a test rewrite.
    expect(data.charts.length).toBe(METRICS.length);
    for (const chart of data.charts) {
      expect(chart.days.length).toBe(30);
    }

    // Spec 022: the condition snapshot rides along on the SAME fetch — last night's sleep with its
    // stages and bed/wake times, plus the four recovery channels against their own baselines.
    expect(data.condition).not.toBeNull();
    expect(data.condition!.sleep).toMatchObject({
      day: '2026-08-07',
      deepS: 4500,
      score: 80,
      bedTime: '23:10',
      wakeTime: '06:40'
    });
    expect(data.condition!.sleep!.efficiencyPct).toBeGreaterThan(0);
    expect(data.condition!.channels.map((c) => c.key)).toEqual([
      'body_battery',
      'hrv',
      'resting_heart_rate',
      'stress'
    ]);
    expect(['rested', 'steady', 'strained', 'unknown']).toContain(data.condition!.state);
    expect(data.condition!.summary).toMatch(/\.$/);

    // Spec 059: Garmin's own score and recovery timer ride along on the same fetch.
    expect(data.condition!.garmin).toMatchObject({
      score: 12 + (29 % 3),
      level: 'low',
      state: 'strained',
      hrvWeeklyAvg: 61,
      acuteLoad: 300
    });
    expect(data.condition!.garmin!.factors.map((f) => f.key)).toEqual([
      'sleep',
      'hrv',
      'recovery',
      'load',
      'stress'
    ]);
    expect(data.condition!.garmin!.summary).toContain('do pełnej regeneracji 1 dzień 10 h');
    expect(data.condition!.recovery).toMatchObject({ hours: 34, change: 'krótszy niż wczoraj' });
  });

  it('leaves the Garmin block null when the account has no Training Readiness', async () => {
    const garmin = fakeGarmin({ authenticated: true, without: ['training_readiness'] });
    const d = deps(garmin);
    await d.consent.accept('detailed_analytics', '1.0');
    const data = await loadInsights(d, { window: 30 });

    expect(data.condition).not.toBeNull();
    expect(data.condition!.garmin).toBeNull();
    expect(data.condition!.recovery).toBeNull();
    // Our own composite is unaffected — the card still has something to lead with.
    expect(data.condition!.readiness).not.toBeNull();
  });

  it('honours the window and computes the span (90 days = 3 chunks per metric)', async () => {
    const garmin = fakeGarmin({ authenticated: true });
    const d = deps(garmin);
    await d.consent.accept('detailed_analytics', '1.0');
    const data = await loadInsights(d, { window: 90 });

    expect(data.window).toBe(90);
    expect(data.end).toBe('2026-08-07');
    expect(data.start).toBe('2026-05-10'); // 89 days before end
    expect(data.charts[0]!.days.length).toBe(90);
    // One chunk per 31 days, per metric.
    expect(garmin.rangeCalls).toBe(METRICS.length * 3);
  });

  it('defaults to a 30-day window', async () => {
    const d = deps(fakeGarmin({ authenticated: true }));
    await d.consent.accept('detailed_analytics', '1.0');
    const data = await loadInsights(d);
    expect(data.window).toBe(30);
  });

  it('takes its window from the global range, reaching all-time (spec 047)', async () => {
    const d = deps(fakeGarmin({ authenticated: true }));
    await d.consent.accept('detailed_analytics', '1.0');

    const week = await loadInsights(d, { range: resolveRange('7', TODAY) });
    expect(week.window).toBe(7);
    expect(week.start).toBe('2026-08-01');
    expect(week.charts[0]!.days.length).toBe(7);

    // "cały czas" is an arbitrary span no fixed window list could hold — the whole reason `range`
    // exists beside `window`.
    const allRange = resolveRange('all', TODAY, '2026-01-01');
    const all = await loadInsights(d, { range: allRange });
    expect(all.window).toBe(allRange.days);
    expect(all.start).toBe('2026-01-01');
  });

  it('buckets the CHARTS for a long range but leaves the engine on daily data (spec 047)', async () => {
    const d = deps(fakeGarmin({ authenticated: true }));
    await d.consent.accept('detailed_analytics', '1.0');
    const year = await loadInsights(d, { range: resolveRange('365', TODAY) });

    // 53 plotted points per metric rather than 365 — a year of daily points is unreadable and heavy.
    const chart = year.charts[0]!;
    expect(chart.days.length).toBe(53);
    expect(chart.days.every((p) => p.date.length === 10)).toBe(true);
    // Anomalies are day-level statistics: they must still be dated to real days, not to buckets.
    for (const a of year.anomalies) expect(a.date.length).toBe(10);
    // And the correlations still saw every day, not 53 weekly means.
    for (const c of year.correlations) expect(c.n).toBeGreaterThan(53);
  });

  it('carries the summary statistics the Analityka page used to own (spec 048)', async () => {
    const d = deps(fakeGarmin({ authenticated: true }));
    await d.consent.accept('detailed_analytics', '1.0');
    const data = await loadInsights(d, { window: 30 });

    const steps = data.charts.find((c) => c.key === 'steps')!;
    // Steps is summable and goodWhen:'up' — the spike day is the best one, not the worst.
    expect(steps.max).toBe(50_000);
    expect(steps.best!.value).toBe(50_000);
    expect(steps.worst!.value).toBe(steps.min);
    expect(steps.total).toBe(steps.days.reduce((n, p) => n + (p.value ?? 0), 0));
    expect(steps.count).toBe(30);
    expect(steps.rangeDays).toBe(30);

    // A goodWhen:'down' metric inverts: the LOWEST resting heart rate is the best day.
    const rhr = data.charts.find((c) => c.key === 'resting_heart_rate')!;
    expect(rhr.goodWhen).toBe('down');
    expect(rhr.best!.value).toBe(rhr.min);
    expect(rhr.worst!.value).toBe(rhr.max);
    expect(rhr.total).toBeNull(); // summing heart rates is meaningless
  });

  it('computes the statistics from DAILY data even when the chart is bucketed (spec 048)', async () => {
    const d = deps(fakeGarmin({ authenticated: true }));
    await d.consent.accept('detailed_analytics', '1.0');
    const year = await loadInsights(d, { range: resolveRange('365', TODAY) });
    const steps = year.charts.find((c) => c.key === 'steps')!;

    // The chart is 53 weekly points, but the statistics still describe days. Summarizing the
    // bucketed series instead would report a week's MEAN (~14k) as the best day.
    expect(steps.days.length).toBe(53);
    expect(steps.max).toBe(50_000);
    expect(steps.best!.value).toBe(50_000);
    expect(Math.max(...steps.series)).toBeLessThan(50_000);
    // …and "najlepszy dzień" names a real day, not a bucket start it happens to share a shape with.
    expect(steps.count).toBeGreaterThan(53);
    expect(steps.rangeDays).toBe(365);
  });

  it('reports an empty range as no data rather than zeroes', async () => {
    const d = deps(fakeGarmin({ authenticated: true, rangeThrows: 'unavailable' }));
    await d.consent.accept('detailed_analytics', '1.0');
    const data = await loadInsights(d, { window: 30 });

    for (const chart of data.charts) {
      expect(chart.count).toBe(0);
      // A metric you did not record is not a metric that read zero.
      expect(chart.avg).toBeNull();
      expect(chart.best).toBeNull();
      expect(chart.total).toBeNull();
    }
  });

  it('a range beats an explicit window when both are given', async () => {
    const d = deps(fakeGarmin({ authenticated: true }));
    await d.consent.accept('detailed_analytics', '1.0');
    const data = await loadInsights(d, { window: 30, range: resolveRange('7', TODAY) });
    expect(data.window).toBe(7);
  });

  it('rejects a bad window with a typed error', async () => {
    const d = deps(fakeGarmin({ authenticated: true }));
    await expect(loadInsights(d, { window: 45 })).rejects.toBeInstanceOf(InvalidWindowError);
  });

  it('anchors the window on the local day, not the UTC day (spec 018)', async () => {
    // 22:30Z on 6 Aug is 00:30 on 7 Aug in Warsaw; a UTC key would have said 2026-08-06.
    const c = createTestContainer({
      clock: fixedClock(new Date('2026-08-06T22:30:00.000Z')),
      garmin: fakeGarmin({ authenticated: true })
    });
    const d = { garmin: c.garminFor(USER), consent: c.consentFor(USER), clock: c.clock };
    await d.consent.accept('detailed_analytics', '1.0');

    const local = await loadInsights(d, { window: 7 });
    expect(local.end).toBe('2026-08-07');
    expect(local.start).toBe('2026-08-01');

    const utc = await loadInsights({ ...d, timeZone: 'UTC' }, { window: 7 });
    expect(utc.end).toBe('2026-08-06');
    expect(utc.start).toBe('2026-07-31');
  });

  it('degrades to empty results if a metric range read is unavailable mid-fetch', async () => {
    const d = deps(fakeGarmin({ authenticated: true, rangeThrows: 'unavailable' }));
    await d.consent.accept('detailed_analytics', '1.0');
    const data = await loadInsights(d, { window: 30 });
    expect(data.connected).toBe(true);
    expect(data.enabled).toBe(true);
    // Every metric degraded to no days → charts present but empty, no readiness.
    expect(data.readiness).toBeNull();
    expect(data.charts.every((c) => c.days.length === 0)).toBe(true);
  });
});
