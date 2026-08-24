import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, cleanup } from '@testing-library/svelte';
import { createRawSnippet, tick } from 'svelte';
import { readable } from 'svelte/store';
import { formatInstant, resolveBrowserTimeZone } from '$lib/date';
import { SIDEBAR_PREF_KEY } from './sidebar-state';

/**
 * Since spec 063 the shell mounts `NavLinks` itself when no `nav` snippet is passed, which is the
 * normal path for every real page — so this suite needs the `page` store that `NavLinks` reads.
 */
vi.mock('$app/stores', () => ({
  page: readable<{ url: URL; data: Record<string, unknown> }>({
    url: new URL('http://vagus.test/'),
    data: {}
  })
}));

const { default: AppShell } = await import('./AppShell.svelte');

afterEach(() => {
  cleanup();
  Reflect.deleteProperty(window, 'matchMedia');
});

/**
 * jsdom ships no `matchMedia`, so the drawer breakpoint has to be faked to test the narrow-screen
 * behaviour at all. Returns the change listener so a test can widen the viewport mid-run.
 */
function stubViewport(narrow: boolean): { widen: () => void } {
  let matches = narrow;
  const listeners = new Set<() => void>();
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: vi.fn(() => ({
      get matches() {
        return matches;
      },
      addEventListener: (_: string, fn: () => void) => listeners.add(fn),
      removeEventListener: (_: string, fn: () => void) => listeners.delete(fn)
    }))
  });
  return {
    widen: () => {
      matches = false;
      for (const fn of listeners) fn();
    }
  };
}

const navSnippet = createRawSnippet(() => ({
  render: () => '<div><a class="to-panel" href="/dashboard">Panel</a></div>'
}));

/** The drawer toggle in the topbar. */
const menuButton = (container: Element): HTMLButtonElement =>
  container.querySelector('.menu-btn') as HTMLButtonElement;

/**
 * Mount, then let the breakpoint effect run AND the re-render it schedules land. One tick only gets
 * you the first of those — the component deliberately renders its wide-screen shape first so SSR and
 * hydration agree, and adopts the drawer shape a beat later.
 */
async function settle(): Promise<void> {
  await tick();
  await tick();
}

describe('AppShell version stamp (spec 018)', () => {
  it('renders the build time as local time, never a UTC-labelled ISO slice', () => {
    const { container } = render(AppShell, { props: { title: 'Test' } });
    const time = container.querySelector('.build-time');

    // The machine-readable value stays the exact UTC instant…
    expect(time?.getAttribute('datetime')).toBe(__BUILD_TIME__);
    // …while the visible text is localised and no longer claims "UTC".
    expect(time?.textContent).not.toContain('UTC');
    expect(time?.textContent).not.toContain('T');
    expect(time?.textContent).toBe(formatInstant(__BUILD_TIME__, 'dateTime', resolveBrowserTimeZone()));
  });

  it('exposes the build instant and commit in the tooltip', () => {
    const { container } = render(AppShell, { props: { title: 'Test' } });
    const title = container.querySelector('.build')?.getAttribute('title') ?? '';
    expect(title).toContain('Zbudowano:');
    expect(title).not.toContain('(UTC)');
    if (__BUILD_SHA__) {
      expect(title).toContain(__BUILD_SHA__);
      expect(container.querySelector('.build-sha')?.textContent).toBe(__BUILD_SHA__);
    }
  });
});

describe('AppShell sidebar footer (spec 027)', () => {
  it('renders the footer snippet directly above the build stamp', () => {
    const footer = createRawSnippet(() => ({ render: () => '<p class="fresh">świeżość</p>' }));
    const { container } = render(AppShell, { props: { title: 'Test', footer } });

    const slot = container.querySelector('.sidebar-footer');
    expect(slot?.querySelector('.fresh')?.textContent).toBe('świeżość');
    // Order matters: freshness first, then the version stamp it kept being confused with.
    expect(slot?.nextElementSibling?.classList.contains('build')).toBe(true);
  });

  it('renders no footer slot when no snippet is given', () => {
    const { container } = render(AppShell, { props: { title: 'Test' } });
    expect(container.querySelector('.sidebar-footer')).toBeNull();
    expect(container.querySelector('.build')).not.toBeNull();
  });
});

