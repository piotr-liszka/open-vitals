import { describe, it, expect } from 'vitest';
import {
  DEFAULT_READINESS_CONFIG,
  bandFor,
  buildChannels,
  buildLimits,
  computeReadiness,
  hrvChannelFromBand,
  recoveryChannel,
  type ReadinessInputs
} from './insights.readiness';
import { parseHrvStatusDay, parseTrainingReadinessDay } from './insights.garmin-readiness';
import type { DayPoint, HrvStatus } from './insights.types';

/* ------------------------------------------------------------------ *
 * The real payloads this spec was written against (2026-08-17)
 * ------------------------------------------------------------------ */

/**
 * Verbatim from the athlete's own store — the morning our score read 52 `moderate` and Garmin read 39
 * `LOW`. Kept whole rather than trimmed: it is the regression this spec exists for, and a hand-built
 * fixture would drift from the shape Garmin actually sends.
 */
const TR_17_08 = {
  level: 'LOW',
  score: 39,
  acuteLoad: 360,
  timestamp: '2026-08-17T05:05:19.0',
  sleepScore: 82,
  validSleep: true,
  calendarDate: '2026-08-17',
  feedbackLong: 'LOW_HRV_UNBALANCED',
  recoveryTime: 1297,
  hrvFactorPercent: 57,
  hrvWeeklyAverage: 99,
  acwrFactorPercent: 61,
  hrvFactorFeedback: 'MODERATE',
  acwrFactorFeedback: 'MODERATE',
  sleepScoreFactorPercent: 74,
  recoveryTimeChangePhrase: 'NO_CHANGE_SLEEP',
  sleepScoreFactorFeedback: 'GOOD',
  recoveryTimeFactorPercent: 65,
  sleepHistoryFactorPercent: 62,
  recoveryTimeFactorFeedback: 'MODERATE',
  sleepHistoryFactorFeedback: 'MODERATE',
  stressHistoryFactorPercent: 76,
  stressHistoryFactorFeedback: 'GOOD'
};

const HRV_17_08 = {
  hrvSummary: {
    status: 'UNBALANCED',
    baseline: { lowUpper: 96, balancedLow: 102, markerValue: 0.1968689, balancedUpper: 133 },
    weeklyAvg: 99,
    calendarDate: '2026-08-17',
    lastNightAvg: 113,
    feedbackPhrase: 'HRV_UNBALANCED_8'
  }
};

/** 2026-08-14: the day Garmin answered 1 with a 61-hour timer and a `POOR` load. */
const TR_14_08 = {
  level: 'POOR',
  score: 1,
  acuteLoad: 467,
  timestamp: '2026-08-14T18:30:15.0',
  calendarDate: '2026-08-14',
  recoveryTime: 3672,
  hrvFactorPercent: 73,
  acwrFactorPercent: 36,
  hrvFactorFeedback: 'GOOD',
  acwrFactorFeedback: 'POOR',
  sleepScoreFactorPercent: 68,
  recoveryTimeFactorPercent: 19,
  sleepHistoryFactorPercent: 71,
  stressHistoryFactorPercent: 60
};

const CAPTURED_17_08 = Date.UTC(2026, 7, 17, 5, 5, 19);

function garminOf(payload: unknown, day: string) {
  const parsed = parseTrainingReadinessDay(day, payload);
  if (!parsed) throw new Error('fixture did not parse');
  return parsed;
}

function hrvOf(payload: unknown, day: string): HrvStatus {
  const parsed = parseHrvStatusDay(day, payload);
  if (!parsed) throw new Error('fixture did not parse');
  return parsed;
}

function nights(values: number[], start = '2026-08-11'): DayPoint[] {
  const base = new Date(`${start}T00:00:00Z`);
  return values.map((value, i) => {
    const d = new Date(base);
    d.setUTCDate(d.getUTCDate() + i);
    return { date: d.toISOString().slice(0, 10), value };
  });
}

/* ------------------------------------------------------------------ *
 * Channel maths
 * ------------------------------------------------------------------ */

describe('recoveryChannel', () => {
  it('reads 100 for a spent or absent timer', () => {
    expect(recoveryChannel(0, DEFAULT_READINESS_CONFIG)).toBe(100);
    expect(recoveryChannel(-5, DEFAULT_READINESS_CONFIG)).toBe(100);
    expect(recoveryChannel(Number.NaN, DEFAULT_READINESS_CONFIG)).toBe(100);
  });

  it("tracks Garmin's own recovery factor closely enough to be the same claim", () => {
    // Garmin's figures for these exact timers were 65, 74 and 19 (spec 084's evidence table).
    expect(Math.round(recoveryChannel(1297, DEFAULT_READINESS_CONFIG))).toBe(70);
    expect(Math.round(recoveryChannel(968, DEFAULT_READINESS_CONFIG))).toBe(78);
    expect(Math.round(recoveryChannel(3672, DEFAULT_READINESS_CONFIG))).toBe(15);
  });

  it('floors at 0 rather than going negative past the span', () => {
    expect(recoveryChannel(100 * 60, DEFAULT_READINESS_CONFIG)).toBe(0);
  });
});

