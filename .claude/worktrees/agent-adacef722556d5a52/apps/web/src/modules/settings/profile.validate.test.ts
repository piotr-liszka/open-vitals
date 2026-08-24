/**
 * Spec 090 — the bounds, per field.
 *
 * The interesting cases are the ones that decide whether a number reaches storage at all: blank is
 * legal (it means "estimate it", the behaviour that predates this screen), the edges of each band
 * are inclusive, and anything that is not a finite number is refused rather than coerced.
 */
import { describe, it, expect } from 'vitest';
import { PROFILE_BOUNDS, type ProfileField } from './profile.types';
import {
  parseProfile,
  parseProfileField,
  parseProfileInput,
  readStoredProfile,
  toProfileInput
} from './profile.validate';

const FIELDS: ProfileField[] = ['ftpWatts', 'maxHrBpm', 'weightKg'];

describe('parseProfileField — bounds', () => {
  it.each(FIELDS)('accepts both edges of %s', (field) => {
    const { min, max } = PROFILE_BOUNDS[field];
    expect(parseProfileField(field, min)).toEqual({ ok: true, value: min });
    expect(parseProfileField(field, max)).toEqual({ ok: true, value: max });
  });

  it.each(FIELDS)('refuses just outside %s', (field) => {
    const { min, max } = PROFILE_BOUNDS[field];
    expect(parseProfileField(field, min - 1)).toEqual({ ok: false, error: 'out_of_range' });
    expect(parseProfileField(field, max + 1)).toEqual({ ok: false, error: 'out_of_range' });
  });

  it('uses each field its own band — 250 is a fine FTP and an impossible pulse', () => {
    expect(parseProfileField('ftpWatts', 250)).toEqual({ ok: true, value: 250 });
    expect(parseProfileField('maxHrBpm', 250)).toEqual({ ok: false, error: 'out_of_range' });
    expect(parseProfileField('weightKg', 250)).toEqual({ ok: true, value: 250 });
  });

  it.each(FIELDS)('reads null and a missing key on %s as "estimate it"', (field) => {
    expect(parseProfileField(field, null)).toEqual({ ok: true, value: null });
    expect(parseProfileField(field, undefined)).toEqual({ ok: true, value: null });
  });

  it.each([
    ['a string', '200'],
    ['an empty string', ''],
    ['a boolean', true],
    ['an object', { value: 200 }],
    ['NaN', Number.NaN],
    ['Infinity', Number.POSITIVE_INFINITY]
  ])('refuses %s — the contract is number | null', (_label, raw) => {
    expect(parseProfileField('ftpWatts', raw)).toEqual({ ok: false, error: 'not_a_number' });
  });

  it('rounds to each field own precision', () => {
    expect(parseProfileField('ftpWatts', 249.6)).toEqual({ ok: true, value: 250 });
    expect(parseProfileField('maxHrBpm', 174.4)).toEqual({ ok: true, value: 174 });
    // One decimal on weight, and no float dust behind it.
    expect(parseProfileField('weightKg', 72.34)).toEqual({ ok: true, value: 72.3 });
    expect(parseProfileField('weightKg', 72.3)).toEqual({ ok: true, value: 72.3 });
  });
});

describe('parseProfileInput — what someone typed', () => {
  it('treats blank and whitespace as cleared', () => {
    expect(parseProfileInput('ftpWatts', '')).toEqual({ ok: true, value: null });
    expect(parseProfileInput('ftpWatts', '   ')).toEqual({ ok: true, value: null });
  });

  it('accepts a decimal comma — this app writes 72,5 first', () => {
    expect(parseProfileInput('weightKg', '72,5')).toEqual({ ok: true, value: 72.5 });
    expect(parseProfileInput('weightKg', '72.5')).toEqual({ ok: true, value: 72.5 });
  });

  it('refuses text', () => {
    expect(parseProfileInput('ftpWatts', 'dużo')).toEqual({ ok: false, error: 'not_a_number' });
    expect(parseProfileInput('ftpWatts', '250 W')).toEqual({ ok: false, error: 'not_a_number' });
  });

  it('applies the same bounds as the JSON path', () => {
    expect(parseProfileInput('maxHrBpm', '175')).toEqual({ ok: true, value: 175 });
    expect(parseProfileInput('maxHrBpm', '1750')).toEqual({ ok: false, error: 'out_of_range' });
  });

  it('round-trips a stored value through the input and back', () => {
    expect(parseProfileInput('weightKg', toProfileInput(72.5))).toEqual({ ok: true, value: 72.5 });
    expect(toProfileInput(null)).toBe('');
  });
});

describe('parseProfile — the whole body', () => {
  it('accepts all three, and an empty body as three cleared fields', () => {
    expect(parseProfile({ ftpWatts: 250, maxHrBpm: 175, weightKg: 72.5 })).toEqual({
      ok: true,
      profile: { ftpWatts: 250, maxHrBpm: 175, weightKg: 72.5 }
    });
    expect(parseProfile({})).toEqual({
      ok: true,
      profile: { ftpWatts: null, maxHrBpm: null, weightKg: null }
    });
  });

  it('reports every offending field at once', () => {
    const parsed = parseProfile({ ftpWatts: 5000, maxHrBpm: 'szybko', weightKg: 72 });
    expect(parsed).toEqual({
      ok: false,
      fields: { ftpWatts: 'out_of_range', maxHrBpm: 'not_a_number' }
    });
  });

  it.each([
    ['null', null],
    ['a string', 'ftp=250'],
    ['an array', [250, 175, 72]]
  ])('refuses %s without blaming a field', (_label, body) => {
    expect(parseProfile(body)).toEqual({ ok: false, fields: {} });
  });
});

describe('readStoredProfile — narrowing an untrusted bag', () => {
  it('returns the three numbers and ignores everything else in the bag', () => {
    expect(readStoredProfile({ ftpWatts: 250, maxHrBpm: 175, weightKg: 72.5, locale: 'pl' })).toEqual({
      ftpWatts: 250,
      maxHrBpm: 175,
      weightKg: 72.5
    });
  });

  it('reads a missing, null or non-numeric value as "estimate it"', () => {
    expect(readStoredProfile({})).toEqual({ ftpWatts: null, maxHrBpm: null, weightKg: null });
    expect(readStoredProfile({ ftpWatts: null, maxHrBpm: '175', weightKg: Number.NaN })).toEqual({
      ftpWatts: null,
      maxHrBpm: null,
      weightKg: null
    });
  });

  it('matches what the analysis reads: zero and negatives are not values', () => {
    expect(readStoredProfile({ ftpWatts: 0, weightKg: -72 })).toMatchObject({
      ftpWatts: null,
      weightKg: null
    });
  });
});
