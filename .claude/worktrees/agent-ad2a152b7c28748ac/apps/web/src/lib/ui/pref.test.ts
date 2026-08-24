import { describe, it, expect } from 'vitest';
import { readBoolPref, readEnumPref, writeBoolPref, writePref, type PrefStorage } from './pref';

const ORIENTATIONS = ['vertical', 'horizontal'] as const;
type Orientation = (typeof ORIENTATIONS)[number];

function fakeStorage(initial: Record<string, string> = {}): PrefStorage & { data: Map<string, string> } {
  const data = new Map(Object.entries(initial));
  return {
    data,
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, v)
  };
}

/** A store that throws on every access — Safari private mode / storage-disabled policy / quota. */
const hostileStorage: PrefStorage = {
  getItem() {
    throw new DOMException('denied');
  },
  setItem() {
    throw new DOMException('quota exceeded');
  }
};

describe('readEnumPref', () => {
  it('returns a stored allowed value', () => {
    const store = fakeStorage({ 'gb-x': 'horizontal' });
    expect(readEnumPref<Orientation>('gb-x', ORIENTATIONS, 'vertical', store)).toBe('horizontal');
  });

  it('falls back when the key is absent', () => {
    expect(readEnumPref<Orientation>('gb-x', ORIENTATIONS, 'vertical', fakeStorage())).toBe('vertical');
  });

  it('falls back on a value outside the allowed set', () => {
    const store = fakeStorage({ 'gb-x': 'diagonal' });
    expect(readEnumPref<Orientation>('gb-x', ORIENTATIONS, 'vertical', store)).toBe('vertical');
  });

  it('falls back with no storage at all (SSR)', () => {
    expect(readEnumPref<Orientation>('gb-x', ORIENTATIONS, 'horizontal', null)).toBe('horizontal');
  });

  it('falls back instead of throwing when the store denies access', () => {
    expect(readEnumPref<Orientation>('gb-x', ORIENTATIONS, 'vertical', hostileStorage)).toBe('vertical');
  });
});

describe('writePref', () => {
  it('writes through', () => {
    const store = fakeStorage();
    writePref('gb-x', 'horizontal', store);
    expect(store.data.get('gb-x')).toBe('horizontal');
  });

  it('is a no-op without storage', () => {
    expect(() => writePref('gb-x', 'horizontal', null)).not.toThrow();
  });

  it('swallows a throwing store', () => {
    expect(() => writePref('gb-x', 'horizontal', hostileStorage)).not.toThrow();
  });

  it('round-trips through read', () => {
    const store = fakeStorage();
    writePref('gb-x', 'horizontal', store);
    expect(readEnumPref<Orientation>('gb-x', ORIENTATIONS, 'vertical', store)).toBe('horizontal');
  });
});

describe('readBoolPref / writeBoolPref', () => {
  it('round-trips both ways', () => {
    const store = fakeStorage();
    writeBoolPref('gb-open', true, store);
    expect(readBoolPref('gb-open', false, store)).toBe(true);
    writeBoolPref('gb-open', false, store);
    expect(readBoolPref('gb-open', true, store)).toBe(false);
  });

  it('falls back for an absent key', () => {
    expect(readBoolPref('gb-open', true, fakeStorage())).toBe(true);
    expect(readBoolPref('gb-open', false, fakeStorage())).toBe(false);
  });

  it('falls back for junk rather than coercing it', () => {
    // The trap this guards: `Boolean('false')` is `true`.
    expect(readBoolPref('gb-open', false, fakeStorage({ 'gb-open': 'false' }))).toBe(false);
    expect(readBoolPref('gb-open', true, fakeStorage({ 'gb-open': 'yes' }))).toBe(true);
  });

  it('survives a missing and a hostile store', () => {
    expect(readBoolPref('gb-open', true, null)).toBe(true);
    expect(readBoolPref('gb-open', true, hostileStorage)).toBe(true);
    expect(() => writeBoolPref('gb-open', true, hostileStorage)).not.toThrow();
  });
});
