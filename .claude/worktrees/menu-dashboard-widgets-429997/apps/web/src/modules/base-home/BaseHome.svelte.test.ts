import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/svelte';
import BaseHome from './BaseHome.svelte';
import type { HealthStatus } from '$modules/healthcheck/health.types';
import type { ConsentFeatureView } from '$modules/consent/consent.types';

const advancedFeature: ConsentFeatureView = {
  id: 'detailed_analytics',
  title: 'Tryb zaawansowany — przetwarzanie danych',
  summary: 'Włącz pulpit, analitykę i wnioski.',
  termsVersion: '1.0',
  termsText: 'Przetwarzamy Twoje dane z Garmina, aby narysować wykresy.',
  requiresConsent: true,
  enabled: false,
  acceptedAt: null
};

const connected: HealthStatus = {
  connected: true,
  displayName: 'Ala Biegaczka',
  expiresAt: '2026-08-12T09:30:00.000Z',
  reachable: true
};

afterEach(cleanup);

describe('BaseHome (spec 021 — no configuration on the start page)', () => {
  it('connected: renders no MCP address, only a pointer to Settings', () => {
    render(BaseHome, { props: { health: connected, advancedFeature } });

    // The MCP URL is a secret; it must not appear on the start page any more.
    expect(screen.queryByLabelText('Adres MCP')).toBeNull();
    expect(screen.queryByRole('button', { name: /kopiuj/i })).toBeNull();
    expect(screen.queryByText('Twój adres MCP')).toBeNull();
    // Nor the connection panel that used to sit next to it.
    expect(screen.queryByText('Połączenie z Garmin')).toBeNull();
    expect(screen.queryByRole('button', { name: /odśwież/i })).toBeNull();

    const link = screen.getByRole('link', { name: /otwórz ustawienia/i });
    expect(link.getAttribute('href')).toBe('/settings');
  });

  it('connected: still invites the upgrade to the Advanced tier', () => {
    render(BaseHome, { props: { health: connected, advancedFeature } });
    expect(screen.getByText('Odblokuj tryb zaawansowany')).toBeTruthy();
  });

  it('not connected: keeps the connect form so a fresh user is never stuck', () => {
    render(BaseHome, {
      props: {
        health: { connected: false, displayName: null, expiresAt: null, reachable: true },
        advancedFeature
      }
    });

    expect(screen.getByText('Podłącz Garmina i gotowe')).toBeTruthy();
    expect(screen.getByRole('button', { name: /połącz garmina/i })).toBeTruthy();
    expect(screen.queryByText('Twój adres MCP')).toBeNull();
  });
});
