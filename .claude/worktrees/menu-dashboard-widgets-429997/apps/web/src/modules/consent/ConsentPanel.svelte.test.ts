import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import ConsentPanel from './ConsentPanel.svelte';
import type { ConsentFeatureView } from './consent.types';

const base: ConsentFeatureView = {
  id: 'detailed_analytics',
  title: 'Detailed analytics',
  summary: 'Show multi-day trends.',
  termsVersion: '1.0',
  termsText: 'We fetch a range of daily metrics to draw charts.',
  requiresConsent: true,
  enabled: false,
  acceptedAt: null
};

describe('ConsentPanel', () => {
  it('needs-consent: shows Accept and can reveal the terms text', async () => {
    render(ConsentPanel, { props: { feature: base } });
    expect(screen.getByText('Wymaga zgody')).toBeTruthy();
    expect(screen.getByRole('button', { name: /zaakceptuj/i })).toBeTruthy();
    // Terms hidden until disclosed.
    expect(screen.queryByText(/range of daily metrics/i)).toBeNull();
    await fireEvent.click(screen.getByRole('button', { name: /pokaż warunki/i }));
    expect(screen.getByText(/range of daily metrics/i)).toBeTruthy();
  });

  it('granted: shows Revoke and a consented badge', () => {
    render(ConsentPanel, {
      props: { feature: { ...base, enabled: true, acceptedAt: '2026-08-07T10:00:00.000Z' } }
    });
    expect(screen.getByText('Zaakceptowano')).toBeTruthy();
    expect(screen.getByRole('button', { name: /wycofaj/i })).toBeTruthy();
  });

  it('consent-free feature shows an on-by-default badge and no action', () => {
    render(ConsentPanel, {
      props: { feature: { ...base, id: 'mcp', requiresConsent: false, enabled: true } }
    });
    expect(screen.getByText('Domyślnie włączone')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /wycofaj|zaakceptuj/i })).toBeNull();
  });
});
