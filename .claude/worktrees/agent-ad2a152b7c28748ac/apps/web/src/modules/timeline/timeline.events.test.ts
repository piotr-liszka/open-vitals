/**
 * Unit tests for the pure timeline engine (spec 022): formatting, per-sport headline stats,
 * importance ranking, milestone detection and the collapse/chronology split.
 */
import { describe, it, expect } from 'vitest';
import {
  IMPORTANCE,
  activityImportance,
  activityStats,
  buildActivityEvents,
  buildHealthEvents,
  buildMilestoneEvents,
  buildTimeline,
  classifySignal,
  compareChronological,
  fmtDistance,
  fmtHm,
  isStreakMilestone,
  isUsableSignal,
  localDayOf,
  localTimeOf,
  rank,
  streakLengths,
  type TimelineActivityInput
} from './timeline.events';
import { createTranslator } from '$lib/i18n';

const t = createTranslator('pl');
import type { HealthSignalInput, TimelineEvent } from './timeline.types';

const FROM = '2026-07-25';
const TO = '2026-08-07';

function act(over: Partial<TimelineActivityInput> & { activityId: string }): TimelineActivityInput {
  return {
    sport: 'cycling',
    name: null,
    startTimeLocal: '2026-08-05 09:00:00',
    distanceM: 30_000,
    durationS: 3600,
    movingS: 3600,
    elevationGainM: 120,
    avgHr: 140,
    avgPower: 200,
    calories: 600,
    trainingLoad: 90,
    ...over
  };
}

function signal(over: Partial<HealthSignalInput> = {}): HealthSignalInput {
  return {
    key: 'hrv',
    label: 'HRV',
    accent: 'green',
    date: '2026-08-04',
    value: 38,
    z: -2.4,
    direction: 'down',
    severity: 'moderate',
    ...over
  };
}

describe('formatting', () => {
  it('renders distance in km above a kilometre and in metres below it', () => {
    expect(fmtDistance('pl', 18_400)).toBe('18,4 km');
    expect(fmtDistance('pl', 640)).toBe('640 m');
    expect(fmtDistance('pl', 0)).toBeNull();
    expect(fmtDistance('pl', null)).toBeNull();
  });

  it('renders durations as hours+minutes, minutes, or seconds', () => {
    expect(fmtHm(7530)).toBe('2 h 06 min');
    expect(fmtHm(2880)).toBe('48 min');
    expect(fmtHm(40)).toBe('40 s');
    expect(fmtHm(null)).toBeNull();
  });

  it('reads the local day and wall-clock time straight off the Garmin string', () => {
    expect(localDayOf('2026-08-05 06:15:00')).toBe('2026-08-05');
    expect(localTimeOf('2026-08-05 06:15:00')).toBe('06:15');
    expect(localDayOf('nonsense')).toBeNull();
    expect(localTimeOf('2026-08-05')).toBeNull();
  });
});

describe('activityStats', () => {
  it('leads a run with distance, pace and time', () => {
    const stats = activityStats(
      t,
      act({ activityId: 'r', sport: 'running', distanceM: 10_000, durationS: 3000, movingS: 3000 })
    );
    expect(stats.map((s) => s.label)).toEqual(['Dystans', 'Tempo', 'Czas']);
    expect(stats[1]!.value).toBe('5:00');
    expect(stats[1]!.unit).toBe('/km');
  });

  it('leads a ride with distance and average power', () => {
    const stats = activityStats(t, act({ activityId: 'c', sport: 'cycling', avgPower: 214 }));
    expect(stats.map((s) => s.label)).toEqual(['Dystans', 'Śr. moc', 'Czas']);
    expect(stats[1]!.value).toBe('214');
  });

  it('falls back to average speed when a ride has no power', () => {
    const stats = activityStats(t, act({ activityId: 'c2', sport: 'cycling', avgPower: null }));
    expect(stats[1]!.label).toBe('Śr. prędkość');
    expect(stats[1]!.unit).toBe('km/h');
  });

  it('reports swim pace per 100 m', () => {
    const stats = activityStats(
      t,
      act({ activityId: 's', sport: 'lap_swimming', distanceM: 2000, durationS: 3000, movingS: 3000 })
    );
    expect(stats[1]!.unit).toBe('/100 m');
    expect(stats[1]!.value).toBe('2:30');
  });

  it('never renders more than three readouts', () => {
    const stats = activityStats(t, act({ activityId: 'x', sport: 'running', elevationGainM: 900 }));
    expect(stats.length).toBeLessThanOrEqual(3);
  });
});

