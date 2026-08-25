import { describe, it, expect } from 'vitest';
import { readoutStep } from './readout-fit';

describe('readoutStep', () => {
  it('keeps the hero size for short readouts', () => {
    expect(readoutStep('42')).toBe('xl');
    expect(readoutStep(9204)).toBe('xl');
    expect(readoutStep('11238')).toBe('xl');
  });

  it('steps down as the rendered string grows', () => {
    expect(readoutStep('11 238')).toBe('lg'); // 6
    expect(readoutStep('1 234 5')).toBe('lg'); // 7
    expect(readoutStep('12:34:56')).toBe('md'); // 8
    expect(readoutStep('1 234 567')).toBe('md'); // 9
    expect(readoutStep('12 345 678')).toBe('sm'); // 10
  });

  it('shrinks the duration readout that used to overflow the tile', () => {
    // /training/walk → "Czas": the regression this rule exists for (spec 029).
    expect(readoutStep('6 h 52 min')).toBe('sm');
    expect(readoutStep('12 h 05 min')).toBe('sm');
    expect(readoutStep('52 min')).toBe('lg');
  });

  it('counts a unit at a reduced weight, since it renders smaller', () => {
    expect(readoutStep(50, 'bpm')).toBe('xl'); // 2 + 2 → still the hero size
    expect(readoutStep('1 234', 'km')).toBe('lg'); // 5 + 1 → the pair no longer fits at xl
    expect(readoutStep('4:52', '/km')).toBe('lg'); // 4 + 2
  });

  it('treats an empty readout as short', () => {
    expect(readoutStep('')).toBe('xl');
    expect(readoutStep('—')).toBe('xl');
  });

  it('lands two same-length values at the same step regardless of their exact characters', () => {
    // The bug this guards against (spec 040): "30:26" and "4.94" used to render at different sizes
    // in the same grid because a separate per-glyph scale (since removed) weighted their punctuation
    // differently. The step itself — the only thing StatTile now sizes off — must not do that.
    expect(readoutStep('30:26')).toBe(readoutStep('4.94'));
  });
});
