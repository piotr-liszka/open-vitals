/**
 * Spec 075 — the recovery timer read as a live countdown and as a moment on the clock.
 *
 * `fmtRecovery` itself is covered in `insights.garmin-readiness.test.ts` (specs 059/070); what is
 * tested here is the pair that spec 075 added around it: how many minutes are left *now*, and when
 * "now plus that" actually falls.
 */
import { createTranslator } from '$lib/i18n';
import { describe, it, expect } from 'vitest';
import { fmtRecoveryEnd, isLiveCountdown, remainingMinutes } from './condition.format';
import type { RecoveryTime } from './insights.types';

const t = createTranslator('pl');

/** The live row from the spec: captured 2026-08-16 15:54:57 UTC with 949 minutes to run. */
const CAPTURED = Date.UTC(2026, 7, 16, 15, 54, 57);
const ENDS = Date.UTC(2026, 7, 17, 7, 43, 57);

function anchored(over: Partial<RecoveryTime> = {}): RecoveryTime {
  return {
    day: '2026-08-16',
    minutes: 949,
    changeKey: null,
    capturedAt: CAPTURED,
    endsAt: ENDS,
    superseded: false,
    ...over
  };
}

/** The pre-075 shape: a figure with no origin, which can only ever be repeated. */
const anchorless = anchored({ capturedAt: null, endsAt: null });

describe('remainingMinutes', () => {
  it('counts down from the instant Garmin captured the reading', () => {
    expect(remainingMinutes(anchored(), CAPTURED)).toBe(949);
    expect(remainingMinutes(anchored(), CAPTURED + 60 * 60_000)).toBe(889);
    expect(remainingMinutes(anchored(), CAPTURED + 6 * 60 * 60_000)).toBe(589);
  });

  it('bottoms out at zero instead of going negative past the end', () => {
    expect(remainingMinutes(anchored(), ENDS)).toBe(0);
    expect(remainingMinutes(anchored(), ENDS + 5 * 60 * 60_000)).toBe(0);
  });

  it('clamps a capture instant that sits in the future', () => {
    // Clock skew between watch, Garmin and this host must never buy the athlete extra hours.
    expect(remainingMinutes(anchored(), CAPTURED - 3 * 60 * 60_000)).toBe(949);
  });

  it('falls back to the stored figure when there is nothing to count from', () => {
    expect(remainingMinutes(anchorless, CAPTURED + 6 * 60 * 60_000)).toBe(949);
    expect(remainingMinutes(anchored(), null)).toBe(949);
  });

  it('falls back once a later session has superseded the reading', () => {
    // Garmin re-derives the timer after training, and a hard session RAISES it — so continuing to
    // count the old one down would not merely be stale, it would point the wrong way.
    const stale = anchored({ superseded: true });
    expect(remainingMinutes(stale, CAPTURED + 6 * 60 * 60_000)).toBe(949);
  });
});

describe('isLiveCountdown', () => {
  it('is true only with an anchor, a clock, and no superseding session', () => {
    expect(isLiveCountdown(anchored(), CAPTURED)).toBe(true);
    expect(isLiveCountdown(anchored(), null)).toBe(false);
    expect(isLiveCountdown(anchorless, CAPTURED)).toBe(false);
    expect(isLiveCountdown(anchored({ superseded: true }), CAPTURED)).toBe(false);
  });
});

describe('fmtRecoveryEnd', () => {
  it('names the moment in the app timezone, relative to today', () => {
    // 07:43 UTC is 09:43 in Warsaw, on the day after the capture.
    expect(fmtRecoveryEnd(t, ENDS, CAPTURED)).toBe('jutro 09:43');
    expect(fmtRecoveryEnd(t, ENDS, ENDS - 60_000)).toBe('dziś 09:43');
  });

  it('dates anything past tomorrow rather than saying "in 3 days"', () => {
    const far = Date.UTC(2026, 7, 19, 7, 43, 57);
    expect(fmtRecoveryEnd(t, far, CAPTURED)).toBe('19 sie, 09:43');
  });

  it('renders in the zone it is given, not the host’s', () => {
    expect(fmtRecoveryEnd(t, ENDS, CAPTURED, 'UTC')).toBe('jutro 07:43');
  });

  it('has nothing to say without an instant or a clock', () => {
    expect(fmtRecoveryEnd(t, null, CAPTURED)).toBeNull();
    expect(fmtRecoveryEnd(t, ENDS, null)).toBeNull();
  });
});
