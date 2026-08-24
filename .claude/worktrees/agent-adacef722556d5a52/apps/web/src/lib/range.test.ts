import { describe, expect, it } from 'vitest';
import {
  DEFAULT_RANGE,
  MAX_RANGE_DAYS,
  RANGE_KEYS,
  RANGE_OPTIONS,
  bucketFor,
  isRangeKey,
  parseRange,
  rangeKeyLabel,
  rangeLabel,
  rangeWeeks,
  resolveRange,
  routeSupportsRange,
  withRange
} from './range';
import { createTranslator } from '$lib/i18n';

const t = createTranslator('pl');
const en = createTranslator('en');

const TODAY = '2026-08-11';

describe('parseRange', () => {
  it('accepts every offered key', () => {
    for (const key of RANGE_KEYS) expect(parseRange(key)).toBe(key);
  });

  it.each([null, undefined, '', '9999', '31', 'ALL', 'all-time', '7d', '-7'])(
    'falls back to the default for %p',
    (raw) => {
      expect(parseRange(raw)).toBe(DEFAULT_RANGE);
    }
  );
});

describe('isRangeKey', () => {
  it('narrows only real keys', () => {
    expect(isRangeKey('30')).toBe(true);
    expect(isRangeKey('all')).toBe(true);
    expect(isRangeKey(30)).toBe(false);
    expect(isRangeKey('90')).toBe(false);
    expect(isRangeKey(undefined)).toBe(false);
  });
});

describe('RANGE_OPTIONS', () => {
  it('covers every key exactly once, in order, with both labels resolving to real words', () => {
    expect(RANGE_OPTIONS.map((o) => o.value)).toEqual([...RANGE_KEYS]);
    for (const option of RANGE_OPTIONS) {
      // A key that has no catalog entry renders as itself, so this also catches a missing message.
      expect(t(option.labelKey)).not.toBe(option.labelKey);
      expect(t(option.shortKey)).not.toBe(option.shortKey);
    }
  });

  it('labels the extended ranges in each language', () => {
    expect(rangeKeyLabel(t, '365')).toBe('1 rok');
    expect(rangeKeyLabel(t, 'all')).toBe('cały czas');
    expect(rangeKeyLabel(en, '365')).toBe('1 year');
    expect(rangeKeyLabel(en, 'all')).toBe('all time');
  });
});

describe('bucketFor', () => {
  it('keeps short windows daily', () => {
    expect(bucketFor(7)).toBe('day');
    expect(bucketFor(30)).toBe('day');
    expect(bucketFor(45)).toBe('day');
  });

  it('buckets a year by week', () => {
    expect(bucketFor(46)).toBe('week');
    expect(bucketFor(365)).toBe('week');
    expect(bucketFor(400)).toBe('week');
  });

  it('buckets multi-year windows by month', () => {
    expect(bucketFor(401)).toBe('month');
    expect(bucketFor(5 * 365)).toBe('month');
  });
});

describe('resolveRange', () => {
  it('resolves a fixed window inclusive of today', () => {
    const range = resolveRange('7', TODAY);
    expect(range).toMatchObject({
      key: '7',
      start: '2026-08-05',
      end: TODAY,
      days: 7,
      bucket: 'day',
      clamped: false
    });
  });

  it('resolves 14 and 30 days off the same anchor', () => {
    expect(resolveRange('14', TODAY).start).toBe('2026-07-29');
    expect(resolveRange('30', TODAY).start).toBe('2026-07-13');
  });

  it('resolves a year to 365 inclusive days, bucketed weekly', () => {
    const range = resolveRange('365', TODAY);
    expect(range.start).toBe('2025-08-12');
    expect(range.days).toBe(365);
    expect(range.bucket).toBe('week');
  });

  it('anchors "all" on the earliest synced day', () => {
    const range = resolveRange('all', TODAY, '2021-03-04');
    expect(range).toMatchObject({ key: 'all', start: '2021-03-04', end: TODAY, clamped: true });
    expect(range.days).toBe(1987);
    expect(range.bucket).toBe('month');
    // The label is no longer carried on the range — it is derived, in the reader's language.
    expect(rangeLabel(t, range)).toContain('2021-03-04');
    expect(rangeLabel(en, range)).toBe('all time (from 2021-03-04)');
  });

  it('degrades "all" to the default window when nothing is synced', () => {
    const range = resolveRange('all', TODAY, null);
    // Still reported as `all` (the switch must stay on the segment the user picked), but the window
    // is the default one and no unbounded query is implied.
    expect(range.key).toBe('all');
    expect(range.start).toBe(resolveRange(DEFAULT_RANGE, TODAY).start);
    expect(range.days).toBe(7);
    expect(range.clamped).toBe(false);
    expect(rangeLabel(t, range)).toBe('cały czas');
  });

  it('never inverts the window when coverage sits in the future', () => {
    const range = resolveRange('all', TODAY, '2030-01-01');
    expect(range.start).toBe(TODAY);
    expect(range.end).toBe(TODAY);
    expect(range.days).toBe(1);
  });

  it('clamps an absurdly old earliest day to the hard ceiling', () => {
    const range = resolveRange('all', TODAY, '1901-01-01');
    expect(range.days).toBe(MAX_RANGE_DAYS);
  });

  it('always covers at least one day and ends on today', () => {
    for (const key of RANGE_KEYS) {
      const range = resolveRange(key, TODAY, '2026-08-11');
      expect(range.days).toBeGreaterThanOrEqual(1);
      expect(range.end).toBe(TODAY);
    }
  });
});

