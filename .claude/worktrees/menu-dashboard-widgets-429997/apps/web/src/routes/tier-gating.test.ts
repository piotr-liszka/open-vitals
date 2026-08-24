/**
 * Authz boundary (spec 014): the Advanced-only pages redirect Base users to the upgrade home,
 * so a Base user can never land on an empty processed screen. We assert the loaders throw a
 * SvelteKit redirect(303, '/') BEFORE any Garmin/data work happens.
 */
import { describe, it, expect } from 'vitest';
import type { ConsentService } from '$lib/server/consent/types';
import { load as loadInsights } from './insights/+page.server';
import { load as loadTrainingSection } from './training/+layout.server';
import { load as loadActivities } from './activities/+page.server';
import { load as loadActivitiesMap } from './activities/mapa/+page.server';

function baseConsent(): ConsentService {
  return {
    isEnabled: async () => false, // Base: advanced gate not accepted
    listFeatures: async () => [],
    accept: async () => {
      throw new Error('unused');
    },
    revoke: async () => {
      throw new Error('unused');
    }
  };
}

// A locals stub good enough to reach the isAdvanced() guard. Garmin is a throwing proxy so any
// attempt to actually fetch data (which must NOT happen for a Base user) fails loudly.
function baseLocals() {
  const garmin = new Proxy(
    {},
    {
      get() {
        throw new Error('Garmin must not be touched for a Base user');
      }
    }
  );
  return {
    consent: baseConsent(),
    garmin,
    container: { clock: { now: () => new Date('2026-08-07T00:00:00Z') } }
  } as never;
}

async function expectRedirect(load: (event: unknown) => Promise<unknown>, url = 'http://x/'): Promise<void> {
  let thrown: { status?: number; location?: string } | undefined;
  try {
    await load({ locals: baseLocals(), url: new URL(url) });
  } catch (e) {
    thrown = e as { status?: number; location?: string };
  }
  expect(thrown).toBeDefined();
  expect(thrown!.status).toBe(303);
  expect(thrown!.location).toBe('/');
}

describe('Advanced-only page gating', () => {
  it('redirects a Base user away from /insights', async () => {
    await expectRedirect(loadInsights as never, 'http://x/insights?window=30');
  });

  it('redirects a Base user away from /activities', async () => {
    await expectRedirect(loadActivities as never, 'http://x/activities');
  });

  // The map is a tab of the activities section now (spec 048) rather than a top-level page, so its
  // own guard has to be asserted separately — a section here is two sibling pages, not one layout.
  it('redirects a Base user away from the activities map', async () => {
    await expectRedirect(loadActivitiesMap as never, 'http://x/activities/mapa');
  });

  // One layout gate covers /training AND every sport subpage under it (spec 025), so a new tab
  // can never ship without the guard.
  it('redirects a Base user away from the whole /training section', async () => {
    await expectRedirect(loadTrainingSection as never, 'http://x/training/rower');
  });
});
