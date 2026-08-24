import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, cleanup } from '@testing-library/svelte';
import TrendChart from './TrendChart.svelte';

afterEach(cleanup);

/**
 * jsdom has no layout, so the wrapper measures 0px and the chart falls back to its default 640
 * coordinate width. Pinning the rect to that same width makes a client x map 1:1 onto chart x.
 */
const W = 640;
function pinWidth(container: HTMLElement): HTMLElement {
  const wrap = container.querySelector('.chart') as HTMLElement;
  wrap.getBoundingClientRect = () => ({ left: 0, width: W, top: 0, height: 200 }) as DOMRect;
  return wrap;
}

/** jsdom lacks PointerEvent; the handlers only read `clientX`, which MouseEvent carries. */
function pointer(el: Element, type: string, clientX: number): void {
  el.dispatchEvent(new MouseEvent(type, { clientX, bubbles: true }));
}

function key(el: Element, k: string): void {
  el.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true }));
}

describe('TrendChart', () => {
  it('renders an svg with a line for a normal series', () => {
    const { container } = render(TrendChart, {
      props: { values: [42, 45, 41, 48, 47, 52, 49], label: 'HRV' }
    });
    const svg = container.querySelector('svg');
    expect(svg).not.toBeNull();
    expect(svg?.getAttribute('role')).toBe('img');
    expect(container.querySelector('path.line')).not.toBeNull();
  });

  it('summarises low/high in the aria-label and includes avg when asked', () => {
    const { container } = render(TrendChart, {
      props: { values: [10, 20, 30], label: 'steps', showAvg: true }
    });
    expect(container.querySelector('svg')?.getAttribute('aria-label')).toBe(
      'steps trend, 3 points, low 10, high 30, avg 20'
    );
  });

  it('marks the min and max points for a normal series', () => {
    const { container } = render(TrendChart, { props: { values: [5, 9, 3, 7] } });
    // Two markers (min + max), each with a value label.
    expect(container.querySelectorAll('circle.marker')).toHaveLength(2);
    expect(container.querySelectorAll('text.point-label')).toHaveLength(2);
  });

  it('handles an empty array with a placeholder and no-data label', () => {
    const { container } = render(TrendChart, { props: { values: [], label: 'steps' } });
    const svg = container.querySelector('svg');
    expect(svg).not.toBeNull();
    expect(svg?.getAttribute('aria-label')).toBe('steps trend, no data');
    expect(container.querySelector('path.line')).toBeNull();
    expect(container.querySelector('line.placeholder')).not.toBeNull();
    expect(container.querySelector('text.empty')?.textContent).toBe('Brak danych');
  });

  it('renders a single value as a lone dot, no connecting line', () => {
    const { container } = render(TrendChart, { props: { values: [72] } });
    expect(container.querySelector('path.line')).toBeNull();
    expect(container.querySelector('circle.marker')).not.toBeNull();
    expect(container.querySelector('svg')?.getAttribute('aria-label')).toBe('trend, 1 point, value 72');
  });

  it('draws a flat centred line for an all-equal series without NaN', () => {
    const { container } = render(TrendChart, { props: { values: [50, 50, 50, 50] } });
    const line = container.querySelector('path.line');
    expect(line).not.toBeNull();
    expect(line?.getAttribute('d')).not.toContain('NaN');
    // Flat series suppresses the min/max markers (they would coincide).
    expect(container.querySelectorAll('circle.marker')).toHaveLength(0);
  });

  describe('hover / tap / keyboard read-out', () => {
    const props = {
      values: [10, 20, 30, 40],
      labels: ['1 Aug', '2 Aug', '3 Aug', '4 Aug'],
      label: 'steps'
    };

    it('shows the value + date of the point under the pointer', async () => {
      const { container } = render(TrendChart, { props });
      const wrap = pinWidth(container);
      const hit = container.querySelector('rect.hit')!;

      // Far right of the plot → the newest point.
      pointer(hit, 'pointermove', W - 1);
      await Promise.resolve();

      expect(container.querySelector('.tip-title')?.textContent).toBe('4 Aug');
      expect(container.querySelector('.tip .v')?.textContent).toBe('40');
      expect(container.querySelectorAll('circle.cursor-dot')).toHaveLength(1);
      expect(container.querySelector('line.cursor')).not.toBeNull();
      expect(wrap.querySelector('[aria-live]')?.textContent).toBe('4 Aug: 40');
    });

    it('picks the nearest point, not the one to the left', async () => {
      const { container } = render(TrendChart, { props });
      pinWidth(container);
      const hit = container.querySelector('rect.hit')!;

      // Points sit at 25.6, 221.9, 418.1, 614.4 — 400 is nearest the third.
      pointer(hit, 'pointermove', 400);
      await Promise.resolve();
      expect(container.querySelector('.tip-title')?.textContent).toBe('3 Aug');
    });

    it('clears the read-out when the pointer leaves', async () => {
      const { container } = render(TrendChart, { props });
      pinWidth(container);
      const hit = container.querySelector('rect.hit')!;

      pointer(hit, 'pointermove', 300);
      await Promise.resolve();
      expect(container.querySelector('.tip')).not.toBeNull();

      pointer(hit, 'pointerleave', 300);
      await Promise.resolve();
      expect(container.querySelector('.tip')).toBeNull();
    });

    it('is keyboard reachable: arrows step the read-out, Escape clears it', async () => {
      const { container } = render(TrendChart, { props });
      const svg = container.querySelector('svg')!;
      expect(svg.getAttribute('tabindex')).toBe('0');

      // First key press lands on the newest point.
      key(svg, 'ArrowLeft');
      await Promise.resolve();
      expect(container.querySelector('.tip-title')?.textContent).toBe('4 Aug');

      key(svg, 'ArrowLeft');
      await Promise.resolve();
      expect(container.querySelector('.tip-title')?.textContent).toBe('3 Aug');

      key(svg, 'Home');
      await Promise.resolve();
      expect(container.querySelector('.tip-title')?.textContent).toBe('1 Aug');

      key(svg, 'Escape');
      await Promise.resolve();
      expect(container.querySelector('.tip')).toBeNull();
    });

    it('skips gap days without shifting the remaining labels', async () => {
      const { container } = render(TrendChart, {
        props: { values: [10, NaN, 30], labels: ['1 Aug', '2 Aug', '3 Aug'] }
      });
      pinWidth(container);
      const svg = container.querySelector('svg')!;

      key(svg, 'End');
      await Promise.resolve();
      expect(container.querySelector('.tip-title')?.textContent).toBe('3 Aug');
      expect(container.querySelector('.tip .v')?.textContent).toBe('30');

      key(svg, 'Home');
      await Promise.resolve();
      expect(container.querySelector('.tip-title')?.textContent).toBe('1 Aug');
    });

    it('leaves an empty chart non-interactive', () => {
      const { container } = render(TrendChart, { props: { values: [] } });
      expect(container.querySelector('svg')?.hasAttribute('tabindex')).toBe(false);
      expect(container.querySelector('rect.hit')).toBeNull();
    });
  });

  describe('axes (spec 017)', () => {
    const labels = ['1 Aug', '2 Aug', '3 Aug', '4 Aug'];

    it('labels the y scale with round tick values', () => {
      const { container } = render(TrendChart, { props: { values: [0, 40, 80, 100], labels } });
      const ticks = [...container.querySelectorAll('text.axis-tick.y')].map((t) => t.textContent?.trim());
      expect(ticks.length).toBeGreaterThan(1);
      // Round values only — no raw data mins/maxes on the axis.
      for (const t of ticks) expect(t).toMatch(/^-?\d+(\.\d+)?k?$/);
      expect(container.querySelectorAll('line.grid').length).toBe(ticks.length);
    });

    it('draws an x tick per label when they all fit', () => {
      const { container } = render(TrendChart, { props: { values: [1, 2, 3, 4], labels } });
      expect([...container.querySelectorAll('text.axis-tick.x')].map((t) => t.textContent)).toEqual(labels);
    });

    it('thins x ticks so they can never collide, always keeping the newest', () => {
      const many = Array.from({ length: 120 }, (_, i) => i);
      const manyLabels = many.map((i) => `2026-08-${String((i % 28) + 1).padStart(2, '0')}`);
      const { container } = render(TrendChart, {
        props: { values: many, labels: manyLabels }
      });
      const drawn = [...container.querySelectorAll('text.axis-tick.x')].map((t) => t.textContent);
      expect(drawn.length).toBeGreaterThan(1);
      // 120 ten-character dates cannot fit in 640px — most must be dropped.
      expect(drawn.length).toBeLessThan(20);
      expect(drawn[drawn.length - 1]).toBe(manyLabels[119]);
    });

    it('prints the unit once above the scale, never on every tick', () => {
      const { container } = render(TrendChart, {
        props: { values: [50, 60, 70], labels: ['a', 'b', 'c'], unit: 'bpm' }
      });
      const units = [...container.querySelectorAll('text.axis-unit')];
      expect(units).toHaveLength(1);
      expect(units[0]?.textContent).toBe('bpm');
      for (const t of container.querySelectorAll('text.axis-tick.y')) {
        expect(t.textContent).not.toContain('bpm');
      }
    });

    it('keeps x ticks off until labels are supplied', () => {
      const { container } = render(TrendChart, { props: { values: [1, 2, 3] } });
      expect(container.querySelectorAll('text.axis-tick.x')).toHaveLength(0);
      expect(container.querySelectorAll('text.axis-tick.y').length).toBeGreaterThan(0);
    });

    it('offers an escape hatch for decorative uses', () => {
      const { container } = render(TrendChart, {
        props: { values: [1, 2, 3], labels: ['a', 'b', 'c'], xAxis: false, yAxis: false }
      });
      expect(container.querySelectorAll('text.axis-tick')).toHaveLength(0);
      // Falls back to the plain hairline grid.
      expect(container.querySelectorAll('line.grid')).toHaveLength(4);
    });
  });

  describe('multi-series + legend (spec 017)', () => {
    const labels = ['1 Aug', '2 Aug', '3 Aug', '4 Aug'];
    const series = [
      { name: 'CTL', values: [10, 20, 30, 40], color: 'var(--lane-green)' },
      { name: 'ATL', values: [15, 25, 20, 35], color: 'var(--lane-red)' }
    ];

    it('draws one line per series and no area fill', () => {
      const { container } = render(TrendChart, { props: { series, labels } });
      expect(container.querySelectorAll('path.line')).toHaveLength(2);
      expect(container.querySelector('path.area')).toBeNull();
    });

    it('names every series in the aria summary', () => {
      const { container } = render(TrendChart, { props: { series, labels, label: 'load' } });
      expect(container.querySelector('svg')?.getAttribute('aria-label')).toBe(
        'load trend, 2 series: CTL, ATL, 4 points, low 10, high 40'
      );
    });

    it('shows a legend with a toggle button per series', () => {
      const { container } = render(TrendChart, { props: { series, labels } });
      const buttons = [...container.querySelectorAll('button.item')];
      expect(buttons.map((b) => b.querySelector('.name')?.textContent)).toEqual(['CTL', 'ATL']);
      for (const b of buttons) expect(b.getAttribute('aria-pressed')).toBe('true');
    });

    it('doubles as a read-out: the legend carries each series value on hover', async () => {
      const { container } = render(TrendChart, { props: { series, labels } });
      pinWidth(container);
      pointer(container.querySelector('rect.hit')!, 'pointermove', W - 1);
      await Promise.resolve();

      expect([...container.querySelectorAll('.legend .value')].map((v) => v.textContent)).toEqual([
        '40',
        '35'
      ]);
      // …and the tooltip lists both series by name.
      expect([...container.querySelectorAll('.tip .k')].map((k) => k.textContent)).toEqual(['CTL', 'ATL']);
      expect([...container.querySelectorAll('.tip .v')].map((v) => v.textContent)).toEqual(['40', '35']);
    });

    it('hides a series when its legend item is toggled off', async () => {
      const { container } = render(TrendChart, { props: { series, labels } });
      const buttons = [...container.querySelectorAll('button.item')] as HTMLButtonElement[];

      buttons[0]!.click();
      await Promise.resolve();
      expect(container.querySelectorAll('path.line')).toHaveLength(1);
      expect(container.querySelectorAll('button.item')[0]?.getAttribute('aria-pressed')).toBe('false');

      buttons[0]!.click();
      await Promise.resolve();
      expect(container.querySelectorAll('path.line')).toHaveLength(2);
    });

    it('refuses to hide the last visible series', async () => {
      const { container } = render(TrendChart, { props: { series, labels } });
      const buttons = [...container.querySelectorAll('button.item')] as HTMLButtonElement[];

      buttons[0]!.click();
      await Promise.resolve();
      buttons[1]!.click();
      await Promise.resolve();

      expect(container.querySelectorAll('path.line')).toHaveLength(1);
      expect(container.querySelector('text.empty')).toBeNull();
    });

    it('stays a plain single-series chart — no legend — for one series', () => {
      const { container } = render(TrendChart, { props: { values: [1, 2, 3], label: 'steps' } });
      expect(container.querySelector('.legend')).toBeNull();
      expect(container.querySelector('path.area')).not.toBeNull();
    });
  });

  describe('click to select (spec 017)', () => {
    const props = {
      values: [10, 20, 30, 40],
      labels: ['1 Aug', '2 Aug', '3 Aug', '4 Aug'],
      label: 'steps'
    };

    it('pins the read-out on click, so it survives pointerleave', async () => {
      const onSelect = vi.fn();
      const { container } = render(TrendChart, { props: { ...props, onSelect } });
      pinWidth(container);
      const hit = container.querySelector('rect.hit')!;

      pointer(hit, 'pointermove', W - 1);
      pointer(hit, 'pointerup', W - 1);
      await Promise.resolve();
      expect(onSelect).toHaveBeenCalledWith(3);

      pointer(hit, 'pointerleave', W - 1);
      await Promise.resolve();
      expect(container.querySelector('.tip-title')?.textContent).toBe('4 Aug');
      expect(container.querySelector('line.cursor')?.classList.contains('pinned')).toBe(true);
    });

    it('moves the pin when another point is clicked', async () => {
      const onSelect = vi.fn();
      const { container } = render(TrendChart, { props: { ...props, onSelect } });
      pinWidth(container);
      const hit = container.querySelector('rect.hit')!;

      pointer(hit, 'pointermove', 1);
      pointer(hit, 'pointerup', 1);
      pointer(hit, 'pointerleave', 1);
      await Promise.resolve();
      expect(onSelect).toHaveBeenLastCalledWith(0);
      expect(container.querySelector('.tip-title')?.textContent).toBe('1 Aug');
    });

    it('pins from the keyboard with Enter and clears with Escape', async () => {
      const onSelect = vi.fn();
      const { container } = render(TrendChart, { props: { ...props, onSelect } });
      const svg = container.querySelector('svg')!;

      key(svg, 'Home');
      key(svg, 'Enter');
      await Promise.resolve();
      expect(onSelect).toHaveBeenCalledWith(0);

      // Blur drops the hover but keeps the pin.
      svg.dispatchEvent(new FocusEvent('blur'));
      await Promise.resolve();
      expect(container.querySelector('.tip-title')?.textContent).toBe('1 Aug');

      key(svg, 'Escape');
      await Promise.resolve();
      expect(container.querySelector('.tip')).toBeNull();
    });

    it('opens on a caller-supplied selectedIndex', async () => {
      const { container } = render(TrendChart, { props: { ...props, selectedIndex: 1 } });
      await Promise.resolve();
      expect(container.querySelector('.tip-title')?.textContent).toBe('2 Aug');
      expect(container.querySelector('.tip .v')?.textContent).toBe('20');
    });

    it('ignores a selection left over from a longer series', async () => {
      const { container } = render(TrendChart, { props: { ...props, selectedIndex: 99 } });
      await Promise.resolve();
      expect(container.querySelector('.tip')).toBeNull();
    });
  });

  describe('shared crosshair hooks (spec 035)', () => {
    const props = {
      values: [10, 20, 30, 40],
      labels: ['1 Aug', '2 Aug', '3 Aug', '4 Aug'],
      label: 'steps'
    };

    it('opens the read-out from a caller-supplied hoverIndex, with no pointer at all', async () => {
      const { container } = render(TrendChart, { props: { ...props, hoverIndex: 1 } });
      await Promise.resolve();
      expect(container.querySelector('.tip-title')?.textContent).toBe('2 Aug');
      expect(container.querySelector('.tip .v')?.textContent).toBe('20');
      // A hover — not a pin — so the rule stays dashed.
      expect(container.querySelector('line.cursor')?.classList.contains('pinned')).toBe(false);
    });

    it('ignores a shared hoverIndex that is past the end of this series', async () => {
      const { container } = render(TrendChart, { props: { ...props, hoverIndex: 99 } });
      await Promise.resolve();
      expect(container.querySelector('.tip')).toBeNull();
      expect(container.querySelector('line.cursor')).toBeNull();
    });

    it('suppresses only the floating box under tooltip={false}, keeping the crosshair', async () => {
      const { container } = render(TrendChart, {
        props: { ...props, hoverIndex: 2, tooltip: false }
      });
      await Promise.resolve();
      expect(container.querySelector('.tip')).toBeNull();
      expect(container.querySelector('line.cursor')).not.toBeNull();
      expect(container.querySelectorAll('circle.cursor-dot')).toHaveLength(1);
      // The screen-reader read-out is not a tooltip and must survive.
      expect(container.querySelector('[aria-live]')?.textContent).toBe('3 Aug: 30');
    });

    it('reports the inset its own y ticks need', async () => {
      const seen: number[] = [];
      render(TrendChart, { props: { ...props, onGutter: (px: number) => seen.push(px) } });
      await Promise.resolve();
      expect(seen.length).toBeGreaterThan(0);
      expect(seen.at(-1)).toBeGreaterThan(0);
    });

    it('clamps the plot to a caller-supplied gutterLeft so a stack can align', async () => {
      const natural = render(TrendChart, { props });
      await Promise.resolve();
      const naturalX = Number(natural.container.querySelector('text.axis-tick.y')?.getAttribute('x'));

      cleanup();
      const forced = render(TrendChart, { props: { ...props, gutterLeft: 200 } });
      await Promise.resolve();
      const forcedX = Number(forced.container.querySelector('text.axis-tick.y')?.getAttribute('x'));

      expect(naturalX).toBeGreaterThan(0);
      expect(forcedX).toBeGreaterThan(naturalX);
      // Ticks hang AXIS_GAP to the left of the plot edge, which is now the forced inset.
      expect(forcedX).toBeLessThan(200);
      expect(forcedX).toBeGreaterThan(190);
    });

    it('leaves the plot alone when the shared gutter is narrower than its own', async () => {
      const { container } = render(TrendChart, { props: { ...props, gutterLeft: 1 } });
      await Promise.resolve();
      const x = Number(container.querySelector('text.axis-tick.y')?.getAttribute('x'));
      expect(x).toBeGreaterThan(1);
    });
  });

  describe('draw-in reveal', () => {
    /*
      The reveal must not be length-based. `pathLength` + `stroke-dasharray` disagrees with
      `vector-effect: non-scaling-stroke` about which space the stroke is measured in, and WebKit
      resolved that by drawing only the first half of every line on a 2× display — permanently.
    */
    it('reveals via a clip wipe, never via a dash along the stroke', () => {
      const { container } = render(TrendChart, { props: { values: [1, 4, 2, 8, 5] } });
      const line = container.querySelector('path.line');
      expect(line?.hasAttribute('pathLength')).toBe(false);
      expect(line?.getAttribute('stroke-dasharray')).toBeNull();
      expect(container.querySelector('clipPath rect.reveal')).not.toBeNull();
    });

    it('clips the lines with its own clip path, so two charts cannot collide', () => {
      const a = render(TrendChart, { props: { values: [1, 2, 3] } });
      const b = render(TrendChart, { props: { values: [3, 2, 1] } });
      const idOf = (c: HTMLElement): string | null | undefined =>
        c.querySelector('clipPath')?.getAttribute('id');
      const refOf = (c: HTMLElement): string | null | undefined =>
        c.querySelector('g[clip-path]')?.getAttribute('clip-path');

      expect(idOf(a.container)).toBeTruthy();
      expect(idOf(a.container)).not.toBe(idOf(b.container));
      expect(refOf(a.container)).toBe(`url(#${idOf(a.container)})`);
      expect(refOf(b.container)).toBe(`url(#${idOf(b.container)})`);
    });
  });

  it('labels every tick a sparse x axis carries', () => {
    // A day-of-year axis: a name on the 1st of each month, the rest of the slots blank.
    const labels = Array.from({ length: 366 }, (_, i) => (i % 30 === 0 ? 'mies' : ''));
    const values = labels.map((_, i) => i);
    const { container } = render(TrendChart, { props: { values, labels } });
    // 13 non-blank labels, all of which fit across the default 640 coordinate width.
    expect(container.querySelectorAll('text.axis-tick.x')).toHaveLength(13);
  });

  describe('decorative emphasis (spec 056)', () => {
    const props = { values: [10, 20, 30, 25], labels: ['a', 'b', 'c', 'd'], label: 'km' };

    it('draws a haloed dot and a rule at the emphasised point', () => {
      const { container } = render(TrendChart, { props: { ...props, emphasisIndex: 3 } });
      expect(container.querySelectorAll('circle.emphasis-dot')).toHaveLength(1);
      expect(container.querySelectorAll('circle.emphasis-halo')).toHaveLength(1);
      const rule = container.querySelector('line.emphasis-rule');
      expect(rule).not.toBeNull();
      // Rule and dot share the emphasised point's x.
      expect(rule?.getAttribute('x1')).toBe(
        container.querySelector('circle.emphasis-dot')?.getAttribute('cx')
      );
    });

    it('spells the emphasis out in the accessible summary, so it is not colour-only', () => {
      const { container } = render(TrendChart, {
        props: { ...props, emphasisIndex: 3, emphasisLabel: 'bieżący tydzień' }
      });
      expect(container.querySelector('svg')?.getAttribute('aria-label')).toBe(
        'km trend, 4 points, low 10, high 30, bieżący tydzień d: 25'
      );
    });

    it('is decorative only: no tooltip, no cursor, no pinned selection', () => {
      const { container } = render(TrendChart, { props: { ...props, emphasisIndex: 2 } });
      expect(container.querySelector('line.cursor')).toBeNull();
      expect(container.querySelector('circle.cursor-dot')).toBeNull();
      // No read-out opened, so no tooltip and nothing announced.
      expect(container.querySelector('.tip')).toBeNull();
      expect(container.querySelector('.sr-only')?.textContent).toBe('');
    });

    it('draws nothing when no index is given', () => {
      const { container } = render(TrendChart, { props });
      expect(container.querySelector('circle.emphasis-dot')).toBeNull();
      expect(container.querySelector('line.emphasis-rule')).toBeNull();
    });

    it('draws nothing for a null, out-of-range or fractional index', () => {
      for (const emphasisIndex of [null, -1, 4, 99, 1.5]) {
        const { container } = render(TrendChart, { props: { ...props, emphasisIndex } });
        expect(container.querySelector('circle.emphasis-dot')).toBeNull();
        expect(container.querySelector('line.emphasis-rule')).toBeNull();
        cleanup();
      }
    });

    it('draws nothing where the emphasised sample is a gap', () => {
      const { container } = render(TrendChart, {
        props: { values: [10, NaN, 30], emphasisIndex: 1 }
      });
      expect(container.querySelector('circle.emphasis-dot')).toBeNull();
    });

    it('emphasises every visible series of a multi-series chart at that x', () => {
      const { container } = render(TrendChart, {
        props: {
          series: [
            { name: 'A', values: [1, 2, 3] },
            { name: 'B', values: [3, 2, 1] }
          ],
          emphasisIndex: 2
        }
      });
      expect(container.querySelectorAll('circle.emphasis-dot')).toHaveLength(2);
    });
  });

  it('stays finite for very large and negative values', () => {
    const { container } = render(TrendChart, {
      props: { values: [-1000, 5_000_000, -250, 9_999_999] }
    });
    const line = container.querySelector('path.line');
    expect(line?.getAttribute('d')).not.toContain('NaN');
    expect(container.querySelector('path.area')?.getAttribute('d')).not.toContain('NaN');
  });
});
