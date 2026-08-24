import { describe, it, expect } from 'vitest';
import {
  ASSUMPTION_NIGHTS,
  MAX_PROJECTION_DAYS,
  computeForecast,
  projectHrvClearance,
  type ForecastInputs
} from './insights.forecast';
import type { DayPoint, HrvStatus, ReadinessLimit } from './insights.types';

const CAPTURED = Date.UTC(2026, 7, 17, 5, 5, 19);
/** 1297 minutes on from the capture instant: 2026-08-18 02:42:19 UTC. */
const ENDS_AT = CAPTURED + 1297 * 60_000;

const HRV: HrvStatus = {
  day: '2026-08-17',
  status: 'unbalanced',
  weeklyAvg: 99,
  lastNightAvg: 113,
  balancedLow: 102,
  balancedUpper: 133
};

/**
 * A week whose 7-night mean (95.3) is below the floor of 102 while the last three nights have already
 * come back above it — the shape of a recovery in progress, where the window mean clears purely by the
 * bad nights ageing out.
 */
const RECOVERING = [80, 85, 90, 95, 102, 105, 110];

/**
 * The shape the 17.08 payload actually had: a weekly average of 99 carried by ONE good night (113) with
 * the rest still depressed. The median of the last three sits under the floor, so there is nothing to
 * extrapolate from and the projection must refuse.
 */
const STILL_DEPRESSED = [104, 96, 95, 88, 92, 90, 113];

function nights(values: number[], start = '2026-08-11'): DayPoint[] {
  const base = new Date(`${start}T00:00:00Z`);
  return values.map((value, i) => {
    const d = new Date(base);
    d.setUTCDate(d.getUTCDate() + i);
    return { date: d.toISOString().slice(0, 10), value };
  });
}

const RECOVERY: ReadinessLimit = {
  key: 'recovery',
  labelKey: 'readiness.limit.recovery',
  ceiling: 70,
  minutes: 1297,
  detail: null,
  clearsAt: null,
  clearsOn: null,
  confidence: 'unknown'
};

const HRV_LIMIT: ReadinessLimit = {
  key: 'hrv',
  labelKey: 'readiness.limit.hrv',
  ceiling: 57,
  detail: '99 ms · 102–133',
  clearsAt: null,
  clearsOn: null,
  confidence: 'unknown'
};

const LOAD_LIMIT: ReadinessLimit = {
  key: 'load',
  labelKey: 'readiness.limit.load',
  ceiling: 36,
  detail: null,
  clearsAt: null,
  clearsOn: null,
  confidence: 'unknown'
};

function inputs(over: Partial<ForecastInputs> = {}): ForecastInputs {
  return {
    limits: [],
    hrv: HRV,
    hrvNights: nights(RECOVERING),
    hrvWindowNights: 7,
    today: '2026-08-17',
    nowMs: CAPTURED,
    recoveryEndsAt: ENDS_AT,
    recoverySuperseded: false,
    timeZone: 'UTC',
    ...over
  };
}

