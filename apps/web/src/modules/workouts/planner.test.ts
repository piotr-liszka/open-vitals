import { describe, it, expect } from 'vitest';
import { GRID_WEEKS, byTimeThenTitle, gridRange, groupByDay, monthGrid, monthWeeks } from './planner';

describe('month grid (spec 066)', () => {
  it('is always 6×7, so the panel never changes height between months', () => {
    for (const month of ['2026-02', '2026-08', '2027-01']) {
      expect(monthGrid(month)).toHaveLength(GRID_WEEKS * 7);
      expect(monthWeeks(month)).toHaveLength(GRID_WEEKS);
      for (const week of monthWeeks(month)) expect(week).toHaveLength(7);
    }
  });

  it('starts on a Monday', () => {
    // 2026-08-01 is a Saturday, so the grid opens on Monday 2026-07-27.
    expect(monthGrid('2026-08')[0]!.day).toBe('2026-07-27');
  });

  /**
   * The case that breaks naive calendar code: a month whose 1st falls on a Sunday needs SIX leading
   * cells, and an implementation keyed on a Sunday-first week produces one.
   */
  it('places the 1st correctly when the month starts on a Sunday', () => {
    // 2026-03-01 is a Sunday.
    const cells = monthGrid('2026-03');
    expect(cells[0]!.day).toBe('2026-02-23');
    expect(cells[6]!.day).toBe('2026-03-01');
    expect(cells[6]!.inMonth).toBe(true);
    expect(cells[5]!.inMonth).toBe(false);
  });

  it('marks borrowed days from the neighbouring months as outside', () => {
    const cells = monthGrid('2026-08');
    expect(cells.filter((c) => c.inMonth)).toHaveLength(31);
    expect(cells[0]!.inMonth).toBe(false);
    expect(cells.at(-1)!.inMonth).toBe(false);
  });

  it('handles a leap February', () => {
    expect(monthGrid('2028-02').filter((c) => c.inMonth)).toHaveLength(29);
    expect(monthGrid('2026-02').filter((c) => c.inMonth)).toHaveLength(28);
  });
});

describe('gridRange', () => {
  /**
   * The loader queries THIS, not the month's own bounds. Reading only the month would leave the
   * borrowed cells unmarked, so a session on the 31st of the previous month would render as an empty
   * day the athlete can see — a calendar that is blank where it should not be.
   */
  it('spans the whole visible grid, not just the month', () => {
    expect(gridRange('2026-08')).toEqual({ from: '2026-07-27', to: '2026-09-06' });
  });

  it('agrees with the grid it describes', () => {
    for (const month of ['2026-01', '2026-03', '2026-12']) {
      const cells = monthGrid(month);
      const { from, to } = gridRange(month);
      expect(from).toBe(cells[0]!.day);
      expect(to).toBe(cells.at(-1)!.day);
    }
  });
});

describe('groupByDay', () => {
  it('buckets by the day accessor, preserving order within a day', () => {
    const items = [
      { id: 'a', day: '2026-08-12' },
      { id: 'b', day: '2026-08-13' },
      { id: 'c', day: '2026-08-12' }
    ];
    const grouped = groupByDay(items, (i) => i.day);
    expect(grouped.get('2026-08-12')?.map((i) => i.id)).toEqual(['a', 'c']);
    expect(grouped.get('2026-08-13')?.map((i) => i.id)).toEqual(['b']);
    expect(grouped.has('2026-08-14')).toBe(false);
  });

  it('is empty for no items', () => {
    expect(groupByDay([], () => '2026-01-01').size).toBe(0);
  });
});

describe('byTimeThenTitle', () => {
  const s = (time: string | null, title: string) => ({ time, title });

  it('orders timed sessions by the clock', () => {
    expect([s('18:00', 'b'), s('06:30', 'a')].sort(byTimeThenTitle).map((x) => x.time)).toEqual([
      '06:30',
      '18:00'
    ]);
  });

  /** An untimed session is not an early one; sorting it to 00:00 would claim it was. */
  it('puts untimed sessions after timed ones, not first', () => {
    const sorted = [s(null, 'kiedyś'), s('18:00', 'wieczorem')].sort(byTimeThenTitle);
    expect(sorted.map((x) => x.title)).toEqual(['wieczorem', 'kiedyś']);
  });

  it('falls back to the title so the order is stable', () => {
    expect([s(null, 'b'), s(null, 'a')].sort(byTimeThenTitle).map((x) => x.title)).toEqual(['a', 'b']);
    expect([s('07:00', 'b'), s('07:00', 'a')].sort(byTimeThenTitle).map((x) => x.title)).toEqual(['a', 'b']);
  });
});
