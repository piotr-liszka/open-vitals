import { describe, it, expect } from 'vitest';
import { bestAverageForDuration, buildPowerProfile, type PowerActivity } from './power-profile';

describe('bestAverageForDuration', () => {
  it('finds the best sustained window', () => {
    // 10 samples: a 3s window peaks at [9,10,11] avg = 10.
    const power = [1, 2, 3, 4, 5, 9, 10, 11, 2, 1];
    expect(bestAverageForDuration(power, 3)).toBeCloseTo(10, 6);
  });
  it('returns null when the stream is shorter than the window', () => {
    expect(bestAverageForDuration([1, 2, 3], 5)).toBeNull();
  });
  it('equals the mean for a constant stream', () => {
    expect(bestAverageForDuration(new Array(60).fill(200), 5)).toBe(200);
  });
});

function ride(id: string, day: string, watts: number, len: number): PowerActivity {
  return { activityId: id, day, power: new Array(len).fill(watts) };
}

describe('buildPowerProfile', () => {
  it('degrades gracefully with no power', () => {
    const p = buildPowerProfile([{ activityId: 'x', day: '2026-01-01', power: null }], { weightKg: 70 });
    expect(p.hasPower).toBe(false);
    expect(p.bests).toEqual([]);
    expect(p.ftpWatts).toBeNull();
    expect(p.zones).toEqual([]);
    expect(p.radar).toEqual([]);
  });

  it('still exposes settings FTP + zones when there is no power', () => {
    const p = buildPowerProfile([{ activityId: 'x', day: '2026-01-01', power: null }], {
      weightKg: 50,
      ftpOverride: 200
    });
    expect(p.hasPower).toBe(false);
    expect(p.ftpWatts).toBe(200);
    expect(p.ftpSource).toBe('settings');
    expect(p.ftpWattsPerKg).toBe(4);
    expect(p.zones).toHaveLength(7);
  });

  it('aggregates all-time bests across activities with provenance', () => {
    const p = buildPowerProfile([ride('a', '2025-06-01', 300, 60), ride('b', '2026-06-01', 250, 3600)], {
      weightKg: 70
    });
    expect(p.hasPower).toBe(true);
    const best5 = p.bests.find((b) => b.durationS === 5)!;
    expect(best5.watts).toBe(300); // 'a' is the higher short-effort
    expect(best5.activityId).toBe('a');
    expect(best5.day).toBe('2025-06-01');
    const best1200 = p.bests.find((b) => b.durationS === 1200)!;
    expect(best1200.watts).toBe(250); // only 'b' is long enough
    expect(best1200.activityId).toBe('b');
  });

  it('estimates FTP as 0.95 × 20-min best and derives Coggan zones', () => {
    const p = buildPowerProfile([ride('b', '2026-06-01', 250, 3600)], { weightKg: 62.5 });
    expect(p.best20MinWatts).toBe(250);
    expect(p.ftpWatts).toBe(238); // round(0.95 * 250)
    expect(p.ftpSource).toBe('estimated');
    expect(p.ftpWattsPerKg).toBeCloseTo(3.81, 2);
    expect(p.zones).toHaveLength(7);
    // Z1 tops out at 55% FTP; top zone is open-ended.
    expect(p.zones[0]!.maxW).toBe(Math.round(0.55 * 238));
    expect(p.zones[6]!.maxW).toBeNull();
  });

  it('prefers a settings FTP over the estimate', () => {
    const p = buildPowerProfile([ride('b', '2026-06-01', 250, 3600)], { weightKg: 70, ftpOverride: 300 });
    expect(p.ftpWatts).toBe(300);
    expect(p.ftpSource).toBe('settings');
  });

  it('builds per-year curves + a five-axis rider radar with W/kg', () => {
    const p = buildPowerProfile([ride('a', '2025-06-01', 300, 3600), ride('b', '2026-06-01', 250, 3600)], {
      weightKg: 75
    });
    expect(p.years).toEqual([2026, 2025]);
    expect(p.yearCurves.map((c) => c.year)).toEqual([2026, 2025]);
    expect(p.radar).toHaveLength(5);
    const sprint = p.radar.find((a) => a.key === 'sprint')!;
    expect(sprint.watts).toBe(300);
    expect(sprint.wattsPerKg).toBe(4); // 300 / 75
  });

  it('leaves W/kg null when weight is unknown', () => {
    const p = buildPowerProfile([ride('a', '2026-01-01', 300, 60)], { weightKg: null });
    expect(p.bests[0]!.wattsPerKg).toBeNull();
    expect(p.radar.find((a) => a.key === 'sprint')!.wattsPerKg).toBeNull();
  });
});
