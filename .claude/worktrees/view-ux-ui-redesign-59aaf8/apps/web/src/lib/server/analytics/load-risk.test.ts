import { describe, it, expect } from 'vitest';
import { ACWR_HIGH, ACWR_LOW, MIN_HISTORY_DAYS, RAMP_WINDOW_DAYS, bandFor, loadRisk } from './load-risk';
import type { DailyLoadPoint } from './training-load';

/**
 * A synthetic PMC: one entry per day with the CTL/ATL we want to test against. `ctlAt` lets a test
 * shape the fitness curve so the ramp rate is a known number.
 */
function series(
  days: number,
  opts: { ctl: number | ((i: number) => number); atl: number | ((i: number) => number) }
): DailyLoadPoint[] {
  return Array.from({ length: days }, (_, i) => {
    const ctl = typeof opts.ctl === 'function' ? opts.ctl(i) : opts.ctl;
    const atl = typeof opts.atl === 'function' ? opts.atl(i) : opts.atl;
    return { day: `2026-01-${String((i % 28) + 1).padStart(2, '0')}`, tss: 0, ctl, atl, tsb: ctl - atl };
  });
}

describe('loadRisk', () => {
  it('refuses to judge a history too short for CTL to have converged', () => {
    const risk = loadRisk(series(MIN_HISTORY_DAYS - 1, { ctl: 50, atl: 90 }));
    expect(risk.acwr).toBeNull();
    expect(risk.rampRatePerWeek).toBeNull();
    expect(risk.advice).toContain('Za mało historii');
    expect(risk.historyDays).toBe(MIN_HISTORY_DAYS - 1);
  });

  it('refuses an empty series rather than dividing by nothing', () => {
    const risk = loadRisk([]);
    expect(risk.acwr).toBeNull();
    expect(risk.historyDays).toBe(0);
  });

  it('refuses a series whose CTL is still zero', () => {
    expect(loadRisk(series(60, { ctl: 0, atl: 0 })).acwr).toBeNull();
  });

  it('is the ratio of the PMC‘s own acute and chronic load', () => {
    const risk = loadRisk(series(60, { ctl: 50, atl: 60 }));
    expect(risk.acwr).toBe(1.2);
  });

  it('calls a flat, matched load steady', () => {
    const risk = loadRisk(series(60, { ctl: 50, atl: 50 }));
    expect(risk.band).toBe('steady');
    expect(risk.acwr).toBe(1);
  });

  it('calls a week clear of the base overreaching', () => {
    const risk = loadRisk(series(60, { ctl: 50, atl: 70 })); // 1.4
    expect(risk.band).toBe('overreaching');
    expect(risk.advice).toContain('kontuzji przeciążeniowej');
  });

  it('calls a big jump a spike and says to back off', () => {
    const risk = loadRisk(series(60, { ctl: 50, atl: 90 })); // 1.8
    expect(risk.band).toBe('spike');
    expect(risk.advice).toContain('lżejszy tydzień');
  });

  it('measures the ramp rate in CTL points per week', () => {
    // CTL climbing 1 point a day → 7 a week.
    const risk = loadRisk(series(60, { ctl: (i) => 20 + i, atl: (i) => 20 + i }));
    expect(risk.rampRatePerWeek).toBe(7);
  });

  it('is negative when fitness is falling', () => {
    const risk = loadRisk(series(60, { ctl: (i) => 100 - i, atl: 50 }));
    expect(risk.rampRatePerWeek).toBe(-7);
  });

  it('smooths the ramp over a fortnight, not over one day', () => {
    // Flat for the whole window except a jump on the very last day.
    const risk = loadRisk(series(60, { ctl: (i) => (i === 59 ? 70 : 50), atl: 50 }));
    // 20 points spread over the window, not read as a 140/week explosion.
    expect(risk.rampRatePerWeek).toBe(round1((20 / RAMP_WINDOW_DAYS) * 7));
  });

  it('catches fitness being forced even when the ratio looks calm', () => {
    // ACWR 1.0 — inside the band — but CTL climbing 14 points a week.
    const risk = loadRisk(series(60, { ctl: (i) => 20 + i * 2, atl: (i) => 20 + i * 2 }));
    expect(risk.acwr).toBe(1);
    expect(risk.rampRatePerWeek).toBe(14);
    expect(risk.band).toBe('overreaching');
  });

  it('calls a gentle climb inside the band building', () => {
    const risk = loadRisk(series(60, { ctl: (i) => 40 + i * 0.3, atl: (i) => 42 + i * 0.3 }));
    expect(risk.band).toBe('building');
  });

  it('distinguishes detraining from merely doing less', () => {
    // Low ratio AND fitness falling fast → detraining.
    const falling = loadRisk(series(60, { ctl: (i) => 120 - i * 1.5, atl: 20 }));
    expect(falling.band).toBe('detraining');
    expect(falling.advice).toContain('cofa się szybciej');

    // Low ratio but fitness holding → an easy week, not detraining.
    const easyWeek = loadRisk(series(60, { ctl: 60, atl: 40 }));
    expect(easyWeek.acwr).toBeLessThan(ACWR_LOW);
    expect(easyWeek.band).toBe('steady');
  });

  it('reports how much history is behind the numbers', () => {
    expect(loadRisk(series(90, { ctl: 50, atl: 50 })).historyDays).toBe(90);
  });
});

describe('bandFor', () => {
  it('lets the ratio decide first', () => {
    expect(bandFor(1.9, 0)).toBe('spike');
    expect(bandFor(1.35, 0)).toBe('overreaching');
    expect(bandFor(ACWR_HIGH, 0)).toBe('steady');
  });

  it('lets the ramp rate only ever make the verdict worse, never better', () => {
    expect(bandFor(1.9, -20)).toBe('spike');
    expect(bandFor(1.0, 12)).toBe('overreaching');
  });

  it('treats the boundaries as inclusive of the safer side', () => {
    expect(bandFor(ACWR_LOW, 0)).toBe('steady');
    expect(bandFor(ACWR_LOW - 0.01, 0)).toBe('steady'); // low ratio, flat fitness
  });
});

function round1(v: number): number {
  return Math.round(v * 10) / 10;
}