describe('projectHrvClearance', () => {
  /**
   * The 17.08 situation: a window mean of 99 against a floor of 102, with the bad nights of 14–16.08
   * still inside the window. Nothing about HRV has to *improve* for this to clear — those nights simply
   * have to roll out, which is exactly what a reader cannot see and a simulation can.
   */
  it('clears once the bad nights roll out of the window', () => {
    const projected = projectHrvClearance(inputs())!;
    expect(projected).not.toBeNull();
    expect(projected.assumedNightly).toBe(105); // median of [102, 105, 110]
    // Window mean 95.3 → 98.9 → 101.7 → 103.9: three nights, no improvement required.
    expect(projected.day).toBe('2026-08-20');
  });

  /**
   * The honest refusal, on the real 17.08 trajectory. One good night inside a depressed week is not
   * evidence of a return, and a date derived from it would be a guess wearing a forecast's clothes.
   */
  it('refuses when the recent nights are themselves still below the floor', () => {
    expect(projectHrvClearance(inputs({ hrvNights: nights(STILL_DEPRESSED) }))).toBeNull();
  });

  it('refuses with fewer nights than the assumption needs', () => {
    const tooFew = nights([110, 115]).slice(0, ASSUMPTION_NIGHTS - 1);
    expect(projectHrvClearance(inputs({ hrvNights: tooFew }))).toBeNull();
  });

  it('refuses without a band, a today, or an HRV reading', () => {
    expect(projectHrvClearance(inputs({ hrv: { ...HRV, balancedLow: null } }))).toBeNull();
    expect(projectHrvClearance(inputs({ today: null }))).toBeNull();
    expect(projectHrvClearance(inputs({ hrv: null }))).toBeNull();
  });

  /**
   * A clearance can never be further out than the window is long: once every night in the window has
   * been replaced by the assumed value, the mean IS the assumed value, which the projection already
   * established is at or above the floor. `MAX_PROJECTION_DAYS` is therefore a terminating guard rather
   * than a limit the maths reaches.
   */
  it('always lands inside the window length, deeply depressed or not', () => {
    const projected = projectHrvClearance(inputs({ hrvNights: nights([10, 10, 10, 10, 103, 103, 103]) }))!;
    expect(projected).not.toBeNull();
    const daysOut = Number(projected.day.slice(-2)) - 17;
    expect(daysOut).toBeLessThanOrEqual(7);
    expect(daysOut).toBeLessThanOrEqual(MAX_PROJECTION_DAYS);
  });
});

describe('computeForecast', () => {
  it('answers "today" when nothing is capping', () => {
    const forecast = computeForecast(inputs({ limits: [] }));
    expect(forecast.fullyReadyAt).toBe('2026-08-17');
    expect(forecast.limits).toEqual([]);
  });

  it("dates the recovery timer exactly, from Garmin's own capture instant", () => {
    const forecast = computeForecast(inputs({ limits: [RECOVERY] }));
    expect(forecast.recoveredAt).toBe(ENDS_AT);
    const recovery = forecast.limits[0]!;
    expect(recovery.confidence).toBe('exact');
    expect(recovery.clearsAt).toBe(ENDS_AT);
    expect(recovery.clearsOn).toBe('2026-08-18');
    expect(forecast.fullyReadyAt).toBe('2026-08-18');
  });

  it('projects HRV and takes the LATER of the two constraints', () => {
    const forecast = computeForecast(inputs({ limits: [HRV_LIMIT, RECOVERY] }));
    const hrv = forecast.limits.find((l) => l.key === 'hrv')!;
    expect(hrv.confidence).toBe('projected');
    expect(hrv.clearsOn).not.toBeNull();
    expect(hrv.clearsOn).toBe('2026-08-20');
    // The later of the two: HRV on the 20th, not the timer's own 18th.
    expect(forecast.fullyReadyAt).toBe('2026-08-20');
  });

  it('reports no recovery instant once a later activity has superseded the reading', () => {
    const forecast = computeForecast(inputs({ limits: [RECOVERY], recoverySuperseded: true }));
    expect(forecast.recoveredAt).toBeNull();
    expect(forecast.limits[0]!.confidence).toBe('unknown');
    expect(forecast.fullyReadyAt).toBeNull();
  });

  it('reports no recovery instant when the payload carried no capture time', () => {
    const forecast = computeForecast(inputs({ limits: [RECOVERY], recoveryEndsAt: null }));
    expect(forecast.recoveredAt).toBeNull();
    expect(forecast.fullyReadyAt).toBeNull();
  });

  /**
   * The most misleading thing this card could say is a confident date that quietly ignores a constraint
   * it cannot project. Load has no projection in spec 084, so it poisons the answer by design.
   */
  it('refuses a date when any active limit is unprojectable', () => {
    const forecast = computeForecast(inputs({ limits: [HRV_LIMIT, LOAD_LIMIT] }));
    expect(forecast.limits.find((l) => l.key === 'load')!.confidence).toBe('unknown');
    expect(forecast.fullyReadyAt).toBeNull();
  });

  it('keeps every limit it was given, capping or not', () => {
    const forecast = computeForecast(inputs({ limits: [HRV_LIMIT, RECOVERY, LOAD_LIMIT] }));
    expect(forecast.limits.map((l) => l.key)).toEqual(['hrv', 'recovery', 'load']);
  });
});
