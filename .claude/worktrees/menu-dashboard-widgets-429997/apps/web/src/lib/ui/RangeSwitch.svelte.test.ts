import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, cleanup, screen } from '@testing-library/svelte';
import { tick } from 'svelte';

const goto = vi.fn();
/** Mutable stand-in for SvelteKit's `page` — each test sets the URL the server rendered. */
const state = { url: new URL('http://vagus.test/') };

vi.mock('$app/navigation', () => ({ goto: (...args: unknown[]) => goto(...args) }));
vi.mock('$app/state', () => ({
  page: {
    get url() {
      return state.url;
    }
  }
}));

const { default: RangeSwitch } = await import('./RangeSwitch.svelte');
const { RANGE_PREF_KEY } = await import('$lib/range');

/** jsdom has a real localStorage, but tests must not leak a remembered range into each other. */
beforeEach(() => {
  goto.mockClear();
  state.url = new URL('http://vagus.test/');
  localStorage.clear();
});

afterEach(cleanup);

/** The URL passed to the last `goto` call. */
function lastTarget(): URL {
  const call = goto.mock.calls.at(-1);
  expect(call, 'expected a navigation').toBeDefined();
  return call![0] as URL;
}

describe('RangeSwitch', () => {
  it('offers every range, extended with a year and all-time', () => {
    render(RangeSwitch);
    const labels = screen.getAllByRole('radio').map((el) => el.getAttribute('aria-label'));
    expect(labels).toEqual(['7 dni', '14 dni', '30 dni', '1 rok', 'cały czas']);
  });

  it('renders both a full and a compact label per segment', () => {
    const { container } = render(RangeSwitch);
    expect([...container.querySelectorAll('.label.long')].map((e) => e.textContent)).toEqual([
      '7 dni',
      '14 dni',
      '30 dni',
      '1 rok',
      'cały czas'
    ]);
    expect([...container.querySelectorAll('.label.short')].map((e) => e.textContent)).toEqual([
      '7d',
      '14d',
      '30d',
      '1r',
      '∞'
    ]);
  });

  it('marks the segment the URL asked for', () => {
    state.url = new URL('http://vagus.test/insights?range=365');
    render(RangeSwitch);
    expect(screen.getByRole('radio', { name: '1 rok' }).getAttribute('aria-checked')).toBe('true');
  });

  it('defaults to 7 days when the URL carries no range', () => {
    render(RangeSwitch);
    expect(screen.getByRole('radio', { name: '7 dni' }).getAttribute('aria-checked')).toBe('true');
  });

  it('falls back to the default for a hand-typed range', () => {
    state.url = new URL('http://vagus.test/?range=9999');
    render(RangeSwitch);
    expect(screen.getByRole('radio', { name: '7 dni' }).getAttribute('aria-checked')).toBe('true');
  });

  it('navigates with the new range and re-runs the loaders', async () => {
    state.url = new URL('http://vagus.test/insights?range=7');
    render(RangeSwitch);
    screen.getByRole('radio', { name: 'cały czas' }).click();
    await tick();

    expect(lastTarget().searchParams.get('range')).toBe('all');
    expect(goto.mock.calls.at(-1)![1]).toMatchObject({
      invalidateAll: true,
      keepFocus: true,
      noScroll: true,
      replaceState: true
    });
  });

  it('keeps the page and its other query parameters', async () => {
    state.url = new URL('http://vagus.test/activities?sport=running&sort=distance&range=7');
    render(RangeSwitch);
    screen.getByRole('radio', { name: '30 dni' }).click();
    await tick();

    const target = lastTarget();
    expect(target.pathname).toBe('/activities');
    expect(target.searchParams.get('sport')).toBe('running');
    expect(target.searchParams.get('sort')).toBe('distance');
    expect(target.searchParams.get('range')).toBe('30');
  });

  it('remembers the choice for this device', async () => {
    render(RangeSwitch);
    screen.getByRole('radio', { name: '1 rok' }).click();
    await tick();
    expect(localStorage.getItem(RANGE_PREF_KEY)).toBe('365');
  });

  it('re-applies the remembered range when the URL carries none', async () => {
    localStorage.setItem(RANGE_PREF_KEY, '30');
    render(RangeSwitch);
    await tick();
    expect(lastTarget().searchParams.get('range')).toBe('30');
  });

  it('lets an explicit range in the URL beat what this device remembers', async () => {
    // A shared link must show the sender what they sent, whatever the recipient last picked.
    localStorage.setItem(RANGE_PREF_KEY, 'all');
    state.url = new URL('http://vagus.test/insights?range=7');
    render(RangeSwitch);
    await tick();
    expect(goto).not.toHaveBeenCalled();
    expect(screen.getByRole('radio', { name: '7 dni' }).getAttribute('aria-checked')).toBe('true');
  });

  it('does not navigate on mount when nothing is remembered', async () => {
    render(RangeSwitch);
    await tick();
    expect(goto).not.toHaveBeenCalled();
  });

  it('survives a storage that refuses to be read', async () => {
    const getItem = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('SecurityError: storage disabled');
    });
    try {
      render(RangeSwitch);
      await tick();
      // A blocked store is not an error worth breaking a page over — the default just applies.
      expect(screen.getByRole('radio', { name: '7 dni' }).getAttribute('aria-checked')).toBe('true');
      expect(goto).not.toHaveBeenCalled();
    } finally {
      getItem.mockRestore();
    }
  });
});
