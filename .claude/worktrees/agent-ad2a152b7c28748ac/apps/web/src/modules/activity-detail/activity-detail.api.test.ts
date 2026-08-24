import { describe, it, expect } from 'vitest';
import { loadActivityDetail } from './activity-detail.api';
import { createMemoryStore } from '$lib/server/store/memory';
import type { SettingsRepo, UserSettings } from '$lib/server/repo/types';
import type { ActivityLap, ActivitySummary, LocalStore } from '$lib/server/store/types';
import type { WorkoutStep } from '$lib/workouts';

function act(over: Partial<ActivitySummary>): ActivitySummary {
  return {
    userId: 'u',
    activityId: 'a',
    sport: 'cycling',
    name: 'Test',
    startTime: '2026-05-01T07:00:00Z',
    startTimeLocal: '2026-05-01 09:00:00',
    distanceM: 40000,
    durationS: 3600,
    movingS: 3600,
    elevationGainM: 300,
    avgHr: 150,
    maxHr: 190,
    avgPower: 200,
    maxPower: 600,
    normPower: 210,
    calories: 800,
    trainingLoad: 90,
    hasGps: true,
    raw: {},
    ...over
  };
}

/** One authored step. Defaults to a 10-minute work block with no target. */
function wStep(over: Partial<WorkoutStep> = {}): WorkoutStep {
  return {
    kind: 'work',
    durationType: 'time',
    durationValue: 600,
    target: null,
    repeats: null,
    steps: null,
    note: null,
    ...over
  };
}

function stubSettings(bag: UserSettings): SettingsRepo {
  return {
    async get() {
      return bag;
    },
    async set() {
      /* no-op */
    }
  };
}

