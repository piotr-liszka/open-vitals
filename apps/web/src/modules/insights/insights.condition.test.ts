/**
 * Unit tests for the condition & regeneration snapshot (spec 022): sleep extraction from the real
 * Garmin payload shape, per-channel baselines, the recovery state machine and the Polish summary.
 */
import { createTranslator } from '$lib/i18n';
import { describe, it, expect } from 'vitest';
import { METRICS } from '$lib/server/garmin/metric-specs';
import type { GarminMetricDay } from '$lib/server/interfaces';
import type { DayPoint, Readiness } from './insights.types';
import {
  BATTERY_BUCKET_MS,
  BATTERY_DAY_MS,
  buildConditionMetric,
  computeCondition,
  conditionSummary,
  extractBatteryIntraday,
  extractSleepNight,
  recoveryStateOf,
  sleepEfficiency,
  type ConditionSeries
} from './insights.condition';
import { fmtChannelValue, fmtDelta, fmtSleepDuration } from './condition.format';

const t = createTranslator('pl');

const spec = (key: string) => METRICS.find((m) => m.key === key)!;

/** Real Garmin sleep shape: everything nested under `dailySleepDTO`, times as local-epoch ms. */
function sleepPayload(over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    dailySleepDTO: {
      sleepTimeSeconds: 27_060, // 7 h 31 min
      deepSleepSeconds: 4800,
      lightSleepSeconds: 15_060,
      remSleepSeconds: 6000,
      awakeSleepSeconds: 1200,
      // 23:15 → 07:05 the next morning, as local wall clock.
      sleepStartTimestampLocal: Date.UTC(2026, 7, 5, 23, 15),
      sleepEndTimestampLocal: Date.UTC(2026, 7, 6, 7, 5),
      sleepScores: { overall: { value: 82 } },
      ...over
    }
  };
}

/** "Today" for the snapshot tests: the newest day `series()` below carries, i.e. fully current. */
const TODAY = '2026-08-06';

function days(values: Array<number | null>, startDay = 1): DayPoint[] {
  return values.map((value, i) => ({ date: `2026-08-${String(startDay + i).padStart(2, '0')}`, value }));
}

function rawDays(payloads: Array<unknown>, startDay = 1): GarminMetricDay[] {
  return payloads.map((data, i) => ({ date: `2026-08-${String(startDay + i).padStart(2, '0')}`, data }));
}

const readiness = (over: Partial<Readiness> = {}): Readiness => ({
  score: 72,
  band: 'high',
  drivers: [],
  composite: 74,
  limitedBy: [],
  forecast: { recoveredAt: null, fullyReadyAt: null, limits: [] },
  ...over
});

describe('extractSleepNight', () => {
  it('reads duration, stages, score and local bed/wake times off the real payload shape', () => {
    const night = extractSleepNight(rawDays([sleepPayload()], 6));
    expect(night).toMatchObject({
      day: '2026-08-06',
      totalS: 27_060,
      deepS: 4800,
      lightS: 15_060,
      remS: 6000,
      awakeS: 1200,
      score: 82,
      bedTime: '23:15',
      wakeTime: '07:05'
    });
  });

  it('takes the NEWEST day that actually has sleep, skipping empty tails', () => {
    const night = extractSleepNight(rawDays([sleepPayload(), null, {}], 4));
    expect(night!.day).toBe('2026-08-04');
  });

  it('returns null when no day in the window has a usable duration', () => {
    expect(extractSleepNight(rawDays([null, {}, { dailySleepDTO: { sleepTimeSeconds: 0 } }]))).toBeNull();
    expect(extractSleepNight([])).toBeNull();
  });

  it('degrades field by field rather than failing on a partial payload', () => {
    const night = extractSleepNight(rawDays([{ dailySleepDTO: { sleepTimeSeconds: 21_600 } }], 3));
    expect(night).toMatchObject({
      totalS: 21_600,
      deepS: null,
      score: null,
      bedTime: null,
      efficiencyPct: null
    });
  });
});

