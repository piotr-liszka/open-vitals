import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, cleanup } from '@testing-library/svelte';
import BarChart from './BarChart.svelte';

afterEach(cleanup);

/**
 * jsdom has no layout, so the wrapper measures 0px and the chart falls back to its default 640
 * coordinate width. Pinning the rect to that same width makes a client x map 1:1 onto chart x.
 */
const W = 640;
function pinWidth(container: HTMLElement): HTMLElement {
  const wrap = container.querySelector('.chart') as HTMLElement;
  wrap.getBoundingClientRect = () => ({ left: 0, width: W, top: 0, height: 140 }) as DOMRect;
  return wrap;
}

/** jsdom lacks PointerEvent; the handlers only read `clientX`, which MouseEvent carries. */
function pointer(el: Element, type: string, clientX: number): void {
  el.dispatchEvent(new MouseEvent(type, { clientX, bubbles: true }));
}

function key(el: Element, k: string): void {
  el.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true }));
}

describe('BarChart', () => {
  it('renders an svg with a bar per value for a normal series', () => {
    const { container } = render(BarChart, {
      props: { values: [8421, 11238, 6094, 9765], labels: ['Mon', 'Tue', 'Wed', 'Thu'] }
    });
    const svg = container.querySelector('svg');
    expect(svg).not.toBeNull();
    expect(svg?.getAttribute('role')).toBe('img');
    expect(container.querySelectorAll('path.bar')).toHaveLength(4);
  });

  it('summarises the high and low (with labels) in the aria-label', () => {
    const { container } = render(BarChart, {
      props: { values: [10, 40, 20], labels: ['Mar 1', 'Mar 2', 'Mar 3'] }
    });
    const aria = container.querySelector('svg')?.getAttribute('aria-label');
    expect(aria).toBe('bar chart, 3 days, high 40 on Mar 2, low 10 on Mar 1');
  });

  it('handles an empty array with a placeholder and no-data label', () => {
    const { container } = render(BarChart, { props: { values: [] } });
    const svg = container.querySelector('svg');
    expect(svg).not.toBeNull();
    expect(svg?.getAttribute('aria-label')).toBe('bar chart, no data');
    expect(container.querySelector('path.bar')).toBeNull();
    expect(container.querySelector('text.empty')?.textContent).toBe('Brak danych');
  });

  it('renders a single value without crashing', () => {
    const { container } = render(BarChart, { props: { values: [500] } });
    expect(container.querySelector('svg')).not.toBeNull();
    expect(container.querySelector('path.bar')).not.toBeNull();
    expect(container.querySelector('svg')?.getAttribute('aria-label')).toBe(
      'bar chart, 1 day, high 500, low 500'
    );
  });

  it('does not draw bars for an all-equal all-zero series but keeps the baseline', () => {
    const { container } = render(BarChart, { props: { values: [0, 0, 0, 0] } });
    // Zero-height bars render nothing, but the chart is still valid + labelled.
    expect(container.querySelectorAll('path.bar')).toHaveLength(0);
    expect(container.querySelector('line.grid')).not.toBeNull();
    expect(container.querySelector('svg')?.getAttribute('aria-label')).toBe(
      'bar chart, 4 days, high 0, low 0'
    );
  });

  it('renders bars for an all-equal non-zero series and stays finite', () => {
    const { container } = render(BarChart, { props: { values: [60, 60, 60] } });
    expect(container.querySelectorAll('path.bar')).toHaveLength(3);
    for (const p of container.querySelectorAll('path.bar')) {
      expect(p.getAttribute('d')).not.toContain('NaN');
    }
  });

  describe('hover / tap / keyboard read-out', () => {
    const props = {
      values: [8421, 11238, 6094, 9765],
      labels: ['Mon', 'Tue', 'Wed', 'Thu']
    };

    it('reads the bar under the pointer and dims the others', async () => {
      const { container } = render(BarChart, { props });
      const wrap = pinWidth(container);
      const hit = container.querySelector('rect.hit')!;

      // Four bands of 160: x=200 sits in the second one.
      pointer(hit, 'pointermove', 200);
      await Promise.resolve();

      expect(container.querySelector('.tip-title')?.textContent).toBe('Tue');
      expect(container.querySelector('.tip .v')?.textContent).toBe((11238).toLocaleString());
      expect(container.querySelectorAll('path.bar.active')).toHaveLength(1);
      expect(container.querySelectorAll('path.bar.dim')).toHaveLength(3);
      expect(wrap.querySelector('[aria-live]')?.textContent).toContain('Tue');
    });

    it('clears the read-out when the pointer leaves', async () => {
      const { container } = render(BarChart, { props });
      pinWidth(container);
      const hit = container.querySelector('rect.hit')!;

      pointer(hit, 'pointerdown', 20);
      await Promise.resolve();
      expect(container.querySelector('.tip-title')?.textContent).toBe('Mon');

      pointer(hit, 'pointerleave', 20);
      await Promise.resolve();
      expect(container.querySelector('.tip')).toBeNull();
      expect(container.querySelectorAll('path.bar.dim')).toHaveLength(0);
    });

    it('is keyboard reachable: arrows step the read-out, Escape clears it', async () => {
      const { container } = render(BarChart, { props });
      const svg = container.querySelector('svg')!;
      expect(svg.getAttribute('tabindex')).toBe('0');

      // First key press lands on the newest bar.
      key(svg, 'ArrowRight');
      await Promise.resolve();
      expect(container.querySelector('.tip-title')?.textContent).toBe('Thu');

      key(svg, 'ArrowLeft');
      await Promise.resolve();
      expect(container.querySelector('.tip-title')?.textContent).toBe('Wed');

      key(svg, 'Escape');
      await Promise.resolve();
      expect(container.querySelector('.tip')).toBeNull();
    });

    it('leaves an empty chart non-interactive', () => {
      const { container } = render(BarChart, { props: { values: [] } });
      expect(container.querySelector('svg')?.hasAttribute('tabindex')).toBe(false);
      expect(container.querySelector('rect.hit')).toBeNull();
    });
  });

  it('draws a dashed reference line when a baseline is provided', () => {
    const { container } = render(BarChart, { props: { values: [10, 20, 30], baseline: 25 } });
    expect(container.querySelector('line.baseline')).not.toBeNull();
  });

  describe('axes (spec 017)', () => {
    const labels = ['Mon', 'Tue', 'Wed', 'Thu'];
    const values = [8421, 11238, 6094, 9765];

    it('adds a labelled y scale with gridlines and a zero rule', () => {
      const { container } = render(BarChart, { props: { values, labels } });
      const ticks = [...container.querySelectorAll('text.axis-tick.y')].map((t) => t.textContent?.trim());
      expect(ticks.length).toBeGreaterThan(1);
      // Compact, round tick text keeps the gutter thin.
      expect(ticks).toContain('0');
      for (const t of ticks) expect(t).toMatch(/^-?\d+(\.\d+)?[kM]?$/);
      expect(container.querySelector('line.grid.zero')).not.toBeNull();
    });

    it('draws an x tick per bar when they all fit', () => {
      const { container } = render(BarChart, { props: { values, labels } });
      expect([...container.querySelectorAll('text.axis-tick.x')].map((t) => t.textContent)).toEqual(labels);
    });

    it('thins x ticks so they can never collide, always keeping the newest', () => {
      const many = Array.from({ length: 90 }, (_, i) => 1000 + i);
      const manyLabels = many.map((_, i) => `2026-05-${String((i % 28) + 1).padStart(2, '0')}`);
      const { container } = render(BarChart, { props: { values: many, labels: manyLabels } });
      const drawn = [...container.querySelectorAll('text.axis-tick.x')].map((t) => t.textContent);
      expect(drawn.length).toBeGreaterThan(1);
      expect(drawn.length).toBeLessThan(20);
      expect(drawn[drawn.length - 1]).toBe(manyLabels[89]);
    });

    it('prints the unit once above the scale', () => {
      const { container } = render(BarChart, { props: { values, labels, unit: 'kroki' } });
      const units = [...container.querySelectorAll('text.axis-unit')];
      expect(units).toHaveLength(1);
      expect(units[0]?.textContent).toBe('kroki');
    });

    it('offers an escape hatch for decorative uses', () => {
      const { container } = render(BarChart, {
        props: { values, labels, xAxis: false, yAxis: false }
      });
      expect(container.querySelectorAll('text.axis-tick')).toHaveLength(0);
      // The zero rule stays — bars are meaningless without their base.
      expect(container.querySelector('line.grid.zero')).not.toBeNull();
    });
  });

  describe('multi-series + legend (spec 017)', () => {
    const labels = ['Mon', 'Tue', 'Wed'];
    const series = [
      { name: 'Bieg', values: [30, 45, 20], color: 'var(--lane-orange)' },
      { name: 'Rower', values: [60, 20, 50], color: 'var(--lane-cyan)' }
    ];

    it('groups a bar per series inside each day', () => {
      const { container } = render(BarChart, { props: { series, labels } });
      expect(container.querySelectorAll('path.bar')).toHaveLength(6);
      // Grouped bars share the band: each is narrower than a lone bar would be.
      const bands = container.querySelectorAll('text.axis-tick.x');
      expect(bands).toHaveLength(3);
    });

    it('shows a legend with a toggle button per series', () => {
      const { container } = render(BarChart, { props: { series, labels } });
      const buttons = [...container.querySelectorAll('button.item')];
      expect(buttons.map((b) => b.querySelector('.name')?.textContent)).toEqual(['Bieg', 'Rower']);
    });

    it('reads every series for the hovered day', async () => {
      const { container } = render(BarChart, { props: { series, labels } });
      pinWidth(container);
      pointer(container.querySelector('rect.hit')!, 'pointermove', W - 1);
      await Promise.resolve();

      expect(container.querySelector('.tip-title')?.textContent).toBe('Wed');
      expect([...container.querySelectorAll('.tip .k')].map((k) => k.textContent)).toEqual(['Bieg', 'Rower']);
      expect([...container.querySelectorAll('.legend .value')].map((v) => v.textContent)).toEqual([
        '20',
        '50'
      ]);
    });

    it('hides a series when its legend item is toggled off', async () => {
      const { container } = render(BarChart, { props: { series, labels } });
      const buttons = [...container.querySelectorAll('button.item')] as HTMLButtonElement[];

      buttons[1]!.click();
      await Promise.resolve();
      expect(container.querySelectorAll('path.bar')).toHaveLength(3);

      buttons[1]!.click();
      await Promise.resolve();
      expect(container.querySelectorAll('path.bar')).toHaveLength(6);
    });

    it('refuses to hide the last visible series', async () => {
      const { container } = render(BarChart, { props: { series, labels } });
      const buttons = [...container.querySelectorAll('button.item')] as HTMLButtonElement[];

      buttons[0]!.click();
      await Promise.resolve();
      buttons[1]!.click();
      await Promise.resolve();
      expect(container.querySelectorAll('path.bar')).toHaveLength(3);
    });

    it('stays a plain single-series chart — no legend — for one series', () => {
      const { container } = render(BarChart, { props: { values: [1, 2, 3], label: 'steps' } });
      expect(container.querySelector('.legend')).toBeNull();
    });
  });

  describe('click to select (spec 017)', () => {
    const props = {
      values: [8421, 11238, 6094, 9765],
      labels: ['Mon', 'Tue', 'Wed', 'Thu']
    };

    it('pins the read-out on tap, so it survives pointerleave', async () => {
      const onSelect = vi.fn();
      const { container } = render(BarChart, { props: { ...props, onSelect } });
      pinWidth(container);
      const hit = container.querySelector('rect.hit')!;

      pointer(hit, 'pointerdown', W - 1);
      pointer(hit, 'pointerup', W - 1);
      await Promise.resolve();
      expect(onSelect).toHaveBeenCalledWith(3);

      pointer(hit, 'pointerleave', W - 1);
      await Promise.resolve();
      expect(container.querySelector('.tip-title')?.textContent).toBe('Thu');
      expect(container.querySelector('rect.band')?.classList.contains('pinned')).toBe(true);
    });

    it('pins from the keyboard with Enter and clears with Escape', async () => {
      const onSelect = vi.fn();
      const { container } = render(BarChart, { props: { ...props, onSelect } });
      const svg = container.querySelector('svg')!;

      key(svg, 'Home');
      key(svg, 'Enter');
      await Promise.resolve();
      expect(onSelect).toHaveBeenCalledWith(0);

      svg.dispatchEvent(new FocusEvent('blur'));
      await Promise.resolve();
      expect(container.querySelector('.tip-title')?.textContent).toBe('Mon');

      key(svg, 'Escape');
      await Promise.resolve();
      expect(container.querySelector('.tip')).toBeNull();
    });

    it('opens on a caller-supplied selectedIndex', async () => {
      const { container } = render(BarChart, { props: { ...props, selectedIndex: 2 } });
      await Promise.resolve();
      expect(container.querySelector('.tip-title')?.textContent).toBe('Wed');
    });
  });

  it('skips gap days instead of drawing them as zero', async () => {
    const { container } = render(BarChart, {
      props: { values: [10, NaN, 30], labels: ['Mon', 'Tue', 'Wed'] }
    });
    expect(container.querySelectorAll('path.bar')).toHaveLength(2);

    const svg = container.querySelector('svg')!;
    key(svg, 'Home');
    await Promise.resolve();
    expect(container.querySelector('.tip-title')?.textContent).toBe('Mon');

    // Stepping right hops the gap rather than landing on an empty day.
    key(svg, 'ArrowRight');
    await Promise.resolve();
    expect(container.querySelector('.tip-title')?.textContent).toBe('Wed');
  });
});