describe('loadActivityDetail', () => {
  it('returns null for an unknown activity', async () => {
    const store = createMemoryStore();
    const data = await loadActivityDetail({ store, settings: stubSettings({}) }, 'u', 'missing');
    expect(data).toBeNull();
  });

  it('computes power maths from stored FTP and exposes zones + curve + GPS', async () => {
    const store = createMemoryStore();
    await store.putActivities('u', [act({})]);
    // One hour at a steady 200 W, 1 Hz. NP ≈ 200, IF = 1, TSS = 100.
    const power = new Array(3600).fill(200);
    await store.putStreams('u', 'a', {
      power,
      heartRate: new Array(3600).fill(150),
      gps: [
        [50, 8],
        [50.1, 8.1],
        [50.2, 8.2]
      ],
      time: power.map((_, i) => i)
    });

    const data = await loadActivityDetail(
      { store, settings: stubSettings({ ftpWatts: 200, weightKg: 72 }) },
      'u',
      'a'
    );
    expect(data).not.toBeNull();
    expect(data!.ftp).toBe(200);
    expect(data!.ftpEstimated).toBe(false);
    expect(data!.weightKg).toBe(72);
    expect(data!.power?.np).toBe(200);
    expect(data!.power?.if).toBe(1);
    expect(data!.power?.tss).toBe(100);
    expect(data!.power?.kj).toBe(720); // 200 W · 3600 s / 1000
    expect(data!.power?.zones.length).toBe(7);
    // 200/200 = 100% FTP → all time in Z4.
    expect(data!.power?.zones.find((z) => z.zone === 4)?.pct).toBe(100);
    expect(data!.hr?.zones.length).toBe(5);
    expect(data!.gps?.length).toBe(3);
    expect(data!.stravaUrl).toBeNull();
  });

  it('estimates FTP from the 20-minute best when settings lack one', async () => {
    const store = createMemoryStore();
    await store.putActivities('u', [act({ durationS: 1200 })]);
    const power = new Array(1200).fill(300); // 20 min at 300 W
    await store.putStreams('u', 'a', { power, time: power.map((_, i) => i) });

    const data = await loadActivityDetail({ store, settings: stubSettings({}) }, 'u', 'a');
    expect(data!.ftpEstimated).toBe(true);
    expect(data!.ftp).toBe(285); // round(0.95 * 300)
    expect(data!.power?.if).toBe(1.05); // round(300/285, 2)
  });

  it('degrades power widgets when no power stream exists (HR still computed)', async () => {
    const store = createMemoryStore();
    await store.putActivities('u', [act({ hasGps: false, avgPower: null, maxPower: null, normPower: null })]);
    await store.putStreams('u', 'a', {
      heartRate: new Array(600).fill(150),
      time: Array.from({ length: 600 }, (_, i) => i)
    });

    const data = await loadActivityDetail({ store, settings: stubSettings({}) }, 'u', 'a');
    expect(data!.power).toBeNull();
    expect(data!.ftp).toBeNull();
    expect(data!.hr?.zones.length).toBe(5);
    expect(data!.gps).toBeNull();
  });

  it('projects the rich Garmin stats out of the stored raw payload (spec 023)', async () => {
    const store = createMemoryStore();
    await store.putActivities('u', [
      act({
        raw: {
          activityId: 'a',
          distance: 10000,
          duration: 3000,
          movingDuration: 2940,
          calories: 700,
          bmrCalories: 60,
          waterEstimated: 850,
          avgRespirationRate: 31.2,
          aerobicTrainingEffect: 3.6,
          anaerobicTrainingEffect: 1.1,
          trainingEffectLabel: 'TEMPO',
          activityTrainingLoad: 143,
          beginPotentialStamina: 96,
          endPotentialStamina: 71,
          hrTimeInZone_1: 120,
          hrTimeInZone_3: 1500,
          elevationGain: 120,
          elevationLoss: 118,
          moderateIntensityMinutes: 12,
          vigorousIntensityMinutes: 34,
          differenceBodyBattery: -28,
          averageRunningCadenceInStepsPerMinute: 172.4,
          avgGroundContactTime: 251
        }
      })
    ]);
    await store.putStreams('u', 'a', {
      heartRate: [150, 150],
      temperature: [20, 22],
      typedSplits: [
        { index: 1, type: 'RWD_RUN', durationS: 2800 },
        { index: 2, type: 'RWD_WALK', durationS: 140 },
        { index: 3, type: 'RWD_STAND', durationS: 60 }
      ],
      laps: [{ index: 1, distanceM: 5000, durationS: 1500, avgHr: 148 }]
    });

    const data = await loadActivityDetail({ store, settings: stubSettings({}) }, 'u', 'a');

    expect(data!.stats.calories).toEqual({ total: 700, resting: 60, active: 640 });
    expect(data!.stats.hydration.sweatLossMl).toBe(850);
    expect(data!.stats.respiration.avg).toBe(31.2);
    expect(data!.stats.trainingEffect).toEqual({ aerobic: 3.6, anaerobic: 1.1, label: 'TEMPO', load: 143 });
    expect(data!.stats.stamina).toEqual({ beginPotential: 96, endPotential: 71 });
    expect(data!.stats.hr.timeInZoneS).toEqual([120, 0, 1500, 0, 0]);
    expect(data!.stats.timing).toEqual({ durationS: 3000, movingS: 2940, idleS: 60 });
    expect(data!.stats.pace.avgSecPerKm).toBe(300);
    expect(data!.stats.intensityMinutes).toEqual({ moderate: 12, vigorous: 34, total: 80 });
    expect(data!.stats.bodyBattery.difference).toBe(-28);
    expect(data!.stats.runningDynamics.avgCadenceSpm).toBe(172);
    // Run/walk comes from the typed splits; avg temperature falls back to the stream.
    expect(data!.stats.runWalk).toEqual({ runS: 2800, walkS: 140, idleS: 60 });
    expect(data!.stats.temperature.avgC).toBe(21);
    // Laps + streams reach the UI contract; gps/laps are not duplicated inside `streams`.
    expect(data!.laps).toHaveLength(1);
    expect(data!.typedSplits).toHaveLength(3);
    expect(data!.streams.heartRate).toEqual([150, 150]);
    expect(data!.streams.laps).toBeUndefined();
    expect(data!.streams.gps).toBeUndefined();
    // Already-projected fields stay projected.
    expect(data!.activity.calories).toBe(800);
    expect(data!.activity.trainingLoad).toBe(90);
  });

  it('degrades to empty stat groups when the raw payload is missing or thin', async () => {
    const store = createMemoryStore();
    await store.putActivities('u', [act({ raw: null })]);

    const data = await loadActivityDetail({ store, settings: stubSettings({}) }, 'u', 'a');

    expect(data!.stats.calories).toEqual({});
    expect(data!.stats.runWalk).toEqual({});
    expect(data!.stats.runningDynamics).toEqual({});
    expect(data!.laps).toEqual([]);
    expect(data!.typedSplits).toEqual([]);
    expect(data!.streams).toEqual({});
  });

  it('compares the session with the athlete’s own recent sessions of the same sport (spec 026)', async () => {
    const store = createMemoryStore();
    // Ten earlier rides at load 100, plus a run that must NOT pollute the cycling norm.
    const past = Array.from({ length: 10 }, (_, i) => {
      const day = `2026-04-${String(20 - i).padStart(2, '0')}`;
      return act({
        activityId: `p${i}`,
        trainingLoad: 100,
        startTime: `${day}T07:00:00Z`,
        startTimeLocal: `${day} 09:00:00`
      });
    });
    const foreignRun = act({
      activityId: 'run1',
      sport: 'running',
      trainingLoad: 900,
      startTime: '2026-04-30T07:00:00Z',
      startTimeLocal: '2026-04-30 09:00:00'
    });
    await store.putActivities('u', [act({ trainingLoad: 150 }), ...past, foreignRun]);

    const data = await loadActivityDetail({ store, settings: stubSettings({}) }, 'u', 'a');
    const cmp = data!.trainingComparison!;
    expect(cmp.load).toBe(150);
    expect(cmp.loadMethod).toBe('garmin');
    expect(cmp.recentCount).toBe(10); // the run is a different sport family
    expect(cmp.recentMedianLoad).toBe(100);
    expect(cmp.vsRecentPct).toBe(50);
    expect(cmp.verdict).toBe('peak');
    expect(cmp.ctlBefore).toBeGreaterThan(0);
    // No workout calendar is synced, so the planned-workout slot stays honestly empty.
    expect(cmp.plannedWorkout).toBeNull();
    expect(cmp.plannedWorkoutStatus).toBe('not-synced');
  });

  it('links the activity to the workout planned for that day (spec 024 calendar)', async () => {
    const store = createMemoryStore();
    await store.putActivities('u', [act({})]); // 40 km, 3600 s, load 90
    await store.replacePlannedEvents('u', '2026-04-01', '2026-06-01', [
      {
        id: 'w1',
        day: '2026-05-01',
        time: '09:00',
        kind: 'workout',
        title: 'Interwały 4×8',
        sport: 'cycling',
        description: 'Rozgrzewka + 4×8 min w progu',
        estimatedDurationS: 3600,
        estimatedDistanceM: 40000,
        targetLoad: 100,
        source: 'garmin'
      }
    ]);

    const data = await loadActivityDetail({ store, settings: stubSettings({}) }, 'u', 'a');
    const plan = data!.trainingComparison!.plannedWorkout!;
    expect(data!.trainingComparison!.plannedWorkoutStatus).toBe('linked');
    expect(plan.name).toBe('Interwały 4×8');
    expect(plan.steps.find((s) => s.key === 'duration')?.met).toBe(true);
    expect(plan.steps.find((s) => s.key === 'load')?.actual).toBe(90);
    expect(plan.compliancePct).toBe(97); // 90 of a planned 100 load, the rest exact
  });

  it('separates "nothing planned" from "no calendar synced"', async () => {
    const store = createMemoryStore();
    await store.putActivities('u', [act({})]);

    // Nothing anywhere near the date → we must not claim the day was unplanned.
    const blind = await loadActivityDetail({ store, settings: stubSettings({}) }, 'u', 'a');
    expect(blind!.trainingComparison!.plannedWorkoutStatus).toBe('not-synced');

    // A calendar that covers the date but holds a swim → this ride was off-plan.
    await store.replacePlannedEvents('u', '2026-04-01', '2026-06-01', [
      {
        id: 'w2',
        day: '2026-05-01',
        time: null,
        kind: 'workout',
        title: 'Basen',
        sport: 'lap_swimming',
        description: null,
        estimatedDurationS: 2700,
        estimatedDistanceM: null,
        targetLoad: null,
        source: 'garmin'
      }
    ]);
    const seeing = await loadActivityDetail({ store, settings: stubSettings({}) }, 'u', 'a');
    expect(seeing!.trainingComparison!.plannedWorkoutStatus).toBe('none-scheduled');
    expect(seeing!.trainingComparison!.plannedWorkout).toBeNull();
  });

  /* ------------------------------------------------------------------------------------ *
   * Both halves of the plan (spec 085)
   * ------------------------------------------------------------------------------------ */

  it('scores the session against the athlete’s OWN authored workout, not just Garmin’s calendar', async () => {
    const store = createMemoryStore();
    // 40 km in 3600 s → 90 s/km; NP 210 W.
    await store.putActivities('u', [act({})]);
    await store.createWorkout('u', {
      id: 'aw1',
      day: '2026-05-01',
      time: '09:00',
      sport: 'cycling',
      title: 'Próg 4×8',
      steps: [
        wStep({ kind: 'warmup', durationValue: 900 }),
        wStep({
          kind: 'repeat',
          durationType: null,
          durationValue: null,
          repeats: 4,
          steps: [
            wStep({ kind: 'work', durationValue: 480, target: { type: 'power', low: 200, high: 220 } }),
            wStep({ kind: 'recovery', durationValue: 120 })
          ]
        }),
        wStep({ kind: 'cooldown', durationValue: 300 })
      ],
      note: 'Trzymaj moc, nie tempo.',
      createdAt: '2026-04-28T10:00:00Z'
    });

    const data = await loadActivityDetail({ store, settings: stubSettings({}) }, 'u', 'a');
    const plan = data!.trainingComparison!.plannedWorkout!;

    expect(data!.trainingComparison!.plannedWorkoutStatus).toBe('linked');
    expect(plan.origin).toBe('authored');
    expect(plan.name).toBe('Próg 4×8');
    expect(plan.description).toBe('Trzymaj moc, nie tempo.');
    // 900 + 4 × (480 + 120) + 300 = 3600 s, derived from the steps rather than stored.
    expect(plan.targetDurationS).toBe(3600);
    expect(plan.compliancePct).not.toBeNull();

    // The work steps' power band became a comparison row, scored against NP.
    const power = plan.steps.find((s) => s.key === 'power');
    expect(power).toBeDefined();
    expect(power!.targetLow).toBe(200);
    expect(power!.targetHigh).toBe(220);
    expect(power!.actual).toBe(210);
    expect(power!.met).toBe(true);

    // …and the flattened sequence is exposed for the Przebieg strip.
    expect(data!.plannedStructure).not.toBeNull();
    expect(data!.plannedStructure!.map((s) => s.kind)).toEqual([
      'warmup',
      'work',
      'recovery',
      'work',
      'recovery',
      'work',
      'recovery',
      'work',
      'recovery',
      'cooldown'
    ]);
    expect(data!.plannedStructure![0]?.plannedS).toBe(900);
  });

  it('an authored workout alone is enough — the athlete never sees "calendar not synced"', async () => {
    const store = createMemoryStore();
    await store.putActivities('u', [act({})]);
    await store.createWorkout('u', {
      id: 'aw2',
      // Near the activity but not on its day: it still proves we hold plan data around this date.
      day: '2026-05-03',
      time: null,
      sport: 'cycling',
      title: 'Spokojne 2 h',
      steps: [wStep({ durationValue: 7200 })],
      note: null,
      createdAt: '2026-04-28T10:00:00Z'
    });

    const data = await loadActivityDetail({ store, settings: stubSettings({}) }, 'u', 'a');
    expect(data!.trainingComparison!.plannedWorkoutStatus).toBe('none-scheduled');
    expect(data!.trainingComparison!.plannedWorkout).toBeNull();
    expect(data!.plannedStructure).toBeNull();
  });

  it('prefers the authored workout when Garmin’s calendar holds one for the same day too', async () => {
    const store = createMemoryStore();
    await store.putActivities('u', [act({})]);
    await store.replacePlannedEvents('u', '2026-04-01', '2026-06-01', [
      {
        id: 'g1',
        day: '2026-05-01',
        time: '09:00',
        kind: 'workout',
        title: 'Kopia z Garmina',
        sport: 'cycling',
        description: null,
        estimatedDurationS: 3600,
        estimatedDistanceM: 40000,
        targetLoad: 100,
        source: 'garmin'
      }
    ]);
    await store.createWorkout('u', {
      id: 'aw3',
      day: '2026-05-01',
      time: '09:00',
      sport: 'cycling',
      title: 'Mój własny plan',
      steps: [wStep({ durationValue: 3600, target: { type: 'power', low: 200, high: 220 } })],
      note: null,
      createdAt: '2026-04-28T10:00:00Z'
    });

    const data = await loadActivityDetail({ store, settings: stubSettings({}) }, 'u', 'a');
    const plan = data!.trainingComparison!.plannedWorkout!;
    expect(plan.origin).toBe('authored');
    expect(plan.name).toBe('Mój własny plan');
  });

  it('a bare Garmin entry gets no adherence figure and no structure', async () => {
    const store = createMemoryStore();
    await store.putActivities('u', [act({})]);
    await store.replacePlannedEvents('u', '2026-04-01', '2026-06-01', [
      {
        id: 'g2',
        day: '2026-05-01',
        time: null,
        kind: 'workout',
        title: 'Rower',
        sport: 'cycling',
        description: 'Cokolwiek',
        estimatedDurationS: null,
        estimatedDistanceM: null,
        targetLoad: null,
        source: 'garmin'
      }
    ]);

    const data = await loadActivityDetail({ store, settings: stubSettings({}) }, 'u', 'a');
    const plan = data!.trainingComparison!.plannedWorkout!;
    expect(plan.origin).toBe('garmin');
    expect(plan.steps).toEqual([]);
    expect(plan.compliancePct).toBeNull();
    expect(data!.plannedStructure).toBeNull();
    expect(data!.trainingComparison!.plannedTakeaways).toEqual([]);
  });

  it('returns "none-scheduled" and no structure when neither half of the plan holds anything', async () => {
    const store = createMemoryStore();
    await store.putActivities('u', [act({})]);
    // A plan for another sport, so the window HAS data but this ride was off-plan.
    await store.createWorkout('u', {
      id: 'aw4',
      day: '2026-05-01',
      time: null,
      sport: 'lap_swimming',
      title: 'Basen',
      steps: [wStep({ durationValue: 2700 })],
      note: null,
      createdAt: '2026-04-28T10:00:00Z'
    });

    const data = await loadActivityDetail({ store, settings: stubSettings({}) }, 'u', 'a');
    expect(data!.trainingComparison!.plannedWorkoutStatus).toBe('none-scheduled');
    expect(data!.plannedStructure).toBeNull();
  });

  it('turns a missed target into guidance for next time', async () => {
    const store = createMemoryStore();
    // Only half the planned hour was ridden, at 300 W against a 200–220 W band.
    await store.putActivities('u', [act({ durationS: 1800, movingS: 1800, normPower: 300 })]);
    await store.createWorkout('u', {
      id: 'aw5',
      day: '2026-05-01',
      time: null,
      sport: 'cycling',
      title: 'Tempo',
      steps: [wStep({ durationValue: 3600, target: { type: 'power', low: 200, high: 220 } })],
      note: null,
      createdAt: '2026-04-28T10:00:00Z'
    });

    const data = await loadActivityDetail({ store, settings: stubSettings({}) }, 'u', 'a');
    expect(data!.trainingComparison!.plannedTakeaways).toEqual([
      // 300 W against a 220 W ceiling → 36% harder; half the hour → 50% short.
      { key: 'plan.takeaway.under', metric: 'duration', pct: 50 },
      { key: 'plan.takeaway.harder', metric: 'power', pct: 36 }
    ]);
  });

  it('scores a run’s pace band against the pace it actually held', async () => {
    const store = createMemoryStore();
    // 10 km in 50 min → 300 s/km.
    await store.putActivities('u', [
      act({
        sport: 'running',
        distanceM: 10000,
        durationS: 3000,
        movingS: 3000,
        normPower: null,
        avgPower: null,
        maxPower: null
      })
    ]);
    await store.createWorkout('u', {
      id: 'aw6',
      day: '2026-05-01',
      time: null,
      sport: 'running',
      title: 'Spokojne 10 km',
      steps: [
        wStep({
          durationType: 'distance',
          durationValue: 10000,
          target: { type: 'pace', low: 290, high: 310 }
        })
      ],
      note: null,
      createdAt: '2026-04-28T10:00:00Z'
    });

    const data = await loadActivityDetail({ store, settings: stubSettings({}) }, 'u', 'a');
    const pace = data!.trainingComparison!.plannedWorkout!.steps.find((s) => s.key === 'pace');
    expect(pace?.actual).toBe(300);
    expect(pace?.met).toBe(true);
    expect(data!.trainingComparison!.plannedTakeaways).toEqual([]);
  });

  /* ------------------------------------------------------------------------------------ *
   * Which lap was which planned step (spec 091)
   * ------------------------------------------------------------------------------------ */

  /** `5 × (1 km @ 4:00–4:10 + 400 m jog)` — 7 km of work, the athlete's normal Tuesday. */
  const INTERVAL_STEPS: WorkoutStep[] = [
    wStep({
      kind: 'repeat',
      durationType: null,
      durationValue: null,
      repeats: 5,
      steps: [
        wStep({
          durationType: 'distance',
          durationValue: 1000,
          target: { type: 'pace', low: 240, high: 250 }
        }),
        wStep({ kind: 'recovery', durationType: 'distance', durationValue: 400 })
      ]
    })
  ];

  /** The run that executed it: 7 km in 2065 s, so the SESSION average is 295 s/km. */
  const intervalRun = () =>
    act({
      sport: 'running',
      distanceM: 7000,
      durationS: 2065,
      movingS: 2065,
      normPower: null,
      avgPower: null,
      maxPower: null
    });

  /** One lap per planned step: reps at 4:05/km, jogs at 7:00/km. */
  function intervalLaps(): ActivityLap[] {
    const laps: ActivityLap[] = [];
    for (let i = 0; i < 5; i++) {
      laps.push({ index: laps.length + 1, distanceM: 1000, durationS: 245, avgHr: 170 });
      laps.push({ index: laps.length + 1, distanceM: 400, durationS: 168, avgHr: 142 });
    }
    return laps;
  }

  async function seedIntervalSession(store: LocalStore, laps: ActivityLap[]): Promise<void> {
    await store.putActivities('u', [intervalRun()]);
    if (laps.length > 0) await store.putStreams('u', 'a', { laps });
    await store.createWorkout('u', {
      id: 'aw7',
      day: '2026-05-01',
      time: null,
      sport: 'running',
      title: 'Interwały 5×1 km',
      steps: INTERVAL_STEPS,
      note: null,
      createdAt: '2026-04-28T10:00:00Z'
    });
  }

  it('scores an interval session rep by rep once its laps line up with the plan', async () => {
    const store = createMemoryStore();
    await seedIntervalSession(store, intervalLaps());

    const data = await loadActivityDetail({ store, settings: stubSettings({}) }, 'u', 'a');
    const plan = data!.trainingComparison!.plannedWorkout!;
    const pace = plan.steps.find((s) => s.key === 'pace')!;

    expect(plan.intensitySource).toBe('per-step');
    // The work steps' own pace — NOT the 295 s/km the whole session averages out to.
    expect(pace.actual).toBe(245);
    expect(pace.met).toBe(true);
    expect(pace.perStep).toHaveLength(5);
    expect(pace.perStep?.map((s) => s.actual)).toEqual([245, 245, 245, 245, 245]);
    expect(pace.perStep?.every((s) => s.met === true && s.confidence === 'exact')).toBe(true);

    // …and every planned step says which laps it was, on the payload the strip draws from.
    expect(data!.plannedStructure).toHaveLength(10);
    expect(data!.plannedStructure!.map((s) => s.alignment?.lapIndices)).toEqual([
      [1],
      [2],
      [3],
      [4],
      [5],
      [6],
      [7],
      [8],
      [9],
      [10]
    ]);
  });

  it('falls back to the session average, and says so, when the activity has no laps', async () => {
    const store = createMemoryStore();
    await seedIntervalSession(store, []);

    const data = await loadActivityDetail({ store, settings: stubSettings({}) }, 'u', 'a');
    const plan = data!.trainingComparison!.plannedWorkout!;
    const pace = plan.steps.find((s) => s.key === 'pace')!;

    expect(plan.intensitySource).toBe('session-average');
    expect(pace.perStep).toBeNull();
    // 7000 m in 2065 s — the blended average that made a good session read as off-plan.
    expect(pace.actual).toBe(295);
    expect(pace.met).toBe(false);
    expect(data!.plannedStructure!.every((s) => s.alignment === null)).toBe(true);
  });

  it('gives the same session a better adherence figure once it is judged rep by rep', async () => {
    const aligned = createMemoryStore();
    await seedIntervalSession(aligned, intervalLaps());
    const blind = createMemoryStore();
    await seedIntervalSession(blind, []);

    const withLaps = await loadActivityDetail({ store: aligned, settings: stubSettings({}) }, 'u', 'a');
    const withoutLaps = await loadActivityDetail({ store: blind, settings: stubSettings({}) }, 'u', 'a');

    const a = withLaps!.trainingComparison!.plannedWorkout!.compliancePct!;
    const b = withoutLaps!.trainingComparison!.plannedWorkout!.compliancePct!;
    expect(a).toBeGreaterThan(b);
    // The scalar rows are untouched by alignment, so only the pace row moved.
    expect(withLaps!.trainingComparison!.plannedTakeaways.map((t) => t.metric)).toEqual(['duration']);
    expect(withoutLaps!.trainingComparison!.plannedTakeaways.map((t) => t.metric)).toEqual([
      'duration',
      'pace'
    ]);
  });

  it('refuses to pair laps that bear no relation to the plan', async () => {
    const store = createMemoryStore();
    // Three 4 km blocks against a ten-step interval plan.
    await seedIntervalSession(
      store,
      [1, 2, 3].map((index) => ({ index, distanceM: 4000, durationS: 1180 }))
    );

    const data = await loadActivityDetail({ store, settings: stubSettings({}) }, 'u', 'a');
    expect(data!.trainingComparison!.plannedWorkout!.intensitySource).toBe('session-average');
    expect(data!.plannedStructure!.every((s) => s.alignment === null)).toBe(true);
  });

  it('still returns a comparison — with no norm — for a first-ever activity', async () => {
    const store = createMemoryStore();
    await store.putActivities('u', [act({ trainingLoad: 90 })]);

    const data = await loadActivityDetail({ store, settings: stubSettings({}) }, 'u', 'a');
    const cmp = data!.trainingComparison!;
    expect(cmp.load).toBe(90);
    expect(cmp.recentCount).toBe(0);
    expect(cmp.vsRecentPct).toBeNull();
    expect(cmp.ctlBefore).toBeNull();
    expect(cmp.summary).toContain('pierwsza porównywalna sesja');
  });

  describe('notable + suspect values (spec 036)', () => {
    /** Ten earlier, shorter rides so a metric has enough comparable history to be ranked. */
    function tenShortRides(): ActivitySummary[] {
      return Array.from({ length: 10 }, (_, i) =>
        act({
          activityId: `old-${i}`,
          startTime: `2026-0${(i % 4) + 1}-0${(i % 9) + 1}T07:00:00Z`,
          startTimeLocal: `2026-0${(i % 4) + 1}-0${(i % 9) + 1} 09:00:00`,
          distanceM: 10_000 + i * 100,
          durationS: 2000 + i,
          movingS: 2000 + i,
          elevationGainM: 100 + i,
          calories: 300 + i,
          trainingLoad: 40 + i
        })
      );
    }

    it('ranks this ride against the athlete‘s earlier ones', async () => {
      const store = createMemoryStore();
      await store.putActivities('u', [act({}), ...tenShortRides()]);

      const data = await loadActivityDetail({ store, settings: stubSettings({}) }, 'u', 'a');
      const distance = data!.highlights.find((h) => h.key === 'distance');
      expect(distance).toMatchObject({ kind: 'record', rank: 1, outOf: 11 });
      // The whole history fits inside the read, so a superlative is honest here.
      expect(distance?.text).toContain('Rekord');
    });

    it('ranks nothing for a first-ever activity but still checks its data quality', async () => {
      const store = createMemoryStore();
      // 40 km in 3600 s is 40 km/h average against a 130 km/h maximum — a clear GPS spike.
      await store.putActivities('u', [act({ raw: { maxSpeed: 36, averageSpeed: 11.1 } })]);

      const data = await loadActivityDetail({ store, settings: stubSettings({}) }, 'u', 'a');
      expect(data!.highlights).toEqual([]);
      expect(data!.suspects.map((s) => s.key)).toContain('maxSpeedCeiling');
      expect(data!.suspects[0]?.severity).toBe('warn');
    });

    it('carries both arrays even when there is nothing to say', async () => {
      const store = createMemoryStore();
      await store.putActivities('u', [act({})]);

      const data = await loadActivityDetail({ store, settings: stubSettings({}) }, 'u', 'a');
      expect(data!.highlights).toEqual([]);
      expect(data!.suspects).toEqual([]);
    });

    it('never ranks a session against another sport family', async () => {
      const store = createMemoryStore();
      // Ten long RUNS cannot make this ride's 40 km look ordinary, nor rank it.
      const runs = Array.from({ length: 10 }, (_, i) =>
        act({
          activityId: `run-${i}`,
          sport: 'running',
          startTimeLocal: `2026-0${(i % 4) + 1}-0${(i % 9) + 1} 09:00:00`,
          distanceM: 90_000
        })
      );
      await store.putActivities('u', [act({}), ...runs]);

      const data = await loadActivityDetail({ store, settings: stubSettings({}) }, 'u', 'a');
      expect(data!.highlights).toEqual([]);
    });

    it('does not let a LATER session change this one‘s standing', async () => {
      const store = createMemoryStore();
      const future = act({
        activityId: 'future',
        startTimeLocal: '2027-01-01 09:00:00',
        distanceM: 200_000
      });
      await store.putActivities('u', [act({}), future, ...tenShortRides()]);

      const data = await loadActivityDetail({ store, settings: stubSettings({}) }, 'u', 'a');
      expect(data!.highlights.find((h) => h.key === 'distance')).toMatchObject({
        kind: 'record',
        rank: 1
      });
    });
  });

  describe('aerobic efficiency (spec 038)', () => {
    it('measures decoupling, EF and cardiac cost from the streams and the summary', async () => {
      const store = createMemoryStore();
      await store.putActivities('u', [
        act({ distanceM: 10_000, durationS: 3000, movingS: 3000, avgHr: 150, raw: {} })
      ]);
      // Steady 3.33 m/s at 150 bpm for 3000 s: coupled, EF = 200/150.
      await store.putStreams('u', 'a', {
        speed: new Array(3000).fill(10_000 / 3000),
        heartRate: new Array(3000).fill(150),
        time: Array.from({ length: 3000 }, (_, i) => i)
      });

      const data = await loadActivityDetail({ store, settings: stubSettings({}) }, 'u', 'a');
      expect(data!.efficiency.decoupling).toMatchObject({ pct: 0, coupled: true, basis: 'pace' });
      expect(data!.efficiency.cardiacCost).toBe(750);
      expect(data!.efficiency.ef).toBeCloseTo(1.333, 2);
    });

    it('prefers power for decoupling when a meter was fitted', async () => {
      const store = createMemoryStore();
      await store.putActivities('u', [act({})]);
      await store.putStreams('u', 'a', {
        power: new Array(3600).fill(200),
        speed: new Array(3600).fill(10),
        heartRate: new Array(3600).fill(150),
        time: Array.from({ length: 3600 }, (_, i) => i)
      });

      const data = await loadActivityDetail({ store, settings: stubSettings({}) }, 'u', 'a');
      expect(data!.efficiency.decoupling?.basis).toBe('power');
    });

    it('derives average speed from distance ÷ moving time when Garmin omits it', async () => {
      const store = createMemoryStore();
      // `raw` carries no `averageSpeed`, but distance and moving time are both there.
      await store.putActivities('u', [
        act({ distanceM: 10_000, durationS: 3600, movingS: 3000, avgHr: 150, raw: {} })
      ]);

      const data = await loadActivityDetail({ store, settings: stubSettings({}) }, 'u', 'a');
      expect(data!.efficiency.ef).toBeCloseTo(1.333, 2);
    });

    it('carries the block with null leaves when the session has no heart rate', async () => {
      const store = createMemoryStore();
      await store.putActivities('u', [act({ avgHr: null, maxHr: null })]);

      const data = await loadActivityDetail({ store, settings: stubSettings({}) }, 'u', 'a');
      expect(data!.efficiency).toEqual({
        decoupling: null,
        ef: null,
        powerEf: null,
        cardiacCost: null
      });
    });

    it('computes the power efficiency factor from normalized power', async () => {
      const store = createMemoryStore();
      await store.putActivities('u', [act({ normPower: 210, avgHr: 150 })]);

      const data = await loadActivityDetail({ store, settings: stubSettings({}) }, 'u', 'a');
      expect(data!.efficiency.powerEf).toBe(1.4);
    });
  });

  describe('best efforts inside the activity (spec 040)', () => {
    /** A run of `seconds` at a steady `mps`, sampled once a second. */
    async function seedRun(mps: number, seconds: number, sport = 'running') {
      const store = createMemoryStore();
      await store.putActivities('u', [
        act({ sport, distanceM: mps * seconds, durationS: seconds, movingS: seconds })
      ]);
      await store.putStreams('u', 'a', {
        speed: new Array(seconds).fill(mps),
        time: Array.from({ length: seconds }, (_, i) => i)
      });
      return store;
    }

    it('finds every distance a run contained, shortest first', async () => {
      const store = await seedRun(4, 1600); // 6.4 km
      const data = await loadActivityDetail({ store, settings: stubSettings({}) }, 'u', 'a');
      expect(data!.bestEfforts.map((e) => e.key)).toEqual(['400m', '1k', 'mile', '5k']);
      const oneK = data!.bestEfforts.find((e) => e.key === '1k')!;
      expect(oneK.durationS).toBeCloseTo(250, 0);
      expect(oneK.paceSecPerKm).toBeCloseTo(250, 0);
    });

    it('offers nothing for a ride — the fastest kilometre of a descent is not a result', async () => {
      const store = await seedRun(10, 1200, 'cycling'); // 12 km by bike
      const data = await loadActivityDetail({ store, settings: stubSettings({}) }, 'u', 'a');
      expect(data!.bestEfforts).toEqual([]);
    });

    it('offers nothing when there is no speed stream to integrate', async () => {
      const store = createMemoryStore();
      await store.putActivities('u', [act({ sport: 'running' })]);
      await store.putStreams('u', 'a', { heartRate: new Array(600).fill(150) });

      const data = await loadActivityDetail({ store, settings: stubSettings({}) }, 'u', 'a');
      expect(data!.bestEfforts).toEqual([]);
    });

    it('offers nothing for a run too short to contain even the shortest target', async () => {
      const store = await seedRun(3, 100); // 300 m
      const data = await loadActivityDetail({ store, settings: stubSettings({}) }, 'u', 'a');
      expect(data!.bestEfforts).toEqual([]);
    });

    it('carries an empty array for an activity with no streams at all', async () => {
      const store = createMemoryStore();
      await store.putActivities('u', [act({ sport: 'running' })]);
      const data = await loadActivityDetail({ store, settings: stubSettings({}) }, 'u', 'a');
      expect(data!.bestEfforts).toEqual([]);
    });
  });

  describe('matched routes (spec 041)', () => {
    /** A ~2 km straight track north from Warsaw, `count` points 25 m apart. */
    function track(count = 80, lng = 21.0): Array<[number, number]> {
      const dLat = 25 / 111_320;
      return Array.from({ length: count }, (_, i) => [52.2 + i * dLat, lng] as [number, number]);
    }

    async function seed(
      rows: Array<{
        id: string;
        day: string;
        gps: Array<[number, number]>;
        sport?: string;
        movingS?: number;
        distanceM?: number;
      }>
    ) {
      const store = createMemoryStore();
      for (const r of rows) {
        await store.putActivities('u', [
          act({
            activityId: r.id,
            sport: r.sport ?? 'running',
            startTimeLocal: `${r.day} 09:00:00`,
            startTime: `${r.day}T09:00:00Z`,
            distanceM: r.distanceM ?? 1975,
            durationS: r.movingS ?? 600,
            movingS: r.movingS ?? 600
          })
        ]);
        await store.putStreams('u', r.id, { gps: r.gps });
      }
      return store;
    }

    it('finds earlier outings on the same route and ranks this one among them', async () => {
      const store = await seed([
        { id: 'a', day: '2026-05-01', gps: track(), movingS: 600 },
        { id: 'older-fast', day: '2026-04-01', gps: track(), movingS: 540 },
        { id: 'older-slow', day: '2026-03-01', gps: track(), movingS: 660 }
      ]);

      const data = await loadActivityDetail({ store, settings: stubSettings({}) }, 'u', 'a');
      const route = data!.matchedRoute!;
      expect(route.previousCount).toBe(2);
      // Fastest first: 540 s, then this one at 600 s, then 660 s.
      expect(route.entries.map((e) => e.activityId)).toEqual(['older-fast', 'a', 'older-slow']);
      expect(route.currentRank).toBe(2);
      expect(route.entries.find((e) => e.isCurrent)?.activityId).toBe('a');
    });

    it('says this was the fastest when it was', async () => {
      const store = await seed([
        { id: 'a', day: '2026-05-01', gps: track(), movingS: 500 },
        { id: 'older', day: '2026-04-01', gps: track(), movingS: 600 }
      ]);
      const data = await loadActivityDetail({ store, settings: stubSettings({}) }, 'u', 'a');
      expect(data!.matchedRoute!.currentRank).toBe(1);
      expect(data!.matchedRoute!.bestPaceSecPerKm).toBe(data!.matchedRoute!.entries[0]!.paceSecPerKm);
    });

    it('is null when no earlier outing matches', async () => {
      const store = await seed([
        { id: 'a', day: '2026-05-01', gps: track() },
        // A different place entirely.
        { id: 'elsewhere', day: '2026-04-01', gps: track(80, 19.9) }
      ]);
      const data = await loadActivityDetail({ store, settings: stubSettings({}) }, 'u', 'a');
      expect(data!.matchedRoute).toBeNull();
    });

    it('never matches across sport families', async () => {
      const store = await seed([
        { id: 'a', day: '2026-05-01', gps: track(), sport: 'running' },
        { id: 'ride', day: '2026-04-01', gps: track(), sport: 'cycling' }
      ]);
      const data = await loadActivityDetail({ store, settings: stubSettings({}) }, 'u', 'a');
      expect(data!.matchedRoute).toBeNull();
    });

    it('is null for an activity with no GPS at all', async () => {
      const store = createMemoryStore();
      await store.putActivities('u', [act({ sport: 'running', hasGps: false })]);
      const data = await loadActivityDetail({ store, settings: stubSettings({}) }, 'u', 'a');
      expect(data!.matchedRoute).toBeNull();
    });

    it('rejects a route that merely contains this one', async () => {
      const out = track();
      const store = await seed([
        { id: 'a', day: '2026-05-01', gps: out },
        // Out and back: same ground, twice the distance.
        { id: 'double', day: '2026-04-01', gps: [...out, ...[...out].reverse()] }
      ]);
      const data = await loadActivityDetail({ store, settings: stubSettings({}) }, 'u', 'a');
      expect(data!.matchedRoute).toBeNull();
    });

    it('reports the overlap per row so the match is never implied to be certain', async () => {
      const store = await seed([
        { id: 'a', day: '2026-05-01', gps: track() },
        { id: 'older', day: '2026-04-01', gps: track() }
      ]);
      const data = await loadActivityDetail({ store, settings: stubSettings({}) }, 'u', 'a');
      for (const e of data!.matchedRoute!.entries) {
        expect(e.similarity).toBeGreaterThan(0);
        expect(e.similarity).toBeLessThanOrEqual(1);
      }
      expect(data!.matchedRoute!.comparedCount).toBe(1);
    });

    it('never reads another user‘s tracks', async () => {
      const store = await seed([{ id: 'a', day: '2026-05-01', gps: track() }]);
      await store.putActivities('other', [
        act({ activityId: 'theirs', sport: 'running', startTimeLocal: '2026-04-01 09:00:00' })
      ]);
      await store.putStreams('other', 'theirs', { gps: track() });

      const data = await loadActivityDetail({ store, settings: stubSettings({}) }, 'u', 'a');
      expect(data!.matchedRoute).toBeNull();
    });
  });

  describe('grade-adjusted pace (spec 042)', () => {
    it('derives the stat Garmin does not provide, from the speed and grade streams', async () => {
      const store = createMemoryStore();
      await store.putActivities('u', [act({ sport: 'running', raw: {} })]);
      // Steady 3 m/s up a constant 10% climb: the flat equivalent is ~1.5× faster.
      await store.putStreams('u', 'a', {
        speed: new Array(600).fill(3),
        grade: new Array(600).fill(10),
        time: Array.from({ length: 600 }, (_, i) => i)
      });

      const data = await loadActivityDetail({ store, settings: stubSettings({}) }, 'u', 'a');
      const gap = data!.stats.pace.gradeAdjustedSecPerKm!;
      expect(gap).toBeGreaterThan(0);
      // 3 m/s is 333 s/km; a 1.5× flat-equivalent speed is ~222 s/km.
      expect(gap).toBeLessThan(250);
      expect(gap).toBeGreaterThan(200);
    });

    it('says a downhill effort was worth a slower flat pace', async () => {
      const store = createMemoryStore();
      await store.putActivities('u', [act({ sport: 'running', raw: {} })]);
      await store.putStreams('u', 'a', {
        speed: new Array(600).fill(3),
        grade: new Array(600).fill(-8),
        time: Array.from({ length: 600 }, (_, i) => i)
      });

      const data = await loadActivityDetail({ store, settings: stubSettings({}) }, 'u', 'a');
      // Slower than the raw 333 s/km.
      expect(data!.stats.pace.gradeAdjustedSecPerKm!).toBeGreaterThan(333);
    });

    it('leaves the stat absent when no grade stream was recorded', async () => {
      const store = createMemoryStore();
      await store.putActivities('u', [act({ sport: 'running', raw: {} })]);
      await store.putStreams('u', 'a', { speed: new Array(600).fill(3) });

      const data = await loadActivityDetail({ store, settings: stubSettings({}) }, 'u', 'a');
      expect(data!.stats.pace.gradeAdjustedSecPerKm).toBeUndefined();
    });

    it('is the only source of this stat — Garmin sends no grade-adjusted field to defer to', async () => {
      const store = createMemoryStore();
      // Even with a plausible-looking key in the payload, the extractor has no GAP field (spec 023's
      // closeout established that Garmin does not compute it), so the derived value is what appears.
      // The `??` in the handler is there for the day that changes, not for today.
      await store.putActivities('u', [act({ sport: 'running', raw: { gradeAdjustedSpeed: 4 } })]);
      await store.putStreams('u', 'a', {
        speed: new Array(600).fill(3),
        grade: new Array(600).fill(10)
      });

      const data = await loadActivityDetail({ store, settings: stubSettings({}) }, 'u', 'a');
      expect(data!.stats.pace.gradeAdjustedSecPerKm).toBeLessThan(250);
    });
  });

  it('keeps NP/curve but drops IF/TSS/zones when FTP is unknown and unestimable', async () => {
    const store = createMemoryStore();
    await store.putActivities('u', [act({ durationS: 300 })]);
    const power = new Array(300).fill(180); // 5 min — no 20-min point to estimate FTP from
    await store.putStreams('u', 'a', { power, time: power.map((_, i) => i) });

    const data = await loadActivityDetail({ store, settings: stubSettings({}) }, 'u', 'a');
    expect(data!.ftp).toBeNull();
    expect(data!.power).not.toBeNull();
    expect(data!.power?.np).toBe(180);
    expect(data!.power?.if).toBeNull();
    expect(data!.power?.tss).toBeNull();
    expect(data!.power?.zones).toEqual([]);
    expect(data!.power?.curve.length).toBeGreaterThan(0);
  });

  describe('pace shape (spec 045)', () => {
    it('reports the split balance and variability of a session', async () => {
      const store = createMemoryStore();
      await store.putActivities('u', [act({ sport: 'running' })]);
      // First half at 4 m/s, second at 3.2 m/s over 2.4 km — a clear fade.
      await store.putStreams('u', 'a', {
        speed: [...new Array(300).fill(4), ...new Array(375).fill(3.2)],
        time: Array.from({ length: 675 }, (_, i) => i)
      });

      const data = await loadActivityDetail({ store, settings: stubSettings({}) }, 'u', 'a');
      expect(data!.pacing).not.toBeNull();
      expect(data!.pacing!.shape).toBe('faded');
      expect(data!.pacing!.splitPct).toBeGreaterThan(0);
    });

    it('is offered for a ride too — pacing is not a running-only question', async () => {
      const store = createMemoryStore();
      await store.putActivities('u', [act({ sport: 'cycling' })]);
      await store.putStreams('u', 'a', {
        speed: new Array(600).fill(8),
        time: Array.from({ length: 600 }, (_, i) => i)
      });

      const data = await loadActivityDetail({ store, settings: stubSettings({}) }, 'u', 'a');
      expect(data!.pacing?.shape).toBe('even');
    });

    it('is null without a distance axis, and for a session too short to judge', async () => {
      const store = createMemoryStore();
      await store.putActivities('u', [act({ sport: 'running' })]);
      await store.putStreams('u', 'a', { heartRate: new Array(600).fill(150) });
      const noAxis = await loadActivityDetail({ store, settings: stubSettings({}) }, 'u', 'a');
      expect(noAxis!.pacing).toBeNull();

      const short = createMemoryStore();
      await short.putActivities('u', [act({ sport: 'running' })]);
      await short.putStreams('u', 'a', {
        speed: new Array(100).fill(4),
        time: Array.from({ length: 100 }, (_, i) => i)
      });
      const tooShort = await loadActivityDetail({ store: short, settings: stubSettings({}) }, 'u', 'a');
      expect(tooShort!.pacing).toBeNull();
    });
  });

  describe('climbs (spec 046)', () => {
    /** A steady ascent: `steps` samples, each covering 100 m and 20 s, rising `perStep` metres. */
    function ascent(steps: number, perStep: number) {
      const elevation: number[] = [100];
      const speed: number[] = [];
      const time: number[] = [0];
      for (let i = 0; i < steps; i++) {
        elevation.push((elevation[i] ?? 0) + perStep);
        // 100 m in 20 s → 5 m/s, and `cumulativeDistance` integrates speed × dt.
        speed.push(5);
        time.push((time[i] ?? 0) + 20);
      }
      speed.push(5);
      return { elevation, speed, time };
    }

    it('finds a climb and reports its VAM', async () => {
      const store = createMemoryStore();
      await store.putActivities('u', [act({ sport: 'cycling', elevationGainM: 60 })]);
      await store.putStreams('u', 'a', ascent(10, 6));

      const data = await loadActivityDetail({ store, settings: stubSettings({}) }, 'u', 'a');
      expect(data!.climbs).toHaveLength(1);
      expect(data!.climbs[0]!.gainM).toBe(60);
      expect(data!.climbs[0]!.vam).toBeGreaterThan(0);
    });

    it('finds nothing on a flat activity', async () => {
      const store = createMemoryStore();
      await store.putActivities('u', [act({ sport: 'cycling' })]);
      await store.putStreams('u', 'a', ascent(20, 0));

      const data = await loadActivityDetail({ store, settings: stubSettings({}) }, 'u', 'a');
      expect(data!.climbs).toEqual([]);
    });

    it('finds nothing without an elevation stream — a treadmill run has no climbs', async () => {
      const store = createMemoryStore();
      await store.putActivities('u', [act({ sport: 'running' })]);
      await store.putStreams('u', 'a', {
        speed: new Array(600).fill(3),
        time: Array.from({ length: 600 }, (_, i) => i)
      });

      const data = await loadActivityDetail({ store, settings: stubSettings({}) }, 'u', 'a');
      expect(data!.climbs).toEqual([]);
    });

    it('carries an empty array for an activity with no streams at all', async () => {
      const store = createMemoryStore();
      await store.putActivities('u', [act({})]);
      const data = await loadActivityDetail({ store, settings: stubSettings({}) }, 'u', 'a');
      expect(data!.climbs).toEqual([]);
    });
  });
});

