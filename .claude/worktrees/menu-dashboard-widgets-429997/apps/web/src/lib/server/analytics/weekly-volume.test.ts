import { describe, it, expect } from 'vitest';
import { weekLattice, weeklyVolume, weeklyWindowStart, type WeeklyActivity } from './weekly-volume';
import type { SportGroup } from '$lib/sport-labels';

/** 2026-08-12 is a Wednesday; its ISO week starts Monday 2026-08-10. */
const TODAY = '2026-08-12';
const THIS_MONDAY = '2026-08-10';

function act(day: string, over: Partial<WeeklyActivity> = {}): WeeklyActivity {
  return {
    day,
    group: 'run',
    distanceM: 10_000,
    durationS: 3_000,
    elevationGainM: 100,
    ...over
  };
}

describe('weekLattice', () => {
  it('returns exactly `weeks` Mondays, oldest first, ending with the current week', () => {
    const weeks = weekLattice(TODAY, 12);
    expect(weeks).toHaveLength(12);
    expect(weeks[11]).toBe(THIS_MONDAY);
    expect(weeks[0]).toBe('2026-05-25');
    // Every entry is a Monday exactly 7 days after the previous one.
    for (let i = 1; i < weeks.length; i++) {
      expect(Date.parse(`${weeks[i]}T00:00:00Z`) - Date.parse(`${weeks[i - 1]}T00:00:00Z`)).toBe(
        7 * 86_400_000
      );
    }
  });

  it('treats a Monday as the START of its week, not the end of the previous one', () => {
    expect(weekLattice('2026-08-10', 1)).toEqual(['2026-08-10']);
    // Sunday belongs to the week that began six days earlier.
    expect(weekLattice('2026-08-09', 1)).toEqual(['2026-08-03']);
  });

  it('degrades to an empty lattice rather than throwing on a nonsense width', () => {
    expect(weekLattice(TODAY, 0)).toEqual([]);
    expect(weekLattice(TODAY, -4)).toEqual([]);
  });
});

describe('weeklyWindowStart', () => {
  it('is the Monday of the oldest week — the store read’s lower bound', () => {
    expect(weeklyWindowStart(TODAY, 12)).toBe('2026-05-25');
    expect(weeklyWindowStart(TODAY, 1)).toBe(THIS_MONDAY);
  });
});

describe('weeklyVolume', () => {
  it('keeps every bucket: a week without training is 0, not missing', () => {
    const weeks = weeklyVolume([act('2026-08-11')], { today: TODAY, weeks: 12 });
    expect(weeks).toHaveLength(12);
    expect(weeks.slice(0, 11).every((w) => w.activities === 0 && w.distanceM === 0)).toBe(true);
    expect(weeks[11]?.distanceM).toBe(10_000);
  });

  it('sums distance, duration and elevation into the week each day belongs to', () => {
    const weeks = weeklyVolume(
      [
        act('2026-08-10', { distanceM: 12_000, durationS: 3_600, elevationGainM: 150 }),
        act('2026-08-12', { distanceM: 8_000, durationS: 2_400, elevationGainM: 50 }),
        // Sunday of the PREVIOUS week — must not land in the current bucket.
        act('2026-08-09', { distanceM: 21_000, durationS: 7_200, elevationGainM: 300 })
      ],
      { today: TODAY, weeks: 3 }
    );

    expect(weeks.map((w) => w.week)).toEqual(['2026-07-27', '2026-08-03', THIS_MONDAY]);
    expect(weeks[2]).toMatchObject({
      activities: 2,
      distanceM: 20_000,
      durationS: 6_000,
      elevationGainM: 200
    });
    expect(weeks[1]).toMatchObject({ activities: 1, distanceM: 21_000, elevationGainM: 300 });
  });

  it('marks ONLY the current week partial and counts the days lived through', () => {
    const weeks = weeklyVolume([], { today: TODAY, weeks: 4 });
    expect(weeks.filter((w) => w.partial)).toHaveLength(1);
    expect(weeks[3]).toMatchObject({ week: THIS_MONDAY, partial: true, daysElapsed: 3 });
    expect(weeks.slice(0, 3).every((w) => !w.partial && w.daysElapsed === 7)).toBe(true);
  });

  it('counts a Monday as one day elapsed and a Sunday as seven', () => {
    expect(weeklyVolume([], { today: '2026-08-10', weeks: 1 })[0]?.daysElapsed).toBe(1);
    expect(weeklyVolume([], { today: '2026-08-16', weeks: 1 })[0]?.daysElapsed).toBe(7);
  });

  it('splits per sport family without leaking one family’s metres into another', () => {
    const activities = [
      act('2026-08-11', { group: 'run', distanceM: 10_000, durationS: 3_000, elevationGainM: 60 }),
      act('2026-08-11', { group: 'ride', distanceM: 60_000, durationS: 7_200, elevationGainM: 800 }),
      act('2026-08-12', { group: 'walk', distanceM: 4_000, durationS: 2_700, elevationGainM: 20 })
    ];

    const runs = weeklyVolume(activities, { today: TODAY, weeks: 1, group: 'run' });
    const rides = weeklyVolume(activities, { today: TODAY, weeks: 1, group: 'ride' });
    const walks = weeklyVolume(activities, { today: TODAY, weeks: 1, group: 'walk' });
    const all = weeklyVolume(activities, { today: TODAY, weeks: 1 });

    expect(runs[0]).toMatchObject({ activities: 1, distanceM: 10_000, elevationGainM: 60 });
    expect(rides[0]).toMatchObject({ activities: 1, distanceM: 60_000, elevationGainM: 800 });
    expect(walks[0]).toMatchObject({ activities: 1, distanceM: 4_000, durationS: 2_700 });
    // Omitting the family aggregates all of them.
    expect(all[0]).toMatchObject({ activities: 3, distanceM: 74_000, elevationGainM: 880 });
  });

  it('treats a missing distance/duration/elevation as zero, not NaN', () => {
    const weeks = weeklyVolume(
      [act('2026-08-11', { distanceM: null, durationS: null, elevationGainM: null })],
      { today: TODAY, weeks: 1 }
    );
    expect(weeks[0]).toMatchObject({ activities: 1, distanceM: 0, durationS: 0, elevationGainM: 0 });
  });

  it('ignores activities outside the window and rows with an unusable day', () => {
    const weeks = weeklyVolume(
      [
        act('2026-01-05'), // long before the window
        act('not-a-day'),
        act('2026-02-30'), // syntactically fine, not a real date
        act('2026-08-11')
      ],
      { today: TODAY, weeks: 12 }
    );
    expect(weeks.reduce((n, w) => n + w.activities, 0)).toBe(1);
  });

  it('ignores an unknown family filter instead of inventing buckets', () => {
    const weeks = weeklyVolume([act('2026-08-11')], {
      today: TODAY,
      weeks: 2,
      group: 'swim' as SportGroup
    });
    expect(weeks.map((w) => w.activities)).toEqual([0, 0]);
  });
});
