/** Spec 059 — parsing Garmin's own Training Readiness out of an untrusted daily payload. */
import { afterAll, beforeAll, describe, it, expect } from 'vitest';
import { createTranslator } from '$lib/i18n';
import { fmtRecovery } from './condition.format';
import {
  garminSummary,
  isHrvUnbalanced,
  latestTrainingReadiness,
  levelForScore,
  markSuperseded,
  normaliseFeedback,
  normaliseLevel,
  parseGarminInstant,
  parseHrvStatusDay,
  parseTrainingReadinessDay,
  stalenessOf,
  stateForLevel,
  toGarminReadiness
} from './insights.garmin-readiness';
import type { RecoveryTime } from './insights.types';

const t = createTranslator('pl');

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
      changeKey: 'garminReadiness.change.decreased',
      capturedAt: null,
      endsAt: null,
      superseded: false
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
    expect(parsed!.recovery).toEqual({
      day: '2026-08-14',
      minutes: 0,
      changeKey: 'garminReadiness.change.none',
      capturedAt: null,
      endsAt: null,
      superseded: false
    });
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
    expect(parsed!.recovery).toMatchObject({ minutes: 2040, changeKey: null });
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
    expect(fmtRecovery(t, 0)).toBe('gotowy');
    expect(fmtRecovery(t, -1)).toBe('gotowy');
    expect(fmtRecovery(t, Number.NaN)).toBe('gotowy');
  });

  it('writes anything under an hour in minutes', () => {
    expect(fmtRecovery(t, 1)).toBe('1 min');
    expect(fmtRecovery(t, 45)).toBe('45 min');
    expect(fmtRecovery(t, 59)).toBe('59 min');
  });

  it('counts hours, then days — from MINUTES', () => {
    expect(fmtRecovery(t, 60)).toBe('1 h');
    expect(fmtRecovery(t, 23 * 60)).toBe('23 h');
    expect(fmtRecovery(t, 24 * 60)).toBe('1 dzień');
    expect(fmtRecovery(t, 34 * 60)).toBe('1 dzień 10 h');
    expect(fmtRecovery(t, 50 * 60)).toBe('2 dni 2 h');
  });

  /*
    The regression this unit change exists for: Garmin reported 3672 (61 hours), the card read the
    field as hours and announced "153 dni do pełnej regeneracji" — longer than any Garmin recovery
    timer can be, and the loudest number on the start page.
  */
  it('renders the payload that produced "153 dni" as the 61 hours it really was', () => {
    expect(fmtRecovery(t, 3672)).toBe('2 dni 13 h');
  });
});

/** A timer with no capture instant: the pre-075 shape, frozen at whatever Garmin last said. */
function frozen(minutes: number, day = '2026-08-14'): RecoveryTime {
  return { day, minutes, changeKey: null, capturedAt: null, endsAt: null, superseded: false };
}

describe('garminSummary', () => {
  it('leads with the level, then the timer, then the shared clauses', () => {
    const text = garminSummary(t, 'low', frozen(2040), ['HRV poniżej bazy (88 ms)', 'sen 7 h 24 min']);
    expect(text).toBe(
      'Garmin: gotowość niska — do pełnej regeneracji 1 dzień 10 h, HRV poniżej bazy (88 ms), sen 7 h 24 min.'
    );
  });

  it('states that recovery is done at zero', () => {
    const text = garminSummary(t, 'high', frozen(0), []);
    expect(text).toBe('Garmin: gotowość wysoka — regeneracja zakończona.');
  });

  it('still ends in a full stop with nothing to add', () => {
    expect(garminSummary(t, 'moderate', null, [])).toBe('Garmin: gotowość umiarkowana.');
  });
});

