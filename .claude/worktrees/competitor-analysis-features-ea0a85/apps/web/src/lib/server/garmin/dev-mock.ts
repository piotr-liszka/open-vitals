/**
 * DEV-ONLY GarminService that serves believable, deterministic fixture data so the UI can be
 * built and screenshotted without real Garmin credentials. Wired only when GARMIN_ADAPTER=mock
 * (refused in production by config.ts). Never used in tests — use `createGarminMock` for those.
 */
import {
  type GarminActivityDetails,
  type GarminLoginInput,
  type GarminLoginResult,
  type GarminMetricName,
  type GarminMetricRange,
  type GarminStatus,
  type GarminSyncSource,
  type GarminWeighIn
} from '../interfaces';
import { eachDate } from './mock-adapter';

/** Deterministic 0..1 pseudo-random from a string seed (stable screenshots, no Math.random). */
function seeded(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  // map to [0,1)
  return ((h >>> 0) % 100000) / 100000;
}

/** Value that wobbles around `base` by ±`spread`, deterministic per (metric,date). */
function around(metric: string, date: string, base: number, spread: number): number {
  return Math.round((base + (seeded(`${metric}:${date}`) - 0.5) * 2 * spread) * 100) / 100;
}

function metricForDate(name: GarminMetricName, rawDate: string, salt: string): unknown {
  // Fold the per-user salt into the seed key so two users get different-but-stable fixtures, while
  // keeping the real date for any display fields (e.g. activity start times).
  const date = `${salt}:${rawDate}`;
  switch (name) {
    case 'steps':
      return {
        totalSteps: Math.round(around('steps', date, 9200, 3500)),
        stepGoal: 10000,
        distanceMeters: Math.round(around('dist', date, 7100, 2600)),
        activeMinutes: Math.round(around('active', date, 62, 30))
      };
    case 'resting_heart_rate':
      return { restingHeartRate: Math.round(around('rhr', date, 52, 5)), unit: 'bpm' };
    case 'body_battery': {
      /*
        Real Garmin shape: a per-reading array [epochMs, status, level, version]. The condition card
        draws these intraday (spec 052), so the fixture has to be a believable CURVE — charge
        overnight, peak around waking, drain through the day — not three loose readings. Garmin
        samples every ~3 min; 15 is plenty for a fixture. Slots are pinned to UTC midnight, which is
        a couple of hours off the wearer's local day and does not matter for fixture data.
      */
      const SLOT_MS = 15 * 60 * 1000;
      const SLOTS = 96;
      const WAKE_SLOT = 28; // 07:00
      const midnight = Date.parse(`${rawDate}T00:00:00Z`);
      const low = Math.round(around('bb-lo', date, 22, 8));
      const peak = Math.round(around('bb-hi', date, 86, 6));
      const dusk = Math.round(around('bb-cur', date, 38, 12));
      const lerp = (a: number, b: number, t: number): number => Math.round(a + (b - a) * t);
      return {
        bodyBatteryValuesArray: Array.from({ length: SLOTS }, (_, i) => {
          const level =
            i <= WAKE_SLOT
              ? lerp(low, peak, i / WAKE_SLOT)
              : lerp(peak, dusk, (i - WAKE_SLOT) / (SLOTS - 1 - WAKE_SLOT));
          return [midnight + i * SLOT_MS, 'MEASURED', Math.min(100, Math.max(5, level)), 3];
        })
      };
    }
    case 'sleep': {
      const total = Math.round(around('sleep-dur', date, 7.1 * 3600, 3600));
      const deep = Math.round(total * 0.18);
      const rem = Math.round(total * 0.22);
      const awake = Math.round(total * 0.06);
      // Real Garmin shape: the daily summary is nested under `dailySleepDTO`.
      return {
        dailySleepDTO: {
          sleepTimeSeconds: total,
          deepSleepSeconds: deep,
          remSleepSeconds: rem,
          lightSleepSeconds: total - deep - rem - awake,
          awakeSleepSeconds: awake
        },
        sleepScores: { overall: { value: Math.round(around('sleep-score', date, 78, 14)) } }
      };
    }
    case 'hrv':
      // Real Garmin shape: values live under `hrvSummary`.
      return {
        hrvSummary: {
          lastNightAvg: Math.round(around('hrv', date, 62, 12)),
          weeklyAvg: 60,
          status: seeded(`hrvstat:${date}`) > 0.3 ? 'BALANCED' : 'LOW'
        }
      };
    case 'stress':
      return {
        avgStressLevel: Math.round(around('stress', date, 34, 12)),
        maxStressLevel: Math.round(around('stress-max', date, 78, 12))
      };
    case 'spo2':
      // Sourced from the daily summary (garmy has no standalone spo2 metric).
      return {
        averageSpo2: Math.round(around('spo2', date, 96, 2)),
        lowestSpo2: Math.round(around('spo2-lo', date, 92, 3))
      };
    case 'respiration':
      return {
        avgWakingRespirationValue: Math.round(around('resp', date, 14, 2)),
        lowestRespirationValue: Math.round(around('resp-lo', date, 11, 2)),
        highestRespirationValue: Math.round(around('resp-hi', date, 19, 3))
      };
    case 'calories':
      return {
        totalKilocalories: Math.round(around('cal', date, 2650, 500)),
        activeKilocalories: Math.round(around('cal-act', date, 720, 350)),
        bmrKilocalories: 1680
      };
    case 'training_readiness': {
      /*
        Garmin's own readiness document (spec 059), camelCase as the API serves it. The sidecar has
        already unwrapped the single-item list, so this is one object per day. `recoveryTime` is the
        MINUTES Garmin says remain until full recovery (spec 070) — occasionally 0, which must read as
        "ready" rather than as missing data, so the fixture reaches zero on some days. Centred around
        18 h with a spread that reaches both "under an hour" and "past a day", so dev exercises all
        three branches of `fmtRecovery`.
      */
      const score = Math.round(around('tr-score', date, 46, 34));
      const clamped = Math.min(99, Math.max(1, score));
      const recovery = Math.max(0, Math.round(around('tr-rec', date, 18 * 60, 22 * 60)));
      return {
        calendarDate: rawDate,
        score: clamped,
        level: clamped >= 75 ? 'HIGH' : clamped >= 50 ? 'MODERATE' : clamped >= 25 ? 'LOW' : 'POOR',
        feedbackShort: 'RECOVERY_TIME_LIMITED',
        sleepScore: Math.round(around('tr-sleep', date, 78, 14)),
        sleepScoreFactorPercent: Math.round(around('tr-sleepf', date, 70, 25)),
        sleepHistoryFactorPercent: Math.round(around('tr-sleeph', date, 65, 25)),
        hrvFactorPercent: Math.round(around('tr-hrv', date, 60, 30)),
        hrvWeeklyAverage: Math.round(around('tr-hrvw', date, 61, 8)),
        recoveryTime: recovery,
        recoveryTimeFactorPercent: Math.round(around('tr-recf', date, 45, 40)),
        recoveryTimeChangePhrase: null,
        acwrFactorPercent: Math.round(around('tr-acwr', date, 72, 22)),
        acuteLoad: Math.round(around('tr-load', date, 290, 90)),
        stressHistoryFactorPercent: Math.round(around('tr-stress', date, 58, 28))
      };
    }
    case 'body_composition':
      return {
        weightKg: around('weight', date, 74.2, 0.6),
        bodyFatPct: around('bf', date, 17.5, 1.2),
        muscleMassKg: around('muscle', date, 34.1, 0.5)
      };
    case 'activities':
      return seeded(`act:${date}`) > 0.5
        ? [
            {
              type: 'running',
              name: 'Morning Run',
              durationSeconds: Math.round(around('act-dur', date, 2700, 900)),
              distanceMeters: Math.round(around('act-dist', date, 6500, 2500)),
              calories: Math.round(around('act-cal', date, 520, 180)),
              avgHeartRate: Math.round(around('act-hr', date, 148, 12)),
              startTime: `${rawDate}T06:40:00`
            }
          ]
        : [];
    default:
      return { name, date };
  }
}

