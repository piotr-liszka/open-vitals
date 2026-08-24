import { describe, it, expect } from 'vitest';
import { labelFitScale, readoutFitScale, readoutStep } from './readout-fit';

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
    // /training/marsz → "Czas": the regression this rule exists for (spec 029).
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
});

/**
 * The scales are consumed as `calc(100cqw * scale)`, so a scale is asserted through the size it yields
 * at a given tile width — that is the property that has to hold, not the number itself.
 */
describe('readoutFitScale', () => {
  /** Usable width of one activity-detail hero tile at --container-max: ~118px. */
  const NARROW = 118;
  /** ...and of one dashboard tile in the 3-column grid. */
  const WIDE = 250;
  const sizeAt = (width: number, scale: number): number => width * scale;

  it('leaves the hero token in charge in a wide tile', () => {
    // 48px is --readout-xl's upper clamp: the container term must not undercut it here.
    expect(sizeAt(WIDE, readoutFitScale('6,11', 'km'))).toBeGreaterThan(48);
    expect(sizeAt(WIDE, readoutFitScale('6336'))).toBeGreaterThan(48);
  });

  it('shrinks the value+unit pair that overlapped in a narrow tile', () => {
    // "6,11 km" and "5:44 min/km" at 48px are the two overlaps this rule exists for (spec 031).
    const distance = sizeAt(NARROW, readoutFitScale('6,11', 'km'));
    const pace = sizeAt(NARROW, readoutFitScale('5:44', 'min/km'));
    expect(distance).toBeLessThan(48);
    expect(pace).toBeLessThan(distance); // the longer unit costs more room
    expect(pace).toBeGreaterThan(16); // ...but a readout never collapses to caption size
  });

  it('charges for the unit, so the same value fits smaller with one', () => {
    expect(readoutFitScale('1 234', 'km')).toBeLessThan(readoutFitScale('1 234'));
  });

  it('is safe for an empty readout', () => {
    expect(readoutFitScale('')).toBe(1);
    expect(Number.isFinite(readoutFitScale(''))).toBe(true);
  });
});

describe('labelFitScale', () => {
  /** The label's line in a narrow hero tile, less the accent dot and its gap. */
  const NARROW_LABEL = 118 - 16;
  const sizeAt = (width: number, scale: number): number => width * scale;

  it('keeps micro-caps at the token size when the longest word fits', () => {
    // 12px is --text-xs; a wrapping multi-word label must not be punished for its total length.
    expect(sizeAt(NARROW_LABEL, labelFitScale('CZAS W RUCHU'))).toBeGreaterThan(12);
    expect(sizeAt(NARROW_LABEL, labelFitScale('KALORIE'))).toBeGreaterThan(12);
  });

  it('shrinks a long unbreakable word', () => {
    // "PRZEWYŻSZENIE" has no wrap opportunity and used to run past the tile border (spec 031).
    expect(sizeAt(NARROW_LABEL, labelFitScale('PRZEWYŻSZENIE'))).toBeLessThan(12);
  });

  it('sizes off the longest word, not the whole string', () => {
    expect(labelFitScale('A B C D E F G H')).toBe(labelFitScale('A'));
  });

  it('is safe for an empty label', () => {
    expect(labelFitScale('')).toBe(1);
  });
});
