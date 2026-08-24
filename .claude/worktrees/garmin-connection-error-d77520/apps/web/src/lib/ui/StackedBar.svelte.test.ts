import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/svelte';
import StackedBar from './StackedBar.svelte';
import type { StackedBarSegment } from './StackedBar.svelte';

afterEach(cleanup);

const stages: StackedBarSegment[] = [
  { label: 'Głęboki', value: 25, color: 'var(--lane-indigo)' },
  { label: 'REM', value: 25, color: 'var(--lane-violet)' },
  { label: 'Lekki', value: 50, color: 'var(--lane-sky)' }
];

function segments(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll('.seg'));
}

describe('StackedBar', () => {
  it('sizes each slice by its share of the total', () => {
    const { container } = render(StackedBar, { props: { segments: stages, ariaLabel: 'Fazy snu' } });
    expect(segments(container).map((s) => s.style.width)).toEqual(['25%', '25%', '50%']);
  });

  it('exposes the whole composition to assistive tech in one accessible name', () => {
    const { getByRole } = render(StackedBar, { props: { segments: stages, ariaLabel: 'Fazy snu' } });
    const name = getByRole('img').getAttribute('aria-label') ?? '';
    expect(name.startsWith('Fazy snu: ')).toBe(true);
    expect(name).toContain('Głęboki 25 (25%)');
    expect(name).toContain('Lekki 50 (50%)');
  });

  it('drops zero and negative segments instead of leaving hairline artefacts', () => {
    const { container } = render(StackedBar, {
      props: {
        segments: [...stages, { label: 'Czuwanie', value: 0, color: 'var(--lane-amber)' }],
        ariaLabel: 'Fazy snu'
      }
    });
    expect(segments(container).length).toBe(3);
    expect(container.textContent).not.toContain('Czuwanie');
  });

  it('renders nothing at all when there is no data to show', () => {
    const { container } = render(StackedBar, { props: { segments: [], ariaLabel: 'Fazy snu' } });
    expect(container.querySelector('.track')).toBeNull();
  });

  it('formats legend values through the caller’s formatter', () => {
    const { container } = render(StackedBar, {
      props: { segments: stages, ariaLabel: 'Fazy snu', format: (v: number) => `${v} min` }
    });
    expect(container.textContent).toContain('50 min');
  });

  it('can hide the legend', () => {
    const { container } = render(StackedBar, {
      props: { segments: stages, ariaLabel: 'Fazy snu', legend: false }
    });
    expect(container.querySelector('.legend')).toBeNull();
    expect(container.querySelector('.track')).not.toBeNull();
  });
});
