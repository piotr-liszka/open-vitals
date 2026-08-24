import { describe, expect, it } from 'vitest';
import { createTranslator, type MessageKey } from './translate';

const pl = createTranslator('pl');
const en = createTranslator('en');

describe('createTranslator', () => {
  it('translates a plain key in each language', () => {
    expect(pl('common.save')).toBe('Zapisz');
    expect(en('common.save')).toBe('Save');
  });

  it('exposes the locale it was built for', () => {
    expect(pl.locale).toBe('pl');
    expect(en.locale).toBe('en');
  });

  it('interpolates named params', () => {
    expect(en('range.allFrom', { start: '2021-03-04' })).toBe('all time (from 2021-03-04)');
    expect(pl('range.allFrom', { start: '2021-03-04' })).toBe('cały czas (od 2021-03-04)');
  });

  it('leaves an unfilled placeholder standing rather than printing undefined', () => {
    expect(en('range.allFrom')).toBe('all time (from {start})');
    expect(en('range.allFrom', { wrong: 'x' })).toBe('all time (from {start})');
  });

  it('renders the key itself for an unknown key instead of throwing', () => {
    // Reachable only from untyped callers (JSON, old persisted rows) — it must not take a page down.
    const missing = 'nope.not.a.key' as MessageKey;
    expect(en(missing)).toBe('nope.not.a.key');
  });
});

describe('plurals', () => {
  it('picks all three Polish forms, which an n === 1 check would get wrong', () => {
    expect(pl('common.days', { count: 1 })).toBe('1 dzień');
    expect(pl('common.days', { count: 2 })).toBe('2 dni');
    expect(pl('common.days', { count: 4 })).toBe('4 dni');
    expect(pl('common.days', { count: 5 })).toBe('5 dni');
    expect(pl('common.days', { count: 12 })).toBe('12 dni');
    expect(pl('common.days', { count: 22 })).toBe('22 dni');
    expect(pl('common.days', { count: 25 })).toBe('25 dni');
  });

  it('picks the two English forms', () => {
    expect(en('common.days', { count: 1 })).toBe('1 day');
    expect(en('common.days', { count: 2 })).toBe('2 days');
    expect(en('common.days', { count: 22 })).toBe('22 days');
  });

  it('selects the Polish "few" form for 2-4 and "many" for 5+', () => {
    // The distinction Polish actually makes — asserted through the catalog's own wording.
    expect(pl('common.weeks', { count: 2 })).toBe('2 tygodnie');
    expect(pl('common.weeks', { count: 5 })).toBe('5 tygodni');
    expect(pl('common.weeks', { count: 1 })).toBe('1 tydzień');
  });

  it('falls back to the `other` form when no count is given', () => {
    expect(en('common.days')).toBe('{count} days');
  });

  it('never renders NaN at a reader', () => {
    expect(en('common.days', { count: Number.NaN })).toBe('{count} days');
    expect(en('common.days', { count: Number.POSITIVE_INFINITY })).toBe('{count} days');
  });
});

describe('bad input', () => {
  it('falls back to the default catalog for a locale that is not one', () => {
    // Typed as `Locale`, but the value reaches this function from a settings bag, a cookie or a
    // request body — an undefined lookup must not make every label on the page throw.
    const rogue = createTranslator('klingon' as never);
    expect(rogue('common.save')).toBe('Zapisz');
    expect(rogue('common.days', { count: 3 })).toBe('3 dni');
  });
});
