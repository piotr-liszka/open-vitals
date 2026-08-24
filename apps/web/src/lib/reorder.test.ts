import { describe, it, expect } from 'vitest';
import { moveItem } from './reorder';

/**
 * The drag layer only decides `from` and `to`; everything else about a move is this function, which
 * is why the mouse drag and the keyboard arrows provably agree.
 */
describe('reordering (spec 064)', () => {
  it('moves an item to a later slot', () => {
    expect(moveItem(['a', 'b', 'c', 'd'], 0, 2)).toEqual(['b', 'c', 'a', 'd']);
  });

  it('moves an item to an earlier slot', () => {
    expect(moveItem(['a', 'b', 'c', 'd'], 3, 1)).toEqual(['a', 'd', 'b', 'c']);
  });

  it('returns the SAME reference for a no-op, so a pointless save can be skipped', () => {
    const items = ['a', 'b', 'c'];
    expect(moveItem(items, 1, 1)).toBe(items);
    expect(moveItem(items, -1, 1)).toBe(items);
    expect(moveItem(items, 0, 9)).toBe(items);
  });

  it('never loses or duplicates an item', () => {
    const items = ['a', 'b', 'c', 'd', 'e'];
    for (let from = 0; from < items.length; from++) {
      for (let to = 0; to < items.length; to++) {
        expect([...moveItem(items, from, to)].sort()).toEqual([...items].sort());
      }
    }
  });
});
