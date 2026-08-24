import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/svelte';
import Sparkline from './Sparkline.svelte';

afterEach(cleanup);

describe('Sparkline', () => {
  it('renders an svg with a line for normal input', () => {
    const { container } = render(Sparkline, {
      props: { values: [1, 4, 2, 8, 5], label: 'steps' }
    });
    const svg = container.querySelector('svg');
    expect(svg).not.toBeNull();
    expect(svg?.getAttribute('role')).toBe('img');
    expect(container.querySelector('path.line')).not.toBeNull();
  });

  it('summarises the trend in the aria-label', () => {
    const { container } = render(Sparkline, {
      props: { values: [10, 20, 9204], label: 'steps' }
    });
    const label = container.querySelector('svg')?.getAttribute('aria-label');
    expect(label).toBe('steps trend, 3 points, latest 9,204');
  });

  it('handles an empty array with a placeholder and no-data label', () => {
    const { container } = render(Sparkline, { props: { values: [], label: 'steps' } });
    const svg = container.querySelector('svg');
    expect(svg).not.toBeNull();
    expect(svg?.getAttribute('aria-label')).toBe('steps trend, no data');
    expect(container.querySelector('path.line')).toBeNull();
    expect(container.querySelector('line.placeholder')).not.toBeNull();
  });

  it('renders a single point without a connecting line', () => {
    const { container } = render(Sparkline, { props: { values: [42] } });
    expect(container.querySelector('path.line')).toBeNull();
    expect(container.querySelector('path.dot')).not.toBeNull();
    expect(container.querySelector('svg')?.getAttribute('aria-label')).toBe('trend, 1 point, latest 42');
  });

  it('does not throw for all-equal values and still draws a line', () => {
    const { container } = render(Sparkline, { props: { values: [5, 5, 5, 5] } });
    expect(container.querySelector('path.line')).not.toBeNull();
  });

  it('draws an area fill and baseline when requested', () => {
    const { container } = render(Sparkline, {
      props: { values: [3, 6, 4, 9], showArea: true, baseline: 5 }
    });
    expect(container.querySelector('path.area')).not.toBeNull();
    expect(container.querySelector('line.baseline')).not.toBeNull();
  });
});
