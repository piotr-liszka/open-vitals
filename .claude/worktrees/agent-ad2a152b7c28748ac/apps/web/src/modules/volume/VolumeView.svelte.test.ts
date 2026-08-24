import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/svelte';
import VolumeView from './VolumeView.svelte';
import type { MonthVolume, VolumeData } from './volume.types';

afterEach(cleanup);

function month(key: string, km: number, partial = false): MonthVolume {
  return {
    month: key,
    activities: 4,
    distanceM: km * 1000,
    durationS: km * 300,
    elevationGainM: km * 10,
    partial
  };
}

function data(over: Partial<VolumeData> = {}): VolumeData {
  const monthly = [month('2026-06', 100), month('2026-07', 200), month('2026-08', 30, true)];
  const years = [
    { year: 2026, cumulativeKm: [10, 20], totalKm: 20, toDateKm: 20, partial: true },
    { year: 2025, cumulativeKm: [5, 8], totalKm: 500, toDateKm: 8, partial: false }
  ];
  const merged: VolumeData = {
    windowMonths: 3,
    months: monthly.map((m) => m.month),
    monthly,
    bySport: [
      {
        group: 'run',
        label: 'Bieg',
        color: 'var(--lane-orange)',
        distanceM: [100_000, 200_000, 30_000],
        durationS: [30_000, 60_000, 9000],
        elevationGainM: [1000, 2000, 300]
      }
    ],
    years,
    vsLastYearKm: 12,
    yearsBySport: {},
    sportOptions: [{ value: 'all', label: 'Wszystko' }],
    throughDayOfYear: 223,
    dayOfYearLabels: ['sty', ''],
    gridDays: [
      { day: '2026-03-01', km: 12.4, title: '1 mar 2026: 12,4 km · 1 aktywność' },
      { day: '2026-03-03', km: 8, title: '3 mar 2026: 8,0 km · 1 aktywność' }
    ],
    today: '2026-08-11',
    hasData: true,
    ...over
  };

  // `all` mirrors the flat fields the way the loader builds it, so a test that overrides
  // `years`/`vsLastYearKm` alone still describes a coherent payload.
  return over.yearsBySport
    ? merged
    : { ...merged, yearsBySport: { all: { years: merged.years, vsLastYearKm: merged.vsLastYearKm } } };
}

/** A two-sport athlete: the only shape that earns the year-over-year sport switch. */
function multiSport(): VolumeData {
  const base = data();
  const rideYears = [
    { year: 2026, cumulativeKm: [40, 80], totalKm: 80, toDateKm: 80, partial: true },
    { year: 2025, cumulativeKm: [10, 20], totalKm: 900, toDateKm: 20, partial: false }
  ];
  return {
    ...base,
    yearsBySport: {
      ...base.yearsBySport,
      run: { years: base.years, vsLastYearKm: 12 },
      ride: { years: rideYears, vsLastYearKm: 60 }
    },
    sportOptions: [
      { value: 'all', label: 'Wszystko' },
      { value: 'run', label: 'Bieg' },
      { value: 'ride', label: 'Rower' }
    ]
  };
}

