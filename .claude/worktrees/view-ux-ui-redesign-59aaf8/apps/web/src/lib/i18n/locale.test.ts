import { describe, expect, it } from 'vitest';
import { DEFAULT_LOCALE, intlLocale, isLocale, negotiateLocale, resolveLocale } from './locale';

describe('isLocale', () => {
  it('accepts the shipped languages and nothing else', () => {
    expect(isLocale('pl')).toBe(true);
    expect(isLocale('en')).toBe(true);
    expect(isLocale('de')).toBe(false);
    expect(isLocale('EN')).toBe(false); // tags are compared verbatim; callers normalize
    expect(isLocale(null)).toBe(false);
    expect(isLocale(undefined)).toBe(false);
    expect(isLocale(42)).toBe(false);
  });
});

describe('negotiateLocale', () => {
  it('matches a language-only tag', () => {
    expect(negotiateLocale('pl')).toBe('pl');
    expect(negotiateLocale('en')).toBe('en');
  });

  it('matches on the primary subtag, so any English region counts', () => {
    expect(negotiateLocale('en-US')).toBe('en');
    expect(negotiateLocale('en-GB')).toBe('en');
    expect(negotiateLocale('pl-PL')).toBe('pl');
  });

  it('honours quality values over header order', () => {
    expect(negotiateLocale('pl;q=0.4,en;q=0.9')).toBe('en');
    expect(negotiateLocale('en;q=0.2,pl;q=0.8')).toBe('pl');
  });

  it('keeps header order when qualities tie', () => {
    expect(negotiateLocale('en,pl')).toBe('en');
    expect(negotiateLocale('pl,en')).toBe('pl');
  });

  it('skips languages we do not speak and takes the best one we do', () => {
    expect(negotiateLocale('de-DE,de;q=0.9,en;q=0.5')).toBe('en');
  });

  it('treats q=0 as an explicit refusal', () => {
    expect(negotiateLocale('en;q=0,pl;q=0.3')).toBe('pl');
    expect(negotiateLocale('en;q=0')).toBeNull();
  });

  it('returns null when nothing matches, so the caller can fall through', () => {
    expect(negotiateLocale('de,fr,es')).toBeNull();
    expect(negotiateLocale('')).toBeNull();
    expect(negotiateLocale(null)).toBeNull();
    expect(negotiateLocale(undefined)).toBeNull();
  });

  it('survives junk instead of throwing', () => {
    expect(negotiateLocale(';;;,,,')).toBeNull();
    expect(negotiateLocale('*')).toBeNull();
    // A malformed `q` param is ignored, not held against the tag: the visitor still asked for
    // English, and one bad parameter is no reason to serve them Polish.
    expect(negotiateLocale('en;q=banana')).toBe('en');
    expect(negotiateLocale('en;q=.')).toBeNull(); // ...but a numeric-shaped q that parses to NaN is q=0
  });
});

describe('resolveLocale', () => {
  it('prefers the account setting over everything else', () => {
    expect(resolveLocale({ stored: 'en', cookie: 'pl', acceptLanguage: 'pl-PL' })).toBe('en');
  });

  it('falls back to the cookie when nothing is stored', () => {
    expect(resolveLocale({ cookie: 'en', acceptLanguage: 'pl-PL' })).toBe('en');
  });

  it('falls back to the browser header when there is no cookie', () => {
    expect(resolveLocale({ acceptLanguage: 'en-US,en;q=0.9' })).toBe('en');
  });

  it('falls back to Polish when no source says anything', () => {
    expect(resolveLocale({})).toBe(DEFAULT_LOCALE);
    expect(resolveLocale()).toBe(DEFAULT_LOCALE);
  });

  it('ignores a stored value that is not a known locale', () => {
    // A settings bag is JSON from the database — it can hold anything, including an old value.
    expect(resolveLocale({ stored: 'klingon', cookie: 'en' })).toBe('en');
    expect(resolveLocale({ stored: 42, acceptLanguage: 'en' })).toBe('en');
    expect(resolveLocale({ stored: null })).toBe(DEFAULT_LOCALE);
  });

  it('ignores a tampered cookie', () => {
    expect(resolveLocale({ cookie: '../../etc/passwd', acceptLanguage: 'en' })).toBe('en');
  });
});

describe('intlLocale', () => {
  it('maps English to en-GB, so the clock stays 24-hour and dates stay day-first', () => {
    expect(intlLocale('en')).toBe('en-GB');
    expect(intlLocale('pl')).toBe('pl-PL');
  });
});

describe('intlLocale, defensively', () => {
  it('falls back to the default tag rather than to the host locale', () => {
    // `new Intl.DateTimeFormat(undefined)` formats in whatever locale the SERVER runs in, which is
    // a bug that never reproduces locally. An unknown locale must resolve to a real tag.
    expect(intlLocale('nope' as never)).toBe('pl-PL');
  });
});
