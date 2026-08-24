import { describe, it, expect } from 'vitest';
import {
  calorieSplit,
  extractActivityStats,
  idleSeconds,
  paceFromSpeed,
  paceSecPerKm,
  runWalkFromSplits,
  streamAverage,
  totalIntensityMinutes
} from './activity-stats';

/** A realistic slice of Garmin's activity-list payload (the shape stored in `synced_activities.raw`). */
const RAW_RUN = {
  activityId: 1,
  distance: 10000,
  duration: 3000,
  movingDuration: 2940,
  elapsedDuration: 3100,
  calories: 700,
  bmrCalories: 60,
  waterEstimated: 850,
  avgRespirationRate: 31.2,
  minRespirationRate: 14.5,
  maxRespirationRate: 42.1,
  aerobicTrainingEffect: 3.6,
  anaerobicTrainingEffect: 1.1,
  trainingEffectLabel: 'TEMPO',
  activityTrainingLoad: 143.2,
  beginPotentialStamina: 96,
  endPotentialStamina: 71,
  minAvailableStamina: 34,
  averageHR: 152,
  maxHR: 178,
  hrTimeInZone_1: 120,
  hrTimeInZone_2: 600,
  hrTimeInZone_3: 1500,
  hrTimeInZone_4: 700,
  hrTimeInZone_5: 80,
  elevationGain: 120,
  elevationLoss: 118,
  minElevation: 44,
  maxElevation: 96,
  averageSpeed: 3.33,
  maxSpeed: 4.5,
  minTemperature: 12,
  maxTemperature: 19,
  moderateIntensityMinutes: 12,
  vigorousIntensityMinutes: 34,
  differenceBodyBattery: -28,
  avgStress: 41,
  maxStress: 88,
  startStress: 30,
  endStress: 55,
  differenceStress: 25,
  averageRunningCadenceInStepsPerMinute: 172.4,
  maxRunningCadenceInStepsPerMinute: 190.6,
  avgStrideLength: 118.3,
  avgVerticalRatio: 7.4,
  avgVerticalOscillation: 9.1,
  avgGroundContactBalance: 49.6,
  avgGroundContactTime: 251,
  directWorkoutRpe: 70,
  directWorkoutFeel: 75
};

describe('derivations', () => {
  it('paceSecPerKm converts distance + duration and rejects nonsense', () => {
    expect(paceSecPerKm(10000, 3000)).toBe(300); // 5:00 /km
    expect(paceSecPerKm(0, 3000)).toBeUndefined();
    expect(paceSecPerKm(10000, 0)).toBeUndefined();
    expect(paceSecPerKm(undefined, 3000)).toBeUndefined();
    expect(paceSecPerKm(-5, 3000)).toBeUndefined();
  });

  it('paceFromSpeed inverts m/s into sec/km', () => {
    expect(paceFromSpeed(4)).toBe(250);
    expect(paceFromSpeed(0)).toBeUndefined();
    expect(paceFromSpeed(undefined)).toBeUndefined();
  });

  it('calorieSplit derives active from total minus resting', () => {
    expect(calorieSplit(700, 60)).toEqual({ total: 700, resting: 60, active: 640 });
    // Never negative, even on an inconsistent payload.
    expect(calorieSplit(50, 60).active).toBe(0);
    expect(calorieSplit(700, undefined)).toEqual({ total: 700 });
    expect(calorieSplit(undefined, 60)).toEqual({ resting: 60 });
    expect(calorieSplit(undefined, undefined)).toEqual({});
  });

  it('idleSeconds is duration minus moving, floored at zero', () => {
    expect(idleSeconds(3000, 2940)).toBe(60);
    expect(idleSeconds(3000, 3100)).toBe(0);
    expect(idleSeconds(3000, undefined)).toBeUndefined();
  });

  it('totalIntensityMinutes counts vigorous minutes double', () => {
    expect(totalIntensityMinutes(12, 34)).toBe(80);
    expect(totalIntensityMinutes(12, undefined)).toBe(12);
    expect(totalIntensityMinutes(undefined, 5)).toBe(10);
    expect(totalIntensityMinutes(undefined, undefined)).toBeUndefined();
  });

  it('runWalkFromSplits sums Garmin run/walk/stand splits', () => {
    const stats = runWalkFromSplits([
      { index: 1, type: 'RWD_RUN', durationS: 400 },
      { index: 2, type: 'RWD_WALK', durationS: 60 },
      { index: 3, type: 'RWD_RUN', durationS: 500 },
      { index: 4, type: 'RWD_STAND', durationS: 30 },
      { index: 5, type: 'INTERVAL_ACTIVE' } // no duration → ignored
    ]);
    expect(stats).toEqual({ runS: 900, walkS: 60, idleS: 30 });
  });

  it('runWalkFromSplits is empty without typed splits', () => {
    expect(runWalkFromSplits(undefined)).toEqual({});
    expect(runWalkFromSplits([])).toEqual({});
    expect(runWalkFromSplits([{ index: 1, type: 'INTERVAL_ACTIVE', durationS: 100 }])).toEqual({});
  });

  it('streamAverage means a stream and ignores junk', () => {
    expect(streamAverage([10, 20, 30])).toBe(20);
    expect(streamAverage([])).toBeUndefined();
    expect(streamAverage(undefined)).toBeUndefined();
  });
});