describe('AppShell mobile drawer (spec 034)', () => {
  it('opens on the menu button and closes again on the scrim', async () => {
    stubViewport(true);
    const { container } = render(AppShell, { props: { title: 'Test', nav: navSnippet } });
    await settle();

    menuButton(container).click();
    await tick();
    expect(container.querySelector('.shell')?.classList.contains('mobile-open')).toBe(true);
    expect(menuButton(container).getAttribute('aria-expanded')).toBe('true');

    (container.querySelector('.scrim') as HTMLButtonElement).click();
    await tick();
    expect(container.querySelector('.shell')?.classList.contains('mobile-open')).toBe(false);
    expect(container.querySelector('.scrim')).toBeNull();
  });

  it('closes when a nav destination is tapped — the drawer must not survive the navigation', async () => {
    stubViewport(true);
    const { container } = render(AppShell, { props: { title: 'Test', nav: navSnippet } });
    await settle();

    // Real navigation is SvelteKit's job and jsdom refuses to do it; only the drawer is under test.
    const swallow = (event: Event): void => event.preventDefault();
    document.addEventListener('click', swallow);

    menuButton(container).click();
    await tick();
    (container.querySelector('.to-panel') as HTMLAnchorElement).click();
    await tick();

    document.removeEventListener('click', swallow);

    expect(container.querySelector('.shell')?.classList.contains('mobile-open')).toBe(false);
  });

  it('closes on Escape', async () => {
    stubViewport(true);
    const { container } = render(AppShell, { props: { title: 'Test', nav: navSnippet } });
    await settle();

    menuButton(container).click();
    await tick();
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    await tick();

    expect(container.querySelector('.shell')?.classList.contains('mobile-open')).toBe(false);
  });

  it('holds the page still while open and releases it on close', async () => {
    stubViewport(true);
    const { container } = render(AppShell, { props: { title: 'Test', nav: navSnippet } });
    await settle();

    menuButton(container).click();
    await tick();
    expect(document.body.style.overflow).toBe('hidden');

    menuButton(container).click();
    await tick();
    expect(document.body.style.overflow).toBe('');
  });

  it('keeps the off-canvas sidebar out of the tab order until it is opened', async () => {
    stubViewport(true);
    const { container } = render(AppShell, { props: { title: 'Test', nav: navSnippet } });
    await settle();

    const sidebar = container.querySelector('#app-sidebar') as HTMLElement;
    // Asserted on the PROPERTY: Svelte sets `inert` as an IDL property, which a browser reflects
    // back to an attribute but jsdom (no `inert` support) does not.
    expect(sidebar.inert).toBe(true);

    menuButton(container).click();
    await tick();
    expect(sidebar.inert).toBe(false);
  });

  it('is never inert on a wide viewport, and a widened viewport drops the open drawer', async () => {
    const viewport = stubViewport(true);
    const { container } = render(AppShell, { props: { title: 'Test', nav: navSnippet } });
    await settle();

    menuButton(container).click();
    await tick();
    expect(container.querySelector('.shell')?.classList.contains('mobile-open')).toBe(true);

    viewport.widen();
    await tick();
    expect(container.querySelector('.shell')?.classList.contains('mobile-open')).toBe(false);
    expect((container.querySelector('#app-sidebar') as HTMLElement).inert).toBe(false);
  });
});

/**
 * Spec 063. The three states' LAYOUT is pure CSS keyed on `html[data-sidebar]` (jsdom applies no
 * stylesheets, so there is nothing to assert about widths here). What the component still owns — and
 * what these cover — is that the attribute is written, the preference is persisted, and the way back
 * from `hidden` exists.
 */
