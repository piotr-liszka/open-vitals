/** Spec 059 — parsing Garmin's own Training Readiness out of an untrusted daily payload. */
import { describe, it, expect } from 'vitest';
import { fmtRecovery } from './condition.format';
import {
  garminSummary,
  latestTrainingReadiness,
  levelForScore,
  normaliseLevel,
  parseTrainingReadinessDay,
  stateForLevel,
  toGarminReadiness
} from './insights.garmin-readiness';

/** A full, realistic payload — camelCase, exactly as Garmin serves it. */
function payload(over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    calendarDate: '2026-08-14',
    score: 27,
    level: 'LOW',
    feedbackShort: 'RECOVERY_TIME_LIMITED',
    sleepScoreFactorPercent: 74,
    sleepHistoryFactorPercent: 60,
    hrvFactorPercent: 45,
    recoveryTimeFactorPercent: 10,
    acwrFactorPercent: 80,
    stressHistoryFactorPercent: 55,
    hrvWeeklyAverage: 92,
    acuteLoad: 312,
    recoveryTime: 2040,
    recoveryTimeChangePhrase: 'RECOVERY_TIME_DECREASED',
    ...over
  };
}

describe('parseTrainingReadinessDay', () => {
  it('reads score, level, factors, recovery and the extras', () => {
    const parsed = parseTrainingReadinessDay('2026-08-15', payload());
    expect(parsed).not.toBeNull();
    expect(parsed!.score).toBe(27);
    expect(parsed!.level).toBe('low');
    // Garmin's own calendarDate wins over the day we happened to ask for.
    expect(parsed!.day).toBe('2026-08-14');
    expect(parsed!.hrvWeeklyAvg).toBe(92);
    expect(parsed!.acuteLoad).toBe(312);
    expect(parsed!.recovery).toEqual({
      day: '2026-08-14',
      minutes: 2040,
      change: 'krótszy niż wczoraj'
    });
    expect(parsed!.factors.map((f) => [f.key, f.percent])).toEqual([
      ['sleep', 74],
      ['sleep_history', 60],
      ['hrv', 45],
      ['recovery', 10],
      ['load', 80],
      ['stress', 55]
    ]);
  });

  it('accepts the snake_case variant of every field', () => {
    const parsed = parseTrainingReadinessDay('2026-08-14', {
      score: 61,
      level: 'moderate',
      calendar_date: '2026-08-14',
      hrv_factor_percent: 70,
      recovery_time: 0,
      recovery_time_change_phrase: 'RECOVERY_TIME_NO_CHANGE',
      hrv_weekly_average: 58,
      acute_load: 200
    });
    expect(parsed!.score).toBe(61);
    expect(parsed!.level).toBe('moderate');
    expect(parsed!.factors.map((f) => f.key)).toEqual(['hrv']);
    expect(parsed!.recovery).toEqual({ day: '2026-08-14', minutes: 0, change: 'bez zmian' });
    expect(parsed!.hrvWeeklyAvg).toBe(58);
    expect(parsed!.acuteLoad).toBe(200);
  });

  it('unwraps the sidecar envelope', () => {
    const parsed = parseTrainingReadinessDay('2026-08-14', {
      metric: 'training_readiness',
      date: '2026-08-14',
      data: payload()
    });
    expect(parsed!.score).toBe(27);
  });

  it('rejects a payload with no usable score', () => {
    expect(parseTrainingReadinessDay('2026-08-14', null)).toBeNull();
    expect(parseTrainingReadinessDay('2026-08-14', {})).toBeNull();
    expect(parseTrainingReadinessDay('2026-08-14', { score: 'high' })).toBeNull();
    expect(parseTrainingReadinessDay('2026-08-14', { score: NaN })).toBeNull();
    expect(parseTrainingReadinessDay('2026-08-14', { score: 140 })).toBeNull();
    expect(parseTrainingReadinessDay('2026-08-14', { score: -3 })).toBeNull();
  });

  it('keeps a good score usable when the level string is junk, and drops junk factors', () => {
    const parsed = parseTrainingReadinessDay(
      '2026-08-14',
      payload({ level: 'SOMETHING_NEW', hrvFactorPercent: 400, acwrFactorPercent: null })
    );
    // Banded from the score rather than left "unknown" beside a perfectly good number.
    expect(parsed!.level).toBe('low');
    expect(parsed!.factors.map((f) => f.key)).toEqual(['sleep', 'sleep_history', 'recovery', 'stress']);
  });

  it('drops an unrecognised change code rather than rendering it as prose', () => {
    const parsed = parseTrainingReadinessDay(
      '2026-08-14',
      payload({ recoveryTimeChangePhrase: 'RECOVERY_TIME_WOBBLED' })
    );
    expect(parsed!.recovery).toMatchObject({ minutes: 2040, change: null });
  });

  it('has no recovery block when Garmin reports no timer', () => {
    const parsed = parseTrainingReadinessDay('2026-08-14', payload({ recoveryTime: null }));
    expect(parsed!.recovery).toBeNull();
  });

  it('falls back to the store day when the payload carries no valid calendarDate', () => {
    const parsed = parseTrainingReadinessDay('2026-08-14', payload({ calendarDate: '14/08/2026' }));
    expect(parsed!.day).toBe('2026-08-14');
  });
});

