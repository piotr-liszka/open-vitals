import { describe, it, expect } from 'vitest';
import { fixedClock } from '../clock';
import { createMemoryConsentStore } from './store';
import { createConsentService } from './service';
import { TermsVersionMismatchError, UnknownFeatureError, type Feature } from './types';

const clock = fixedClock(new Date('2026-08-07T10:00:00.000Z'));

const FEATURES: Feature[] = [
  {
    id: 'mcp',
    title: 'MCP',
    summary: 's',
    termsVersion: '1.0',
    termsText: 't',
    requiresConsent: false,
    defaultEnabled: true
  },
  {
    id: 'detailed_analytics',
    title: 'Analytics',
    summary: 's',
    termsVersion: '1.0',
    termsText: 't',
    requiresConsent: true,
    defaultEnabled: false
  }
];

const USER = 'user-1';

function make(seed: Record<string, unknown> = {}) {
  const store = createMemoryConsentStore(clock, { [USER]: seed as never });
  return { store, service: createConsentService({ store, userId: USER, features: FEATURES }) };
}

describe('ConsentService', () => {
  it('consent-free features are enabled by default', async () => {
    const { service } = make();
    expect(await service.isEnabled('mcp')).toBe(true);
  });

  it('consent-required features are disabled until accepted', async () => {
    const { service } = make();
    expect(await service.isEnabled('detailed_analytics')).toBe(false);
  });

  it('accepting the current version enables it and records acceptedAt from the clock', async () => {
    const { service } = make();
    const feature = await service.accept('detailed_analytics', '1.0');
    expect(feature.enabled).toBe(true);
    expect(feature.acceptedAt).toBe('2026-08-07T10:00:00.000Z');
    expect(await service.isEnabled('detailed_analytics')).toBe(true);
  });

  it('a terms-version bump re-prompts (a stale acceptance no longer enables)', async () => {
    // A record accepted at the old version, but the registry now requires a new version.
    const bumped: Feature[] = FEATURES.map((f) =>
      f.id === 'detailed_analytics' ? { ...f, termsVersion: '2.0' } : f
    );
    const store = createMemoryConsentStore(clock, {
      [USER]: { detailed_analytics: { termsVersion: '1.0', acceptedAt: '2026-01-01T00:00:00.000Z' } }
    });
    const service = createConsentService({ store, userId: USER, features: bumped });
    expect(await service.isEnabled('detailed_analytics')).toBe(false);
  });

  it('rejects accepting a mismatched terms version', async () => {
    const { service } = make();
    await expect(service.accept('detailed_analytics', '0.9')).rejects.toBeInstanceOf(
      TermsVersionMismatchError
    );
  });

  it('revoke disables a previously accepted feature', async () => {
    const { service } = make();
    await service.accept('detailed_analytics', '1.0');
    const revoked = await service.revoke('detailed_analytics');
    expect(revoked.enabled).toBe(false);
    expect(await service.isEnabled('detailed_analytics')).toBe(false);
  });

  it('throws on unknown feature ids', async () => {
    const { service } = make();
    await expect(service.isEnabled('nope')).rejects.toBeInstanceOf(UnknownFeatureError);
  });

  it('listFeatures resolves enabled + acceptedAt for each feature', async () => {
    const { service } = make();
    await service.accept('detailed_analytics', '1.0');
    const list = await service.listFeatures();
    expect(list.find((f) => f.id === 'mcp')?.enabled).toBe(true);
    const analytics = list.find((f) => f.id === 'detailed_analytics');
    expect(analytics?.enabled).toBe(true);
    expect(analytics?.acceptedAt).toBe('2026-08-07T10:00:00.000Z');
  });
});
