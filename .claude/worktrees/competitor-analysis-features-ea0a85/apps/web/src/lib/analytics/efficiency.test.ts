import { describe, it, expect } from 'vitest';
import {
  COUPLED_LIMIT_PCT,
  MIN_HALF_SAMPLES,
  aerobicDecoupling,
  cardiacCost,
  cardiacCostStream,
  efficiencyFactor,
  monthlyEfficiency,
  powerEfficiencyFactor,
  type EfficiencySession
} from './efficiency';

const n = MIN_HALF_SAMPLES * 2;
const fill = (count: number, v: number): number[] => new Array<number>(count).fill(v);
/** First half at `a`, second half at `b`, each long enough to be reportable. */
const halves = (a: number, b: number, count = n): number[] => [...fill(count / 2, a), ...fill(count / 2, b)];

describe('aerobicDecoupling', () => {
  it('is zero for a perfectly steady effort', () => {
    const d = aerobicDecoupling(fill(n, 3.5), fill(n, 150));
    expect(d?.pct).toBe(0);
    expect(d?.coupled).toBe(true);
    expect(d?.basis).toBe('pace');
    expect(d?.samples).toBe(n / 2);
  });

  it('is positive when heart rate drifts up at the same pace', () => {
    // Same speed, HR 150 → 165: the second half costs more per beat.
    const d = aerobicDecoupling(fill(n, 3.5), halves(150, 165));
    expect(d?.pct).toBeCloseTo(9.1, 0);
    expect(d?.coupled).toBe(false);
  });

  it('is positive when pace falls at the same heart rate', () => {
    const d = aerobicDecoupling(halves(3.5, 3.15), fill(n, 150));
    expect(d?.pct).toBeCloseTo(10, 0);
    expect(d?.coupled).toBe(false);
  });

  it('is negative when the athlete started conservatively and sped up', () => {
    const d = aerobicDecoupling(halves(3.15, 3.5), fill(n, 150));
    expect(d?.pct).toBeLessThan(0);
  });

  it('calls a small drift coupled, right up to the limit', () => {
    const d = aerobicDecoupling(halves(100, 96), fill(n, 150), 'power');
    expect(d?.pct).toBe(4);
    expect(d?.coupled).toBe(true);
    expect(Math.abs(d!.pct)).toBeLessThanOrEqual(COUPLED_LIMIT_PCT);
  });

  it('keeps each half‘s ratio so a view can show the drift, not just score it', () => {
    const d = aerobicDecoupling(fill(n, 3.5), halves(150, 165));
    expect(d!.firstRatio).toBeGreaterThan(d!.secondRatio);
  });

  it('refuses a session too short for either half to mean anything', () => {
    expect(aerobicDecoupling(fill(20, 3.5), fill(20, 150))).toBeNull();
  });

  it('refuses a session with no streams at all', () => {
    expect(aerobicDecoupling(undefined, fill(n, 150))).toBeNull();
    expect(aerobicDecoupling(fill(n, 3.5), undefined)).toBeNull();
  });

  it('ignores standing samples rather than counting them as slow running', () => {
    // A long mid-session stop: speed 0 at a resting HR. Dropping those leaves a steady effort.
    const speed = [...fill(60, 3.5), ...fill(120, 0), ...fill(60, 3.5)];
    const hr = [...fill(60, 150), ...fill(120, 55), ...fill(60, 150)];
    const d = aerobicDecoupling(speed, hr);
    expect(d?.pct).toBe(0);
    expect(d?.samples).toBe(60);
  });

  it('ignores samples where the strap was not reading', () => {
    const speed = fill(n + 40, 3.5);
    const hr = [...fill(40, 20), ...fill(n, 150)];
    const d = aerobicDecoupling(speed, hr);
    expect(d?.samples).toBe(n / 2);
    expect(d?.pct).toBe(0);
  });

  it('tolerates a NaN in either stream', () => {
    // Padded past the minimum: dropping the two bad samples must not take either half below it.
    const speed = fill(n + 10, 3.5);
    speed[5] = Number.NaN;
    const hr = fill(n + 10, 150);
    hr[7] = Number.NaN;
    expect(aerobicDecoupling(speed, hr)?.pct).toBe(0);
  });

  it('counts a dropped sample against the minimum rather than filling it in', () => {
    // Exactly at the floor, then two samples are unusable → one half falls short and we say nothing.
    const speed = fill(n, 3.5);
    speed[5] = Number.NaN;
    speed[6] = Number.NaN;
    expect(aerobicDecoupling(speed, fill(n, 150))).toBeNull();
  });

  it('splits on the usable samples, so an odd count cannot skew the halves', () => {
    const d = aerobicDecoupling(fill(n + 1, 3.5), fill(n + 1, 150));
    expect(d?.samples).toBe(Math.floor((n + 1) / 2));
    expect(d?.pct).toBe(0);
  });

  it('labels a power-based reading as such', () => {
    expect(aerobicDecoupling(fill(n, 200), fill(n, 150), 'power')?.basis).toBe('power');
  });
});

