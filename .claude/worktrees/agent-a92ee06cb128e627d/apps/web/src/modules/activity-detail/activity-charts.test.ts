import { describe, it, expect } from 'vitest';
import {
  axisLabels,
  buildActivityCharts,
  buildChartSet,
  cumulativeDistance,
  elapsedSeconds,
  latticeOverAxis,
  sampleAt,
  streamLength,
  uniformLattice
} from './activity-charts';
import type { ActivityStreams } from './activity-detail.types';

const ramp = (n: number, f: (i: number) => number): number[] => Array.from({ length: n }, (_, i) => f(i));

describe('streamLength', () => {
  it('is the longest numeric stream', () => {
    expect(streamLength({ heartRate: [1, 2, 3], power: [1, 2] })).toBe(3);
  });

  it('is zero for an empty blob (laps alone are not samples)', () => {
    expect(streamLength({})).toBe(0);
    expect(streamLength({ laps: [{ index: 1 }] })).toBe(0);
  });
});

describe('elapsedSeconds', () => {
  it('uses the time stream when present', () => {
    expect(elapsedSeconds({ time: [0, 2, 4] }, 3)).toEqual([0, 2, 4]);
  });

  it('carries the previous value over a hole so the axis stays monotonic', () => {
    expect(elapsedSeconds({ time: [0, Number.NaN, 4] }, 3)).toEqual([0, 0, 4]);
  });

  it('falls back to the sample ordinal with no time stream', () => {
    expect(elapsedSeconds({ heartRate: [1, 2, 3] }, 3)).toEqual([0, 1, 2]);
  });
});

describe('cumulativeDistance', () => {
  it('integrates speed over time', () => {
    const streams: ActivityStreams = { time: [0, 1, 2, 3], speed: [0, 4, 4, 4] };
    const elapsed = elapsedSeconds(streams, 4);
    expect(cumulativeDistance(streams, elapsed)).toEqual([0, 4, 8, 12]);
  });

  it('is null without a speed stream — a distance axis is never guessed', () => {
    const streams: ActivityStreams = { time: [0, 1, 2] };
    expect(cumulativeDistance(streams, elapsedSeconds(streams, 3))).toBeNull();
  });

  it('is null when the athlete never moved', () => {
    const streams: ActivityStreams = { time: [0, 1, 2], speed: [0, 0, 0] };
    expect(cumulativeDistance(streams, elapsedSeconds(streams, 3))).toBeNull();
  });
});

describe('latticeOverAxis', () => {
  it('returns every sample when there are fewer than requested', () => {
    expect(latticeOverAxis([0, 1, 2], 10)).toEqual([0, 1, 2]);
  });

  it('spreads points evenly over the axis and always ends on the last sample', () => {
    const lattice = latticeOverAxis(
      ramp(100, (i) => i),
      5
    );
    expect(lattice[0]).toBe(0);
    expect(lattice[lattice.length - 1]).toBe(99);
    expect(lattice).toHaveLength(5);
  });

  it('spends no width on a stall — a stopped distance axis repeats the same sample', () => {
    // 10 samples: distance runs 0..4, then the athlete stands still at 4 for five samples.
    const axis = [0, 1, 2, 3, 4, 4, 4, 4, 4, 4];
    const lattice = latticeOverAxis(axis, 5);
    expect(lattice).toEqual([0, 1, 2, 3, 9]);
  });

  it('falls back to a uniform lattice when the axis has no span', () => {
    expect(latticeOverAxis([5, 5, 5, 5], 2)).toEqual([0, 3]);
  });
});

describe('uniformLattice', () => {
  it('spreads indices evenly, endpoints included', () => {
    expect(uniformLattice(10, 3)).toEqual([0, 5, 9]);
  });
});

describe('sampleAt', () => {
  it('reads a stream at the lattice, turning non-numbers into gaps', () => {
    const picked = sampleAt([1, 2, 3, 4], [0, 2, 9]);
    expect(picked[0]).toBe(1);
    expect(picked[1]).toBe(3);
    expect(Number.isNaN(picked[2]!)).toBe(true);
  });
});

describe('axisLabels', () => {
  it('labels a time axis as a clock', () => {
    expect(axisLabels('time', [0, 65, 3661], null, [0, 1, 2])).toEqual(['00:00', '01:05', '1:01:01']);
  });

  it('labels a distance axis in kilometres, Polish decimal comma', () => {
    expect(axisLabels('distance', [0, 1, 2], [0, 500, 2100], [0, 1, 2])).toEqual([
      '0,0 km',
      '0,5 km',
      '2,1 km'
    ]);
  });
});

