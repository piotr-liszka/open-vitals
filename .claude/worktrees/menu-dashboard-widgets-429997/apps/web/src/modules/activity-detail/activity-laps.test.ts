import { describe, it, expect } from 'vitest';
import { buildLapTable, buildSplitSummary, lapPaceSecPerKm, lapSpeedKmh } from './activity-laps';
import type { ActivityLap } from './activity-detail.types';

const lap = (over: Partial<ActivityLap> & { index: number }): ActivityLap => over;

describe('lapPaceSecPerKm / lapSpeedKmh', () => {
  it('prefers Garmin’s own average speed', () => {
    expect(lapPaceSecPerKm(lap({ index: 1, avgSpeedMps: 4 }))).toBeCloseTo(250, 6);
    expect(lapSpeedKmh(lap({ index: 1, avgSpeedMps: 4 }))).toBeCloseTo(14.4, 6);
  });

  it('falls back to distance over time', () => {
    expect(lapPaceSecPerKm(lap({ index: 1, distanceM: 1000, durationS: 300 }))).toBe(300);
    expect(lapSpeedKmh(lap({ index: 1, distanceM: 1000, durationS: 300 }))).toBeCloseTo(12, 6);
  });

  it('is null when the lap carries neither', () => {
    expect(lapPaceSecPerKm(lap({ index: 1 }))).toBeNull();
    expect(lapSpeedKmh(lap({ index: 1 }))).toBeNull();
  });
});

describe('buildLapTable', () => {
  it('is null when a table would say nothing the summary does not', () => {
    expect(buildLapTable([], 'run')).toBeNull();
    expect(buildLapTable([lap({ index: 1, distanceM: 5000 })], 'run')).toBeNull();
  });

  it('keeps only the columns at least one lap filled in', () => {
    const table = buildLapTable(
      [
        lap({ index: 1, distanceM: 1000, durationS: 300, avgHr: 150 }),
        lap({ index: 2, distanceM: 1000, durationS: 290, avgHr: 158 })
      ],
      'run'
    );
    expect(table?.columns.map((c) => c.key)).toEqual(['index', 'distance', 'duration', 'pace', 'avgHr']);
    // No power meter, no watts column — and no empty elevation column either.
    expect(table?.columns.some((c) => c.key === 'avgPower')).toBe(false);
    expect(table?.columns.some((c) => c.key === 'elevation')).toBe(false);
  });

  it('formats a run in minutes per kilometre and a ride in km/h', () => {
    const laps = [
      lap({ index: 1, distanceM: 1000, durationS: 300 }),
      lap({ index: 2, distanceM: 1000, durationS: 300 })
    ];
    const run = buildLapTable(laps, 'run');
    expect(run?.columns.some((c) => c.key === 'pace')).toBe(true);
    expect(run?.rows[0]?.cells[3]).toBe('5:00 /km');

    const ride = buildLapTable(laps, 'ride');
    expect(ride?.columns.some((c) => c.key === 'speed')).toBe(true);
    expect(ride?.rows[0]?.cells[3]).toBe('12 km/h');
  });

  it('leaves a missing cell null so the row renders a dash, not a zero', () => {
    const table = buildLapTable(
      [
        lap({ index: 1, distanceM: 1000, durationS: 300, avgHr: 150 }),
        lap({ index: 2, distanceM: 1000, durationS: 300 })
      ],
      'run'
    );
    const hrColumn = table!.columns.findIndex((c) => c.key === 'avgHr');
    expect(table?.rows[0]?.cells[hrColumn]).toBe('150 bpm');
    expect(table?.rows[1]?.cells[hrColumn]).toBeNull();
  });
});

describe('buildSplitSummary', () => {
  it('aggregates per class, longest first, keeping Garmin’s stretch count', () => {
    const summary = buildSplitSummary([
      { index: 1, type: 'RWD_WALK', durationS: 140, count: 3, distanceM: 200 },
      { index: 2, type: 'RWD_RUN', durationS: 2800, count: 4, distanceM: 8000 },
      { index: 3, type: 'RWD_STAND', durationS: 60 }
    ]);
    expect(summary.map((s) => s.key)).toEqual(['RWD_RUN', 'RWD_WALK', 'RWD_STAND']);
    expect(summary[0]?.label).toBe('Bieg');
    expect(summary[0]?.count).toBe(4);
    expect(summary[0]?.paceSecPerKm).toBe(350);
    // Standing time has no distance, so it gets no invented pace.
    expect(summary[2]?.paceSecPerKm).toBeNull();
    expect(summary[2]?.count).toBeNull();
  });

  it('folds repeated rows of one class together', () => {
    const summary = buildSplitSummary([
      { index: 1, type: 'INTERVAL_ACTIVE', durationS: 120, count: 1 },
      { index: 2, type: 'INTERVAL_ACTIVE', durationS: 180, count: 1 }
    ]);
    expect(summary).toHaveLength(1);
    expect(summary[0]?.seconds).toBe(300);
    expect(summary[0]?.count).toBe(2);
  });

  it('ignores rows with no usable duration', () => {
    expect(buildSplitSummary([{ index: 1, type: 'RWD_RUN' }])).toEqual([]);
    expect(buildSplitSummary([])).toEqual([]);
  });
});
