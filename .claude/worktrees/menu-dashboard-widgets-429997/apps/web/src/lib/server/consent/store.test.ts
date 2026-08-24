import { describe, it, expect } from 'vitest';
import { fixedClock } from '../clock';
import { createMemoryConsentStore } from './store';

const clock = fixedClock(new Date('2026-08-07T10:00:00.000Z'));

describe('in-memory ConsentStore (per-user)', () => {
  it('round-trips a record with acceptedAt from the clock', async () => {
    const store = createMemoryConsentStore(clock);
    await store.set('user-1', 'detailed_analytics', '1.0');
    expect(await store.get('user-1')).toEqual({
      detailed_analytics: { termsVersion: '1.0', acceptedAt: '2026-08-07T10:00:00.000Z' }
    });
  });

  it('revoke removes a record', async () => {
    const store = createMemoryConsentStore(clock, {
      'user-1': { detailed_analytics: { termsVersion: '1.0', acceptedAt: 'x' } }
    });
    await store.revoke('user-1', 'detailed_analytics');
    expect(await store.get('user-1')).toEqual({});
  });

  it('keeps each user’s records isolated', async () => {
    const store = createMemoryConsentStore(clock);
    await store.set('alice', 'detailed_analytics', '1.0');
    expect(await store.get('alice')).toHaveProperty('detailed_analytics');
    expect(await store.get('bob')).toEqual({});
  });

  it('returns no records for an unknown user', async () => {
    const store = createMemoryConsentStore(clock);
    expect(await store.get('nobody')).toEqual({});
  });
});
