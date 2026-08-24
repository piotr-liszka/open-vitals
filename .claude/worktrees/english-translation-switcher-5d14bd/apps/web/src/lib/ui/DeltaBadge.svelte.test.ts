import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/svelte';
import DeltaBadge from './DeltaBadge.svelte';

afterEach(cleanup);

describe('DeltaBadge', () => {
  it.each([
    ['better', 'better'],
    ['worse', 'worse'],
    ['same', 'same']
  ] as const)('tones %s changes with the %s class', (direction, cls) => {
    const { container } = render(DeltaBadge, { props: { direction, value: '1:40', label: 'zmiana' } });
    expect(container.querySelector('.delta')?.classList.contains(cls)).toBe(true);
  });

  it('points the arrow where the caller says, independently of the tone', () => {
    const down = render(DeltaBadge, {
      props: { direction: 'better', arrow: 'down', value: '1:40', label: 'szybciej o 1:40' }
    });
    expect(down.container.querySelector('svg')?.getAttribute('data-icon')).toBe('arrow-down');
    cleanup();

    // A rising volume is ALSO an improvement — tone and arrow must not be welded together.
    const up = render(DeltaBadge, {
      props: { direction: 'better', arrow: 'up', value: '+12 km', label: '12 km więcej' }
    });
    expect(up.container.querySelector('svg')?.getAttribute('data-icon')).toBe('arrow-up');
  });

  it('draws no arrow when there is no direction to point in', () => {
    const { container } = render(DeltaBadge, {
      props: { direction: 'same', value: 'bez zmian', label: 'bez zmian od 90 dni' }
    });
    expect(container.querySelector('svg')).toBeNull();
  });

  it('never leaves meaning to colour alone: the value shows and the sentence is announced', () => {
    const { container } = render(DeltaBadge, {
      props: { direction: 'better', arrow: 'down', value: '1:40', label: 'szybciej o 1:40 niż 90 dni temu' }
    });
    expect(container.querySelector('.value')?.textContent).toBe('1:40');
    // The visible number is decorative for assistive tech; the full sentence carries it instead.
    expect(container.querySelector('.value')?.getAttribute('aria-hidden')).toBe('true');
    expect(container.querySelector('.sr-only')?.textContent).toBe('szybciej o 1:40 niż 90 dni temu');
  });
});
