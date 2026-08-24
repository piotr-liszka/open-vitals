import { describe, it, expect } from 'vitest';
import {
  estimateFtpFromCurve,
  hrZones,
  intensityFactor,
  meanMaxCurve,
  normalizedPower,
  powerZones,
  sampleIntervalS,
  totalWorkKj,
  trainingStressScore
} from './activity-power';

describe('sampleIntervalS', () => {
  it('defaults to 1 Hz without a usable time stream', () => {
    expect(sampleIntervalS()).toBe(1);
    expect(sampleIntervalS([5])).toBe(1);
  });
  it('infers the median positive interval', () => {
    expect(sampleIntervalS([0, 10, 20, 30])).toBe(10);
  });
});

describe('normalizedPower', () => {
  it('equals the constant for a steady effort (rolling avg is flat)', () => {
    const power = new Array(60).fill(200);
    expect(normalizedPower(power)).toBe(200);
  });
  it('collapses to the 4th-power mean when the window is a single sample', () => {
    // dt = 30 s → 30/dt = 1 sample window → NP = (mean of p^4)^0.25 over raw samples.
    const power = [100, 300];
    const time = [0, 30];
    const expected = Math.round(((100 ** 4 + 300 ** 4) / 2) ** 0.25); // ≈ 253
    expect(normalizedPower(power, time)).toBe(expected);
    expect(expected).toBe(253);
  });
  it('degrades to null with no power', () => {
    expect(normalizedPower(undefined)).toBeNull();
    expect(normalizedPower([])).toBeNull();
  });
});

describe('intensityFactor', () => {
  it('is NP / FTP rounded to two decimals', () => {
    expect(intensityFactor(200, 200)).toBe(1);
    expect(intensityFactor(190, 200)).toBe(0.95);
  });
  it('degrades to null when NP or FTP is missing', () => {
    expect(intensityFactor(null, 200)).toBeNull();
    expect(intensityFactor(200, null)).toBeNull();
    expect(intensityFactor(200, 0)).toBeNull();
  });
});

describe('trainingStressScore', () => {
  it('is 100 for one hour at FTP', () => {
    expect(trainingStressScore(3600, 200, 200)).toBe(100);
  });
  it('scales with the square of intensity', () => {
    // NP = FTP·0.5 for 3600 s → TSS = 100 · 0.5^2 = 25
    expect(trainingStressScore(3600, 100, 200)).toBe(25);
  });
  it('degrades to null when inputs are missing', () => {
    expect(trainingStressScore(null, 200, 200)).toBeNull();
    expect(trainingStressScore(3600, null, 200)).toBeNull();
    expect(trainingStressScore(3600, 200, null)).toBeNull();
  });
});

describe('totalWorkKj', () => {
  it('integrates power over time', () => {
    // 1000 W for 10 samples at 1 Hz = 10 kJ.
    expect(totalWorkKj(new Array(10).fill(1000))).toBe(10);
  });
  it('degrades to null with no power', () => {
    expect(totalWorkKj([])).toBeNull();
  });
});

describe('meanMaxCurve', () => {
  it('finds the best sliding-window average per duration', () => {
    const power = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]; // 10 samples @ 1 Hz
    const curve = meanMaxCurve(power);
    // Only 5 s and 10 s windows fit in 10 samples; longer durations are omitted.
    expect(curve.map((c) => c.durationS)).toEqual([5, 10]);
    expect(curve.find((c) => c.durationS === 5)?.watts).toBe(8); // best 5 = (6+7+8+9+10)/5
    expect(curve.find((c) => c.durationS === 10)?.watts).toBe(6); // all 10 = 5.5 → 6
  });
  it('degrades to an empty curve with no power', () => {
    expect(meanMaxCurve(undefined)).toEqual([]);
  });
});

describe('estimateFtpFromCurve', () => {
  it('is 95% of the 20-minute best', () => {
    expect(estimateFtpFromCurve([{ durationS: 1200, watts: 300 }])).toBe(285);
  });
  it('is null when there is no 20-minute point', () => {
    expect(estimateFtpFromCurve([{ durationS: 300, watts: 300 }])).toBeNull();
  });
});

describe('powerZones', () => {
  it('buckets one second into each Coggan zone', () => {
    const ftp = 200;
    // 50%, 65%, 85%, 100%, 115%, 140%, 160% of FTP → Z1..Z7, one sample (1 s) each.
    const power = [100, 130, 170, 200, 230, 280, 320];
    const zones = powerZones(power, ftp);
    expect(zones.map((z) => z.zone)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(zones.every((z) => z.seconds === 1)).toBe(true);
    expect(zones[0]?.pct).toBe(14.3); // 1/7
  });
  it('degrades to empty without power or FTP', () => {
    expect(powerZones([], 200)).toEqual([]);
    expect(powerZones([100], null)).toEqual([]);
  });
});

describe('hrZones', () => {
  it('buckets samples into five %maxHR bands', () => {
    const maxHr = 200;
    // 50%, 65%, 75%, 85%, 95% → Z1..Z5.
    const hr = [100, 130, 150, 170, 190];
    const zones = hrZones(hr, maxHr);
    expect(zones.map((z) => z.zone)).toEqual([1, 2, 3, 4, 5]);
    expect(zones.every((z) => z.seconds === 1)).toBe(true);
    expect(zones[0]?.pct).toBe(20);
  });
  it('degrades to empty without HR or maxHR', () => {
    expect(hrZones([], 200)).toEqual([]);
    expect(hrZones([120], null)).toEqual([]);
  });
});
