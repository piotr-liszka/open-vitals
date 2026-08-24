/**
 * `predictionHistory` (spec 087). The load-bearing claim is that every day is a REAL recomputation
 * through `predictRaces` — not an interpolation between records — so several of these tests call
 * `predictRaces` directly with the bests standing on a day and demand the same number back.
 */
import { describe, it, expect } from 'vitest';
import { predictRaces } from '$lib/analytics/race-predictor';
import { predictionHistory } from './race-history';
import { knownBestsFrom, type MeasuredEffort, type ProjectedBest } from './race-trend';
import { dayRange } from '$lib/date';

function effort(over: Partial<MeasuredEffort> = {}): MeasuredEffort {
  return { key: '10k', durationS: 2700, actualM: 10_010, day: '2026-01-05', ...over };
}

function projection(over: Partial<ProjectedBest> = {}): ProjectedBest {
  return { key: '10k', label: '10 km', meters: 10_000, timeS: 3000, day: '2026-01-05', ...over };
}

const WEEK = dayRange('2026-01-01', '2026-01-07');

describe('predictionHistory', () => {
  it('is null without a single measured effort — an empty chart explains nothing', () => {
    expect(predictionHistory({ days: WEEK, efforts: [], projections: [projection()] })).toBeNull();
    expect(predictionHistory({ days: WEEK, efforts: [], projections: [] })).toBeNull();
  });

  it('is null for an empty window', () => {
    expect(predictionHistory({ days: [], efforts: [effort()], projections: [] })).toBeNull();
  });

  it('leaves the days before the first effort as gaps, not zeros', () => {
    const history = predictionHistory({
      days: WEEK,
      efforts: [effort({ day: '2026-01-04' })],
      projections: []
    })!;
    const tenK = history.distances.find((d) => d.key === '10k')!;
    expect(history.days).toEqual(WEEK);
    expect(tenK.values.slice(0, 3)).toEqual([null, null, null]);
    expect(tenK.values.slice(3).every((v) => typeof v === 'number')).toBe(true);
  });

  it('steps on the day a record lands and stays flat between records', () => {
    const history = predictionHistory({
      days: WEEK,
      efforts: [
        effort({ day: '2026-01-01', durationS: 2700 }),
        effort({ day: '2026-01-05', durationS: 2500 })
      ],
      projections: []
    })!;
    const tenK = history.distances.find((d) => d.key === '10k')!;
    // Flat while the first record stands…
    expect(new Set(tenK.values.slice(0, 4))).toEqual(new Set([tenK.values[0]]));
    // …one step down on the day the second lands…
    expect(tenK.values[4]!).toBeLessThan(tenK.values[3]!);
    // …then flat again to the end of the window.
    expect(new Set(tenK.values.slice(4))).toEqual(new Set([tenK.values[4]]));
  });

  it('inherits a record set BEFORE the window — the line does not start blank', () => {
    const history = predictionHistory({
      days: WEEK,
      efforts: [effort({ day: '2020-06-01' })],
      projections: []
    })!;
    const tenK = history.distances.find((d) => d.key === '10k')!;
    expect(tenK.values.every((v) => v !== null)).toBe(true);
  });

  it('ignores an effort dated after the window', () => {
    const history = predictionHistory({
      days: WEEK,
      efforts: [
        effort({ day: '2026-01-02', durationS: 2700 }),
        effort({ day: '2026-06-01', durationS: 1800 })
      ],
      projections: []
    })!;
    const tenK = history.distances.find((d) => d.key === '10k')!;
    expect(tenK.values.at(-1)).toBe(tenK.values[1]);
  });

  it('a mid-window day equals predictRaces called directly with the bests standing that day', () => {
    const efforts = [
      effort({ key: '5k', durationS: 1200, actualM: 5005, day: '2026-01-02' }),
      effort({ key: '10k', durationS: 2600, actualM: 10_020, day: '2026-01-05' })
    ];
    const projections = [
      projection({ key: '5k', label: '5 km', meters: 5000, timeS: 1400, day: '2026-01-01' })
    ];
    const history = predictionHistory({ days: WEEK, efforts, projections })!;

    // 2026-01-04: the 5 km effort and the 5 km projection have landed, the 10 km one has NOT.
    const standing = knownBestsFrom(
      efforts.filter((e) => e.day <= '2026-01-04'),
      projections.filter((p) => p.day <= '2026-01-04')
    );
    const expected = predictRaces(standing);
    for (const p of expected) {
      const line = history.distances.find((d) => d.key === p.key);
      expect(line?.values[3]).toBe(p.riegelS);
    }

    // …and the same on the last day, once the 10 km record is in.
    const later = predictRaces(knownBestsFrom(efforts, projections));
    for (const p of later) {
      expect(history.distances.find((d) => d.key === p.key)?.values.at(-1)).toBe(p.riegelS);
    }
  });

  it('lets a measured effort override a projection exactly as knownBestsFrom does', () => {
    const day = '2026-01-03';
    // The projection is FASTER in raw seconds, and must still lose: measured beats projected.
    const efforts = [effort({ day, durationS: 2700, actualM: 10_000 })];
    const projections = [projection({ day: '2026-01-01', timeS: 2600 })];
    const history = predictionHistory({ days: WEEK, efforts, projections })!;
    const tenK = history.distances.find((d) => d.key === '10k')!;

    expect(tenK.values[1]).toBe(predictRaces(knownBestsFrom([], projections))[1]?.riegelS ?? null);
    expect(tenK.values.at(-1)).toBe(predictRaces(knownBestsFrom(efforts, projections))[1]?.riegelS ?? null);
    // The measured row is slower, so the line steps UP the day it lands — an honest regression, not
    // a silently better number.
    expect(tenK.values[2]!).toBeGreaterThan(tenK.values[1]!);
  });

  it('never lets a critical speed into the history — the line is Riegel only', () => {
    // A 400 m effort is 12× short of even the 5 km target, far past MAX_EXTRAPOLATION. `predictRaces`
    // WITH a critical speed would still emit every distance from the two-parameter model; without one
    // there is nothing to draw, and the section is absent rather than quietly showing a second model.
    const efforts = [{ key: '400m', durationS: 70, actualM: 402, day: '2026-01-01' }];
    expect(predictionHistory({ days: WEEK, efforts, projections: [] })).toBeNull();
    // Proof the emptiness is the missing critical speed and not a broken input.
    const withCs = predictRaces(knownBestsFrom(efforts, []), { csMps: 4.2, dPrimeM: 180 });
    expect(withCs.map((p) => p.key)).toEqual(['5k', '10k', 'half', 'marathon']);
    expect(withCs.every((p) => p.riegelS === null)).toBe(true);
  });

  it('drops a target that is null on every day rather than offering an empty chip', () => {
    const history = predictionHistory({
      days: WEEK,
      efforts: [effort({ key: '5k', durationS: 1200, actualM: 5002, day: '2026-01-01' })],
      projections: []
    })!;
    // A 5 km best reaches 5 km (1×) and 10 km (2×). The half is 4.2× away and the marathon 8.4× —
    // both past MAX_EXTRAPOLATION — so they are absent rather than shipped as an all-gap chip.
    expect(history.distances.map((d) => d.key)).toEqual(['5k', '10k']);
    for (const d of history.distances) expect(d.values.some((v) => v !== null)).toBe(true);
  });

  describe('net change', () => {
    it('is positive for an improving distance (faster now)', () => {
      const history = predictionHistory({
        days: WEEK,
        efforts: [
          effort({ day: '2026-01-01', durationS: 2700 }),
          effort({ day: '2026-01-05', durationS: 2500 })
        ],
        projections: []
      })!;
      const tenK = history.distances.find((d) => d.key === '10k')!;
      expect(tenK.netChangeS).toBe(tenK.values[0]! - tenK.values.at(-1)!);
      expect(tenK.netChangeS!).toBeGreaterThan(0);
    });

    it('is exactly 0 for a record that has not moved', () => {
      const history = predictionHistory({
        days: WEEK,
        efforts: [effort({ day: '2025-11-01' })],
        projections: []
      })!;
      expect(history.distances.find((d) => d.key === '10k')?.netChangeS).toBe(0);
    });

    it('is null when the window holds a single day with a basis — one point is not a change', () => {
      const history = predictionHistory({
        days: WEEK,
        efforts: [effort({ day: '2026-01-07' })],
        projections: []
      })!;
      expect(history.distances.find((d) => d.key === '10k')?.netChangeS).toBeNull();
    });
  });

  it('carries the bests forward instead of re-scanning: order of the input does not matter', () => {
    const efforts = [
      effort({ day: '2026-01-05', durationS: 2500 }),
      effort({ day: '2026-01-01', durationS: 2700 }),
      effort({ day: '2026-01-03', durationS: 2600 })
    ];
    const forwards = predictionHistory({ days: WEEK, efforts, projections: [] });
    const backwards = predictionHistory({ days: WEEK, efforts: [...efforts].reverse(), projections: [] });
    expect(backwards).toEqual(forwards);
  });

  it('drops rows with a non-positive time or distance rather than dividing by them', () => {
    const history = predictionHistory({
      days: WEEK,
      efforts: [effort({ day: '2026-01-01', durationS: 0 }), effort({ day: '2026-01-04' })],
      projections: [projection({ day: '2026-01-01', meters: 0 })]
    })!;
    const tenK = history.distances.find((d) => d.key === '10k')!;
    expect(tenK.values.slice(0, 3)).toEqual([null, null, null]);
  });
});
