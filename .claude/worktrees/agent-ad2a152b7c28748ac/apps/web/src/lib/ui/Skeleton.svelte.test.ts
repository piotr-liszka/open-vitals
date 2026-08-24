import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/svelte';
import Skeleton from './Skeleton.svelte';

afterEach(cleanup);

describe('Skeleton', () => {
  it('renders a decorative, aria-hidden placeholder', () => {
    const { container } = render(Skeleton);
    const el = container.querySelector('.skeleton');
    expect(el).not.toBeNull();
    expect(el?.getAttribute('aria-hidden')).toBe('true');
  });

  it('applies width and height through style custom properties', () => {
    const { container } = render(Skeleton, {
      props: { width: 'var(--space-16)', height: 'var(--space-6)' }
    });
    const style = container.querySelector('.skeleton')?.getAttribute('style') ?? '';
    expect(style).toContain('--sk-w: var(--space-16)');
    expect(style).toContain('--sk-h: var(--space-6)');
  });

  it('defaults the radius to sm and honours an override', () => {
    const dflt = render(Skeleton);
    expect(dflt.container.querySelector('.skeleton')?.getAttribute('data-radius')).toBe('sm');
    cleanup();

    const lg = render(Skeleton, { props: { radius: 'lg' } });
    expect(lg.container.querySelector('.skeleton')?.getAttribute('data-radius')).toBe('lg');
  });

  it('uses the height for both dimensions when circular', () => {
    const { container } = render(Skeleton, {
      props: { circle: true, height: 'var(--space-10)', width: 'var(--space-16)' }
    });
    const el = container.querySelector('.skeleton');
    expect(el?.classList.contains('circle')).toBe(true);
    const style = el?.getAttribute('style') ?? '';
    // Circle ignores width and squares off on height.
    expect(style).toContain('--sk-w: var(--space-10)');
    expect(style).toContain('--sk-h: var(--space-10)');
  });
});