describe('buildActivityCharts', () => {
  const indices = [0, 1, 2, 3];

  it('emits a chart only for streams the device actually recorded', () => {
    const charts = buildActivityCharts(
      { heartRate: [140, 150, 160, 170], time: [0, 1, 2, 3] },
      'run',
      indices
    );
    expect(charts.map((c) => c.key)).toEqual(['heartRate']);
    // Nothing for the running-dynamics pod this watch does not have.
    expect(charts.some((c) => c.key === 'groundContactTime')).toBe(false);
  });

  it('drops a stream with fewer than two real samples instead of drawing an empty frame', () => {
    const charts = buildActivityCharts(
      { heartRate: [140, Number.NaN, Number.NaN, Number.NaN] },
      'run',
      indices
    );
    expect(charts).toEqual([]);
  });

  it('charts pace for a run and speed for a ride, off the same speed stream', () => {
    const streams: ActivityStreams = { speed: [3, 3.5, 4, 4.5] };
    const run = buildActivityCharts(streams, 'run', indices).find((c) => c.key === 'pace');
    expect(run?.unit).toBe('min/km');
    expect(run?.kind).toBe('pace');
    expect(run?.values[0]).toBeCloseTo(1000 / 3, 6);

    const ride = buildActivityCharts(streams, 'ride', indices).find((c) => c.key === 'speed');
    expect(ride?.unit).toBe('km/h');
    expect(ride?.values[0]).toBeCloseTo(10.8, 6);
    expect(buildActivityCharts(streams, 'ride', indices).some((c) => c.key === 'pace')).toBe(false);
  });

  it('pairs stamina with its potential in one two-series chart', () => {
    const charts = buildActivityCharts(
      { stamina: [90, 80, 70, 60], staminaPotential: [95, 90, 85, 80] },
      'run',
      indices
    );
    const stamina = charts.find((c) => c.key === 'stamina');
    expect(stamina?.series?.map((s) => s.name)).toEqual(['Dostępna', 'Potencjalna']);
    expect(stamina?.group).toBe('physiology');
  });

  it('groups running dynamics apart from effort', () => {
    const charts = buildActivityCharts(
      {
        heartRate: [140, 150, 160, 170],
        groundContactBalance: [49, 50, 51, 50],
        elevation: [100, 110, 120, 130]
      },
      'run',
      indices
    );
    const byKey = Object.fromEntries(charts.map((c) => [c.key, c.group]));
    expect(byKey.heartRate).toBe('effort');
    expect(byKey.elevation).toBe('terrain');
    expect(byKey.groundContactBalance).toBe('dynamics');
  });
});

describe('buildChartSet', () => {
  it('is empty and inert for an activity with no streams', () => {
    const set = buildChartSet({}, 'run');
    expect(set.charts).toEqual([]);
    expect(set.canUseDistance).toBe(false);
    expect(set.labels).toEqual([]);
  });

  it('offers the distance axis only when a speed stream exists', () => {
    const withoutSpeed = buildChartSet({ heartRate: [140, 150, 160], time: [0, 1, 2] }, 'run');
    expect(withoutSpeed.canUseDistance).toBe(false);
    // Asking for distance anyway falls back to time rather than inventing an axis.
    expect(buildChartSet({ heartRate: [140, 150, 160], time: [0, 1, 2] }, 'run', 'distance').axis).toBe(
      'time'
    );

    const withSpeed = buildChartSet(
      { heartRate: [140, 150, 160], speed: [3, 3, 3], time: [0, 1, 2] },
      'run',
      'distance'
    );
    expect(withSpeed.canUseDistance).toBe(true);
    expect(withSpeed.axis).toBe('distance');
    expect(withSpeed.labels[0]).toBe('0,0 km');
  });

  it('decimates to the target point count and keeps every chart on the same lattice', () => {
    const n = 5000;
    const set = buildChartSet(
      {
        time: ramp(n, (i) => i),
        heartRate: ramp(n, (i) => 120 + (i % 40)),
        power: ramp(n, (i) => 200 + (i % 50))
      },
      'ride',
      'time',
      200
    );
    expect(set.indices).toHaveLength(200);
    expect(set.labels).toHaveLength(200);
    for (const chart of set.charts) expect(chart.values).toHaveLength(200);
    // Last lattice point is the end of the activity, not a truncated 4999th of the way.
    expect(set.elapsedS[set.elapsedS.length - 1]).toBe(n - 1);
  });
});