/**
 * Build a dev GarminService whose fixtures are DETERMINISTIC PER USER: the `userId` seeds every
 * value, so two users see genuinely different data — the manual proof that per-user isolation holds.
 */
/** Sports the dev fixtures cycle through (typeKey values mirror Garmin's). */
const DEV_SPORTS = ['cycling', 'virtual_ride', 'running', 'walking', 'hiking'] as const;
/** How many activities the dev backfill exposes (spans ~500 days newest-first). */
const DEV_ACTIVITY_COUNT = 140;

/** Deterministic activity #index (0 = most recent). Believable Garmin-shaped summary dict. */
function devActivity(salt: string, index: number): Record<string, unknown> {
  const s = (k: string) => seeded(`${salt}:act${index}:${k}`);
  const daysAgo = Math.round(index * 3.4 + s('jitter') * 2); // ~every 3–4 days
  const start = new Date(Date.UTC(2026, 7, 8) - daysAgo * 86400_000);
  const yyyy = start.getUTCFullYear();
  const mm = String(start.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(start.getUTCDate()).padStart(2, '0');
  const hh = String(6 + Math.floor(s('hour') * 12)).padStart(2, '0');
  const local = `${yyyy}-${mm}-${dd} ${hh}:15:00`;
  const sport = DEV_SPORTS[index % DEV_SPORTS.length]!;
  const isRide = sport === 'cycling' || sport === 'virtual_ride';
  const isVirtual = sport === 'virtual_ride';
  const dur = Math.round(isRide ? 3600 + s('d') * 5400 : 1800 + s('d') * 3600);
  const dist = Math.round(isRide ? 25000 + s('dist') * 60000 : 5000 + s('dist') * 12000);
  const avgP = isRide ? Math.round(150 + s('p') * 90) : 0;
  return {
    activityId: 900000 + index,
    activityName: isVirtual
      ? 'Zwift - Pacer Group Ride'
      : isRide
        ? 'Road Ride'
        : sport === 'running'
          ? 'Tempo Run'
          : 'Easy Walk',
    activityType: { typeKey: sport },
    startTimeLocal: local,
    startTimeGMT: `${yyyy}-${mm}-${dd} ${hh}:15:00`,
    distance: dist,
    duration: dur,
    movingDuration: Math.round(dur * 0.96),
    elevationGain: Math.round(isRide ? 100 + s('e') * 900 : 30 + s('e') * 300),
    averageHR: Math.round(120 + s('hr') * 40),
    maxHR: Math.round(160 + s('hrm') * 25),
    avgPower: avgP,
    maxPower: avgP ? Math.round(avgP * (2.5 + s('pm'))) : 0,
    normPower: avgP ? Math.round(avgP * 1.08) : 0,
    calories: Math.round(isRide ? 600 + s('c') * 900 : 300 + s('c') * 400),
    bmrCalories: Math.round((dur / 60) * 1.2),
    activityTrainingLoad: Math.round(40 + s('tl') * 120),
    hasPolyline: !isVirtual, // virtual rides carry a synthetic map in reality; keep them non-GPS here
    // The rich fields Garmin already returns on the activity list (spec 023) — the detail page
    // projects these out of `raw`, so the dev fixtures must carry them or the page looks empty.
    aerobicTrainingEffect: Math.round((2 + s('ate') * 3) * 10) / 10,
    anaerobicTrainingEffect: Math.round(s('nte') * 2 * 10) / 10,
    trainingEffectLabel: isRide ? 'TEMPO' : 'AEROBIC_BASE',
    waterEstimated: Math.round(400 + s('w') * 900),
    avgRespirationRate: Math.round((26 + s('rr') * 8) * 10) / 10,
    minRespirationRate: Math.round((14 + s('rrl') * 4) * 10) / 10,
    maxRespirationRate: Math.round((38 + s('rrh') * 8) * 10) / 10,
    hrTimeInZone_1: Math.round(dur * 0.15),
    hrTimeInZone_2: Math.round(dur * 0.35),
    hrTimeInZone_3: Math.round(dur * 0.3),
    hrTimeInZone_4: Math.round(dur * 0.15),
    hrTimeInZone_5: Math.round(dur * 0.05),
    elapsedDuration: Math.round(dur * 1.02),
    elevationLoss: Math.round(isRide ? 100 + s('el') * 900 : 30 + s('el') * 300),
    minElevation: Math.round(80 + s('mine') * 40),
    maxElevation: Math.round(200 + s('maxe') * 600),
    averageSpeed: Math.round((dist / dur) * 100) / 100,
    maxSpeed: Math.round((dist / dur) * 1.6 * 100) / 100,
    minTemperature: Math.round(10 + s('tmin') * 6),
    maxTemperature: Math.round(22 + s('tmax') * 8),
    moderateIntensityMinutes: Math.round(dur / 120),
    vigorousIntensityMinutes: Math.round(dur / 240),
    differenceBodyBattery: -Math.round(10 + s('bb') * 30),
    differenceStress: Math.round(s('ds') * 20 - 10),
    avgStress: Math.round(30 + s('as') * 25),
    maxStress: Math.round(70 + s('ms') * 25),
    beginPotentialStamina: Math.round(92 + s('bps') * 8),
    endPotentialStamina: Math.round(60 + s('eps') * 25),
    minAvailableStamina: Math.round(20 + s('mas') * 30),
    ...(isRide
      ? {}
      : {
          averageRunningCadenceInStepsPerMinute: Math.round(168 + s('rc') * 10),
          maxRunningCadenceInStepsPerMinute: Math.round(184 + s('rcm') * 10),
          avgStrideLength: Math.round(110 + s('sl') * 20),
          avgVerticalRatio: Math.round((7 + s('vr')) * 10) / 10,
          avgVerticalOscillation: Math.round((8.5 + s('vo')) * 10) / 10,
          avgGroundContactBalance: Math.round((49 + s('gcb') * 2) * 10) / 10,
          avgGroundContactTime: Math.round(240 + s('gct') * 30)
        })
  };
}

export function createDevGarminMock(userId: string): GarminSyncSource {
  const salt = userId;
  const status: GarminStatus = {
    authenticated: true,
    // Vary the display name per user so isolation is visible at a glance in the UI.
    displayName: `Dev Athlete ${salt.slice(0, 6)}`,
    expiresAt: '2027-01-01T00:00:00Z'
  };
  return {
    async login(_input: GarminLoginInput): Promise<GarminLoginResult> {
      return { outcome: 'success', status };
    },
    async getStatus(): Promise<GarminStatus> {
      return status;
    },
    async getMetric(name: GarminMetricName, date?: string): Promise<unknown> {
      const day = date ?? new Date().toISOString().slice(0, 10);
      return { metric: name, date: day, data: metricForDate(name, day, salt) };
    },
    async getMetricRange(name: GarminMetricName, start: string, end: string): Promise<GarminMetricRange> {
      const days = eachDate(start, end).map((date) => ({ date, data: metricForDate(name, date, salt) }));
      return { metric: name, start, end, days };
    },
    async disconnect(): Promise<void> {
      // dev mock stays connected
    },

    async listActivitiesPage(limit: number, start: number): Promise<unknown[]> {
      if (start >= DEV_ACTIVITY_COUNT) return [];
      const end = Math.min(start + limit, DEV_ACTIVITY_COUNT);
      const page: unknown[] = [];
      for (let i = start; i < end; i++) page.push(devActivity(salt, i));
      return page;
    },

    async getActivityDetails(activityId: string): Promise<GarminActivityDetails> {
      const index = Number(activityId) - 900000;
      const a = devActivity(salt, Number.isFinite(index) && index >= 0 ? index : 0);
      const hasGps = a.hasPolyline === true;
      const isRun =
        a.activityType &&
        typeof a.activityType === 'object' &&
        (a.activityType as { typeKey?: string }).typeKey === 'running';
      const n = 120;
      const s = (k: string) => seeded(`${salt}:det${activityId}:${k}`);
      const baseLat = 50.02 + (s('lat') - 0.5) * 0.4; // around central Germany, per-activity offset
      const baseLng = 8.34 + (s('lng') - 0.5) * 0.4;
      const avgP = typeof a.avgPower === 'number' ? (a.avgPower as number) : 0;
      const duration = typeof a.duration === 'number' ? (a.duration as number) : 3600;
      const gps: Array<[number, number, number]> = [];
      const heartRate: number[] = [];
      const power: number[] = [];
      const time: number[] = [];
      const elevation: number[] = [];
      const cadence: number[] = [];
      const respirationRate: number[] = [];
      const temperature: number[] = [];
      const groundContactTime: number[] = [];
      const verticalOscillation: number[] = [];
      const verticalRatio: number[] = [];
      const strideLength: number[] = [];
      const moving: number[] = [];
      const speed: number[] = [];
      // Real Garmin always sends `speed`, and it is the ONLY thing the distance axis and the best
      // efforts (specs 040/054) can be integrated from — without it dev-mock silently has no
      // distance-over-time at all. Centre it on the summary's own distance/duration so the
      // integrated `Σ v·Δt` lands back on the distance the activity claims.
      const avgSpeedMps =
        typeof a.distance === 'number' && duration > 0 ? (a.distance as number) / duration : 0;
      for (let i = 0; i < n; i++) {
        const t = i / n;
        const ang = t * Math.PI * 2;
        if (hasGps) {
          gps.push([
            Math.round((baseLat + Math.sin(ang) * 0.03 + s(`la${i}`) * 0.001) * 1e5) / 1e5,
            Math.round((baseLng + Math.cos(ang) * 0.045 + s(`ln${i}`) * 0.001) * 1e5) / 1e5,
            Math.round(180 + Math.sin(ang * 3) * 60)
          ]);
          elevation.push(Math.round(180 + Math.sin(ang * 3) * 60));
        }
        heartRate.push(Math.round(120 + Math.sin(ang * 2) * 20 + s(`h${i}`) * 8));
        if (avgP)
          power.push(
            Math.max(0, Math.round(avgP + Math.sin(ang * 5) * avgP * 0.6 + (s(`p${i}`) - 0.5) * 80))
          );
        time.push(Math.round((i / n) * duration));
        cadence.push(Math.round((isRun ? 172 : 88) + Math.sin(ang * 4) * 6));
        respirationRate.push(Math.round((28 + Math.sin(ang * 2) * 6) * 10) / 10);
        temperature.push(Math.round((18 + Math.sin(ang) * 4) * 10) / 10);
        const isMoving = !(isRun && i % 37 === 0);
        moving.push(isMoving ? 1 : 0); // occasional walk break on runs
        if (avgSpeedMps > 0) {
          // A surge/fade shape plus jitter, so the fastest 1 km is a real window rather than the
          // whole activity at one flat pace; the walk breaks drop to a walk, not to a standstill.
          const shape = 1 + Math.sin(ang * 3) * 0.22 + (s(`v${i}`) - 0.5) * 0.08;
          speed.push(Math.round(avgSpeedMps * shape * (isMoving ? 1 : 0.35) * 1000) / 1000);
        }
        if (isRun) {
          groundContactTime.push(Math.round(250 + Math.sin(ang * 3) * 15));
          verticalOscillation.push(Math.round((9 + Math.sin(ang * 3) * 0.8) * 10) / 10);
          verticalRatio.push(Math.round((7.5 + Math.sin(ang * 3) * 0.4) * 10) / 10);
          strideLength.push(Math.round(118 + Math.sin(ang * 3) * 8));
        }
      }
      const lapCount = 4;
      const laps: GarminActivityDetails['laps'] = Array.from({ length: lapCount }, (_, i) => ({
        index: i + 1,
        distanceM: Math.round((typeof a.distance === 'number' ? (a.distance as number) : 10000) / lapCount),
        durationS: Math.round(duration / lapCount),
        movingDurationS: Math.round((duration / lapCount) * 0.97),
        avgHr: Math.round(135 + i * 4),
        maxHr: Math.round(150 + i * 4),
        ...(avgP ? { avgPower: Math.round(avgP * (0.9 + i * 0.05)) } : {}),
        ...(isRun ? { avgRunCadenceSpm: 170 + i, avgStrideLengthCm: 116 + i * 2 } : {}),
        intensityType: 'ACTIVE'
      }));
      const details: GarminActivityDetails = {
        activityId,
        summary: a,
        heartRate,
        time,
        cadence,
        respirationRate,
        temperature,
        moving,
        laps
      };
      if (hasGps) {
        details.gps = gps;
        details.elevation = elevation;
      }
      if (avgP) details.power = power;
      if (speed.length > 0) details.speed = speed;
      if (isRun) {
        details.groundContactTime = groundContactTime;
        details.verticalOscillation = verticalOscillation;
        details.verticalRatio = verticalRatio;
        details.strideLength = strideLength;
        // Garmin's run/walk classification, aggregated the way /typedsplits reports it.
        const walkS = Math.round((duration * moving.filter((m) => m === 0).length) / n);
        details.typedSplits = [
          {
            index: 1,
            type: 'RWD_RUN',
            durationS: duration - walkS,
            distanceM: typeof a.distance === 'number' ? (a.distance as number) : 10000,
            count: 3
          },
          { index: 2, type: 'RWD_WALK', durationS: walkS, distanceM: 120, count: 3 }
        ];
      }
      return details;
    },

    async getWeightRange(start: string, end: string): Promise<GarminWeighIn[]> {
      // A weigh-in roughly every 4 days across the range, deterministic per user.
      const out: GarminWeighIn[] = [];
      for (const date of eachDate(start, end)) {
        if (seeded(`${salt}:weigh:${date}`) > 0.25) continue;
        out.push({
          day: date,
          weightKg: around('weight', `${salt}:${date}`, 74.2, 0.8),
          raw: { source: 'dev' }
        });
      }
      return out;
    },

    /* ---- workout writes (spec 050) ----
     * Accepted and given a fake id so the whole authoring → push flow is exercisable in dev with no
     * Garmin account. Nothing leaves the process: `make dev` must never touch a real calendar. The
     * counter (rather than a random id) keeps dev runs reproducible.
     */
    async createWorkout() {
      devWorkoutSeq += 1;
      return { supported: true, workoutId: `dev-w-${devWorkoutSeq}`, reason: null };
    },
    async scheduleWorkout(garminWorkoutId) {
      return { supported: true, scheduleId: `dev-s-${garminWorkoutId}`, reason: null };
    },
    async deleteWorkout() {
      return { supported: true, removed: true };
    }
  };
}

/** Module-level so ids stay unique across the sources built per request in dev. */
let devWorkoutSeq = 0;
