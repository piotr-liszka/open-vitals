import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/svelte';
import SubNav from './SubNav.svelte';

afterEach(cleanup);

const items = [
  { href: '/training', label: 'Przegląd' },
  { href: '/training/rower', label: 'Rower', count: 128 },
  { href: '/training/bieg', label: 'Bieg', count: 44 }
];

function tabs(container: HTMLElement): HTMLAnchorElement[] {
  return Array.from(container.querySelectorAll('a.tab'));
}

describe('SubNav', () => {
  it('renders every item as a real link inside a labelled nav', () => {
    const { container, getByRole } = render(SubNav, {
      props: { items, current: '/training', ariaLabel: 'Sekcja treningu' }
    });

    expect(getByRole('navigation').getAttribute('aria-label')).toBe('Sekcja treningu');
    const links = tabs(container);
    expect(links).toHaveLength(3);
    // Real hrefs — each subpage is bookmarkable and works without JS.
    expect(links.map((a) => a.getAttribute('href'))).toEqual([
      '/training',
      '/training/rower',
      '/training/bieg'
    ]);
  });

  it('marks exactly the current pathname with aria-current="page"', () => {
    const { container } = render(SubNav, {
      props: { items, current: '/training/rower', ariaLabel: 'Sekcja treningu' }
    });

    const links = tabs(container);
    expect(links.map((a) => a.getAttribute('aria-current'))).toEqual([null, 'page', null]);
  });

  it('renders counts only for the items that carry one', () => {
    const { container } = render(SubNav, {
      props: { items, current: '/training', ariaLabel: 'Sekcja treningu' }
    });

    const counts = Array.from(container.querySelectorAll('.count')).map((el) => el.textContent);
    expect(counts).toEqual(['128', '44']);
  });
});