describe('importance', () => {
  it('ranks an HRV anomaly above a routine easy walk', () => {
    const walk = activityImportance(
      act({ activityId: 'w', sport: 'casual_walking', durationS: 1800, movingS: 1800, trainingLoad: null })
    );
    const [hrv] = buildHealthEvents(t, [signal()], FROM, TO);
    expect(hrv!.importance).toBeGreaterThan(walk);
  });

  it('scales an activity with moving time and Garmin load, capped', () => {
    const short = activityImportance(act({ activityId: 'a', movingS: 1800, trainingLoad: 0 }));
    const long = activityImportance(act({ activityId: 'b', movingS: 4 * 3600, trainingLoad: 400 }));
    expect(long).toBeGreaterThan(short);
    expect(long).toBeLessThanOrEqual(IMPORTANCE.max);
  });

  it('scores a strong outlier above a moderate one', () => {
    const [moderate] = buildHealthEvents(t, [signal({ z: -2.1, severity: 'moderate' })], FROM, TO);
    const [strong] = buildHealthEvents(
      t,
      [signal({ z: -3.6, severity: 'strong', date: '2026-08-03' })],
      FROM,
      TO
    );
    expect(strong!.importance).toBeGreaterThan(moderate!.importance);
  });
});

describe('buildActivityEvents', () => {
  it('keeps only activities inside the window and carries sport metadata', () => {
    const events = buildActivityEvents(
      t,
      [
        act({ activityId: 'in', startTimeLocal: '2026-08-05 09:00:00', sport: 'running' }),
        act({ activityId: 'old', startTimeLocal: '2026-06-01 09:00:00' }),
        act({ activityId: 'future', startTimeLocal: '2026-09-01 09:00:00' })
      ],
      FROM,
      TO
    );
    expect(events.map((e) => e.activityId)).toEqual(['in']);
    expect(events[0]).toMatchObject({
      kind: 'activity',
      group: 'run',
      icon: 'run',
      day: '2026-08-05',
      time: '09:00'
    });
    expect(events[0]!.href).toBe('/activities/in');
  });

  it('uses the activity name as the title and the sport as the supporting line', () => {
    const [e] = buildActivityEvents(
      t,
      [act({ activityId: 'n', name: 'Poranna szycha', sport: 'running' })],
      FROM,
      TO
    );
    expect(e!.title).toBe('Poranna szycha');
    expect(e!.detail).toBe('Bieg');
  });

  it('falls back to the sport label when the activity is unnamed', () => {
    const [e] = buildActivityEvents(
      t,
      [act({ activityId: 'u', name: '   ', sport: 'gravel_cycling' })],
      FROM,
      TO
    );
    expect(e!.title).toBe('Gravel');
    expect(e!.detail).toBeNull();
  });
});

describe('buildHealthEvents', () => {
  it('classifies each metric + direction into a named signal with its own copy', () => {
    expect(classifySignal('hrv', 'down').signal).toBe('hrv_drop');
    expect(classifySignal('sleep', 'down').signal).toBe('poor_sleep');
    expect(classifySignal('resting_heart_rate', 'up').signal).toBe('elevated_rhr');
    expect(classifySignal('body_battery', 'down').signal).toBe('body_battery_crash');
    expect(classifySignal('stress', 'up').signal).toBe('high_stress');
    expect(classifySignal('something_new', 'up').signal).toBe('metric_outlier');
  });

  it('marks a move in the healthy direction as favourable', () => {
    const [drop] = buildHealthEvents(t, [signal({ key: 'hrv', direction: 'down' })], FROM, TO);
    const [rise] = buildHealthEvents(
      t,
      [signal({ key: 'hrv', direction: 'up', date: '2026-08-02' })],
      FROM,
      TO
    );
    const [rhrUp] = buildHealthEvents(
      t,
      [signal({ key: 'resting_heart_rate', direction: 'up', date: '2026-08-01' })],
      FROM,
      TO
    );
    expect(drop!.favourable).toBe(false);
    expect(rise!.favourable).toBe(true);
    expect(rhrUp!.favourable).toBe(false);
  });

  it('rejects structurally unsound signals instead of rendering junk', () => {
    expect(isUsableSignal(signal())).toBe(true);
    expect(isUsableSignal(signal({ date: '2026-13-40' }))).toBe(false);
    expect(isUsableSignal(signal({ z: Number.NaN }))).toBe(false);
    expect(buildHealthEvents(t, [signal({ date: 'not-a-day' })], FROM, TO)).toEqual([]);
  });

  it('drops signals outside the window', () => {
    expect(buildHealthEvents(t, [signal({ date: '2026-01-01' })], FROM, TO)).toEqual([]);
  });
});