describe('sleepEfficiency', () => {
  it('is asleep ÷ in-bed as a whole percent', () => {
    const start = Date.UTC(2026, 7, 5, 23, 0);
    const end = Date.UTC(2026, 7, 6, 7, 0); // 8 h in bed
    expect(sleepEfficiency(27_060, start, end)).toBe(94); // 7 h 31 min asleep
  });

  it('refuses to invent a figure when the timestamps cannot support one', () => {
    expect(sleepEfficiency(27_060, null, Date.now())).toBeNull();
    expect(sleepEfficiency(27_060, 100, 100)).toBeNull();
    // Asleep longer than in bed → the payload is inconsistent, not 130% efficient.
    expect(sleepEfficiency(27_060, Date.UTC(2026, 7, 6, 0, 0), Date.UTC(2026, 7, 6, 4, 0))).toBeNull();
  });
});

describe('buildConditionMetric', () => {
  it('compares the latest reading against the baseline BEFORE it', () => {
    const m = buildConditionMetric(spec('hrv'), days([50, 50, 50, 60]));
    expect(m).toMatchObject({ latest: 60, baseline: 50, deltaPct: 20, direction: 'up', favourable: true });
  });

  it('marks a rise in a lower-is-better metric as unfavourable', () => {
    const m = buildConditionMetric(spec('resting_heart_rate'), days([50, 50, 50, 56]));
    expect(m).toMatchObject({ direction: 'up', favourable: false });
  });

  it('calls a move inside the noise band flat, with no favourability', () => {
    const m = buildConditionMetric(spec('hrv'), days([100, 100, 100, 101]));
    expect(m).toMatchObject({ direction: 'flat', favourable: null });
  });

  it('handles a single reading (no baseline) and skips gaps', () => {
    const m = buildConditionMetric(spec('hrv'), days([null, null, 44]));
    expect(m).toMatchObject({ latest: 44, baseline: null, deltaPct: null, direction: 'flat' });
  });

  it('returns null when the channel has no readings at all', () => {
    expect(buildConditionMetric(spec('hrv'), days([null, null]))).toBeNull();
  });
});

describe('extractBatteryIntraday', () => {
  /** Real Garmin shape: `[epochMs, status, level, version]` rows every `stepMin` minutes. */
  function batteryPayload(
    startMs: number,
    levels: Array<number | null>,
    stepMin = 3
  ): Record<string, unknown> {
    return {
      bodyBatteryValuesArray: levels.map((level, i) => [
        startMs + i * stepMin * 60_000,
        level === null ? null : 'MEASURED',
        level,
        3
      ])
    };
  }

  const NOON = Date.UTC(2026, 7, 6, 12, 0);

  it('buckets the 3-minute rows onto the lattice, keeping the freshest value in each bucket', () => {
    const points = extractBatteryIntraday(rawDays([batteryPayload(NOON, [40, 41, 42, 43, 50, 51])]));
    // Six 3-minute readings span 15 min → the first five share a bucket, the sixth opens the next.
    expect(points).toEqual([
      { at: NOON, value: 50 },
      { at: NOON + BATTERY_BUCKET_MS, value: 51 }
    ]);
  });

  it('keeps a gap in the readings as a null slot rather than a straight line across it', () => {
    const levels = [40, ...Array.from({ length: 10 }, () => null), 70];
    const points = extractBatteryIntraday(rawDays([batteryPayload(NOON, levels)]));
    expect(points.length).toBe(3); // 33 minutes → three 15-minute buckets
    expect(points.map((p) => p.value)).toEqual([40, null, 70]);
  });

  it('ends at the newest reading and reaches back 24 h, not further', () => {
    // 30 hours of readings at 15-minute spacing; only the last 24 h may survive.
    const start = NOON - 30 * 60 * 60 * 1000;
    const levels = Array.from({ length: 121 }, (_, i) => i);
    const points = extractBatteryIntraday(rawDays([batteryPayload(start, levels, 15)]));
    expect(points.at(-1)).toEqual({ at: NOON, value: 120 });
    expect(points[0]!.at).toBe(NOON - BATTERY_DAY_MS);
    expect(points.length).toBe(BATTERY_DAY_MS / BATTERY_BUCKET_MS + 1);
  });

  it('starts at the first reading when the account holds less than a day of them', () => {
    const points = extractBatteryIntraday(rawDays([batteryPayload(NOON, [40, 45, 50], 15)]));
    expect(points[0]!.at).toBe(NOON);
    expect(points.length).toBe(3);
  });

  it('spans the day boundary by reading the trailing payloads together', () => {
    const yesterday = batteryPayload(NOON - 3 * 60 * 60 * 1000, [20, 25], 15);
    const today = batteryPayload(NOON, [60, 65], 15);
    const points = extractBatteryIntraday(rawDays([yesterday, today], 5));
    expect(points[0]).toEqual({ at: NOON - 3 * 60 * 60 * 1000, value: 20 });
    expect(points.at(-1)).toEqual({ at: NOON + BATTERY_BUCKET_MS, value: 65 });
  });

  it('returns nothing for a payload with no intraday rows, and skips malformed ones', () => {
    expect(extractBatteryIntraday(rawDays([{ bodyBatteryValuesArray: 'nope' }]))).toEqual([]);
    expect(extractBatteryIntraday(rawDays([{}]))).toEqual([]);
    expect(extractBatteryIntraday([])).toEqual([]);
    const junk = { bodyBatteryValuesArray: [['x', 'MEASURED', 40, 3], [NOON, 'MEASURED', 'y', 3], 7] };
    expect(extractBatteryIntraday(rawDays([junk]))).toEqual([]);
  });
});