describe('extractActivityStats', () => {
  it('projects the rich fields Garmin already returns in the raw payload', () => {
    const s = extractActivityStats(RAW_RUN);

    expect(s.calories).toEqual({ total: 700, resting: 60, active: 640 });
    expect(s.hydration.sweatLossMl).toBe(850);
    expect(s.respiration).toEqual({ avg: 31.2, min: 14.5, max: 42.1 });
    expect(s.trainingEffect).toEqual({ aerobic: 3.6, anaerobic: 1.1, label: 'TEMPO', load: 143.2 });
    expect(s.stamina).toEqual({ beginPotential: 96, endPotential: 71, min: 34 });
    expect(s.hr).toEqual({ avg: 152, max: 178, timeInZoneS: [120, 600, 1500, 700, 80] });
    expect(s.timing).toEqual({ durationS: 3000, movingS: 2940, elapsedS: 3100, idleS: 60 });
    expect(s.elevation).toEqual({ gainM: 120, lossM: 118, minM: 44, maxM: 96 });
    expect(s.pace.avgSecPerKm).toBe(300);
    expect(s.pace.avgMovingSecPerKm).toBe(294);
    expect(s.pace.bestSecPerKm).toBe(222);
    expect(s.pace.avgSpeedMps).toBe(3.33);
    expect(s.runningDynamics).toEqual({
      avgCadenceSpm: 172,
      maxCadenceSpm: 191,
      avgStrideLengthCm: 118.3,
      avgVerticalRatio: 7.4,
      avgVerticalOscillationCm: 9.1,
      avgGroundContactBalancePct: 49.6,
      avgGroundContactTimeMs: 251
    });
    expect(s.temperature).toEqual({ minC: 12, maxC: 19 }); // no avg in the list payload
    expect(s.intensityMinutes).toEqual({ moderate: 12, vigorous: 34, total: 80 });
    expect(s.bodyBattery.difference).toBe(-28);
    expect(s.stress).toEqual({ avg: 41, max: 88, start: 30, end: 55, difference: 25 });
    // Garmin stores RPE ×10; surface the 0–10 scale the UI labels.
    expect(s.selfEvaluation).toEqual({ perceivedEffort: 7, feel: 75 });
    // Run/walk is NOT in the summary payload — it comes from typed splits.
    expect(s.runWalk).toEqual({});
  });

  it('omits every field the payload does not carry (no nulls, no throws)', () => {
    const s = extractActivityStats({ activityId: 9, duration: 600 });

    expect(s.timing).toEqual({ durationS: 600 });
    expect(s.calories).toEqual({});
    expect(s.runningDynamics).toEqual({});
    expect(s.hr).toEqual({});
    expect(s.pace).toEqual({});
    expect(s.trainingEffect).toEqual({});
  });

  it('never throws on a hostile or absent payload', () => {
    for (const raw of [
      null,
      undefined,
      'nope',
      42,
      [],
      { duration: 'long', calories: NaN, hrTimeInZone_1: null }
    ]) {
      const s = extractActivityStats(raw);
      expect(s.timing).toEqual({});
      expect(s.hr.timeInZoneS).toBeUndefined();
    }
  });

  it('reports partial HR zones with the missing zones as zero', () => {
    const s = extractActivityStats({ hrTimeInZone_2: 300 });
    expect(s.hr.timeInZoneS).toEqual([0, 300, 0, 0, 0]);
  });
});
