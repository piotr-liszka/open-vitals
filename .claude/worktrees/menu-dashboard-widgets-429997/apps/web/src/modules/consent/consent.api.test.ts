import { describe, it, expect } from 'vitest';
import { createTestContainer } from '$lib/server/container';
import { fixedClock } from '$lib/server/clock';
import { listConsent, postConsent } from './consent.api';

const clock = fixedClock(new Date('2026-08-07T10:00:00.000Z'));

/** A ConsentService scoped to one user over the container's shared in-memory store. */
function consentFor(userId = 'user-1') {
  return createTestContainer({ clock }).consentFor(userId);
}

describe('consent API', () => {
  it('GET lists the registry features with status', async () => {
    const { features } = await listConsent(consentFor());
    const ids = features.map((f) => f.id);
    expect(ids).toContain('mcp');
    expect(ids).toContain('detailed_analytics');
    expect(features.find((f) => f.id === 'mcp')?.enabled).toBe(true);
    expect(features.find((f) => f.id === 'detailed_analytics')?.enabled).toBe(false);
  });

  it('POST accept enables detailed_analytics and returns acceptedAt', async () => {
    const c = consentFor();
    const res = await postConsent(c, { featureId: 'detailed_analytics', termsVersion: '1.0', accept: true });
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.body.feature.enabled).toBe(true);
      expect(res.body.feature.acceptedAt).toBe('2026-08-07T10:00:00.000Z');
    }
  });

  it('POST with a stale terms version → 409', async () => {
    const res = await postConsent(consentFor(), {
      featureId: 'detailed_analytics',
      termsVersion: '0.9',
      accept: true
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.status).toBe(409);
  });

  it('POST unknown feature → 400', async () => {
    const res = await postConsent(consentFor(), { featureId: 'nope', termsVersion: '1.0', accept: true });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.status).toBe(400);
  });

  it('POST malformed body → 400', async () => {
    const res = await postConsent(consentFor(), { featureId: 'detailed_analytics' });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.status).toBe(400);
  });

  it('POST accept:false revokes', async () => {
    const c = consentFor();
    await postConsent(c, { featureId: 'detailed_analytics', termsVersion: '1.0', accept: true });
    const res = await postConsent(c, { featureId: 'detailed_analytics', termsVersion: '1.0', accept: false });
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.body.feature.enabled).toBe(false);
  });

  it('consent is isolated per user: A accepting does not enable it for B', async () => {
    const container = createTestContainer({ clock });
    const alice = container.consentFor('alice');
    const bob = container.consentFor('bob');
    await postConsent(alice, { featureId: 'detailed_analytics', termsVersion: '1.0', accept: true });

    const aliceView = await listConsent(alice);
    const bobView = await listConsent(bob);
    expect(aliceView.features.find((f) => f.id === 'detailed_analytics')?.enabled).toBe(true);
    expect(bobView.features.find((f) => f.id === 'detailed_analytics')?.enabled).toBe(false);
  });
});
