import { describe, it, expect } from 'vitest';
import { getHealth } from './health.api';
import { createGarminMock } from '$lib/server/garmin/mock-adapter';
import { GarminUnavailableError, type GarminService } from '$lib/server/interfaces';

describe('getHealth', () => {
  it('reports connected when Garmin is authenticated', async () => {
    const garmin = createGarminMock({ status: { authenticated: true, displayName: 'Ada' } });
    const res = await getHealth(garmin);
    expect(res).toMatchObject({ connected: true, displayName: 'Ada', reachable: true });
  });

  it('reports not-connected when unauthenticated', async () => {
    const garmin = createGarminMock({ status: { authenticated: false } });
    const res = await getHealth(garmin);
    expect(res.connected).toBe(false);
    expect(res.reachable).toBe(true);
  });

  it('reports unreachable when the sidecar is down', async () => {
    const garmin: GarminService = {
      ...createGarminMock(),
      getStatus: async () => {
        throw new GarminUnavailableError();
      }
    };
    const res = await getHealth(garmin);
    expect(res).toMatchObject({ connected: false, reachable: false });
  });
});
