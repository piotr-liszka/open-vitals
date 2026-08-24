import { describe, it, expect } from 'vitest';
import {
  ewma,
  normalizedPower,
  powerTss,
  hrTrimp,
  activityLoad,
  bandForTsb,
  buildTrainingLoad,
  type LoadActivity
} from './training-load';

describe('ewma', () => {
  it('matches hand-computed EWMA for a constant TSS series (42d & 7d)', () => {
    // alpha42 = 1 - e^(-1/42) ≈ 0.0235283; alpha7 = 1 - e^(-1/7) ≈ 0.1331222
    const ctl = ewma([100, 100, 100], 42);
    expect(ctl[0]).toBeCloseTo(2.35, 2);
    expect(ctl[1]).toBeCloseTo(4.65, 2);
    expect(ctl[2]).toBeCloseTo(6.89, 2);

    const atl = ewma([100, 100, 100], 7);
    expect(atl[0]).toBeCloseTo(13.31, 2);
    expect(atl[1]).toBeCloseTo(24.85, 2);
    expect(atl[2]).toBeCloseTo(34.86, 2);
  });

  it('returns empty for empty input', () => {
    expect(ewma([], 42)).toEqual([]);
  });
});

describe('normalizedPower', () => {
  it('equals the mean for constant power', () => {
    expect(normalizedPower(new Array(60).fill(200))).toBeCloseTo(200, 6);
  });
  it('is null for empty streams', () => {
    expect(normalizedPower([])).toBeNull();
  });
});

describe('powerTss', () => {
  it('gives 100 for one hour at FTP', () => {
    expect(powerTss(250, 250, 3600)).toBeCloseTo(100, 6);
  });
  it('scales with the square of intensity', () => {
    // NP = 0.8·FTP for 1h → IF²·1·100 = 64
    expect(powerTss(200, 250, 3600)).toBeCloseTo(64, 6);
  });
});

describe('hrTrimp', () => {
  it('is positive and monotic in duration', () => {
    const a = hrTrimp(1800, 150, 60, 190);
    const b = hrTrimp(3600, 150, 60, 190);
    expect(a).toBeGreaterThan(0);
    expect(b).toBeGreaterThan(a);
  });
  it('is zero when avg HR is at or below rest', () => {
    expect(hrTrimp(3600, 60, 60, 190)).toBe(0);
  });
});

describe('activityLoad fallback chain', () => {
  const base: LoadActivity = {
    day: '2026-01-01',
    durationS: 3600,
    trainingLoad: null,
    avgHr: null,
    maxHr: null,
    power: null
  };

  it('prefers Garmin training load', () => {
    const r = activityLoad({ ...base, trainingLoad: 80 }, { ftpWatts: 250, endDay: '2026-01-01' });
    expect(r).toEqual({ tss: 80, method: 'garmin' });
  });

  it('falls back to power TSS when no training load', () => {
    const r = activityLoad(
      { ...base, power: new Array(3600).fill(250) },
      { ftpWatts: 250, endDay: '2026-01-01' }
    );
    expect(r.method).toBe('power');
    expect(r.tss).toBeCloseTo(100, 3);
  });

  it('falls back to HR TRIMP when no power', () => {
    const r = activityLoad({ ...base, avgHr: 150, maxHr: 190 }, { ftpWatts: null, endDay: '2026-01-01' });
    expect(r.method).toBe('hr');
    expect(r.tss).toBeGreaterThan(0);
  });

  it('yields no load with nothing usable', () => {
    expect(activityLoad(base, { ftpWatts: null, endDay: '2026-01-01' })).toEqual({ tss: 0, method: 'none' });
  });
});

describe('bandForTsb', () => {
  it('maps TSB to the PWRX bands at the boundaries', () => {
    expect(bandForTsb(30)).toBe('fresh');
    expect(bandForTsb(25)).toBe('optimal');
    expect(bandForTsb(5)).toBe('optimal');
    expect(bandForTsb(0)).toBe('neutral');
    expect(bandForTsb(-10)).toBe('neutral');
    expect(bandForTsb(-11)).toBe('fatigued');
    expect(bandForTsb(-30)).toBe('fatigued');
    expect(bandForTsb(-31)).toBe('very-fatigued');
  });
});

describe('buildTrainingLoad', () => {
  it('returns an empty, safe result with no activities', () => {
    const r = buildTrainingLoad([], { ftpWatts: 250, endDay: '2026-08-01' });
    expect(r.hasData).toBe(false);
    expect(r.series).toEqual([]);
    expect(r.band).toBe('neutral');
    expect(r.recommendation).toContain('Za mało danych');
  });

  it('builds a gap-filled series, decaying to the end day, with prev-day TSB', () => {
    const acts: LoadActivity[] = [
      { day: '2026-01-01', durationS: 3600, trainingLoad: 100, avgHr: null, maxHr: null, power: null },
      { day: '2026-01-02', durationS: 3600, trainingLoad: 100, avgHr: null, maxHr: null, power: null }
    ];
    // End three days after the last activity → two rest days appended.
    const r = buildTrainingLoad(acts, { ftpWatts: null, endDay: '2026-01-04' });
    expect(r.hasData).toBe(true);
    expect(r.series.map((p) => p.day)).toEqual(['2026-01-01', '2026-01-02', '2026-01-03', '2026-01-04']);
    expect(r.series.map((p) => p.tss)).toEqual([100, 100, 0, 0]);

    // Day 0 CTL from constant EWMA seed.
    expect(r.series[0]!.ctl).toBeCloseTo(2.35, 2);
    expect(r.series[1]!.ctl).toBeCloseTo(4.65, 2);
    // TSB on day 2 = CTL(day1) - ATL(day1).
    expect(r.series[2]!.tsb).toBeCloseTo(r.series[1]!.ctl - r.series[1]!.atl, 6);
    // Latest snapshot equals the last point.
    expect(r.tsb).toBeCloseTo(r.series[3]!.tsb, 6);
    expect(r.band).toBe(bandForTsb(r.tsb));
  });

  it('sums multiple activities on the same day', () => {
    const acts: LoadActivity[] = [
      { day: '2026-02-01', durationS: 1800, trainingLoad: 40, avgHr: null, maxHr: null, power: null },
      { day: '2026-02-01', durationS: 1800, trainingLoad: 30, avgHr: null, maxHr: null, power: null }
    ];
    const r = buildTrainingLoad(acts, { ftpWatts: null, endDay: '2026-02-01' });
    expect(r.series).toHaveLength(1);
    expect(r.series[0]!.tss).toBe(70);
  });
});
