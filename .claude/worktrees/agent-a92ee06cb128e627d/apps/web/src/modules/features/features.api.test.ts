/** API-integration tests for the feature-switch handlers (spec 071), over the in-memory store. */
import { describe, it, expect } from 'vitest';
import { createFeatureService } from '$lib/server/features/service';
import { createMemoryFeatureStore } from '$lib/server/features/store';
import type { FeatureStore } from '$lib/server/features/types';
import { listFeatures, postFeature } from './features.api';

const USER = 'u1';
const svc = (store: FeatureStore) => createFeatureService({ store, userId: USER });

describe('GET /api/features', () => {
  it('returns every switch with its integration and resolved state', async () => {
    const body = await listFeatures(svc(createMemoryFeatureStore()));
    expect(body.features.map((f) => f.id)).toEqual([
      'auto_sync',
      'workout_write',
      'workout_auto_push',
      'mcp'
    ]);
    expect(body.features.every((f) => f.enabled)).toBe(true);
    expect(body.features.map((f) => f.integration)).toEqual(['garmin', 'garmin', 'garmin', 'mcp']);
    // The view is the contract: no terms text, no version, nothing left over from consent.
    expect(Object.keys(body.features[0]!).sort()).toEqual([
      'defaultEnabled',
      'enabled',
      'id',
      'integration',
      'summary',
      'title'
    ]);
  });
});

describe('POST /api/features', () => {
  it('flips a switch off and reports the resolved state back', async () => {
    const store = createMemoryFeatureStore();
    const res = await postFeature(svc(store), { featureId: 'mcp', enabled: false });

    expect(res.ok).toBe(true);
    expect(res.ok && res.body.feature).toMatchObject({ id: 'mcp', enabled: false });
    expect(await svc(store).isEnabled('mcp')).toBe(false);
  });

  it('flips it back on again', async () => {
    const store = createMemoryFeatureStore();
    await postFeature(svc(store), { featureId: 'mcp', enabled: false });
    const res = await postFeature(svc(store), { featureId: 'mcp', enabled: true });

    expect(res.ok && res.body.feature.enabled).toBe(true);
  });

  it('400s on an unknown feature id', async () => {
    const res = await postFeature(svc(createMemoryFeatureStore()), {
      featureId: 'detailed_analytics', // the dead consent gate — must not resurrect as a switch
      enabled: true
    });
    expect(res).toMatchObject({ ok: false, status: 400 });
  });

  it('400s on a malformed body rather than guessing', async () => {
    for (const body of [null, {}, { featureId: 'mcp' }, { featureId: 'mcp', enabled: 'yes' }]) {
      const res = await postFeature(svc(createMemoryFeatureStore()), body);
      expect(res, JSON.stringify(body)).toMatchObject({ ok: false, status: 400 });
    }
  });
});
