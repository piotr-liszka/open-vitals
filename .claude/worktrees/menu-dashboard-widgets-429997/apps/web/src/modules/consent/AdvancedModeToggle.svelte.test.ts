import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/svelte';
import AdvancedModeToggle from './AdvancedModeToggle.svelte';
import type { ConsentFeatureView } from './consent.types';

const feature: ConsentFeatureView = {
  id: 'detailed_analytics',
  title: 'Tryb zaawansowany — przetwarzanie danych',
  summary: 'Włącz pulpit, analitykę i wnioski.',
  termsVersion: '1.0',
  termsText: 'Przetwarzamy Twoje dane z Garmina, aby narysować wykresy.',
  requiresConsent: true,
  enabled: false,
  acceptedAt: null
};

function mockFetch(returned: ConsentFeatureView): void {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response(JSON.stringify({ feature: returned }), { status: 200 }))
  );
}

/** Parsed JSON body of the first (and only) POST to /api/consent. */
function postedBody(): Record<string, unknown> {
  const mock = globalThis.fetch as ReturnType<typeof vi.fn>;
  const init = mock.mock.calls[0]?.[1] as RequestInit | undefined;
  return JSON.parse((init?.body as string) ?? '{}');
}

beforeEach(() => vi.restoreAllMocks());
afterEach(cleanup);

describe('AdvancedModeToggle', () => {
  it('off: opening the switch reveals the terms gate before enabling', async () => {
    mockFetch({ ...feature, enabled: true, acceptedAt: '2026-08-07T10:00:00.000Z' });
    const onUpdated = vi.fn();
    render(AdvancedModeToggle, { props: { feature, onUpdated } });

    expect(screen.getByText('Wyłączony')).toBeTruthy();
    // Terms are not shown until the user flips the switch.
    expect(screen.queryByText(/narysować wykresy/i)).toBeNull();

    await fireEvent.click(screen.getByRole('switch'));
    expect(screen.getByText(/narysować wykresy/i)).toBeTruthy();

    await fireEvent.click(screen.getByRole('button', { name: /zaakceptuj i włącz/i }));
    await waitFor(() => expect(onUpdated).toHaveBeenCalled());
    expect(postedBody()).toMatchObject({ featureId: 'detailed_analytics', accept: true });
  });

  it('on: opening the switch asks for confirmation, then revokes', async () => {
    mockFetch({ ...feature, enabled: false });
    const onUpdated = vi.fn();
    render(AdvancedModeToggle, {
      props: { feature: { ...feature, enabled: true, acceptedAt: '2026-08-07T10:00:00.000Z' }, onUpdated }
    });

    expect(screen.getByText('Włączony')).toBeTruthy();

    await fireEvent.click(screen.getByRole('switch'));
    expect(screen.getByText(/Wyłączyć tryb zaawansowany\?/i)).toBeTruthy();

    await fireEvent.click(screen.getByRole('button', { name: /^Wyłącz tryb zaawansowany$/i }));
    await waitFor(() => expect(onUpdated).toHaveBeenCalled());
    expect(postedBody()).toMatchObject({ featureId: 'detailed_analytics', accept: false });
  });

  it('cancel closes the confirm without calling the API', async () => {
    mockFetch(feature);
    render(AdvancedModeToggle, { props: { feature } });
    await fireEvent.click(screen.getByRole('switch'));
    await fireEvent.click(screen.getByRole('button', { name: /anuluj/i }));
    expect(screen.queryByText(/narysować wykresy/i)).toBeNull();
    expect(globalThis.fetch as ReturnType<typeof vi.fn>).not.toHaveBeenCalled();
  });
});