describe('VolumeView', () => {
  it('explains itself instead of drawing empty charts with nothing synced', () => {
    const { container, getByText } = render(VolumeView, {
      props: { data: data({ hasData: false }) }
    });
    expect(getByText(/Brak zsynchronizowanych aktywności/)).toBeTruthy();
    expect(container.querySelector('table')).toBeNull();
  });

  it('headlines the comparable number — this year TO DATE, not the full year', () => {
    const { getByText } = render(VolumeView, { props: { data: data() } });
    expect(getByText('W tym roku do dziś')).toBeTruthy();
    expect(getByText('2025 do tego dnia')).toBeTruthy();
    // Last year's whole-year total is offered as context, clearly labelled as such.
    expect(getByText('Cały 2025')).toBeTruthy();
  });

  it('says whether the athlete is ahead of last year, at the same day of the season', () => {
    const { getByText } = render(VolumeView, { props: { data: data() } });
    expect(getByText(/Przed\s+rokiem 2025/)).toBeTruthy();
    expect(getByText(/na ten sam dzień roku/)).toBeTruthy();
  });

  it('flips that verdict when behind', () => {
    const { getByText } = render(VolumeView, { props: { data: data({ vsLastYearKm: -40 }) } });
    expect(getByText(/Za\s+rokiem 2025/)).toBeTruthy();
  });

  it('omits the verdict entirely when there is no year to compare against', () => {
    const { container } = render(VolumeView, {
      props: {
        data: data({
          vsLastYearKm: null,
          years: [{ year: 2026, cumulativeKm: [10], totalKm: 10, toDateKm: 10, partial: true }]
        })
      }
    });
    expect(container.querySelector('.verdict')).toBeNull();
  });

  it('marks the month in progress in the table so its short row is not read as a collapse', () => {
    const { container } = render(VolumeView, { props: { data: data() } });
    const rows = [...container.querySelectorAll('tbody tr')];
    // Newest month first.
    expect(rows[0]?.classList.contains('partial')).toBe(true);
    expect(rows[0]?.textContent).toContain('w toku');
    expect(rows[1]?.classList.contains('partial')).toBe(false);
  });

  it('lists every month of the window newest first', () => {
    const { container } = render(VolumeView, { props: { data: data() } });
    const heads = [...container.querySelectorAll('tbody th')].map((el) =>
      // The row heading carries the "w toku" tag inline; the month name is what is being ordered.
      el.textContent?.replace('w toku', '').replace(/\s+/g, ' ').trim()
    );
    expect(heads).toEqual(['sierpień 2026', 'lipiec 2026', 'czerwiec 2026']);
  });

  it('shows the average and best-month tiles when a month has completed', () => {
    const { getByText } = render(VolumeView, { props: { data: data() } });
    expect(getByText('Średnio na pełny miesiąc')).toBeTruthy();
    expect(getByText('Najlepszy miesiąc · lip 2026')).toBeTruthy();
  });

  it('drops those tiles rather than showing a zero when nothing has completed', () => {
    // Only the month in progress — nothing complete for an average or a "best" to be about.
    const only = [month('2026-08', 30, true)];
    const { container } = render(VolumeView, {
      props: {
        data: data({
          months: ['2026-08'],
          monthly: only,
          bySport: [
            {
              group: 'run',
              label: 'Bieg',
              color: 'var(--lane-orange)',
              distanceM: [30_000],
              durationS: [9000],
              elevationGainM: [300]
            }
          ]
        })
      }
    });
    expect(container.textContent).not.toContain('Średnio na pełny miesiąc');
    expect(container.textContent).not.toContain('Najlepszy miesiąc');
  });

  it('offers the measure switch and names it for assistive tech', () => {
    const { container } = render(VolumeView, { props: { data: data() } });
    expect(container.querySelector('[aria-label="Miara objętości"]')).not.toBeNull();
  });

  it('renders both charts', () => {
    const { container } = render(VolumeView, { props: { data: data() } });
    // The year lines and the monthly bars.
    expect(container.querySelectorAll('svg').length).toBeGreaterThanOrEqual(2);
  });

  describe('consistency grid (specs 046, 070)', () => {
    it('draws the grid for the selected period and explains the quantile shading', () => {
      const { container, getByText } = render(VolumeView, { props: { data: data() } });
      expect(getByText('Regularność · ostatnie 12 miesięcy')).toBeTruthy();
      expect(container.querySelector('[aria-label^="Regularność treningu"]')).not.toBeNull();
      expect(getByText(/na tle Twoich pozostałych dni/)).toBeTruthy();
    });

    it('says a rest day is an empty cell, not the palest shade', () => {
      const { getByText } = render(VolumeView, { props: { data: data() } });
      expect(getByText(/pustym polem/)).toBeTruthy();
    });

    it('omits the grid entirely when the window has no activity at all', () => {
      const { container } = render(VolumeView, { props: { data: data({ gridDays: [] }) } });
      expect(container.textContent).not.toContain('Regularność');
    });
  });

  /**
   * Spec 070. One control over the bars, the grid and the table — before this they covered three
   * different spans, so "Regularność 2026" sat between two blocks that were not about 2026.
   */
  describe('period filter', () => {
    function periodButton(container: HTMLElement, label: string): HTMLButtonElement {
      const group = container.querySelector('[aria-label="Okres"]')!;
      const button = [...group.querySelectorAll('button')].find((b) => b.textContent?.includes(label));
      if (!button) throw new Error(`no period option "${label}"`);
      return button as HTMLButtonElement;
    }

    it('offers the rolling window first, then every year with data, newest first', () => {
      const { container } = render(VolumeView, { props: { data: data() } });
      // Each segment carries a long and a short label; CSS picks one by width (spec 047).
      const labels = [...container.querySelectorAll('[aria-label="Okres"] button')].map((b) =>
        b.textContent?.replace(/\s+/g, ' ').trim()
      );
      expect(labels).toEqual(['Ostatnie 12 miesięcy 12 mies.', '2026 2026', '2025 2025']);
    });

    it('defaults to the rolling window', () => {
      const { getByText } = render(VolumeView, { props: { data: data() } });
      expect(getByText(/^Ostatnie 12 miesięcy, w podziale na sporty/)).toBeTruthy();
    });

    it('re-scopes the table, the grid title and the month tiles together', async () => {
      const monthly = [
        month('2025-06', 60),
        month('2025-07', 90),
        month('2026-07', 200),
        month('2026-08', 30, true)
      ];
      const { container, getByText } = render(VolumeView, {
        props: {
          data: data({
            months: monthly.map((m) => m.month),
            monthly,
            bySport: [
              {
                group: 'run',
                label: 'Bieg',
                color: 'var(--lane-orange)',
                distanceM: [60_000, 90_000, 200_000, 30_000],
                durationS: [18_000, 27_000, 60_000, 9000],
                elevationGainM: [600, 900, 2000, 300]
              }
            ]
          })
        }
      });

      periodButton(container, '2025').click();
      await Promise.resolve();

      const heads = [...container.querySelectorAll('tbody th')].map((el) =>
        el.textContent?.replace(/\s+/g, ' ').trim()
      );
      expect(heads).toEqual(['lipiec 2025', 'czerwiec 2025']);
      expect(getByText('Regularność · 2025')).toBeTruthy();
      // The best month is the best of 2025, not the all-time best.
      expect(getByText('Najlepszy miesiąc · lip 2025')).toBeTruthy();
    });
  });

  /** Spec 070 — the year-over-year chart can be read one sport at a time. */
  describe('year-over-year sport filter', () => {
    it('is absent for a single-sport athlete', () => {
      const { container } = render(VolumeView, { props: { data: data() } });
      expect(container.querySelector('[aria-label="Dyscyplina na wykresie rok do roku"]')).toBeNull();
    });

    it('offers "Wszystko" plus each family the athlete has', () => {
      const { container } = render(VolumeView, { props: { data: multiSport() } });
      const labels = [
        ...container.querySelectorAll('[aria-label="Dyscyplina na wykresie rok do roku"] button')
      ].map((b) => b.textContent?.trim());
      expect(labels).toEqual(['Wszystko', 'Bieg', 'Rower']);
    });

    it('swaps the ahead/behind verdict and names the family it is now about', async () => {
      const { container, getByText } = render(VolumeView, { props: { data: multiSport() } });
      // Combined first: +12 km against last year.
      expect(getByText(/12,0 km/)).toBeTruthy();

      const group = container.querySelector('[aria-label="Dyscyplina na wykresie rok do roku"]')!;
      const ride = [...group.querySelectorAll('button')].find((b) => b.textContent?.includes('Rower'))!;
      ride.click();
      await Promise.resolve();

      // Rides only: +60 km, and the card says which sport the curves belong to.
      expect(getByText(/60,0 km/)).toBeTruthy();
      expect(container.textContent).toContain('Suma kilometrów narastająco — rower.');
    });
  });
});