describe('toGarminReadiness', () => {
  it('assembles the card contract', () => {
    const parsed = parseTrainingReadinessDay('2026-08-14', payload())!;
    const readiness = toGarminReadiness(t, parsed, ['sen 7 h 24 min'], '2026-08-14');
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

/**
 * Spec 072 — the readiness the card shows is the newest day Garmin SCORED, which is not necessarily
 * today. On 2026-08-16 that was a 2026-08-14 20:30 snapshot: score 1, `recoveryTime` 3672 minutes.
 * The card rendered both as if they were current, and the watch (counting the same timer down
 * locally) was showing 34 and ~19 h. Nothing here was miscalculated; nothing here said which day
 * it was talking about.
 */
describe('staleness (spec 072)', () => {
  it('measures the gap between the scored day and today', () => {
    expect(stalenessOf('2026-08-16', '2026-08-16')).toBe(0);
    expect(stalenessOf('2026-08-14', '2026-08-16')).toBe(2);
  });

  it('never reports a negative age', () => {
    // A payload dated ahead of today (clock skew either side) is "current", not "-1 days stale".
    expect(stalenessOf('2026-08-17', '2026-08-16')).toBe(0);
    expect(stalenessOf('not-a-day', '2026-08-16')).toBe(0);
  });

  it('carries the age into the card contract', () => {
    const parsed = parseTrainingReadinessDay('2026-08-14', payload())!;
    expect(toGarminReadiness(t, parsed, [], '2026-08-14').staleDays).toBe(0);
    expect(toGarminReadiness(t, parsed, [], '2026-08-16').staleDays).toBe(2);
  });

  it('says the day in the sentence, and marks the recovery timer as of that day', () => {
    const parsed = parseTrainingReadinessDay('2026-08-14', payload())!;
    const text = toGarminReadiness(t, parsed, [], '2026-08-16').summary;

    expect(text).toContain('nieaktualne');
    expect(text).toContain('dane z 14 sie');
    // The timer is a countdown from a moment: stale, it is wrong by exactly the snapshot's age.
    expect(text).toContain('stan na ten dzień');
  });

  it('leaves a current reading untouched — no new chrome on the normal path', () => {
    const parsed = parseTrainingReadinessDay('2026-08-14', payload())!;
    const text = toGarminReadiness(t, parsed, ['sen 7 h 24 min'], '2026-08-14').summary;

    expect(text).not.toContain('nieaktualne');
    expect(text).not.toContain('dane z');
    expect(text).not.toContain('stan na ten dzień');
    expect(text).toBe(
      `Garmin: gotowość niska — do pełnej regeneracji ${fmtRecovery(t, 2040)}, sen 7 h 24 min.`
    );
  });
});

/**
 * Spec 075 — the same timer, anchored. The live row that prompted this:
 *
 *   timestamp      2026-08-16T15:54:57.0   (UTC, zoneless, one-digit fraction)
 *   timestampLocal 2026-08-16T17:54:57.0   (+02:00 — same instant, also zoneless)
 *   recoveryTime   949                     (minutes → "16 h")
 *   synced_at      2026-08-16 16:55:41+00  (our fetch, a full hour after Garmin's reading)
 *
 * so full recovery lands at 2026-08-17T07:43:57Z. The card showed a frozen "16 h" until the next
 * sync because nothing read `timestamp`, even though it had been in the stored payload all along.
 */
describe('recovery as an instant (spec 075)', () => {
  const CAPTURED = Date.UTC(2026, 7, 16, 15, 54, 57);
  const ENDS = Date.UTC(2026, 7, 17, 7, 43, 57);

  const live = (over: Record<string, unknown> = {}) =>
    payload({
      calendarDate: '2026-08-16',
      timestamp: '2026-08-16T15:54:57.0',
      timestampLocal: '2026-08-16T17:54:57.0',
      recoveryTime: 949,
      recoveryTimeChangePhrase: 'NO_CHANGE_SLEEP',
      ...over
    });

  describe('parseGarminInstant', () => {
    const original = process.env.TZ;
    // The bug this guards is invisible under UTC, which is what the container runs on.
    beforeAll(() => {
      process.env.TZ = 'Europe/Warsaw';
    });
    afterAll(() => {
      process.env.TZ = original;
    });

    it('reads a zoneless stamp as UTC, not as local time', () => {
      // The test's own premise: in this zone a naive parse really does land two hours early, so a
      // regression here fails loudly instead of passing because the check had quietly become a no-op.
      expect(new Date('2026-08-16T15:54:57.0').getTime()).not.toBe(CAPTURED);
      expect(parseGarminInstant('2026-08-16T15:54:57.0')).toBe(CAPTURED);
    });

    it('respects an explicit zone when one is present, and rejects junk', () => {
      expect(parseGarminInstant('2026-08-16T17:54:57+02:00')).toBe(CAPTURED);
      expect(parseGarminInstant('2026-08-16T15:54:57Z')).toBe(CAPTURED);
      expect(parseGarminInstant('2026-08-16 15:54:57')).toBe(CAPTURED);
      expect(parseGarminInstant(null)).toBeNull();
      expect(parseGarminInstant('wczoraj wieczorem')).toBeNull();
    });
  });

  it('turns the live row into the instant full recovery lands on', () => {
    const parsed = parseTrainingReadinessDay('2026-08-16', live())!;
    expect(parsed.recovery).toEqual({
      day: '2026-08-16',
      minutes: 949,
      changeKey: 'garminReadiness.change.noChangeSleep', // the code the real account emits; it rendered nothing before
      capturedAt: CAPTURED,
      endsAt: ENDS,
      superseded: false
    });
  });

  it('leaves a payload without a timestamp anchorless rather than guessing one', () => {
    const parsed = parseTrainingReadinessDay('2026-08-16', payload())!;
    expect(parsed.recovery).toMatchObject({ capturedAt: null, endsAt: null });
  });

  describe('markSuperseded', () => {
    const parsed = () => parseTrainingReadinessDay('2026-08-16', live())!.recovery;

    it('stops the countdown once a later activity exists', () => {
      const after = markSuperseded(parsed(), CAPTURED + 60 * 60_000);
      expect(after!.superseded).toBe(true);
    });

    it('ignores activities Garmin had already priced in', () => {
      expect(markSuperseded(parsed(), CAPTURED - 60 * 60_000)!.superseded).toBe(false);
      expect(markSuperseded(parsed(), CAPTURED)!.superseded).toBe(false);
      expect(markSuperseded(parsed(), null)!.superseded).toBe(false);
    });

    it('leaves an anchorless timer alone — there is nothing to compare against', () => {
      const anchorless = parseTrainingReadinessDay('2026-08-16', payload())!.recovery;
      expect(markSuperseded(anchorless, Date.now())!.superseded).toBe(false);
    });
  });

  describe('the sentence', () => {
    const parsed = () => parseTrainingReadinessDay('2026-08-16', live())!;

    it('counts the timer down instead of repeating the captured figure', () => {
      // Six hours after Garmin's reading: 949 − 360 = 589 min = "10 h".
      const text = toGarminReadiness(t, parsed(), [], '2026-08-16', CAPTURED + 6 * 60 * 60_000).summary;
      expect(text).toContain(`do pełnej regeneracji ${fmtRecovery(t, 589)}`);
      expect(text).not.toContain(fmtRecovery(t, 949));
    });

    it('drops the "as of that day" qualifier once the figure is genuinely current', () => {
      // Two days late by CALENDAR, but the countdown is anchored, so the number itself is not stale.
      const text = toGarminReadiness(t, parsed(), [], '2026-08-18', CAPTURED + 3 * 60 * 60_000).summary;
      expect(text).toContain('dane z 16 sie'); // the reading is still old, and still says so
      expect(text).not.toContain('stan na ten dzień'); // but the timer on it is not frozen
    });

    it('reaches "regeneracja zakończona" with no sync at all', () => {
      const text = toGarminReadiness(t, parsed(), [], '2026-08-17', ENDS + 60_000).summary;
      expect(text).toContain('regeneracja zakończona');
    });

    it('keeps the frozen wording when a later session superseded the reading', () => {
      const p = parsed();
      const superseded = { ...p, recovery: markSuperseded(p.recovery, CAPTURED + 3600_000) };
      const text = toGarminReadiness(t, superseded, [], '2026-08-18', CAPTURED + 6 * 3600_000).summary;
      // The stored figure, dated — never a countdown Garmin has already thrown away.
      expect(text).toContain(`do pełnej regeneracji ${fmtRecovery(t, 949)}`);
      expect(text).toContain('stan na ten dzień');
    });
  });
});

/* ------------------------------------------------------------------ *
 * The HRV band (spec 084)
 * ------------------------------------------------------------------ */

describe('parseHrvStatusDay', () => {
  /** Verbatim from 2026-08-17 — the payload whose band our score had never once read. */
  const REAL = {
    hrvSummary: {
      status: 'UNBALANCED',
      baseline: { lowUpper: 96, balancedLow: 102, markerValue: 0.1968689, balancedUpper: 133 },
      weeklyAvg: 99,
      calendarDate: '2026-08-17',
      lastNightAvg: 113,
      feedbackPhrase: 'HRV_UNBALANCED_8'
    }
  };

  it('reads the weekly average, last night and the balanced band', () => {
    expect(parseHrvStatusDay('2026-08-16', REAL)).toEqual({
      day: '2026-08-17', // the payload's own calendarDate wins over the store key
      status: 'unbalanced',
      weeklyAvg: 99,
      lastNightAvg: 113,
      balancedLow: 102,
      balancedUpper: 133
    });
  });

  it('discards a self-contradictory band rather than sorting it', () => {
    const inverted = {
      hrvSummary: { ...REAL.hrvSummary, baseline: { balancedLow: 133, balancedUpper: 102 } }
    };
    const parsed = parseHrvStatusDay('2026-08-17', inverted)!;
    expect(parsed.balancedLow).toBeNull();
    expect(parsed.balancedUpper).toBeNull();
    // The numbers it CAN trust survive.
    expect(parsed.weeklyAvg).toBe(99);
  });

  it('rejects non-positive millisecond figures', () => {
    const zeroed = { hrvSummary: { ...REAL.hrvSummary, weeklyAvg: 0, lastNightAvg: -5 } };
    const parsed = parseHrvStatusDay('2026-08-17', zeroed)!;
    expect(parsed.weeklyAvg).toBeNull();
    expect(parsed.lastNightAvg).toBeNull();
  });

  it('keeps an unrecognised status honest rather than guessing', () => {
    const odd = { hrvSummary: { ...REAL.hrvSummary, status: 'SOMETHING_NEW' } };
    expect(parseHrvStatusDay('2026-08-17', odd)!.status).toBe('unknown');
  });

  it('returns null with no summary, or a summary carrying nothing usable', () => {
    expect(parseHrvStatusDay('2026-08-17', { hrvReadings: [] })).toBeNull();
    expect(parseHrvStatusDay('2026-08-17', { hrvSummary: { feedbackPhrase: 'X' } })).toBeNull();
  });
});

describe('isHrvUnbalanced', () => {
  const base = {
    day: '2026-08-17',
    status: 'balanced' as const,
    weeklyAvg: 99,
    lastNightAvg: 113,
    balancedLow: 102,
    balancedUpper: 133
  };

  it('trusts the numbers over the word when both are present', () => {
    // Garmin labelled this BALANCED, but 99 really is under its own floor of 102.
    expect(isHrvUnbalanced(base)).toBe(true);
    expect(isHrvUnbalanced({ ...base, weeklyAvg: 110 })).toBe(false);
  });

  it('falls back to the status word when there is no band to compare against', () => {
    expect(isHrvUnbalanced({ ...base, balancedLow: null, status: 'unbalanced' })).toBe(true);
    expect(isHrvUnbalanced({ ...base, balancedLow: null, status: 'unknown' })).toBe(false);
  });

  it('is false for a missing reading — absence is not a verdict', () => {
    expect(isHrvUnbalanced(null)).toBe(false);
  });
});

describe('normaliseFeedback', () => {
  it("folds Garmin's words into the three that change a decision", () => {
    expect(normaliseFeedback('VERY_GOOD')).toBe('good');
    expect(normaliseFeedback('GOOD')).toBe('good');
    expect(normaliseFeedback('MODERATE')).toBe('moderate');
    expect(normaliseFeedback('POOR')).toBe('poor');
    expect(normaliseFeedback('WHAT')).toBeNull();
    expect(normaliseFeedback(null)).toBeNull();
  });
});