describe('rangeWeeks', () => {
  it('rounds a window up to whole weeks, never below one', () => {
    expect(rangeWeeks(resolveRange('7', TODAY))).toBe(1);
    expect(rangeWeeks(resolveRange('14', TODAY))).toBe(2);
    expect(rangeWeeks(resolveRange('30', TODAY))).toBe(5);
    expect(rangeWeeks(resolveRange('365', TODAY))).toBe(53);
  });
});

describe('routeSupportsRange', () => {
  it.each(['/', '/dashboard', '/activities', '/training', '/analytics', '/insights'])(
    'is on for %s',
    (path) => {
      expect(routeSupportsRange(path)).toBe(true);
    }
  );

  it('covers the windowed training subpages', () => {
    expect(routeSupportsRange('/training/run')).toBe(true);
    expect(routeSupportsRange('/training/walk')).toBe(true);
  });

  it('is off where nothing would react to it', () => {
    // One session has no range; the heat map is a year grid; the cycling page is an all-time mean-max
    // power curve, where a windowed "best 5-minute power" would be a different, misleading number.
    expect(routeSupportsRange('/training/ride')).toBe(false);
    expect(routeSupportsRange('/activities/12345')).toBe(false);
    expect(routeSupportsRange('/heatmap')).toBe(false);
    expect(routeSupportsRange('/settings')).toBe(false);
    expect(routeSupportsRange('/settings/integrations')).toBe(false);
    expect(routeSupportsRange('/data')).toBe(false);
    expect(routeSupportsRange('/login')).toBe(false);
    expect(routeSupportsRange('/styleguide')).toBe(false);
  });

  it('tolerates a trailing slash', () => {
    expect(routeSupportsRange('/insights/')).toBe(true);
    expect(routeSupportsRange('/settings/')).toBe(false);
  });
});

describe('withRange', () => {
  const at = (search: string): URL => new URL(`http://openvitals.test/insights${search}`);

  it('carries the active range to a range-aware destination', () => {
    expect(withRange('/training', at('?range=365'))).toBe('/training?range=365');
    expect(withRange('/dashboard', at('?range=all'))).toBe('/dashboard?range=all');
    expect(withRange('/', at('?range=30'))).toBe('/?range=30');
  });

  it('leaves the href alone when the current page carries no range', () => {
    expect(withRange('/training', at(''))).toBe('/training');
  });

  it('never invents a range on a page that ignores it', () => {
    // Appending `?range=` to Ustawienia would imply a control that does nothing there.
    expect(withRange('/settings', at('?range=365'))).toBe('/settings');
    expect(withRange('/heatmap', at('?range=365'))).toBe('/heatmap');
    expect(withRange('/training/ride', at('?range=365'))).toBe('/training/ride');
    expect(withRange('/activities/123', at('?range=365'))).toBe('/activities/123');
  });

  it('ignores a junk range rather than propagating it', () => {
    expect(withRange('/training', at('?range=9999'))).toBe('/training');
  });

  it('preserves an href that already has a query string', () => {
    const out = new URL(withRange('/activities?sport=running', at('?range=30')), 'http://x');
    expect(out.pathname).toBe('/activities');
    expect(out.searchParams.get('sport')).toBe('running');
    expect(out.searchParams.get('range')).toBe('30');
  });

  it('overwrites a stale range already on the href', () => {
    expect(withRange('/training?range=7', at('?range=365'))).toBe('/training?range=365');
  });

  it('leaves external links and anchors untouched', () => {
    expect(withRange('https://garmin.com', at('?range=30'))).toBe('https://garmin.com');
    expect(withRange('#section', at('?range=30'))).toBe('#section');
  });
});
