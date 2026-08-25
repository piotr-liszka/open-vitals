import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, cleanup } from '@testing-library/svelte';
import IconButton from './IconButton.svelte';

afterEach(cleanup);

describe('IconButton', () => {
  it('names itself for assistive tech, since it has no visible text', () => {
    const { container } = render(IconButton, { props: { icon: 'refresh', label: 'Synchronizuj' } });
    const button = container.querySelector('button');
    expect(button?.getAttribute('aria-label')).toBe('Synchronizuj');
    expect(button?.getAttribute('title')).toBe('Synchronizuj');
    expect(container.querySelector('svg.icon')).not.toBeNull();
  });

  it('keeps an explicit title instead of the label', () => {
    const { container } = render(IconButton, {
      props: { icon: 'refresh', label: 'Synchronizuj', title: 'Ostatnio: 12:53' }
    });
    expect(container.querySelector('button')?.getAttribute('title')).toBe('Ostatnio: 12:53');
  });

  it('swaps the glyph for a spinner and blocks clicks while loading', () => {
    const onclick = vi.fn();
    const { container } = render(IconButton, {
      props: { icon: 'refresh', label: 'Synchronizuj', loading: true, onclick }
    });
    const button = container.querySelector<HTMLButtonElement>('button');
    expect(button?.disabled).toBe(true);
    expect(button?.getAttribute('aria-busy')).toBe('true');
    expect(container.querySelector('.spinner')).not.toBeNull();
    button?.click();
    expect(onclick).not.toHaveBeenCalled();
  });

  it('fires onclick when idle', () => {
    const onclick = vi.fn();
    const { container } = render(IconButton, {
      props: { icon: 'refresh', label: 'Synchronizuj', onclick }
    });
    container.querySelector<HTMLButtonElement>('button')?.click();
    expect(onclick).toHaveBeenCalledOnce();
  });

  it('carries the size class so tight chrome can ask for the small square', () => {
    const { container } = render(IconButton, {
      props: { icon: 'refresh', label: 'Synchronizuj', size: 'sm' }
    });
    expect(container.querySelector('button')?.classList.contains('sm')).toBe(true);
  });

  it('defaults to the neutral variant', () => {
    const { container } = render(IconButton, { props: { icon: 'trash', label: 'Usuń' } });
    const button = container.querySelector('button');
    expect(button?.classList.contains('default')).toBe(true);
    expect(button?.classList.contains('danger')).toBe(false);
  });

  it('carries the danger variant class for a destructive action', () => {
    const { container } = render(IconButton, {
      props: { icon: 'trash', label: 'Usuń', variant: 'danger' }
    });
    expect(container.querySelector('button')?.classList.contains('danger')).toBe(true);
  });
});
