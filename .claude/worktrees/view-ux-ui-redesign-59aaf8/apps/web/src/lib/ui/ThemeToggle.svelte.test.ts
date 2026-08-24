import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, fireEvent, cleanup } from '@testing-library/svelte';
import ThemeToggle from './ThemeToggle.svelte';

beforeEach(() => {
  document.documentElement.dataset.theme = 'light';
  localStorage.clear();
});

afterEach(cleanup);

function getToggle(container: HTMLElement): HTMLButtonElement {
  const el = container.querySelector('button[role="switch"]');
  if (!el) throw new Error('toggle not rendered');
  return el as HTMLButtonElement;
}

describe('ThemeToggle', () => {
  it('reflects the current light theme on mount', () => {
    const { container } = render(ThemeToggle);
    expect(getToggle(container).getAttribute('aria-checked')).toBe('false');
  });

  it('toggles to dark and persists it', async () => {
    const { container } = render(ThemeToggle);
    await fireEvent.click(getToggle(container));

    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(localStorage.getItem('gb-theme')).toBe('dark');
    expect(getToggle(container).getAttribute('aria-checked')).toBe('true');
  });

  it('toggles back to light on a second click', async () => {
    const { container } = render(ThemeToggle);
    const btn = getToggle(container);
    await fireEvent.click(btn);
    await fireEvent.click(btn);

    expect(document.documentElement.dataset.theme).toBe('light');
    expect(localStorage.getItem('gb-theme')).toBe('light');
  });
});