describe('hrvChannelFromBand', () => {
  const band = (weeklyAvg: number): HrvStatus => ({
    day: '2026-08-17',
    status: 'unknown',
    weeklyAvg,
    lastNightAvg: null,
    balancedLow: 102,
    balancedUpper: 133
  });

  it('spans 55–100 inside the band, best at the top', () => {
    expect(hrvChannelFromBand(band(102))).toBe(55);
    expect(hrvChannelFromBand(band(133))).toBe(100);
  });

  it('falls away steeply below the band, reaching 0 one band-width under', () => {
    expect(hrvChannelFromBand(band(99))).toBeLessThan(55);
    expect(hrvChannelFromBand(band(102 - 31))).toBe(0);
  });

  it('returns null without a usable band — never a guess', () => {
    expect(hrvChannelFromBand({ ...band(99), balancedLow: null })).toBeNull();
    expect(hrvChannelFromBand({ ...band(99), balancedUpper: 102 })).toBeNull();
  });
});

describe('buildChannels', () => {
  const inputs = (): ReadinessInputs => ({
    garmin: garminOf(TR_17_08, '2026-08-17'),
    hrv: hrvOf(HRV_17_08, '2026-08-17'),
    recoveryMinutes: 1297
  });

  it('takes five channels from Garmin and computes recovery itself', () => {
    const channels = buildChannels(inputs(), DEFAULT_READINESS_CONFIG);
    const byKey = new Map(channels.map((c) => [c.config.key, c]));
    expect(byKey.get('sleep')!.percent).toBe(74);
    expect(byKey.get('sleep')!.source).toBe('garmin');
    expect(byKey.get('hrv')!.percent).toBe(57);
    expect(byKey.get('load')!.percent).toBe(61);
    expect(byKey.get('stress')!.percent).toBe(76);
    expect(byKey.get('sleep_history')!.percent).toBe(62);
    /*
     * NOT Garmin's 65: the factor is frozen at the 05:05 capture while the timer drains all day, so
     * recovery is always ours (spec 075). 1297 live minutes → 70.
     */
    expect(byKey.get('recovery')!.percent).toBe(70);
    expect(byKey.get('recovery')!.source).toBe('derived');
  });

  it('names the fact behind the HRV channel', () => {
    const hrv = buildChannels(inputs(), DEFAULT_READINESS_CONFIG).find((c) => c.config.key === 'hrv')!;
    expect(hrv.detail).toBe('99 ms · 102–133');
  });

  it('falls back to raw payloads with no Training Readiness at all', () => {
    const channels = buildChannels(
      {
        garmin: null,
        hrv: hrvOf(HRV_17_08, '2026-08-17'),
        recoveryMinutes: null,
        sleepScores: nights([70, 80, 90, 82]),
        stressDays: nights([30, 30, 30, 30])
      },
      DEFAULT_READINESS_CONFIG
    );
    const byKey = new Map(channels.map((c) => [c.config.key, c]));
    expect(byKey.get('sleep')!.percent).toBe(82); // last night's score
    expect(byKey.get('sleep')!.source).toBe('derived');
    expect(byKey.get('sleep_history')!.percent).toBe(81); // 7-night mean of what exists
    expect(byKey.get('stress')!.percent).toBe(70); // 100 − mean stress
    expect(byKey.get('hrv')!.source).toBe('derived');
    // No timer and no ACWR to fall back on — dropped rather than defaulted.
    expect(byKey.has('recovery')).toBe(false);
    expect(byKey.has('load')).toBe(false);
  });

  it('drops a channel whose percent is out of range rather than clamping it', () => {
    const channels = buildChannels(
      {
        garmin: garminOf({ ...TR_17_08, sleepScoreFactorPercent: 140 }, '2026-08-17'),
        recoveryMinutes: 1297
      },
      DEFAULT_READINESS_CONFIG
    );
    expect(channels.some((c) => c.config.key === 'sleep')).toBe(false);
  });
});

/* ------------------------------------------------------------------ *
 * Ceilings
 * ------------------------------------------------------------------ */

