import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/svelte';
import FeatureSwitch from './FeatureSwitch.svelte';
import type { FeatureView } from './features.types';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const feature = (over: Partial<FeatureView> = {}): FeatureView => ({
  id: 'mcp',
  titleKey: 'features.mcp.title',
  summaryKey: 'features.mcp.summary',
  integration: 'mcp',
  enabled: true,
  defaultEnabled: true,
  ...over
});

/** Stub `fetch` with a scripted response and record what was posted. */
function stubFetch(response: { ok: boolean; body: unknown }) {
  const calls: Array<{ url: string; body: unknown }> = [];
  vi.stubGlobal('fetch', async (url: string, init: RequestInit) => {
    calls.push({ url, body: JSON.parse(String(init.body)) });
    return { ok: response.ok, json: async () => response.body } as Response;
  });
  return calls;
}

describe('FeatureSwitch', () => {
  it('labels the switch with the feature title and shows its summary', () => {
    render(FeatureSwitch, { props: { feature: feature() } });

    expect(screen.getByText('Serwer MCP')).toBeTruthy();
    expect(screen.getByText(/Udostępniaj swoje dane klientom AI/)).toBeTruthy();
    expect(screen.getByRole('switch').getAttribute('aria-checked')).toBe('true');
  });

  it('posts the requested position and reports the server’s answer back', async () => {
    const f = feature();
    const calls = stubFetch({ ok: true, body: { feature: { ...f, enabled: false } } });
    const onUpdated = vi.fn();
    render(FeatureSwitch, { props: { feature: f, onUpdated } });

    await fireEvent.click(screen.getByRole('switch'));

    await waitFor(() => expect(onUpdated).toHaveBeenCalled());
    expect(calls).toEqual([{ url: '/api/features', body: { featureId: 'mcp', enabled: false } }]);
    expect(onUpdated.mock.calls[0]![0]).toMatchObject({ id: 'mcp', enabled: false });
  });

  it('flips optimistically, so the switch moves under the finger', async () => {
    // Never resolves: the point is what the UI shows WHILE the write is in flight.
    vi.stubGlobal('fetch', () => new Promise<Response>(() => {}));
    render(FeatureSwitch, { props: { feature: feature() } });

    await fireEvent.click(screen.getByRole('switch'));

    const el = screen.getByRole('switch');
    expect(el.getAttribute('aria-checked')).toBe('false');
    expect(el.getAttribute('aria-busy')).toBe('true');
  });

  it('rolls back to the real state when the write is refused', async () => {
    stubFetch({ ok: false, body: { error: 'Nieznana funkcja.' } });
    const onUpdated = vi.fn();
    render(FeatureSwitch, { props: { feature: feature(), onUpdated } });

    await fireEvent.click(screen.getByRole('switch'));

    await waitFor(() => expect(screen.getByRole('switch').getAttribute('aria-checked')).toBe('true'));
    expect(onUpdated).not.toHaveBeenCalled();
  });

  it('rolls back when the server cannot be reached at all', async () => {
    vi.stubGlobal('fetch', async () => {
      throw new Error('offline');
    });
    render(FeatureSwitch, { props: { feature: feature() } });

    await fireEvent.click(screen.getByRole('switch'));

    await waitFor(() => expect(screen.getByRole('switch').getAttribute('aria-checked')).toBe('true'));
  });
});
