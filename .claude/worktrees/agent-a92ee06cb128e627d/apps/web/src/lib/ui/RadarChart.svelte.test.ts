import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/svelte';
import RadarChart from './RadarChart.svelte';
import type { RadarAxis } from './RadarChart.svelte';

afterEach(cleanup);

const FIVE: RadarAxis[] = [
  { key: 'a', label: 'Szybkość', value: 0.8 },
  { key: 'b', label: 'Tempo', value: 0.6 },
  { key: 'c', label: 'Wytrzymałość', value: 0.4 },
  { key: 'd', label: 'Objętość', value: 0.5 },
  { key: 'e', label: 'Regularność', value: 0.9 }
];

function points(svg: Element | null, selector: string): number {
  const raw = svg?.querySelector(selector)?.getAttribute('points') ?? '';
  return raw.trim() === '' ? 0 : raw.trim().split(/\s+/).length;
}

describe('RadarChart', () => {
  it('draws one spoke and one label per axis, plus the rings', () => {
    const { container, getByRole } = render(RadarChart, {
      props: { axes: FIVE, ariaLabel: 'Profil biegacza' }
    });

    getByRole('img', { name: 'Profil biegacza' });
    expect(container.querySelectorAll('.spoke').length).toBe(5);
    expect(Array.from(container.querySelectorAll('.label')).map((n) => n.textContent)).toEqual([
      'Szybkość',
      'Tempo',
      'Wytrzymałość',
      'Objętość',
      'Regularność'
    ]);
    expect(container.querySelectorAll('.ring').length).toBe(4);
    expect(points(container, '.shape')).toBe(5);
  });

  it('leaves a null axis out of the shape and marks its spoke instead of plotting a zero', () => {
    const axes = FIVE.map((a) => (a.key === 'c' ? { ...a, value: null } : a));
    const { container } = render(RadarChart, { props: { axes, ariaLabel: 'Profil' } });

    expect(points(container, '.shape')).toBe(4);
    expect(container.querySelectorAll('.spoke.missing').length).toBe(1);
    expect(container.querySelectorAll('.label.missing').length).toBe(1);
  });

  it('draws no shape at all under three defined axes', () => {
    const axes = FIVE.map((a, i) => (i < 3 ? { ...a, value: null } : a));
    const { container } = render(RadarChart, { props: { axes, ariaLabel: 'Profil' } });

    expect(container.querySelector('.shape')).toBeNull();
    expect(container.querySelectorAll('.vertex').length).toBe(0);
    // The frame still renders, so the reader sees what *would* be measured.
    expect(container.querySelectorAll('.ring').length).toBe(4);
    expect(container.querySelectorAll('.spoke').length).toBe(5);
  });

  it('clamps out-of-range values instead of drawing outside the frame', () => {
    const { container } = render(RadarChart, {
      props: {
        axes: [
          { key: 'a', label: 'A', value: 4 },
          { key: 'b', label: 'B', value: -2 },
          { key: 'c', label: 'C', value: 0.5 }
        ],
        ariaLabel: 'Profil',
        radius: 100,
        labelSpace: 50
      }
    });

    const raw = container.querySelector('.shape')?.getAttribute('points') ?? '';
    const xs = raw.split(/\s+/).map((p) => Number(p.split(',')[0]));
    // Box is 2*(50+100) = 300 wide; nothing may leave it.
    expect(Math.min(...xs)).toBeGreaterThanOrEqual(0);
    expect(Math.max(...xs)).toBeLessThanOrEqual(300);
  });

  it('widens its own label gutter for long labels, and keeps them inside the box (spec 034)', () => {
    const boxWidth = (axes: RadarAxis[]): number => {
      const { container } = render(RadarChart, { props: { axes, ariaLabel: 'Profil' } });
      return Number((container.querySelector('svg')?.getAttribute('viewBox') ?? '').split(' ')[2]);
    };

    const short = boxWidth(FIVE);
    // Cycling's labels carry their duration; these used to run off the left edge of the box.
    const long = boxWidth(FIVE.map((a) => ({ ...a, label: `${a.label} (60 min)` })));

    expect(long).toBeGreaterThan(short);
    // Widest label ≈ 21 chars; the box has to cover the label's reach from its spoke, not just the rings.
    expect(long).toBeGreaterThan(2 * 90 + 21 * 7);
  });

  it('keeps an explicit labelSpace when one is given', () => {
    const { container } = render(RadarChart, {
      props: { axes: FIVE, ariaLabel: 'Profil', radius: 100, labelSpace: 50 }
    });
    expect(container.querySelector('svg')?.getAttribute('viewBox')).toBe('0 0 300 252');
  });

  it('adapts to a different spoke count', () => {
    const { container } = render(RadarChart, {
      props: { axes: FIVE.slice(0, 4), ariaLabel: 'Profil' }
    });
    expect(container.querySelectorAll('.spoke').length).toBe(4);
    expect(points(container, '.ring')).toBe(4);
  });
});
