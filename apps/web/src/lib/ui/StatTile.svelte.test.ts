import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/svelte';
import StatTile from './StatTile.svelte';

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

  it('renders two values of the same readout step identically, whatever their exact characters', () => {
    // The bug this guards against (spec 040): a duration ("30:26") and a decimal ("4.94") of the same
    // rendered length used to size differently because a per-glyph fit scale weighted their punctuation
    // differently. StatTile no longer computes a per-value scale at all — same step, same `.readout`
    // class, same size.
    const a = render(StatTile, { props: { label: 'Czas w ruchu', value: '30:26' } });
    const stepA = a.container.querySelector('.readout')?.className;
    cleanup();

    const b = render(StatTile, { props: { label: 'Dystans', value: '4.94' } });
    const stepB = b.container.querySelector('.readout')?.className;

    expect(stepA).toBe(stepB);
  });

  it('gives the tile card an accent border and glow instead of a marker dot, only when accented', () => {
    const plain = render(StatTile, { props: { label: 'Score', value: 84 } });
    expect(plain.container.querySelector('.marker')).toBeNull();
    expect(plain.container.querySelector('.tile')?.classList.contains('has-accent')).toBe(false);
    cleanup();

    const accented = render(StatTile, {
      props: { label: 'Steps', value: 9204, accent: 'orange' }
    });
    expect(accented.container.querySelector('.marker')).toBeNull();
    const tile = accented.container.querySelector('.tile');
    expect(tile?.classList.contains('has-accent')).toBe(true);
    expect(tile?.getAttribute('style')).toContain('var(--lane-orange)');
  });
});
