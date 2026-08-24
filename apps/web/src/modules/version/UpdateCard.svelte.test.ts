import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/svelte';
import UpdateCard from './UpdateCard.svelte';
import type { UpdateStatus } from './version.types';

const base: UpdateStatus = {
  buildTime: __BUILD_TIME__,
  buildSha: 'deadbee',
  state: 'ok',
  latest: {
    sha: 'abcdef1',
    committedAt: '2026-08-15T11:00:00.000Z',
    subject: 'feat: a new thing',
    url: 'https://github.com/owner/repo/commit/abcdef1'
  },
  behind: true,
  checkedAt: '2026-08-15T12:00:00.000Z'
};

/** Stub the endpoint the card calls; returns the spy so tests can assert it was (not) used. */
function stubFetch(status: UpdateStatus | { ok: false }): ReturnType<typeof vi.fn> {
  const spy = vi.fn(async () => ('ok' in status ? new Response('', { status: 500 }) : Response.json(status)));
  vi.stubGlobal('fetch', spy);
  return spy;
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('UpdateCard', () => {
  it('shows the running build before anything is checked, and asks GitHub for nothing', () => {
    const spy = stubFetch(base);
    render(UpdateCard);

    expect(screen.getByText('Wersja')).toBeTruthy();
    expect(document.querySelector('time')?.getAttribute('datetime')).toBe(__BUILD_TIME__);
    // The point of the button: a page view must not spend an API call.
    expect(spy).not.toHaveBeenCalled();
  });

  it('behind: names the newer commit and links to it', async () => {
    stubFetch(base);
    render(UpdateCard);

    await fireEvent.click(screen.getByRole('button', { name: /sprawdź aktualizacje/i }));

    await waitFor(() => expect(screen.getByText('Dostępna nowsza wersja')).toBeTruthy());
    expect(screen.getByText('feat: a new thing')).toBeTruthy();
    expect(screen.getByRole('link').getAttribute('href')).toBe(base.latest!.url);
  });

  it('up to date: says so and offers no next step', async () => {
    stubFetch({ ...base, behind: false });
    render(UpdateCard);

    await fireEvent.click(screen.getByRole('button', { name: /sprawdź aktualizacje/i }));

    await waitFor(() => expect(screen.getByText('Aktualna')).toBeTruthy());
    expect(screen.queryByText('Co dalej')).toBeNull();
  });

  it('not configured: points at the missing token instead of claiming a failure', async () => {
    stubFetch({ ...base, state: 'not-configured', latest: null, behind: false });
    render(UpdateCard);

    await fireEvent.click(screen.getByRole('button', { name: /sprawdź aktualizacje/i }));

    await waitFor(() => expect(screen.getByText('Sprawdzanie nieskonfigurowane')).toBeTruthy());
    expect(screen.getByText('GITHUB_TOKEN')).toBeTruthy();
  });

  it('unreachable: warns without pretending to know the version', async () => {
    stubFetch({ ...base, state: 'unreachable', latest: null, behind: false });
    render(UpdateCard);

    await fireEvent.click(screen.getByRole('button', { name: /sprawdź aktualizacje/i }));

    await waitFor(() => expect(screen.getByText('GitHub nieosiągalny')).toBeTruthy());
  });

  it('endpoint failure: surfaces the error rather than a stale answer', async () => {
    stubFetch({ ok: false });
    render(UpdateCard);

    await fireEvent.click(screen.getByRole('button', { name: /sprawdź aktualizacje/i }));

    await waitFor(() => expect(screen.getByText('Nie udało się sprawdzić')).toBeTruthy());
  });
});
