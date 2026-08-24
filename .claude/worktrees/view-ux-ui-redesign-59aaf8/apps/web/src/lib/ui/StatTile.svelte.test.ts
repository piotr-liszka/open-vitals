import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/svelte';
import StatTile from './StatTile.svelte';
import { readoutFitScale } from './readout-fit';

afterEach(cleanup);

describe('StatTile', () => {
  it('renders label and value', () => {
    const { container } = render(StatTile, { props: { label: 'Steps', value: '9,765' } });
    expect(container.querySelector('.label')?.textContent).toContain('Steps');
    expect(container.querySelector('.value')?.textContent).toContain('9,765');
  });

  it('shows an upward, +signed delta for a positive change', () => {
    const { container } = render(StatTile, {
      props: { label: 'Steps', value: 100, delta: 12, deltaSuffix: '%' }
    });
    const delta = container.querySelector('.delta');
    expect(delta?.classList.contains('up')).toBe(true);
    expect(delta?.textContent).toContain('+12%');
  });

  it('shows a downward, negative delta for a negative change', () => {
    const { container } = render(StatTile, {
      props: { label: 'RHR', value: 53, delta: -2, deltaSuffix: ' bpm' }
    });
    const delta = container.querySelector('.delta');
    expect(delta?.classList.contains('down')).toBe(true);
    expect(delta?.textContent).toContain('-2 bpm');
  });

  it('shows a flat delta for a zero change', () => {
    const { container } = render(StatTile, {
      props: { label: 'Battery', value: 72, delta: 0 }
    });
    const delta = container.querySelector('.delta');
    expect(delta?.classList.contains('flat')).toBe(true);
  });

  it('renders no delta when none is provided', () => {
    const { container } = render(StatTile, { props: { label: 'Score', value: 84 } });
    expect(container.querySelector('.delta')).toBeNull();
  });

  it('renders an optional unit alongside the value', () => {
    const { container } = render(StatTile, {
      props: { label: 'RHR', value: 50, unit: 'bpm' }
    });
    expect(container.querySelector('.value')?.textContent).toContain('50');
    expect(container.querySelector('.unit')?.textContent).toContain('bpm');
  });

  it('steps the readout down for a long value so it stays inside the tile', () => {
    // "6 h 52 min" at the hero size overflowed a 160px tile column (spec 029).
    const long = render(StatTile, { props: { label: 'Czas', value: '6 h 52 min' } });
    expect(long.container.querySelector('.readout')?.classList.contains('step-sm')).toBe(true);
    cleanup();

    const short = render(StatTile, { props: { label: 'Kroki', value: '9204' } });
    expect(short.container.querySelector('.readout')?.classList.contains('step-xl')).toBe(true);
  });

  it('publishes the tile-width fit scales the readout and label are sized with', () => {
    // The tile is an inline-size container; these two numbers are what its CSS multiplies 100cqw by,
    // so a 118px activity-detail column shrinks the type instead of overlapping it (spec 031).
    const { container } = render(StatTile, {
      props: { label: 'Przewyższenie', value: '6,11', unit: 'km', accent: 'green' }
    });
    const style = container.querySelector('.tile')?.getAttribute('style') ?? '';
    const readoutScale = Number(/--readout-scale:\s*([\d.]+)/.exec(style)?.[1]);
    const labelScale = Number(/--label-scale:\s*([\d.]+)/.exec(style)?.[1]);

    // At 118px of usable width both land under their tokens (48px readout, 12px micro-caps).
    expect(118 * readoutScale).toBeLessThan(48);
    expect((118 - 16) * labelScale).toBeLessThan(12);
    // ...and a roomy dashboard tile leaves the hero token in charge.
    expect(250 * readoutScale).toBeGreaterThan(48);
  });

  it('drops the unit from the fit when the tile is muted, since none is drawn', () => {
    const { container } = render(StatTile, {
      props: { label: 'SpO2', value: '—', unit: '%', muted: true }
    });
    const style = container.querySelector('.tile')?.getAttribute('style') ?? '';
    expect(style).toContain(`--readout-scale: ${readoutFitScale('—')}`);
    expect(readoutFitScale('—')).toBeGreaterThan(readoutFitScale('—', '%'));
  });

  it('shows a lane accent marker only when an accent is given', () => {
    const plain = render(StatTile, { props: { label: 'Score', value: 84 } });
    expect(plain.container.querySelector('.marker')).toBeNull();
    cleanup();

    const accented = render(StatTile, {
      props: { label: 'Steps', value: 9204, accent: 'orange' }
    });
    expect(accented.container.querySelector('.marker')).not.toBeNull();
    expect(accented.container.querySelector('.tile')?.getAttribute('style')).toContain('var(--lane-orange)');
  });
});
