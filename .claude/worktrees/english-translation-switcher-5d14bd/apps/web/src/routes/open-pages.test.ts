/**
 * Spec 071: there is no Advanced tier any more, so none of these loaders may gate. This is the
 * inverse of the old `tier-gating.test.ts`, and it exists for the same reason that one did — the
 * gate used to be four independent `if`s in four files, and a fifth page could always be added
 * without one. Now the invariant is "no page redirects on a feature switch", and it is asserted
 * once, here, so re-introducing a gate breaks a test rather than quietly splitting the app in two.
 */
import { describe, it, expect } from 'vitest';
import { createGarminMock } from '$lib/server/garmin/mock-adapter';
import { createMemoryStore } from '$lib/server/store/memory';
import { createMemoryRepo } from '$lib/server/repo/memory';
import { systemRandom } from '$lib/server/random';
import { DEFAULT_TIME_ZONE } from '$lib/date';
import { load as loadInsights } from './insights/+page.server';
import { load as loadTrainingSection } from './training/+layout.server';
import { load as loadActivities } from './activities/+page.server';
import { load as loadActivitiesMap } from './activities/map/+page.server';
import { load as loadDashboardNav } from './+layout.server';

const USER = 'user-1';

function locals() {
  const clock = { now: () => new Date('2026-08-07T00:00:00Z') };
  return {
    user: { id: USER },
    garmin: createGarminMock({ status: { authenticated: true, displayName: 'Ada' } }),
    // A switch service that says NO to everything: if any loader still consults one, this makes it
    // gate, and the assertion below catches it.
    features: {
      list: async () => [],
      isEnabled: async () => false,
      setEnabled: async () => {
        throw new Error('unused');
      }
    },
    container: {
      clock,
      config: { appTimeZone: DEFAULT_TIME_ZONE },
      store: createMemoryStore(),
      repo: createMemoryRepo({ random: systemRandom })
    }
  } as never;
}

async function loadsWithoutRedirect(load: (event: unknown) => Promise<unknown>, url: string): Promise<void> {
  const data = await load({ locals: locals(), url: new URL(url), params: {} });
  expect(data).toBeDefined();
}

describe('no page gates on a feature switch (spec 071)', () => {
  it('/insights loads', async () => {
    await loadsWithoutRedirect(loadInsights as never, 'http://x/insights');
  });

  it('/activities loads', async () => {
    await loadsWithoutRedirect(loadActivities as never, 'http://x/activities');
  });

  it('the activities map loads', async () => {
    await loadsWithoutRedirect(loadActivitiesMap as never, 'http://x/activities/map');
  });

  it('the whole /training section loads', async () => {
    await loadsWithoutRedirect(loadTrainingSection as never, 'http://x/training/ride');
  });

  it('the sidebar dashboards group is populated for every signed-in user', async () => {
    const data = (await loadDashboardNav({ locals: locals() } as never)) as {
      dashboardNav: unknown[];
    };
    // The default config always yields at least the "new dashboard" entry — the point is that it is
    // no longer an empty array behind a tier check.
    expect(data.dashboardNav.length).toBeGreaterThan(0);
  });
});
