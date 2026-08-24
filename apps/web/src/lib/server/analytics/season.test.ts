import { describe, it, expect } from 'vitest';
import { MIN_HISTORY_DAYS, RAMP_HIGH, type LoadRisk } from './load-risk';
import type { DailyLoadPoint } from './training-load';
import {
  BASE_DAYS,
  BUILD_DAYS,
  CTL_TOLERANCE,
  PEAK_DAYS,
  RACE_WEEK_DAYS,
  TAPER_DAYS,
  TAPER_MAX_RATIO,
  daysOutTo,
  goalPhase,
  goalStatus,
  inTaperWindow,
  projectCtl,
  requiredRamp,
  taperCheck
} from './season';
import { addDays } from '$lib/date';

/** A PMC of `days` days ending on `end`, with a per-day TSS the test controls. */
function series(days: number, end: string, tssAt: number | ((i: number) => number)): DailyLoadPoint[] {
  const start = addDays(end, -(days - 1));
  return Array.from({ length: days }, (_, i) => ({
    day: addDays(start, i),
    tss: typeof tssAt === 'function' ? tssAt(i) : tssAt,
    ctl: 50,
    atl: 50,
    tsb: 0
  }));
}

/** A risk verdict with enough history to be trusted, unless the test says otherwise. */
function risk(over: Partial<LoadRisk> = {}): LoadRisk {
  return {
    acwr: 1.0,
    rampRatePerWeek: 2,
    band: 'building',
    advice: '',
    historyDays: 120,
    ...over
  };
}

describe('goalPhase', () => {
  it('calls a goal already behind the athlete done', () => {
    expect(goalPhase(-1)).toBe('done');
    expect(goalPhase(-40)).toBe('done');
  });

  it('turns over on the exact boundary day, not the one after', () => {
    expect(goalPhase(0)).toBe('race-week');
    expect(goalPhase(RACE_WEEK_DAYS - 1)).toBe('race-week');
    expect(goalPhase(RACE_WEEK_DAYS)).toBe('taper');
    expect(goalPhase(TAPER_DAYS - 1)).toBe('taper');
    expect(goalPhase(TAPER_DAYS)).toBe('peak');
    expect(goalPhase(PEAK_DAYS - 1)).toBe('peak');
    expect(goalPhase(PEAK_DAYS)).toBe('build');
    expect(goalPhase(BUILD_DAYS - 1)).toBe('build');
    expect(goalPhase(BUILD_DAYS)).toBe('base');
    expect(goalPhase(BASE_DAYS - 1)).toBe('base');
    expect(goalPhase(BASE_DAYS)).toBe('far');
  });
});

describe('inTaperWindow', () => {
  it('covers race day through the last taper day and nothing else', () => {
    expect(inTaperWindow(-1)).toBe(false);
    expect(inTaperWindow(0)).toBe(true);
    expect(inTaperWindow(TAPER_DAYS - 1)).toBe(true);
    expect(inTaperWindow(TAPER_DAYS)).toBe(false);
  });
});

describe('requiredRamp', () => {
  it('measures to the START of the taper, not to race day', () => {
    // 42 days out ⇒ 28 build days ⇒ 4 weeks. 20 CTL points to find ⇒ 5 per week.
    expect(requiredRamp(40, 60, TAPER_DAYS + 28)).toBe(5);
  });

  it('is zero when the athlete is already at or past the target', () => {
    expect(requiredRamp(60, 60, 60)).toBe(0);
    expect(requiredRamp(70, 60, 60)).toBe(0);
  });

  it('refuses once the build is over — inside the taper there is no ramp left to ask for', () => {
    expect(requiredRamp(40, 60, TAPER_DAYS)).toBeNull();
    expect(requiredRamp(40, 60, 3)).toBeNull();
  });

  it('refuses without a target rather than inventing one from the distance', () => {
    expect(requiredRamp(40, null, 60)).toBeNull();
    expect(requiredRamp(null, 60, 60)).toBeNull();
  });
});

describe('projectCtl', () => {
  it('extrapolates the current ramp to the start of the taper', () => {
    // 4 build weeks at 5 points a week on top of 40.
    expect(projectCtl(40, 5, TAPER_DAYS + 28)).toBe(60);
  });

  it('treats a missing ramp as flat rather than as unknown', () => {
    expect(projectCtl(40, null, TAPER_DAYS + 28)).toBe(40);
  });

  it('never projects a negative CTL out of a long detraining ramp', () => {
    expect(projectCtl(10, -20, TAPER_DAYS + 140)).toBe(0);
  });

  it('has nothing left to build once inside the taper', () => {
    expect(projectCtl(40, 5, TAPER_DAYS)).toBe(40);
    expect(projectCtl(40, 5, 0)).toBe(40);
  });
});