describe('latestTrainingReadiness', () => {
  it('takes the newest day that actually carries a score', () => {
    const parsed = latestTrainingReadiness([
      { date: '2026-08-12', data: payload({ score: 55, calendarDate: '2026-08-12' }) },
      { date: '2026-08-13', data: payload({ score: 27, calendarDate: '2026-08-13' }) },
      { date: '2026-08-14', data: null },
      { date: '2026-08-15', data: {} }
    ]);
    expect(parsed).toMatchObject({ day: '2026-08-13', score: 27 });
  });

  it('is null when nothing in the window was scored', () => {
    expect(latestTrainingReadiness([{ date: '2026-08-14', data: null }])).toBeNull();
    expect(latestTrainingReadiness([])).toBeNull();
  });

  it('ignores rows with a malformed date key', () => {
    expect(latestTrainingReadiness([{ date: 'wczoraj', data: payload() }])).toBeNull();
  });
});

describe('levels and states', () => {
  it('normalises the strings Garmin sends', () => {
    expect(normaliseLevel('PRIME')).toBe('prime');
    expect(normaliseLevel('moderate')).toBe('moderate');
    expect(normaliseLevel('VERY_LOW')).toBe('poor');
    expect(normaliseLevel(null)).toBe('unknown');
    expect(normaliseLevel('ready-ish')).toBe('unknown');
  });

  it('bands a score the way Garmin does', () => {
    expect(levelForScore(95)).toBe('prime');
    expect(levelForScore(80)).toBe('high');
    expect(levelForScore(50)).toBe('moderate');
    expect(levelForScore(25)).toBe('low');
    expect(levelForScore(1)).toBe('poor');
  });

  it('maps a level onto the shared card state', () => {
    expect(stateForLevel('prime')).toBe('rested');
    expect(stateForLevel('moderate')).toBe('steady');
    expect(stateForLevel('poor')).toBe('strained');
    expect(stateForLevel('unknown')).toBe('unknown');
  });
});

describe('fmtRecovery', () => {
  it('says "gotowy" at zero and below', () => {
    expect(fmtRecovery(0)).toBe('gotowy');
    expect(fmtRecovery(-1)).toBe('gotowy');
    expect(fmtRecovery(Number.NaN)).toBe('gotowy');
  });

  it('writes anything under an hour in minutes', () => {
    expect(fmtRecovery(1)).toBe('1 min');
    expect(fmtRecovery(45)).toBe('45 min');
    expect(fmtRecovery(59)).toBe('59 min');
  });

  it('counts hours, then days — from MINUTES', () => {
    expect(fmtRecovery(60)).toBe('1 h');
    expect(fmtRecovery(23 * 60)).toBe('23 h');
    expect(fmtRecovery(24 * 60)).toBe('1 dzień');
    expect(fmtRecovery(34 * 60)).toBe('1 dzień 10 h');
    expect(fmtRecovery(50 * 60)).toBe('2 dni 2 h');
  });

  /*
    The regression this unit change exists for: Garmin reported 3672 (61 hours), the card read the
    field as hours and announced "153 dni do pełnej regeneracji" — longer than any Garmin recovery
    timer can be, and the loudest number on the start page.
  */
  it('renders the payload that produced "153 dni" as the 61 hours it really was', () => {
    expect(fmtRecovery(3672)).toBe('2 dni 13 h');
  });
});

describe('garminSummary', () => {
  it('leads with the level, then the timer, then the shared clauses', () => {
    const text = garminSummary('low', { day: '2026-08-14', minutes: 2040, change: null }, [
      'HRV poniżej bazy (88 ms)',
      'sen 7 h 24 min'
    ]);
    expect(text).toBe(
      'Garmin: gotowość niska — do pełnej regeneracji 1 dzień 10 h, HRV poniżej bazy (88 ms), sen 7 h 24 min.'
    );
  });

  it('states that recovery is done at zero', () => {
    const text = garminSummary('high', { day: '2026-08-14', minutes: 0, change: null }, []);
    expect(text).toBe('Garmin: gotowość wysoka — regeneracja zakończona.');
  });

  it('still ends in a full stop with nothing to add', () => {
    expect(garminSummary('moderate', null, [])).toBe('Garmin: gotowość umiarkowana.');
  });
});

describe('toGarminReadiness', () => {
  it('assembles the card contract', () => {
    const parsed = parseTrainingReadinessDay('2026-08-14', payload())!;
    const readiness = toGarminReadiness(parsed, ['sen 7 h 24 min']);
    expect(readiness).toMatchObject({
      day: '2026-08-14',
      score: 27,
      level: 'low',
      state: 'strained',
      hrvWeeklyAvg: 92,
      acuteLoad: 312
    });
    expect(readiness.summary).toContain('sen 7 h 24 min');
  });
});
