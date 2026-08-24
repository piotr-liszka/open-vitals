/**
 * The language switch (spec 076) — the one control the whole feature is reached through.
 *
 * Asserts the CONTRACT a reader depends on, not the markup: both languages offered, the active one
 * marked for assistive tech, the choice sent to the server, and — the part that is easy to get
 * wrong — no request at all when the reader picks the language they are already in.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, fireEvent, cleanup } from '@testing-library/svelte';
import LangSwitch from './LangSwitch.svelte';

const invalidateAll = vi.fn();
vi.mock('$app/navigation', () => ({ invalidateAll: () => invalidateAll() }));

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  invalidateAll.mockClear();
  fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ locale: 'en' }) });
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function segments(container: HTMLElement): HTMLButtonElement[] {
  return [...container.querySelectorAll('button[role="radio"]')] as HTMLButtonElement[];
}

describe('LangSwitch', () => {
  it('offers both languages, labelled as the reader sees them', () => {
    const { container } = render(LangSwitch);
    expect(segments(container).map((b) => b.textContent?.trim())).toEqual(['PL', 'EN']);
  });

  it('marks the active language for assistive tech', () => {
    // No i18n context in an isolated mount, so the fallback (Polish) is active.
    const { container } = render(LangSwitch);
    const [pl, en] = segments(container);
    expect(pl!.getAttribute('aria-checked')).toBe('true');
    expect(en!.getAttribute('aria-checked')).toBe('false');
  });

  it('persists the choice, then re-renders from the server', async () => {
    const { container } = render(LangSwitch);
    await fireEvent.click(segments(container)[1]!);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('/api/settings/locale');
    expect(init).toMatchObject({ method: 'PUT' });
    expect(JSON.parse(init.body as string)).toEqual({ locale: 'en' });

    // The SERVER re-renders the page: swapping strings client-side would leave `<html lang>`,
    // server-formatted numbers and anything computed in a loader speaking the old language.
    expect(invalidateAll).toHaveBeenCalledTimes(1);
  });

  it('does nothing when the active language is re-selected', async () => {
    const { container } = render(LangSwitch);
    await fireEvent.click(segments(container)[0]!);

    expect(fetchMock).not.toHaveBeenCalled();
    expect(invalidateAll).not.toHaveBeenCalled();
  });

  it('names the group, so the two-letter codes are not the only context', () => {
    const { container } = render(LangSwitch);
    const group = container.querySelector('[role="radiogroup"]');
    expect(group?.getAttribute('aria-label')).toBe('Język');
  });
});
