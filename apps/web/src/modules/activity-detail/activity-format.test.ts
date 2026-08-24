import { describe, it, expect } from 'vitest';
import { createTranslator } from '$lib/i18n';
import {
  DASH,
  SIMILAR_METRICS,
  benefitLabel,
  fmtDuration,
  fmtClock,
  fmtKm,
  fmtNum,
  fmtPace,
  fmtSigned,
  isNum,
  paceFromMps,
  speedKmh,
  similarDeltaBadge,
  splitLabel,
  toKm
} from './activity-format';

const t = createTranslator('pl');

describe('isNum', () => {
  it('accepts only finite numbers', () => {
    expect(isNum(0)).toBe(true);
    expect(isNum(-12.5)).toBe(true);
    expect(isNum(null)).toBe(false);
    expect(isNum(undefined)).toBe(false);
    expect(isNum(Number.NaN)).toBe(false);
    expect(isNum(Number.POSITIVE_INFINITY)).toBe(false);
  });
});

describe('fmtNum', () => {
  it('formats with a Polish decimal comma', () => {
    expect(fmtNum(12.34, 1)).toBe('12,3');
    expect(fmtNum(7)).toBe('7');
  });

  it('answers a dash for absent or broken input — never a zero', () => {
    expect(fmtNum(null)).toBe(DASH);
    expect(fmtNum(undefined)).toBe(DASH);
    expect(fmtNum(Number.NaN)).toBe(DASH);
  });
});

describe('fmtSigned', () => {
  it('always carries an explicit sign', () => {
    expect(fmtSigned(28)).toBe('+28');
    expect(fmtSigned(-28)).toBe('−28');
    expect(fmtSigned(0)).toBe('0');
    expect(fmtSigned(null)).toBe(DASH);
  });
});

describe('fmtDuration', () => {
  it('drops the hour below 3600 s and floors fractions', () => {
    expect(fmtDuration(59.7)).toBe('0:59');
    expect(fmtDuration(725)).toBe('12:05');
    expect(fmtDuration(3725)).toBe('1:02:05');
  });

  it('refuses negatives and absent values', () => {
    expect(fmtDuration(-1)).toBe(DASH);
    expect(fmtDuration(null)).toBe(DASH);
  });
});

describe('fmtClock', () => {
  it('zero-pads minutes so axis ticks keep one width', () => {
    expect(fmtClock(0)).toBe('00:00');
    expect(fmtClock(65)).toBe('01:05');
    expect(fmtClock(3661)).toBe('1:01:01');
  });
});

describe('fmtPace', () => {
  it('renders m:ss per kilometre', () => {
    expect(fmtPace(275)).toBe('4:35');
    expect(fmtPace(300)).toBe('5:00');
  });

  it('treats an absurdly slow sample as no reading at all', () => {
    expect(fmtPace(30 * 60 + 1)).toBe(DASH);
    expect(fmtPace(0)).toBe(DASH);
    expect(fmtPace(null)).toBe(DASH);
  });
});

describe('paceFromMps / speedKmh / toKm', () => {
  it('converts a speed both ways', () => {
    expect(paceFromMps(4)).toBeCloseTo(250, 6);
    expect(speedKmh(4)).toBeCloseTo(14.4, 6);
    expect(toKm(4200)).toBe(4.2);
  });

  it('rejects a stopped or absent sample rather than reporting an infinite pace', () => {
    expect(paceFromMps(0)).toBeNull();
    expect(paceFromMps(0.1)).toBeNull(); // 2h46m/km — a pause, not a pace
    expect(paceFromMps(null)).toBeNull();
    expect(speedKmh(null)).toBeNull();
    expect(toKm(undefined)).toBeNull();
  });
});

describe('fmtKm', () => {
  it('formats metres as kilometres', () => {
    expect(fmtKm(10500, 2)).toBe('10,5');
    expect(fmtKm(null)).toBe(DASH);
  });
});

describe('benefitLabel', () => {
  it('translates Garmin primary-benefit enums', () => {
    expect(benefitLabel(t, 'TEMPO')).toBe('Tempo');
    expect(benefitLabel(t, 'aerobic_base')).toBe('Baza tlenowa');
  });

  it('prettifies an unknown enum instead of hiding it', () => {
    expect(benefitLabel(t, 'SOME_NEW_THING')).toBe('Some New Thing');
    expect(benefitLabel(t, undefined)).toBeNull();
  });
});

describe('splitLabel', () => {
  it('names Garmin split classes in Polish', () => {
    expect(splitLabel(t, 'RWD_RUN')).toBe('Bieg');
    expect(splitLabel(t, 'RWD_WALK')).toBe('Marsz');
    expect(splitLabel(t, 'RWD_STAND')).toBe('Postój');
    expect(splitLabel(t, undefined)).toBe('Odcinek');
  });
});

/**
 * Spec 065. This was a helper inside `SimilarActivities.svelte` and therefore untestable, which is a
 * bad place for it: it performs TWO sign inversions — the delta is stored candidate-relative and read
 * today-relative, and "lower" is an improvement for pace but not for power. Both look completely
 * plausible on screen while saying the opposite of the truth.
 */
describe('similarDeltaBadge (spec 065)', () => {
  const metric = (key: 'pace' | 'hr' | 'power') => SIMILAR_METRICS.find((m) => m.key === key)!;

  it('reads the delta from TODAY, not from the older session', () => {
    // The candidate ran 13 s/km slower than today → today was faster by 13 s/km.
    const b = similarDeltaBadge(t, { abs: 13, pct: 5 }, metric('pace'))!;
    expect(b.value).toBe('0:13');
    expect(b.arrow).toBe('down');
    expect(b.direction).toBe('better');
    expect(b.label).toContain('dziś tempo niżej o 0:13');
  });

  it('calls a slower session worse while still pointing the arrow up', () => {
    const b = similarDeltaBadge(t, { abs: -13, pct: -5 }, metric('pace'))!;
    expect(b.arrow).toBe('up');
    expect(b.direction).toBe('worse');
  });

  it('separates direction from the arrow: less power points down and is worse', () => {
    const b = similarDeltaBadge(t, { abs: 62, pct: 20 }, metric('power'))!;
    expect(b.arrow).toBe('down');
    expect(b.direction).toBe('worse');
    expect(b.value).toBe('62 W');
  });

  it('calls more power better, pointing up', () => {
    const b = similarDeltaBadge(t, { abs: -62, pct: -20 }, metric('power'))!;
    expect(b.arrow).toBe('up');
    expect(b.direction).toBe('better');
  });

  it('treats a sub-percent difference as unchanged rather than a tiny win', () => {
    const b = similarDeltaBadge(t, { abs: 1, pct: 0.2 }, metric('hr'))!;
    expect(b.direction).toBe('same');
    expect(b.arrow).toBe('none');
    expect(b.value).toBe('bez zmian');
  });

  it('renders no badge at all when there is nothing to compare', () => {
    expect(similarDeltaBadge(t, { abs: null, pct: null }, metric('hr'))).toBeNull();
    expect(similarDeltaBadge(t, { abs: 5, pct: null }, metric('hr'))).toBeNull();
  });
});
