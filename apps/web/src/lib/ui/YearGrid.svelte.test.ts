import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/svelte';
import YearGrid from './YearGrid.svelte';
import type { YearGridDay } from './YearGrid.svelte';

afterEach(cleanup);

const day = (d: string, value: number, title?: string): YearGridDay => ({
  day: d,
  value,
  ...(title === undefined ? {} : { title })
});

/** Every real cell in the grid, excluding the leading alignment padding and the legend. */
const cells = (container: HTMLElement): Element[] => [...container.querySelectorAll('.grid .cell:not(.pad)')];

const levels = (container: HTMLElement): number[] =>
  cells(container).map((el) => Number(el.getAttribute('data-level')));

describe('YearGrid', () => {
  it('draws every day of the year, leap years included', () => {
    const common = render(YearGrid, { props: { days: [], year: 2026 } });
    expect(cells(common.container)).toHaveLength(365);

    cleanup();
    const leap = render(YearGrid, { props: { days: [], year: 2024 } });
    expect(cells(leap.container)).toHaveLength(366);
  });

  it('pads the first column so 1 January lands on its real weekday', () => {
    // 1 January 2026 is a Thursday → three leading blanks (Mon, Tue, Wed).
    const { container } = render(YearGrid, { props: { days: [], year: 2026 } });
    expect(container.querySelectorAll('.grid .cell.pad')).toHaveLength(3);
  });

  it('leaves a day with no activity visibly EMPTY, not merely pale', () => {
    const { container } = render(YearGrid, {
      props: { days: [day('2026-03-01', 10)], year: 2026 }
    });
    // Exactly one cell is shaded; every other is level 0.
    expect(levels(container).filter((l) => l > 0)).toHaveLength(1);
  });

  it('shades by QUANTILE, so one huge day cannot wash out an ordinary year', () => {
    // Nineteen ordinary days and one enormous one. Linear shading would put all nineteen in the palest
    // band; quantile shading spreads them across the palette.
    const ordinary = Array.from({ length: 19 }, (_, i) =>
      day(`2026-02-${String(i + 1).padStart(2, '0')}`, 8 + i)
    );
    const { container } = render(YearGrid, {
      props: { days: [...ordinary, day('2026-03-01', 400)], year: 2026 }
    });
    const shaded = levels(container).filter((l) => l > 0);
    expect(shaded).toHaveLength(20);
    // More than one shade in use among the ordinary days.
    expect(new Set(shaded).size).toBeGreaterThan(2);
  });

  it('puts the biggest day in the darkest band', () => {
    const days = [day('2026-01-05', 1), day('2026-01-06', 2), day('2026-01-07', 3), day('2026-01-08', 99)];
    const { container } = render(YearGrid, { props: { days, year: 2026 } });
    expect(Math.max(...levels(container))).toBe(4);
  });

  it('counts the active days in its accessible name', () => {
    const { container } = render(YearGrid, {
      props: { days: [day('2026-03-01', 5), day('2026-03-02', 5)], year: 2026 }
    });
    expect(container.querySelector('.grid')?.getAttribute('aria-label')).toContain(
      '2 dni z aktywnością — 2026'
    );
  });

  it('uses a caller-supplied tooltip, and explains a rest day otherwise', () => {
    const { container } = render(YearGrid, {
      props: { days: [day('2026-03-01', 12.4, '12,4 km · Bieg')], year: 2026, unit: 'km' }
    });
    const titles = cells(container).map((el) => el.getAttribute('title'));
    expect(titles).toContain('12,4 km · Bieg');
    expect(titles.some((t) => t?.includes('brak aktywności'))).toBe(true);
  });

  it('falls back to the value and unit when no tooltip is given', () => {
    const { container } = render(YearGrid, {
      props: { days: [day('2026-03-01', 12)], year: 2026, unit: 'km' }
    });
    const titles = cells(container).map((el) => el.getAttribute('title'));
    expect(titles.some((t) => t?.includes('12 km'))).toBe(true);
  });

  it('ignores days outside the year and days that are not real dates', () => {
    const { container } = render(YearGrid, {
      props: {
        days: [day('2025-06-01', 50), day('2026-02-30', 50), day('not-a-day', 50)],
        year: 2026
      }
    });
    expect(levels(container).every((l) => l === 0)).toBe(true);
  });

  it('renders a legend from empty to darkest', () => {
    const { container } = render(YearGrid, { props: { days: [], year: 2026 } });
    const legend = [...container.querySelectorAll('.legend .cell')];
    expect(legend).toHaveLength(5);
    expect(legend.map((el) => el.getAttribute('data-level'))).toEqual(['0', '1', '2', '3', '4']);
  });

  it('survives a year with no data at all', () => {
    const { container } = render(YearGrid, { props: { days: [], year: 2026 } });
    expect(levels(container).every((l) => l === 0)).toBe(true);
    expect(container.querySelector('.grid')?.getAttribute('aria-label')).toContain('0 dni');
  });

  /**
   * Spec 070. The volume page's period switch can point the grid at a rolling twelve months, which
   * is not a calendar year — and it hands the component four years of days each time, so everything
   * the grid says has to be about the drawn span, not about the whole payload.
   */
  describe('arbitrary span', () => {
    it('draws exactly the requested range, inclusive of both ends', () => {
      const { container } = render(YearGrid, {
        props: { days: [], year: 2026, from: '2026-03-02', to: '2026-03-15' }
      });
      // 2 March 2026 is a Monday, so there is no leading padding to discount.
      expect(cells(container)).toHaveLength(14);
      expect(container.querySelectorAll('.grid .cell.pad')).toHaveLength(0);
    });

    it('spans a year boundary, which a calendar-year grid could never do', () => {
      const { container } = render(YearGrid, {
        props: {
          days: [day('2025-12-31', 10), day('2026-01-02', 10)],
          year: 2026,
          from: '2025-12-29',
          to: '2026-01-04'
        }
      });
      expect(cells(container)).toHaveLength(7);
      expect(levels(container).filter((l) => l > 0)).toHaveLength(2);
    });

    it('counts and shades only the drawn span, never the whole payload', () => {
      const { container } = render(YearGrid, {
        props: {
          // A huge day OUTSIDE the span must not skew the quantiles or the day count.
          days: [day('2026-03-02', 5), day('2026-03-03', 20), day('2025-07-01', 500)],
          year: 2026,
          from: '2026-03-02',
          to: '2026-03-08',
          spanLabel: 'ostatnie 12 miesięcy'
        }
      });
      const label = container.querySelector('.grid')?.getAttribute('aria-label');
      expect(label).toContain('2 dni z aktywnością — ostatnie 12 miesięcy');
      // The biggest day IN the span is the darkest. Quantiles taken over the whole payload would
      // rank it against a 500 km day from a year the grid is not showing and leave it mid-palette.
      expect(levels(container).filter((l) => l === 4)).toHaveLength(1);
      expect(levels(container).filter((l) => l === 1)).toHaveLength(1);
    });

    it('falls back to the whole calendar year when the range is missing or inverted', () => {
      const whole = render(YearGrid, { props: { days: [], year: 2026 } });
      const inverted = render(YearGrid, {
        props: { days: [], year: 2026, from: '2026-06-01', to: '2026-01-01' }
      });
      expect(cells(inverted.container)).toHaveLength(cells(whole.container).length);
      expect(cells(whole.container)).toHaveLength(365);
    });
  });
});
