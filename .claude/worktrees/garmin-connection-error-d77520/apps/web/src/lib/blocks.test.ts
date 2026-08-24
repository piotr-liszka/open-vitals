import { describe, it, expect } from 'vitest';
import {
  blockEndDay,
  blocksOverlap,
  positionOf,
  snapToMonday,
  startsInDays,
  weekBounds,
  weekNumberOf
} from './blocks';

/** A 16-week block starting Monday 2026-08-17 — the shape the coaching feedback describes. */
const block = { startDay: '2026-08-17', weeks: 16 };

describe('block span', () => {
  it('ends on the last day of the last week', () => {
    // 16 weeks = 112 days, so the inclusive end is start + 111.
    expect(blockEndDay(block)).toBe('2026-12-06');
  });

  it('treats a one-week block as seven days', () => {
    expect(blockEndDay({ startDay: '2026-08-17', weeks: 1 })).toBe('2026-08-23');
  });

  it('detects overlap on a single shared day and not on adjacency', () => {
    const next = { startDay: '2026-12-07', weeks: 4 }; // the Monday after this block ends
    expect(blocksOverlap(block, next)).toBe(false);

    const touching = { startDay: '2026-12-06', weeks: 4 }; // shares exactly the last day
    expect(blocksOverlap(block, touching)).toBe(true);

    // Overlap is symmetric, and a block fully inside another counts.
    const inside = { startDay: '2026-09-07', weeks: 2 };
    expect(blocksOverlap(block, inside)).toBe(true);
    expect(blocksOverlap(inside, block)).toBe(true);
  });
});

describe('week number', () => {
  it('is 1 on the first day and on the last day of week 1', () => {
    expect(weekNumberOf(block, '2026-08-17')).toBe(1);
    expect(weekNumberOf(block, '2026-08-23')).toBe(1);
  });

  it('rolls over on the Monday', () => {
    expect(weekNumberOf(block, '2026-08-24')).toBe(2);
  });

  it("reaches the coach's week 7 seven weeks in", () => {
    expect(weekNumberOf(block, '2026-09-28')).toBe(7);
  });

  it('clamps outside the block rather than returning week 0 or 19', () => {
    expect(weekNumberOf(block, '2026-08-10')).toBe(1);
    expect(weekNumberOf(block, '2027-01-04')).toBe(16);
  });

  it('counts calendar days across the DST change, not 7×86400 seconds', () => {
    // Poland turns the clocks back on 2026-10-25, inside week 10 of this block. A block counted in
    // seconds would slip a day here and report week 11 for the Sunday.
    expect(weekNumberOf(block, '2026-10-25')).toBe(10);
    expect(weekNumberOf(block, '2026-10-26')).toBe(11);
    expect(weekBounds(block, 11)).toEqual({ start: '2026-10-26', end: '2026-11-01' });
  });
});

describe('week bounds', () => {
  it('spans Monday to Sunday', () => {
    expect(weekBounds(block, 1)).toEqual({ start: '2026-08-17', end: '2026-08-23' });
    expect(weekBounds(block, 7)).toEqual({ start: '2026-09-28', end: '2026-10-04' });
    expect(weekBounds(block, 16)).toEqual({ start: '2026-11-30', end: '2026-12-06' });
  });
});

describe('position', () => {
  it('reports before, live and done against the span', () => {
    expect(positionOf(block, '2026-08-16')).toBe('before');
    expect(positionOf(block, '2026-08-17')).toBe('live');
    expect(positionOf(block, '2026-12-06')).toBe('live');
    expect(positionOf(block, '2026-12-07')).toBe('done');
  });

  it('counts days to the start and stops at zero once running', () => {
    expect(startsInDays(block, '2026-08-10')).toBe(7);
    expect(startsInDays(block, '2026-08-17')).toBe(0);
    expect(startsInDays(block, '2026-09-01')).toBe(0);
  });
});

describe('snapToMonday', () => {
  it('leaves a Monday alone and pulls any other day back to its Monday', () => {
    expect(snapToMonday('2026-08-17')).toBe('2026-08-17');
    expect(snapToMonday('2026-08-19')).toBe('2026-08-17'); // Wednesday
    expect(snapToMonday('2026-08-23')).toBe('2026-08-17'); // Sunday — the ISO week, not the next one
  });
});