describe('recoveryStateOf', () => {
  it('follows the readiness band when there is one', () => {
    expect(recoveryStateOf(readiness({ band: 'peak' }), [])).toBe('rested');
    expect(recoveryStateOf(readiness({ band: 'high' }), [])).toBe('rested');
    expect(recoveryStateOf(readiness({ band: 'moderate' }), [])).toBe('steady');
    expect(recoveryStateOf(readiness({ band: 'low' }), [])).toBe('strained');
  });

  it('falls back to counting which way the channels moved', () => {
    const up = buildConditionMetric(spec('hrv'), days([50, 50, 60]))!;
    const down = buildConditionMetric(spec('body_battery'), days([80, 80, 40]))!;
    expect(recoveryStateOf(null, [up, down])).toBe('steady');
    expect(recoveryStateOf(null, [up, buildConditionMetric(spec('body_battery'), days([40, 40, 80]))!])).toBe(
      'rested'
    );
    expect(recoveryStateOf(null, [down])).toBe('unknown');
  });
});

describe('conditionSummary', () => {
  it('names the state and the two biggest movers, in Polish, in one sentence', () => {
    const hrv = buildConditionMetric(spec('hrv'), days([50, 50, 60]))!;
    const rhr = buildConditionMetric(spec('resting_heart_rate'), days([50, 50, 56]))!;
    const night = extractSleepNight(rawDays([sleepPayload()], 6))!;

    const text = conditionSummary(t, 'rested', [hrv, rhr], night);
    expect(text.startsWith('Jesteś wypoczęty — ')).toBe(true);
    expect(text).toContain('HRV powyżej bazy');
    expect(text).toContain('sen 7 h 31 min');
    expect(text.endsWith('.')).toBe(true);
  });

  it('stays honest when there is nothing to interpret', () => {
    expect(conditionSummary(t, 'unknown', [], null)).toContain('Za mało danych');
    expect(conditionSummary(t, 'steady', [], null)).toBe('Regeneracja idzie swoim torem.');
  });
});