describe('taperCheck', () => {
  const today = '2026-06-01';

  it('does not ask the question outside the taper window', () => {
    expect(taperCheck(series(60, today, 50), TAPER_DAYS, today)).toBeNull();
    expect(taperCheck(series(60, today, 50), -1, today)).toBeNull();
  });

  it('refuses without enough series to form the 28-day baseline', () => {
    expect(taperCheck(series(30, today, 50), 5, today)).toBeNull();
  });

  it('confirms a real taper when load has come down far enough', () => {
    // 28 days at 60 TSS, then 7 days at 20.
    const s = series(60, today, (i) => (i >= 53 ? 20 : 60));
    const check = taperCheck(s, 5, today);
    expect(check).not.toBeNull();
    expect(check!.recentDailyLoad).toBe(20);
    expect(check!.baselineDailyLoad).toBe(60);
    expect(check!.ratio).toBeCloseTo(0.3, 5);
    expect(check!.tapering).toBe(true);
  });

  it('calls a token 5% trim what it is — a normal week wearing a taper‘s name', () => {
    const s = series(60, today, (i) => (i >= 53 ? 95 : 100));
    const check = taperCheck(s, 5, today);
    expect(check!.ratio).toBeGreaterThan(TAPER_MAX_RATIO);
    expect(check!.tapering).toBe(false);
  });

  it('refuses to congratulate an athlete for resting after a month off', () => {
    const s = series(60, today, (i) => (i >= 53 ? 10 : 0));
    expect(taperCheck(s, 5, today)).toBeNull();
  });

  it('ignores days after today, so a future series cannot leak into the verdict', () => {
    const s = [...series(60, today, 60), ...series(5, addDays(today, 5), 500)];
    const check = taperCheck(s, 5, today);
    expect(check!.recentDailyLoad).toBe(60);
  });
});

describe('goalStatus', () => {
  const base = { daysOut: 60, currentCtl: 40, targetCtl: 60, projectedCtl: 60, risk: risk() };

  it('refuses a verdict under the history floor rather than scaring with three sessions', () => {
    expect(goalStatus({ ...base, risk: risk({ historyDays: MIN_HISTORY_DAYS - 1 }) })).toBe('unknown');
    expect(goalStatus({ ...base, currentCtl: null })).toBe('unknown');
    expect(goalStatus({ ...base, risk: null })).toBe('unknown');
  });

  it('has nothing to judge a goal with no target against', () => {
    expect(goalStatus({ ...base, targetCtl: null })).toBe('unknown');
    expect(goalStatus({ ...base, projectedCtl: null })).toBe('unknown');
  });

  it('says nothing about a goal already behind the athlete', () => {
    expect(goalStatus({ ...base, daysOut: -1 })).toBe('unknown');
  });

  it('reads the projection against the target, within tolerance', () => {
    expect(goalStatus({ ...base, projectedCtl: 60 })).toBe('on-track');
    expect(goalStatus({ ...base, projectedCtl: 60 - CTL_TOLERANCE })).toBe('on-track');
    expect(goalStatus({ ...base, projectedCtl: 60 + CTL_TOLERANCE })).toBe('ahead');
    expect(goalStatus({ ...base, projectedCtl: 60 - CTL_TOLERANCE - 1 })).toBe('behind');
    expect(goalStatus({ ...base, projectedCtl: 80 })).toBe('ahead');
  });

  /**
   * The safety property of the whole module. An athlete told only "behind" trains harder; an athlete
   * who is behind BECAUSE they are already ramping past the safe rate is the one for whom that ends
   * the season. So the ramp finding has to win.
   */
  it('reports at-risk over behind when a short trajectory is being bought with a steep ramp', () => {
    const steep = risk({ rampRatePerWeek: RAMP_HIGH + 1 });
    expect(goalStatus({ ...base, projectedCtl: 20, risk: steep })).toBe('at-risk');
  });

  it('reports at-risk even when the projection is comfortably ahead', () => {
    const steep = risk({ rampRatePerWeek: RAMP_HIGH + 5 });
    expect(goalStatus({ ...base, projectedCtl: 90, risk: steep })).toBe('at-risk');
  });

  it('does not call a ramp exactly at the safe ceiling at-risk', () => {
    const atCeiling = risk({ rampRatePerWeek: RAMP_HIGH });
    expect(goalStatus({ ...base, projectedCtl: 60, risk: atCeiling })).toBe('on-track');
  });

  it('flags a steep ramp even with no target set, since it is true without one', () => {
    const steep = risk({ rampRatePerWeek: RAMP_HIGH + 2 });
    expect(goalStatus({ ...base, targetCtl: null, projectedCtl: null, risk: steep })).toBe('at-risk');
  });
});

describe('daysOutTo', () => {
  it('counts forward to a future day and negative past one', () => {
    expect(daysOutTo('2026-06-01', '2026-06-11')).toBe(10);
    expect(daysOutTo('2026-06-01', '2026-06-01')).toBe(0);
    expect(daysOutTo('2026-06-11', '2026-06-01')).toBe(-10);
  });
});
