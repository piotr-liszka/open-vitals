import { describe, it, expect } from 'vitest';
import {
  TREND_WINDOW_DAYS,
  knownBestsFrom,
  trendCutoff,
  type MeasuredEffort,
  type ProjectedBest
} from './race-trend';

const measured = (over: Partial<MeasuredEffort> = {}): MeasuredEffort => ({
  key: '5k',
  durationS: 1500,
  actualM: 5004,
  day: '2026-06-01',
  ...over
});

const projected = (over: Partial<ProjectedBest> = {}): ProjectedBest => ({
  key: '5k',
  label: '5 km',
  meters: 5000,
  timeS: 1620,
  day: '2025-02-02',
  ...over
});

describe('trendCutoff', () => {
  it('reaches back one training block, from the day it is given', () => {
    expect(TREND_WINDOW_DAYS).toBe(90);
    expect(trendCutoff('2026-08-15')).toBe('2026-05-17');
  });

  it('crosses a year boundary without a raw Date in sight', () => {
    expect(trendCutoff('2026-02-01')).toBe('2025-11-03');
  });
});

describe('knownBestsFrom', () => {
  it('prefers a measured effort over the projection for the same distance', () => {
    const [best] = knownBestsFrom([measured()], [projected()]);
    expect(best).toEqual({
      metres: 5004,
      timeS: 1500,
      label: '5 km',
      day: '2026-06-01',
      basis: 'measured'
    });
  });

  it('prefers the measured effort even when the projection is numerically faster', () => {
    // The projection is arithmetic over a whole run; the effort is a thing that happened.
    const [best] = knownBestsFrom([measured({ durationS: 1700 })], [projected({ timeS: 1400 })]);
    expect(best).toMatchObject({ timeS: 1700, basis: 'measured' });
  });

  it('falls back per distance, so a half-backfilled account still gets a full set', () => {
    const bests = knownBestsFrom(
      [measured({ key: '5k' })],
      [projected({ key: '5k' }), projected({ key: '10k', label: '10 km', meters: 10_000, timeS: 3400 })]
    );
    expect(bests.map((b) => [b.label, b.basis])).toEqual([
      ['5 km', 'measured'],
      ['10 km', 'projected']
    ]);
  });

  it('keeps distances only the measured efforts know about', () => {
    const bests = knownBestsFrom([measured({ key: 'mile', actualM: 1612, durationS: 380 })], []);
    expect(bests).toEqual([
      { metres: 1612, timeS: 380, label: '1 mila', day: '2026-06-01', basis: 'measured' }
    ]);
  });

  it('keeps the fastest of several efforts for one distance', () => {
    const bests = knownBestsFrom(
      [measured({ durationS: 1500 }), measured({ durationS: 1440, day: '2026-07-07' })],
      []
    );
    expect(bests).toEqual([
      { metres: 5004, timeS: 1440, label: '5 km', day: '2026-07-07', basis: 'measured' }
    ]);
  });

  it('drops effort keys that are not standard distances', () => {
    expect(knownBestsFrom([measured({ key: 'not-a-distance' })], [])).toEqual([]);
  });

  it('ignores unusable pairs on either side', () => {
    expect(knownBestsFrom([measured({ durationS: 0 }), measured({ key: '1k', actualM: 0 })], [])).toEqual([]);
    expect(knownBestsFrom([], [projected({ timeS: 0 }), projected({ key: '1k', meters: 0 })])).toEqual([]);
  });

  it('returns sources shortest distance first', () => {
    const bests = knownBestsFrom(
      [
        measured({ key: '10k', actualM: 10_010, durationS: 3200 }),
        measured({ key: '1k', actualM: 1002, durationS: 240 })
      ],
      []
    );
    expect(bests.map((b) => b.metres)).toEqual([1002, 10_010]);
  });

  it('is empty when the athlete has neither efforts nor projections', () => {
    expect(knownBestsFrom([], [])).toEqual([]);
  });
});
