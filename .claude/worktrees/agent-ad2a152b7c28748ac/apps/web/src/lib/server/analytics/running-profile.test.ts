import { describe, it, expect } from 'vitest';
import {
  personalBests,
  weeklyMileage,
  runningTotals,
  paceSecPerKm,
  fmtPace,
  fmtDuration,
  mondayOf,
  type RunSummary
} from './running-profile';

function run(day: string, distanceM: number, durationS: number): RunSummary {
  return { activityId: `r-${day}`, day, distanceM, durationS, movingS: durationS };
}

describe('running-profile', () => {
  it('paceSecPerKm computes seconds per km', () => {
    expect(paceSecPerKm(1500, 5000)).toBe(300); // 25:00 for 5k → 5:00/km
    expect(paceSecPerKm(0, 5000)).toBeNull();
    expect(paceSecPerKm(300, null)).toBeNull();
  });

  it('personalBests picks the fastest projection per distance among covering runs', () => {
    const runs = [
      run('2026-08-01', 5000, 1500), // 5:00/km
      run('2026-08-08', 6000, 1680), // 4:40/km over 6k → faster projection for 5k
      run('2026-07-01', 3000, 900) // too short to cover 5k
    ];
    const bests = personalBests(runs);
    const fiveK = bests.find((b) => b.key === '5k')!;
    expect(fiveK.activityId).toBe('r-2026-08-08'); // the faster run wins
    expect(Math.round(fiveK.timeS)).toBe(1400); // 1680 * (5000/6000)
    // No 10k best (no run >= 10k).
    expect(bests.find((b) => b.key === '10k')).toBeUndefined();
    // 1k best exists (all cover 1k); fastest projection from the 4:40/km run.
    expect(bests.find((b) => b.key === '1k')).toBeDefined();
  });

  it('weeklyMileage sums km per ISO week', () => {
    const runs = [
      run('2026-08-04', 10000, 3000),
      run('2026-08-05', 5000, 1500),
      run('2026-07-28', 8000, 2400)
    ];
    const wk = weeklyMileage(runs, '2026-08-09', 3);
    expect(wk.find((w) => w.week === mondayOf('2026-08-04'))).toEqual({
      week: '2026-08-03',
      km: 15,
      runs: 2
    });
    expect(wk.find((w) => w.week === '2026-07-27')).toEqual({ week: '2026-07-27', km: 8, runs: 1 });
  });

  it('runningTotals aggregates distance/time/longest/avg pace', () => {
    const t = runningTotals([run('2026-08-01', 10000, 3000), run('2026-08-02', 5000, 1650)]);
    expect(t.runs).toBe(2);
    expect(t.totalKm).toBe(15);
    expect(t.longestKm).toBe(10);
    expect(t.totalTimeS).toBe(4650);
    expect(Math.round(t.avgPaceSecPerKm!)).toBe(310); // 4650 / 15
  });

  it('formats pace and duration', () => {
    expect(fmtPace(300)).toBe('5:00');
    expect(fmtPace(285)).toBe('4:45');
    expect(fmtPace(119.6)).toBe('2:00'); // carry: 59.6s must roll to the next minute, not "1:60"
    expect(fmtDuration(1400)).toBe('23:20');
    expect(fmtDuration(3725)).toBe('1:02:05');
  });
});
