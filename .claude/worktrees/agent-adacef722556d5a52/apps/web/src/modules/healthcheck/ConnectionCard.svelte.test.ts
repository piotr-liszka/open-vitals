import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/svelte';
import ConnectionCard from './ConnectionCard.svelte';
import type { HealthStatus } from './health.types';

const connected: HealthStatus = {
  connected: true,
  displayName: 'Ala Biegaczka',
  expiresAt: '2026-08-12T09:30:00.000Z',
  reachable: true
};

afterEach(cleanup);

describe('ConnectionCard', () => {
  it('connected: one card carries status, account and session validity', () => {
    render(ConnectionCard, { props: { status: connected } });

    expect(screen.getByText('Garmin')).toBeTruthy();
    expect(screen.getByText('Połączono')).toBeTruthy();
    expect(screen.getByText('Ala Biegaczka')).toBeTruthy();
    expect(screen.getByText('Sesja ważna do')).toBeTruthy();
  });

  it('not connected: shows the neutral state and no disconnect action', () => {
    render(ConnectionCard, {
      props: {
        status: { connected: false, displayName: null, expiresAt: null, reachable: true },
        onDisconnect: vi.fn()
      }
    });

    expect(screen.getByText('Nie połączono')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /rozłącz/i })).toBeNull();
  });

  it('unreachable: warns and explains, whatever the token state', () => {
    render(ConnectionCard, { props: { status: { ...connected, reachable: false } } });

    expect(screen.getByText('Niedostępny')).toBeTruthy();
    expect(screen.getByText(/Nie udało się połączyć z usługą Garmin/i)).toBeTruthy();
  });

  it('refresh: renders the button only when a handler is given, and calls it', async () => {
    const onRefresh = vi.fn();
    const { unmount } = render(ConnectionCard, { props: { status: connected } });
    expect(screen.queryByRole('button', { name: /odśwież/i })).toBeNull();
    unmount();

    render(ConnectionCard, { props: { status: connected, onRefresh } });
    await fireEvent.click(screen.getByRole('button', { name: /odśwież/i }));
    expect(onRefresh).toHaveBeenCalledOnce();
  });

  it('disconnect: asks for confirmation before calling the handler', async () => {
    const onDisconnect = vi.fn();
    render(ConnectionCard, { props: { status: connected, onDisconnect } });

    await fireEvent.click(screen.getByRole('button', { name: /rozłącz garmina/i }));
    expect(screen.getByText(/Rozłączyć i usunąć zapisane tokeny\?/i)).toBeTruthy();
    expect(onDisconnect).not.toHaveBeenCalled();

    await fireEvent.click(screen.getByRole('button', { name: /^Rozłącz$/ }));
    expect(onDisconnect).toHaveBeenCalledOnce();
  });

  it('disconnect: cancel closes the confirmation without calling the handler', async () => {
    const onDisconnect = vi.fn();
    render(ConnectionCard, { props: { status: connected, onDisconnect } });

    await fireEvent.click(screen.getByRole('button', { name: /rozłącz garmina/i }));
    await fireEvent.click(screen.getByRole('button', { name: /anuluj/i }));

    expect(screen.queryByText(/Rozłączyć i usunąć zapisane tokeny\?/i)).toBeNull();
    expect(onDisconnect).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: /rozłącz garmina/i })).toBeTruthy();
  });
});