describe('computeCondition', () => {
  function series(): ConditionSeries[] {
    return [
      {
        spec: spec('sleep'),
        days: days([25_000, 26_000, 27_060], 4),
        raw: rawDays([sleepPayload(), sleepPayload(), sleepPayload()], 4)
      },
      { spec: spec('hrv'), days: days([50, 50, 60], 4), raw: [] },
      { spec: spec('body_battery'), days: days([80, 82, 74], 4), raw: [] },
      { spec: spec('resting_heart_rate'), days: days([50, 50, 56], 4), raw: [] },
      { spec: spec('stress'), days: days([30, 31, 30], 4), raw: [] },
      { spec: spec('steps'), days: days([8000, 9000, 12_000], 4), raw: [] }
    ];
  }

  it('assembles sleep, the four recovery channels, readiness and a sentence', () => {
    const snapshot = computeCondition(t, series(), readiness(), TODAY)!;

    expect(snapshot.state).toBe('rested');
    expect(snapshot.day).toBe('2026-08-06');
    expect(snapshot.sleep!.totalS).toBe(27_060);
    expect(snapshot.sleepTrend!.key).toBe('sleep');
    // Only the recovery channels, in reading order — steps is a volume metric, not a channel.
    expect(snapshot.channels.map((c) => c.key)).toEqual([
      'body_battery',
      'hrv',
      'resting_heart_rate',
      'stress'
    ]);
    expect(snapshot.summary.length).toBeGreaterThan(0);
  });

  /*
   * Spec 095: the card says "vs your last {n} days" off this, so it must be the window the caller
   * actually fetched — not a number this module invents on its own.
   */
  describe('windowDays', () => {
    it('reports the caller-supplied window', () => {
      const snapshot = computeCondition(t, series(), readiness(), TODAY, { windowDays: 7 })!;
      expect(snapshot.windowDays).toBe(7);
    });

    it('falls back to the longest series length when the caller passes none', () => {
      // `series()` fetches 3 days per channel — every test above this one relies on that default.
      const snapshot = computeCondition(t, series(), readiness(), TODAY)!;
      expect(snapshot.windowDays).toBe(3);
    });
  });

  it('still reports when only some channels exist', () => {
    const snapshot = computeCondition(
      t,
      [{ spec: spec('hrv'), days: days([50, 60]), raw: [] }],
      null,
      TODAY
    )!;
    expect(snapshot.sleep).toBeNull();
    expect(snapshot.channels.map((c) => c.key)).toEqual(['hrv']);
  });

  /*
   * Spec 072. Every field on this snapshot is read off the newest day the STORE holds, which is not
   * the same day as today whenever the watch has not uploaded — and the card said nothing about the
   * difference, so a Thursday-evening reading sat on the start page all Saturday looking current.
   */
  it('is not stale when the newest day it describes is today', () => {
    const snapshot = computeCondition(t, series(), readiness(), TODAY)!;
    expect(snapshot.staleDays).toBe(0);
    expect(snapshot.summary).not.toContain('dane z');
  });

  it('measures how far behind today the snapshot is, and says so in the sentence', () => {
    const snapshot = computeCondition(t, series(), readiness(), '2026-08-08')!;

    expect(snapshot.day).toBe('2026-08-06');
    expect(snapshot.staleDays).toBe(2);
    expect(snapshot.summary).toContain('dane z 6 sie');
  });

  it('reports an unknown age as null rather than as current', () => {
    // Nothing dated at all: "we don't know how old this is" must not collapse into "it is today's".
    const snapshot = computeCondition(
      t,
      [{ spec: spec('hrv'), days: [{ date: 'nonsense', value: 50 }], raw: [] }],
      readiness(),
      TODAY
    );
    expect(snapshot?.staleDays ?? 'absent').not.toBe(0);
  });

  it('returns null when there is genuinely nothing to show', () => {
    expect(computeCondition(t, [], null, TODAY)).toBeNull();
    expect(
      computeCondition(t, [{ spec: spec('hrv'), days: days([null, null]), raw: [] }], null, TODAY)
    ).toBeNull();
  });
});

describe('condition formatting', () => {
  it('renders durations, channel values and deltas the same way everywhere', () => {
    expect(fmtSleepDuration(27_060)).toBe('7 h 31 min');
    expect(fmtSleepDuration(2880)).toBe('48 min');
    expect(fmtSleepDuration(0)).toBeNull();

    const sleepTrend = buildConditionMetric(spec('sleep'), days([25_000, 27_060]))!;
    expect(fmtChannelValue(t, sleepTrend)).toBe('7 h 31 min');

    const hrv = buildConditionMetric(spec('hrv'), days([50, 50, 60]))!;
    expect(fmtChannelValue(t, hrv)).toBe('60');
    expect(fmtDelta(t, hrv)).toBe('+20,0%');

    const flat = buildConditionMetric(spec('hrv'), days([100, 100, 100]))!;
    expect(fmtDelta(t, flat)).toBeNull();
  });
});