describe('milestones', () => {
  const history: TimelineActivityInput[] = [
    act({
      activityId: '1',
      startTimeLocal: '2026-05-01 08:00:00',
      distanceM: 20_000,
      durationS: 3000,
      movingS: 3000
    }),
    act({
      activityId: '2',
      startTimeLocal: '2026-05-08 08:00:00',
      distanceM: 25_000,
      durationS: 3200,
      movingS: 3200
    }),
    act({
      activityId: '3',
      startTimeLocal: '2026-05-15 08:00:00',
      distanceM: 30_000,
      durationS: 3400,
      movingS: 3400
    }),
    act({
      activityId: '4',
      startTimeLocal: '2026-05-22 08:00:00',
      distanceM: 28_000,
      durationS: 3300,
      movingS: 3300
    })
  ];

  it('announces a distance record once there is enough history in that sport family', () => {
    const events = buildMilestoneEvents(
      t,
      [...history, act({ activityId: 'pb', startTimeLocal: '2026-08-02 08:00:00', distanceM: 120_000 })],
      FROM,
      TO
    );
    expect(events.map((e) => e.milestone)).toEqual(['longest_distance']);
    expect(events[0]!.activityId).toBe('pb');
    expect(events[0]!.stats[0]!.value).toBe('30,0 km');
  });

  it('does not stack a duration trophy on the same activity as a distance one', () => {
    const events = buildMilestoneEvents(
      t,
      [
        ...history,
        act({
          activityId: 'both',
          startTimeLocal: '2026-08-02 08:00:00',
          distanceM: 120_000,
          durationS: 20_000,
          movingS: 20_000
        })
      ],
      FROM,
      TO
    );
    expect(events.filter((e) => e.activityId === 'both').map((e) => e.milestone)).toEqual([
      'longest_distance'
    ]);
  });

  it('stays silent for a user without enough prior activities in the family', () => {
    const events = buildMilestoneEvents(
      t,
      [act({ activityId: 'first', startTimeLocal: '2026-08-02 08:00:00', distanceM: 999_000 })],
      FROM,
      TO
    );
    expect(events).toEqual([]);
  });

  it('announces a genuinely new sport once the user has real history', () => {
    const events = buildMilestoneEvents(
      t,
      [
        ...history,
        act({ activityId: '5', startTimeLocal: '2026-06-01 08:00:00' }),
        act({
          activityId: 'new',
          sport: 'bouldering',
          startTimeLocal: '2026-08-03 17:00:00',
          distanceM: null
        })
      ],
      FROM,
      TO
    );
    expect(events.some((e) => e.milestone === 'new_sport' && e.activityId === 'new')).toBe(true);
  });

  it('counts consecutive-day streaks and only announces round ones', () => {
    const days = ['2026-08-01', '2026-08-02', '2026-08-03', '2026-08-05'];
    const lengths = streakLengths(days);
    expect(lengths.get('2026-08-03')).toBe(3);
    expect(lengths.get('2026-08-05')).toBe(1);

    expect(isStreakMilestone(6)).toBe(false);
    expect(isStreakMilestone(7)).toBe(true);
    expect(isStreakMilestone(10)).toBe(true);
    expect(isStreakMilestone(14)).toBe(true);
    expect(isStreakMilestone(11)).toBe(false);
  });

  it('emits a streak milestone on the day the run reaches a full week', () => {
    const week = [
      '2026-07-30',
      '2026-07-31',
      '2026-08-01',
      '2026-08-02',
      '2026-08-03',
      '2026-08-04',
      '2026-08-05'
    ].map((day, i) =>
      act({ activityId: `s${i}`, sport: 'running', startTimeLocal: `${day} 07:00:00`, distanceM: 5000 })
    );
    const events = buildMilestoneEvents(t, week, FROM, TO);
    const streak = events.find((e) => e.milestone === 'streak');
    expect(streak).toBeDefined();
    expect(streak!.day).toBe('2026-08-05');
    expect(streak!.title).toBe('7 dni z rzędu z treningiem');
  });
});

describe('rank', () => {
  const events = buildTimeline({
    t,
    history: [
      act({
        activityId: 'walk',
        sport: 'casual_walking',
        startTimeLocal: '2026-08-06 12:00:00',
        durationS: 1800,
        movingS: 1800,
        trainingLoad: null,
        distanceM: 2000
      }),
      act({
        activityId: 'ride',
        sport: 'cycling',
        startTimeLocal: '2026-08-04 09:00:00',
        durationS: 10_800,
        movingS: 10_800,
        trainingLoad: 200
      })
    ],
    signals: [signal({ date: '2026-08-05', z: -3.4, severity: 'strong' })],
    from: FROM,
    to: TO,
    limit: 2
  }).events;

  it('renders newest first regardless of importance', () => {
    expect(events.map((e) => e.day)).toEqual(['2026-08-06', '2026-08-05', '2026-08-04']);
  });

  it('marks only the top-`limit` events by importance as primary', () => {
    const primary = events.filter((e) => e.primary).map((e) => e.kind);
    expect(primary).toEqual(['health', 'activity']); // the HRV crash and the 3 h ride, not the walk
  });

  it('keeps every event in the payload so expanding needs no second request', () => {
    const ranked = rank(events, 1);
    expect(ranked.totalCount).toBe(3);
    expect(ranked.primaryCount).toBe(1);
    expect(ranked.events.length).toBe(3);
  });

  it('orders health above an activity that happened at the same moment', () => {
    const a = events.find((e) => e.kind === 'activity')!;
    const h = events.find((e) => e.kind === 'health')!;
    const sameDay = { ...h, day: a.day, time: a.time } as TimelineEvent;
    expect(compareChronological(sameDay, a)).toBeLessThan(0);
  });
});