describe('buildLimits', () => {
  const channelsFor = (inputs: ReadinessInputs) => buildChannels(inputs, DEFAULT_READINESS_CONFIG);

  it('caps on HRV when the weekly average is under the band', () => {
    const inputs: ReadinessInputs = {
      garmin: garminOf(TR_17_08, '2026-08-17'),
      hrv: hrvOf(HRV_17_08, '2026-08-17'),
      recoveryMinutes: 1297
    };
    const limits = buildLimits(channelsFor(inputs), inputs);
    expect(limits.map((l) => l.key)).toEqual(['hrv', 'recovery']); // strongest ceiling first
    expect(limits.find((l) => l.key === 'hrv')!.ceiling).toBe(57);
  });

  it("does not cap on a MODERATE load, only on Garmin's own POOR", () => {
    const moderate: ReadinessInputs = { garmin: garminOf(TR_17_08, '2026-08-17'), recoveryMinutes: 1297 };
    expect(buildLimits(channelsFor(moderate), moderate).some((l) => l.key === 'load')).toBe(false);

    const poor: ReadinessInputs = { garmin: garminOf(TR_14_08, '2026-08-14'), recoveryMinutes: 3672 };
    expect(buildLimits(channelsFor(poor), poor).some((l) => l.key === 'load')).toBe(true);
  });

  it('does not cap on a spent timer', () => {
    const inputs: ReadinessInputs = { garmin: garminOf(TR_17_08, '2026-08-17'), recoveryMinutes: 0 };
    expect(buildLimits(channelsFor(inputs), inputs).some((l) => l.key === 'recovery')).toBe(false);
  });

  it('does not cap on a balanced HRV', () => {
    const balanced = { hrvSummary: { ...HRV_17_08.hrvSummary, status: 'BALANCED', weeklyAvg: 120 } };
    const inputs: ReadinessInputs = {
      garmin: garminOf(TR_17_08, '2026-08-17'),
      hrv: hrvOf(balanced, '2026-08-17'),
      recoveryMinutes: 1297
    };
    expect(buildLimits(channelsFor(inputs), inputs).some((l) => l.key === 'hrv')).toBe(false);
  });
});

/* ------------------------------------------------------------------ *
 * The score
 * ------------------------------------------------------------------ */

describe('computeReadiness', () => {
  /**
   * THE REGRESSION THIS SPEC EXISTS FOR. On this payload the old z-score engine said 52 `moderate` —
   * an athlete with a 21-hour recovery debt and a weekly HRV average below his own balanced range was
   * told he was moderately ready, because last night alone had been good and his 30-day norm had
   * drifted down to meet him.
   */
  it('scores the 2026-08-17 payload at 57, capped by HRV', () => {
    const readiness = computeReadiness({
      garmin: garminOf(TR_17_08, '2026-08-17'),
      hrv: hrvOf(HRV_17_08, '2026-08-17'),
      recoveryMinutes: 1297,
      hrvNights: nights([120, 103, 95, 88, 92, 113]),
      today: '2026-08-17',
      nowMs: CAPTURED_17_08,
      recoveryEndsAt: CAPTURED_17_08 + 1297 * 60_000
    })!;

    // 74·.25 + 70·.25 + 57·.20 + 61·.15 + 62·.10 + 76·.05 = 66.55 → 67
    expect(readiness.composite).toBe(67);
    expect(readiness.score).toBe(57);
    expect(readiness.band).toBe('moderate');
    expect(readiness.limitedBy.map((l) => l.key)).toEqual(['hrv']);
    // The 21-hour timer caps nothing under a composite of 67, but still postpones "100%".
    expect(readiness.forecast.limits.map((l) => l.key)).toEqual(['hrv', 'recovery']);
    expect(readiness.forecast.recoveredAt).toBe(Date.UTC(2026, 7, 18, 2, 42, 19));
    expect(readiness.drivers.length).toBe(6);
    expect(readiness.drivers.reduce((s, d) => s + d.contribution, 0)).toBe(67);
  });

  it('takes the LOWEST of two ceilings and names both, on the 2026-08-14 payload', () => {
    const readiness = computeReadiness({
      garmin: garminOf(TR_14_08, '2026-08-14'),
      recoveryMinutes: 3672,
      today: '2026-08-14'
    })!;
    // Composite over the five channels Garmin gave us plus our timer at 15.
    expect(readiness.limitedBy.map((l) => l.key)).toEqual(['recovery', 'load']);
    expect(readiness.score).toBe(15); // 61 h on the clock, below the load's 36
    expect(readiness.band).toBe('low');
  });

  it('never raises the score above its channels', () => {
    const tired = {
      garmin: garminOf(
        { ...TR_17_08, sleepScoreFactorPercent: 20, sleepHistoryFactorPercent: 20 },
        '2026-08-17'
      ),
      recoveryMinutes: 0
    };
    const readiness = computeReadiness(tired)!;
    expect(readiness.score).toBe(readiness.composite);
    expect(readiness.limitedBy).toEqual([]);
  });

  it('returns null below the channel minimum rather than guessing', () => {
    expect(computeReadiness({})).toBeNull();
    expect(computeReadiness({ recoveryMinutes: 100 })).toBeNull(); // one channel only
  });
});

describe('bandFor', () => {
  it('bands on the documented thresholds', () => {
    expect(bandFor(39)).toBe('low');
    expect(bandFor(40)).toBe('moderate');
    expect(bandFor(59)).toBe('moderate');
    expect(bandFor(60)).toBe('high');
    expect(bandFor(79)).toBe('high');
    expect(bandFor(80)).toBe('peak');
  });
});
