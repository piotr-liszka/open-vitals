import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, cleanup } from '@testing-library/svelte';
import { readable } from 'svelte/store';

/**
 * Mutable stand-in for SvelteKit's `page` store — each test sets the URL the server rendered, and
 * since spec 064 also the `data` the root layout load returns (the sidebar reads the user's own
 * dashboards from there).
 */
const state = { url: new URL('http://vagus.test/'), data: {} as Record<string, unknown> };

vi.mock('$app/stores', () => ({
  page: readable<{ url: URL; data: Record<string, unknown> }>({ url: state.url, data: state.data }, (set) => {
    set({ url: state.url, data: state.data });
    return () => {};
  })
}));

const { default: NavLinks } = await import('./NavLinks.svelte');

beforeEach(() => {
  state.url = new URL('http://vagus.test/');
  state.data = {};
});

afterEach(cleanup);

const links = (c: HTMLElement): HTMLAnchorElement[] => Array.from(c.querySelectorAll('a.nav-item'));
/**
 * An item's label. Read from the `.label` span rather than the anchor's `textContent`, because since
 * spec 063 the anchor also contains an icon — asserting on the whole subtree would couple every one
 * of these tests to the icon markup.
 */
const labelOf = (a: HTMLAnchorElement): string | null => a.querySelector('.label')?.textContent ?? null;
const headings = (c: HTMLElement): HTMLElement[] => Array.from(c.querySelectorAll('.group-title'));

describe('NavLinks', () => {
  it('renders one heading per group and none for the ungrouped run', () => {
    const { container } = render(NavLinks, { props: { advanced: true } });

    expect(headings(container).map((h) => h.textContent)).toEqual(['Trening', 'Zdrowie', 'System']);
    // Start is ungrouped, so the first list carries no heading at all.
    const lists = Array.from(container.querySelectorAll('ul.items'));
    expect(lists[0]!.getAttribute('aria-labelledby')).toBeNull();
  });

  it('ties each heading to the list it labels, so the grouping reaches assistive tech', () => {
    const { container } = render(NavLinks, { props: { advanced: true } });

    for (const h of headings(container)) {
      const id = h.getAttribute('id');
      expect(id).toBeTruthy();
      const list = container.querySelector(`ul[aria-labelledby="${id}"]`);
      expect(list).not.toBeNull();
    }
  });

  it('keeps headings out of the tab order — they label, they do not navigate', () => {
    const { container } = render(NavLinks, { props: { advanced: true } });

    for (const h of headings(container)) {
      expect(h.tagName).toBe('H2');
      expect(h.querySelector('a, button')).toBeNull();
      expect(h.hasAttribute('tabindex')).toBe(false);
    }
  });

  it('shows a Base user three links and no empty group headings', () => {
    const { container } = render(NavLinks, { props: { advanced: false } });

    expect(links(container).map(labelOf)).toEqual(['Start', 'Dane', 'Ustawienia']);
    // Trening and Zdrowie are Advanced-only in full, so their headings must not survive the filter.
    expect(headings(container).map((h) => h.textContent)).toEqual(['System']);
  });

  it('marks a section parent active from a subpage', () => {
    state.url = new URL('http://vagus.test/training/bieg');
    const { container } = render(NavLinks, { props: { advanced: true } });

    const active = links(container).filter((a) => a.classList.contains('active'));
    expect(active.map(labelOf)).toEqual(['Trening']);
  });

  it('activates Aktywności on the map tab — the heat map is inside that section now', () => {
    state.url = new URL('http://vagus.test/activities/mapa');
    const { container } = render(NavLinks, { props: { advanced: true } });

    const active = links(container).filter((a) => a.classList.contains('active'));
    expect(active.map(labelOf)).toEqual(['Aktywności']);
  });

  it('does not light up Start on every page', () => {
    state.url = new URL('http://vagus.test/insights');
    const { container } = render(NavLinks, { props: { advanced: true } });

    const active = links(container).filter((a) => a.classList.contains('active'));
    expect(active.map(labelOf)).toEqual(['Wnioski']);
  });

  it('carries the active range across to range-aware destinations', () => {
    state.url = new URL('http://vagus.test/insights?range=365');
    const { container } = render(NavLinks, { props: { advanced: true } });

    const training = links(container).find((a) => labelOf(a) === 'Trening')!;
    expect(training.getAttribute('href')).toContain('range=365');
  });

  /**
   * Spec 063. The sidebar leans on "has an icon" to mean "is a destination" — which only works if the
   * two categories stay disjoint. Both halves are asserted here, because either one drifting on its
   * own quietly restores the bug the spec was written to fix.
   */
  describe('icons distinguish links from headings (spec 063)', () => {
    it('gives every item an icon', () => {
      const { container } = render(NavLinks, { props: { advanced: true } });

      const items = links(container);
      expect(items.length).toBeGreaterThan(0);
      for (const a of items) {
        expect(a.querySelector('svg[data-icon]')).not.toBeNull();
      }
    });

    it('gives no heading an icon', () => {
      const { container } = render(NavLinks, { props: { advanced: true } });

      for (const h of headings(container)) {
        expect(h.querySelector('svg')).toBeNull();
      }
    });

    /** The icon-only state hides labels in CSS, so the tooltip is the mouse user's only readout. */
    it('carries the label as a title, for the collapsed state', () => {
      const { container } = render(NavLinks, { props: { advanced: true } });

      for (const a of links(container)) {
        expect(a.getAttribute('title')).toBe(labelOf(a));
      }
    });

    /** `aria-current` is what a screen reader announces; the `.active` class is only paint. */
    it('marks the current page with aria-current, not colour alone', () => {
      state.url = new URL('http://vagus.test/insights');
      const { container } = render(NavLinks, { props: { advanced: true } });

      const current = links(container).filter((a) => a.getAttribute('aria-current') === 'page');
      expect(current.map(labelOf)).toEqual(['Wnioski']);
    });
  });
});
