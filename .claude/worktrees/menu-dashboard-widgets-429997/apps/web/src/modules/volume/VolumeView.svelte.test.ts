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
  return {
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
    avgDistanceM: 150_000,
    bestMonth: month('2026-07', 200),
    years: [
      { year: 2026, cumulativeKm: [10, 20], totalKm: 20, toDateKm: 20, partial: true },
      { year: 2025, cumulativeKm: [5, 8], totalKm: 500, toDateKm: 8, partial: false }
    ],
    throughDayOfYear: 223,
    vsLastYearKm: 12,
    dayOfYearLabels: ['sty', ''],
    gridDays: [
      { day: '2026-03-01', km: 12.4, title: '1 mar 2026: 12,4 km · 1 aktywność' },
      { day: '2026-03-03', km: 8, title: '3 mar 2026: 8,0 km · 1 aktywność' }
    ],
    gridYear: 2026,
    hasData: true,
    ...over
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
    const { container } = render(VolumeView, {
      props: { data: data({ avgDistanceM: null, bestMonth: null }) }
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

  describe('consistency grid (spec 046)', () => {
    it('draws the year grid and explains the quantile shading', () => {
      const { container, getByText } = render(VolumeView, { props: { data: data() } });
      expect(getByText('Regularność 2026')).toBeTruthy();
      expect(container.querySelector('[aria-label^="Regularność treningu"]')).not.toBeNull();
      expect(getByText(/na tle Twoich pozostałych dni/)).toBeTruthy();
    });

    it('says a rest day is an empty cell, not the palest shade', () => {
      const { getByText } = render(VolumeView, { props: { data: data() } });
      expect(getByText(/pustym polem/)).toBeTruthy();
    });

    it('omits the grid entirely when this year has no activity yet', () => {
      const { container } = render(VolumeView, { props: { data: data({ gridDays: [] }) } });
      expect(container.textContent).not.toContain('Regularność');
    });
  });
});
