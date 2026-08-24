import { describe, it, expect } from 'vitest';
import { isAdvanced, resolveTier, ADVANCED_FEATURE } from './tier';
import type { ConsentService } from './consent/types';

/** Minimal ConsentService fake: only isEnabled matters for the tier. */
function fakeConsent(enabled: Record<string, boolean>): ConsentService {
  return {
    isEnabled: async (id: string) => enabled[id] ?? false,
    listFeatures: async () => [],
    accept: async () => {
      throw new Error('not used');
    },
    revoke: async () => {
      throw new Error('not used');
    }
  };
}

describe('tier', () => {
  it('base when the advanced gate is not accepted', async () => {
    const consent = fakeConsent({});
    expect(await isAdvanced(consent)).toBe(false);
    expect(await resolveTier(consent)).toBe('base');
  });

  it('advanced when the advanced gate is accepted', async () => {
    const consent = fakeConsent({ [ADVANCED_FEATURE]: true });
    expect(await isAdvanced(consent)).toBe(true);
    expect(await resolveTier(consent)).toBe('advanced');
  });

  it('the gate IS the detailed_analytics feature (single gate)', () => {
    expect(ADVANCED_FEATURE).toBe('detailed_analytics');
  });
});