describe('efficiencyFactor', () => {
  it('is metres per minute per bpm', () => {
    // 3 m/s = 180 m/min; at 150 bpm that is 1.2.
    expect(efficiencyFactor(3, 150)).toBe(1.2);
  });

  it('rises when the same pace costs fewer beats', () => {
    expect(efficiencyFactor(3, 140)!).toBeGreaterThan(efficiencyFactor(3, 150)!);
  });

  it('refuses inputs it cannot use', () => {
    expect(efficiencyFactor(null, 150)).toBeNull();
    expect(efficiencyFactor(3, null)).toBeNull();
    expect(efficiencyFactor(0, 150)).toBeNull();
    expect(efficiencyFactor(3, 40)).toBeNull(); // strap not reading
    expect(efficiencyFactor(Number.NaN, 150)).toBeNull();
  });
});

describe('powerEfficiencyFactor', () => {
  it('is watts per bpm', () => {
    expect(powerEfficiencyFactor(210, 150)).toBe(1.4);
  });

  it('refuses inputs it cannot use', () => {
    expect(powerEfficiencyFactor(null, 150)).toBeNull();
    expect(powerEfficiencyFactor(210, null)).toBeNull();
    expect(powerEfficiencyFactor(0, 150)).toBeNull();
  });
});

describe('cardiacCost', () => {
  it('is heartbeats per kilometre', () => {
    // 10 km in 3000 s (50 min) at 150 bpm = 7500 beats over 10 km = 750 beats/km.
    expect(cardiacCost(10_000, 3000, 150)).toBe(750);
  });

  it('falls as the athlete gets fitter over the same course', () => {
    expect(cardiacCost(10_000, 3000, 140)!).toBeLessThan(cardiacCost(10_000, 3000, 150)!);
  });

  it('refuses a distance too short to be dominated by anything but the start', () => {
    expect(cardiacCost(200, 60, 150)).toBeNull();
  });

  it('refuses inputs it cannot use', () => {
    expect(cardiacCost(null, 3000, 150)).toBeNull();
    expect(cardiacCost(10_000, null, 150)).toBeNull();
    expect(cardiacCost(10_000, 3000, null)).toBeNull();
    expect(cardiacCost(10_000, 0, 150)).toBeNull();
  });
});

describe('cardiacCostStream', () => {
  it('is beats per kilometre at every sample', () => {
    // 3 m/s at 150 bpm → 2.5 beats/s over 0.003 km/s → 833.3 beats/km.
    const s = cardiacCostStream([3, 3], [150, 150])!;
    expect(s[0]).toBeCloseTo(833.3, 0);
    expect(s).toHaveLength(2);
  });

  it('leaves a gap where the athlete was stopped or the strap was silent', () => {
    const s = cardiacCostStream([3, 0, 3], [150, 55, 150])!;
    expect(Number.isNaN(s[1]!)).toBe(true);
    expect(Number.isFinite(s[0]!)).toBe(true);
    expect(Number.isFinite(s[2]!)).toBe(true);
  });

  it('is undefined when either stream is missing or empty', () => {
    expect(cardiacCostStream(undefined, [150])).toBeUndefined();
    expect(cardiacCostStream([3], undefined)).toBeUndefined();
    expect(cardiacCostStream([], [])).toBeUndefined();
  });

  it('stops at the shorter of two mismatched streams', () => {
    expect(cardiacCostStream([3, 3, 3], [150])).toHaveLength(1);
  });
});

describe('monthlyEfficiency', () => {
  const session = (day: string, over: Partial<EfficiencySession> = {}): EfficiencySession => ({
    day,
    distanceM: 10_000,
    durationS: 3000, // 3.33 m/s
    avgHr: 150,
    ...over
  });
  const MONTHS = ['2026-06', '2026-07', '2026-08'];

  it('averages the sessions of each month onto the caller‘s lattice', () => {
    const rows = [session('2026-07-01'), session('2026-07-20'), session('2026-06-05')];
    const out = monthlyEfficiency(rows, MONTHS);
    expect(out.map((m) => m.month)).toEqual(MONTHS);
    expect(out[1]?.sessions).toBe(2);
    expect(out[1]?.ef).toBeCloseTo(1.333, 2);
    expect(out[1]?.cardiacCost).toBe(750);
  });

  it('leaves a month with no sessions NULL, not zero — a month off is not bad efficiency', () => {
    const out = monthlyEfficiency([session('2026-07-01')], MONTHS);
    expect(out[0]).toMatchObject({ month: '2026-06', ef: null, cardiacCost: null, sessions: 0 });
  });

  it('averages sessions unweighted, so one long run cannot define the month', () => {
    // A 30 km run at a worse EF and a 5 km run at a better one count equally.
    const rows = [
      session('2026-07-01', { distanceM: 30_000, durationS: 10_800, avgHr: 150 }), // 1.111
      session('2026-07-02', { distanceM: 5000, durationS: 1500, avgHr: 150 }) // 1.333
    ];
    const out = monthlyEfficiency(rows, ['2026-07']);
    expect(out[0]?.ef).toBeCloseTo((1.111 + 1.333) / 2, 2);
  });

  it('skips a session it cannot measure but keeps the rest of the month', () => {
    const rows = [session('2026-07-01'), session('2026-07-02', { avgHr: null })];
    const out = monthlyEfficiency(rows, ['2026-07']);
    expect(out[0]?.sessions).toBe(1);
    expect(out[0]?.ef).toBeCloseTo(1.333, 2);
  });

  it('ignores sessions outside the lattice', () => {
    const out = monthlyEfficiency([session('2024-01-01')], MONTHS);
    expect(out.every((m) => m.sessions === 0)).toBe(true);
  });

  it('returns nothing for an empty lattice', () => {
    expect(monthlyEfficiency([session('2026-07-01')], [])).toEqual([]);
  });
});