describe('AppShell sidebar collapse (spec 063)', () => {
  beforeEach(() => {
    localStorage.clear();
    Reflect.deleteProperty(document.documentElement.dataset, 'sidebar');
  });

  const brandToggle = (c: Element): HTMLButtonElement =>
    c.querySelector('.brand .sidebar-toggle') as HTMLButtonElement;
  const topbarToggle = (c: Element): HTMLButtonElement | null =>
    c.querySelector('.topbar-toggle .sidebar-toggle');

  it('mounts the primary nav itself, so no page has to pass one', () => {
    const { container } = render(AppShell, { props: { title: 'Test', advanced: true } });

    expect(container.querySelector('.nav a.nav-item')).not.toBeNull();
  });

  it('still lets a caller override the nav — the styleguide needs fake links', () => {
    const { container } = render(AppShell, { props: { title: 'Test', nav: navSnippet } });

    expect(container.querySelector('.to-panel')).not.toBeNull();
    expect(container.querySelector('.nav a.nav-item')).toBeNull();
  });

  it('writes the root attribute and the preference when the toggle is pressed', async () => {
    const { container } = render(AppShell, { props: { title: 'Test' } });
    await settle();

    brandToggle(container).click();
    await tick();

    expect(document.documentElement.dataset.sidebar).toBe('icons');
    expect(localStorage.getItem(SIDEBAR_PREF_KEY)).toBe('icons');
  });

  it('offers no topbar toggle while the sidebar is on screen — one control, one question', async () => {
    const { container } = render(AppShell, { props: { title: 'Test' } });
    await settle();

    expect(topbarToggle(container)).toBeNull();
  });

  it('surfaces a topbar toggle once the sidebar is hidden, so it can always be recovered', async () => {
    localStorage.setItem(SIDEBAR_PREF_KEY, 'hidden');
    const { container } = render(AppShell, { props: { title: 'Test' } });
    await settle();

    const recover = topbarToggle(container);
    expect(recover).not.toBeNull();
    expect(recover!.getAttribute('aria-label')).toBe('Rozwiń menu');

    recover!.click();
    await tick();
    expect(document.documentElement.dataset.sidebar).toBe('expanded');
  });

  it('adopts the stored preference on mount', async () => {
    localStorage.setItem(SIDEBAR_PREF_KEY, 'icons');
    const { container } = render(AppShell, { props: { title: 'Test' } });
    await settle();

    // Labelled for the NEXT state, so "icons" reads as "Ukryj menu".
    expect(brandToggle(container).getAttribute('aria-label')).toBe('Ukryj menu');
  });
});

/**
 * The same escape-hatch shape as `nav`: all ten real pages were passing the identical "Wyloguj"
 * button and their own copy of the handler behind it, so the shell renders `LogoutButton` by default
 * and a caller that supplies `actions` REPLACES it. Asserted because "replaces" and "is appended to"
 * differ by one stray logout button on the styleguide.
 */
describe('AppShell topbar actions', () => {
  const actionLabels = (c: Element): string[] =>
    Array.from(c.querySelectorAll('.topbar-actions button')).map((b) => b.textContent?.trim() ?? '');

  it('mounts the logout button itself, so no page has to pass one', () => {
    const { container } = render(AppShell, { props: { title: 'Test' } });

    expect(actionLabels(container)).toContain('Wyloguj');
  });

  it('lets a caller replace it rather than add to it', () => {
    const actions = createRawSnippet(() => ({
      render: () => '<button type="button" class="custom">Coś</button>'
    }));
    const { container } = render(AppShell, { props: { title: 'Test', actions } });

    expect(container.querySelector('.custom')).not.toBeNull();
    expect(actionLabels(container)).not.toContain('Wyloguj');
  });
});
