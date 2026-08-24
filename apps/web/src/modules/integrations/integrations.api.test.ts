import { describe, it, expect, beforeEach } from 'vitest';
import {
  getIntegrationsStatus,
  beginAuth,
  completeAuth,
  runProviderSync,
  disconnect
} from './integrations.api';
import { createStravaMock, STRAVA_MOCK_ACTIVITIES } from '$lib/server/integrations/strava.mock';
import { createWithingsMock } from '$lib/server/integrations/withings.mock';
import {
  createMemoryIntegrationTokenStore,
  createMemoryStravaLinkStore
} from '$lib/server/integrations/stores';
import { IntegrationNotConnectedError, type Integrations } from '$lib/server/integrations/types';
import { createMemoryStore } from '$lib/server/store/memory';
import { fixedClock } from '$lib/server/clock';
import { nullLogger } from '$lib/server/logger';
import { sequenceRandom } from '$lib/server/random';
import type { ActivitySummary } from '$lib/server/store/types';

const clock = fixedClock(new Date('2026-08-08T12:00:00Z'));

function makeDeps(): Integrations {
  return {
    store: createMemoryStore(),
    tokens: createMemoryIntegrationTokenStore(),
    links: createMemoryStravaLinkStore(),
    strava: createStravaMock({ redirectUri: 'http://localhost:3000/api/integrations/strava/callback' }),
    withings: createWithingsMock({ redirectUri: 'http://localhost:3000/api/integrations/withings/callback' }),
    random: sequenceRandom('r'),
    clock,
    logger: nullLogger
  };
}

function garminForFirst(): ActivitySummary {
  const a = STRAVA_MOCK_ACTIVITIES[0]!;
  const startTime = new Date(a.start_date).toISOString();
  return {
    userId: 'u1',
    activityId: `g-${a.id}`,
    sport: a.type.toLowerCase(),
    name: a.name,
    startTime,
    startTimeLocal: startTime.replace('T', ' ').replace('Z', ''),
    distanceM: a.distance,
    durationS: a.elapsed_time,
    movingS: a.moving_time,
    elevationGainM: null,
    avgHr: null,
    maxHr: null,
    avgPower: null,
    maxPower: null,
    normPower: null,
    calories: null,
    trainingLoad: null,
    hasGps: true,
    garminWorkoutId: null,
    raw: {}
  };
}

describe('integrations api', () => {
  let deps: Integrations;
  beforeEach(() => {
    deps = makeDeps();
  });

  it('reports both providers disconnected initially', async () => {
    const status = await getIntegrationsStatus(deps, 'u1');
    expect(status.strava.connected).toBe(false);
    expect(status.withings.connected).toBe(false);
    expect(status.withings.weightCount).toBe(0);
    expect(status.strava.linkedCount).toBe(0);
  });

  it('beginAuth returns a provider URL + a transaction carrying state', async () => {
    const res = await beginAuth(deps, 'strava');
    expect(res.location).toContain('/api/integrations/strava/callback');
    expect(res.location).toContain(`state=${res.transaction.state}`);
    expect(res.transaction.state).toBeTruthy();
    expect(res.transaction.codeVerifier).toBeTruthy();
  });

  it('completeAuth stores tokens on a valid state and reflects in status', async () => {
    const { transaction } = await beginAuth(deps, 'withings');
    const res = await completeAuth(
      deps,
      'withings',
      { code: 'mock-withings-code', state: transaction.state, transaction },
      'u1'
    );
    expect(res.ok).toBe(true);
    const status = await getIntegrationsStatus(deps, 'u1');
    expect(status.withings.connected).toBe(true);
  });

  it('completeAuth rejects a mismatched state without storing tokens', async () => {
    const { transaction } = await beginAuth(deps, 'strava');
    const res = await completeAuth(
      deps,
      'strava',
      { code: 'mock-strava-code', state: 'tampered', transaction },
      'u1'
    );
    expect(res.ok).toBe(false);
    expect(res.error).toBeTruthy();
    expect(await deps.tokens.get('u1', 'strava')).toBeNull();
  });

  it('completeAuth fails cleanly on a missing transaction', async () => {
    const res = await completeAuth(deps, 'strava', { code: 'x', state: 's', transaction: null }, 'u1');
    expect(res.ok).toBe(false);
  });

  it('runProviderSync(withings) imports weight after connecting', async () => {
    const { transaction } = await beginAuth(deps, 'withings');
    await completeAuth(
      deps,
      'withings',
      { code: 'mock-withings-code', state: transaction.state, transaction },
      'u1'
    );
    const res = await runProviderSync(deps, 'withings', 'u1');
    expect(res.provider).toBe('withings');
    if (res.provider === 'withings') expect(res.imported).toBe(10);
    const status = await getIntegrationsStatus(deps, 'u1');
    expect(status.withings.weightCount).toBe(10);
  });

  it('runProviderSync(strava) links matching activities after connecting', async () => {
    await deps.store.putActivities('u1', [garminForFirst()]);
    const { transaction } = await beginAuth(deps, 'strava');
    await completeAuth(
      deps,
      'strava',
      { code: 'mock-strava-code', state: transaction.state, transaction },
      'u1'
    );
    const res = await runProviderSync(deps, 'strava', 'u1');
    expect(res.provider).toBe('strava');
    if (res.provider === 'strava') {
      expect(res.scanned).toBe(3);
      expect(res.matched).toBe(1);
    }
    const status = await getIntegrationsStatus(deps, 'u1');
    expect(status.strava.linkedCount).toBe(1);
  });

  it('runProviderSync throws when the provider is not connected', async () => {
    await expect(runProviderSync(deps, 'withings', 'u1')).rejects.toBeInstanceOf(
      IntegrationNotConnectedError
    );
  });

  it('disconnect clears tokens + links', async () => {
    const { transaction } = await beginAuth(deps, 'strava');
    await completeAuth(
      deps,
      'strava',
      { code: 'mock-strava-code', state: transaction.state, transaction },
      'u1'
    );
    await deps.store.putActivities('u1', [garminForFirst()]);
    await runProviderSync(deps, 'strava', 'u1');

    await disconnect(deps, 'strava', 'u1');
    const status = await getIntegrationsStatus(deps, 'u1');
    expect(status.strava.connected).toBe(false);
    expect(status.strava.linkedCount).toBe(0);
    expect(await deps.tokens.get('u1', 'strava')).toBeNull();
  });
});
