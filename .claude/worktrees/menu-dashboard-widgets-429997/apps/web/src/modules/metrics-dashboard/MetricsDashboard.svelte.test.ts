import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/svelte';
import { resolveRange } from '$lib/range';
import MetricsDashboard from './MetricsDashboard.svelte';
import type { DashboardData, MetricTile } from './dashboard.types';

afterEach(cleanup);

const DAYS = ['2026-08-01', '2026-08-02', '2026-08-03', '2026-08-04', '2026-08-05'];

function tile(overrides: Partial<MetricTile> = {}): MetricTile {
  return {
    key: 'steps',
    label: 'Kroki',
    accent: 'orange',
    value: '9204',
    unit: '',
    delta: 5,
    goodWhen: 'up',
    format: 'int',
    series: [8000, null, 8500, 9000, 9204],
    ...overrides
  };
}

function data(overrides: Partial<DashboardData> = {}): DashboardData {
  return {
    connected: true,
    analyticsEnabled: true,
    date: '2026-08-05',
    range: resolveRange('7', '2026-08-05'),
    days: DAYS,
    tiles: [tile()],
    ...overrides
  };
}

describe('MetricsDashboard', () => {
  it('owns no window control of its own — the range is global now (spec 047)', () => {
    const { container } = render(MetricsDashboard, {
      props: { data: data(), analyticsFeature: null }
    });
    expect(container.querySelector('[role="radiogroup"]')).toBeNull();
  });

  it('marks the tile grid with the active range', () => {
    const { container } = render(MetricsDashboard, {
      props: { data: data({ range: resolveRange('14', '2026-08-05') }), analyticsFeature: null }
    });
    const badge = container.querySelector('.range-badge');
    expect(badge?.textContent).toContain('14 dni');
    expect(badge?.getAttribute('title')).toContain('na górze strony');
  });

  it('discloses the bucket once a long range stops being day-by-day', () => {
    const { container } = render(MetricsDashboard, {
      props: { data: data({ range: resolveRange('365', '2026-08-05') }), analyticsFeature: null }
    });
    expect(container.querySelector('.range-badge')?.getAttribute('title')).toContain(
      'Jeden punkt to tydzień.'
    );
  });

  it('draws a dated trend chart for a tile with data', () => {
    const { container } = render(MetricsDashboard, {
      props: { data: data(), analyticsFeature: null }
    });
    const chart = container.querySelector('.spark svg');
    expect(chart).not.toBeNull();
    // The x axis carries the window's dates, so a peak belongs to a visible day (spec 028).
    expect(container.querySelector('.spark')?.textContent).toContain('01.08');
  });

  it('draws no chart when the window holds fewer than two real points', () => {
    const sparse = data({ tiles: [tile({ series: [null, null, 9204, null, null] })] });
    const { container } = render(MetricsDashboard, { props: { data: sparse, analyticsFeature: null } });
    expect(container.querySelector('.spark svg')).toBeNull();
  });

  it('renders neither range badge nor chart while analytics consent is off', () => {
    // Nothing here follows the range without consent, so nothing may claim it does.
    const off = data({ analyticsEnabled: false, tiles: [tile({ series: [], delta: null })] });
    const { container } = render(MetricsDashboard, { props: { data: off, analyticsFeature: null } });
    expect(container.querySelector('.range-badge')).toBeNull();
    expect(container.querySelector('.spark svg')).toBeNull();
  });
});