/**
 * Spec 065. The matching itself is unit-tested in `similar-activities.test.ts`; what these cover is
 * the wiring — that the loader reads the right sessions, in both directions in time, and passes the
 * truncation flag through honestly.
 */
describe('similar activities (spec 065)', () => {
  it('finds comparable sessions of the same sport family', async () => {
    const store = createMemoryStore();
    await store.putActivities('u', [
      act({ activityId: 'a' }),
      // +5% on both axes — a match.
      act({
        activityId: 'near',
        startTimeLocal: '2026-03-01 09:00:00',
        distanceM: 42000,
        durationS: 3780,
        movingS: 3780
      }),
      // Half the distance — not a match.
      act({
        activityId: 'short',
        startTimeLocal: '2026-02-01 09:00:00',
        distanceM: 20000,
        durationS: 1800,
        movingS: 1800
      })
    ]);

    const data = await loadActivityDetail({ store, settings: stubSettings({}) }, 'u', 'a');

    expect(data?.similarActivities?.entries.map((e) => e.activityId)).toEqual(['near']);
    expect(data?.similarActivities?.comparedCount).toBe(2);
    expect(data?.similarActivities?.coversAllHistory).toBe(true);
  });

  it('looks FORWARD in time too, so two activities never disagree about being similar', async () => {
    const store = createMemoryStore();
    await store.putActivities('u', [
      act({ activityId: 'a' }),
      // Six weeks AFTER the activity being viewed. Spec 036's ranking must not see this; "what is
      // this comparable to" has no reason not to.
      act({ activityId: 'later', startTimeLocal: '2026-06-15 09:00:00' })
    ]);

    const data = await loadActivityDetail({ store, settings: stubSettings({}) }, 'u', 'a');
    expect(data?.similarActivities?.entries.map((e) => e.activityId)).toEqual(['later']);
  });

  it('ignores other sport families', async () => {
    const store = createMemoryStore();
    await store.putActivities('u', [
      act({ activityId: 'a', sport: 'cycling' }),
      // Identical numbers, wrong sport: 40 km of running is not a comparable effort to 40 km of riding.
      act({ activityId: 'run', sport: 'running', startTimeLocal: '2026-04-01 09:00:00' })
    ]);

    const data = await loadActivityDetail({ store, settings: stubSettings({}) }, 'u', 'a');
    expect(data?.similarActivities?.entries).toEqual([]);
    expect(data?.similarActivities?.comparedCount).toBe(0);
  });

  it('returns an empty list — not null — when the session is comparable but nothing matched', async () => {
    const store = createMemoryStore();
    await store.putActivities('u', [
      act({ activityId: 'a' }),
      act({
        activityId: 'other',
        startTimeLocal: '2026-04-01 09:00:00',
        distanceM: 5000,
        durationS: 900,
        movingS: 900
      })
    ]);

    const data = await loadActivityDetail({ store, settings: stubSettings({}) }, 'u', 'a');
    expect(data?.similarActivities).not.toBeNull();
    expect(data?.similarActivities?.entries).toEqual([]);
    expect(data?.similarActivities?.comparedCount).toBe(1);
  });

  it('returns null when the activity has no distance to match on', async () => {
    const store = createMemoryStore();
    await store.putActivities('u', [act({ activityId: 'a', distanceM: null })]);

    const data = await loadActivityDetail({ store, settings: stubSettings({}) }, 'u', 'a');
    // Distinct from an empty list: the card says "this cannot be compared", not "nothing was similar".
    expect(data?.similarActivities).toBeNull();
  });

  it('never lists the activity as similar to itself', async () => {
    const store = createMemoryStore();
    await store.putActivities('u', [act({ activityId: 'a' })]);

    const data = await loadActivityDetail({ store, settings: stubSettings({}) }, 'u', 'a');
    expect(data?.similarActivities?.entries).toEqual([]);
  });
});
