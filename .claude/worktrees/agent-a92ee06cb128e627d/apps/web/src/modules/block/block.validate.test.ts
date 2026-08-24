import { describe, it, expect } from 'vitest';
import { parseBlockPatch, parseConstraints, parseNewBlock, parsePaces } from './block.validate';

describe('parseNewBlock', () => {
  it('accepts a full block and snaps the start to its Monday', () => {
    const result = parseNewBlock({
      name: 'Baza pod 5 km',
      startDate: '2026-08-19', // a Wednesday
      weeks: 16,
      paces: { easy: { lowS: 370, highS: 390 } },
      constraints: ['4 biegi/tydz'],
      note: 'po teście 5 km'
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.startDay).toBe('2026-08-17');
    expect(result.value.weeks).toBe(16);
    expect(result.value.paces).toEqual({ easy: { lowS: 370, highS: 390 } });
    expect(result.value.constraints).toEqual(['4 biegi/tydz']);
  });

  it('accepts either spelling of the start day', () => {
    const a = parseNewBlock({ name: 'x', startDay: '2026-08-17', weeks: 4 });
    const b = parseNewBlock({ name: 'x', startDate: '2026-08-17', weeks: 4 });
    expect(a.ok && b.ok).toBe(true);
  });

  it('rejects a missing name, a bad date and an impossible length', () => {
    expect(parseNewBlock({ name: '  ', startDate: '2026-08-17', weeks: 4 })).toMatchObject({ ok: false });
    expect(parseNewBlock({ name: 'x', startDate: '17.08.2026', weeks: 4 })).toMatchObject({ ok: false });
    expect(parseNewBlock({ name: 'x', startDate: '2026-08-17', weeks: 0 })).toMatchObject({ ok: false });
    expect(parseNewBlock({ name: 'x', startDate: '2026-08-17', weeks: 53 })).toMatchObject({ ok: false });
    expect(parseNewBlock({ name: 'x', startDate: '2026-08-17', weeks: 4.5 })).toMatchObject({ ok: false });
  });

  it('rejects anything that is not an object', () => {
    expect(parseNewBlock(null)).toMatchObject({ ok: false });
    expect(parseNewBlock([])).toMatchObject({ ok: false });
  });
});

describe('parsePaces', () => {
  it('swaps a band written back to front rather than rejecting it', () => {
    // The intent is never in doubt, and refusing would only teach the athlete to type it twice.
    const result = parsePaces({ threshold: { lowS: 265, highS: 255 } });
    expect(result).toMatchObject({ ok: true });
    if (!result.ok) return;
    expect(result.value.threshold).toEqual({ lowS: 255, highS: 265 });
  });

  it('rejects a pace outside anything a human runs', () => {
    // 90 s/km is faster than the world record; 25 min/km is slower than walking. Both are unit errors.
    expect(parsePaces({ easy: { lowS: 90, highS: 100 } })).toMatchObject({ ok: false });
    expect(parsePaces({ easy: { lowS: 1400, highS: 1500 } })).toMatchObject({ ok: false });
  });

  it('rejects an unknown band and a half-given one', () => {
    expect(parsePaces({ tempo: { lowS: 300, highS: 320 } })).toMatchObject({ ok: false });
    expect(parsePaces({ easy: { lowS: 370 } })).toMatchObject({ ok: false });
  });

  it('treats absent paces as none', () => {
    expect(parsePaces(undefined)).toEqual({ ok: true, value: {} });
    expect(parsePaces(null)).toEqual({ ok: true, value: {} });
  });
});

describe('parseConstraints', () => {
  it('trims, drops blanks and keeps order', () => {
    const result = parseConstraints(['  4 biegi/tydz ', '', 'kolana']);
    expect(result).toEqual({ ok: true, value: ['4 biegi/tydz', 'kolana'] });
  });

  it('caps the count and the length', () => {
    expect(parseConstraints(Array.from({ length: 21 }, () => 'x'))).toMatchObject({ ok: false });
    expect(parseConstraints(['x'.repeat(201)])).toMatchObject({ ok: false });
  });

  it('rejects a non-list and a non-text entry', () => {
    expect(parseConstraints('4 biegi')).toMatchObject({ ok: false });
    expect(parseConstraints([1])).toMatchObject({ ok: false });
  });
});

describe('parseBlockPatch', () => {
  it('returns only the keys present', () => {
    const result = parseBlockPatch({ name: 'Build' });
    expect(result).toEqual({ ok: true, value: { name: 'Build' } });
  });

  it('rejects an empty patch rather than writing a no-op', () => {
    expect(parseBlockPatch({})).toMatchObject({ ok: false });
  });

  it('distinguishes an absent key from an explicit null in week targets', () => {
    const result = parseBlockPatch({ weekTargets: [{ weekNumber: 7, focus: null }] }, 16);
    expect(result).toMatchObject({ ok: true });
    if (!result.ok) return;
    const target = result.value.weekTargets![0]!;
    expect(target.focus).toBeNull();
    expect('volumeTargetKm' in target).toBe(false);
  });

  it('refuses a target on a week the block does not have', () => {
    expect(parseBlockPatch({ weekTargets: [{ weekNumber: 20 }] }, 16)).toMatchObject({ ok: false });
  });

  it('checks week targets against the length the patch itself sets', () => {
    // Shrinking to 8 weeks and setting a target on week 12 in one call is caught here rather than
    // stored and never read.
    expect(parseBlockPatch({ weeks: 8, weekTargets: [{ weekNumber: 12 }] }, 16)).toMatchObject({
      ok: false
    });
    expect(parseBlockPatch({ weeks: 20, weekTargets: [{ weekNumber: 18 }] }, 16)).toMatchObject({
      ok: true
    });
  });

  it('rejects an out-of-range volume target', () => {
    expect(parseBlockPatch({ weekTargets: [{ weekNumber: 1, volumeTargetKm: 900 }] }, 16)).toMatchObject({
      ok: false
    });
  });
});
