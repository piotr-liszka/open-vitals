import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, cleanup } from '@testing-library/svelte';
import ChartLegend from './ChartLegend.svelte';

afterEach(cleanup);

const items = [
  { name: 'CTL', color: 'var(--lane-green)' },
  { name: 'ATL', color: 'var(--lane-red)' }
];

describe('ChartLegend', () => {
  it('renders a labelled list with one swatch + name per series', () => {
    const { container } = render(ChartLegend, { props: { items, ariaLabel: 'PMC series' } });
    const list = container.querySelector('ul');
    expect(list?.getAttribute('aria-label')).toBe('PMC series');
    expect(container.querySelectorAll('li')).toHaveLength(2);
    expect(container.querySelectorAll('.swatch')).toHaveLength(2);
    expect([...container.querySelectorAll('.name')].map((n) => n.textContent)).toEqual(['CTL', 'ATL']);
  });

  it('is inert text without onToggle', () => {
    const { container } = render(ChartLegend, { props: { items } });
    expect(container.querySelector('button')).toBeNull();
    expect(container.querySelectorAll('.item.static')).toHaveLength(2);
  });

  it('becomes keyboard-reachable toggle buttons with onToggle', async () => {
    const onToggle = vi.fn();
    const { container } = render(ChartLegend, { props: { items, onToggle } });
    const buttons = container.querySelectorAll('button.item');
    expect(buttons).toHaveLength(2);
    // Native buttons: focusable and Enter/Space activated without extra handlers.
    expect(buttons[0]?.getAttribute('type')).toBe('button');

    (buttons[1] as HTMLButtonElement).click();
    await Promise.resolve();
    expect(onToggle).toHaveBeenCalledWith(1);
  });

  it('reports visibility through aria-pressed', () => {
    const { container } = render(ChartLegend, {
      props: {
        items: [items[0]!, { ...items[1]!, hidden: true }],
        onToggle: () => {}
      }
    });
    const buttons = [...container.querySelectorAll('button.item')];
    expect(buttons[0]?.getAttribute('aria-pressed')).toBe('true');
    expect(buttons[1]?.getAttribute('aria-pressed')).toBe('false');
    expect(buttons[1]?.classList.contains('off')).toBe(true);
  });

  it('doubles as the read-out: shows each series value when one is supplied', () => {
    const { container } = render(ChartLegend, {
      props: {
        items: [
          { ...items[0]!, value: '61' },
          { ...items[1]!, value: '48' }
        ]
      }
    });
    expect([...container.querySelectorAll('.value')].map((v) => v.textContent)).toEqual(['61', '48']);
  });

  it('omits the value slot entirely when no read-out is open', () => {
    const { container } = render(ChartLegend, { props: { items } });
    expect(container.querySelectorAll('.value')).toHaveLength(0);
  });

  it('renders nothing for an empty series list', () => {
    const { container } = render(ChartLegend, { props: { items: [] } });
    expect(container.querySelectorAll('li')).toHaveLength(0);
  });
});
