import { describe, it, expect, beforeEach } from 'vitest';
import { syncWithingsWeight, linkStravaActivities } from './sync';
import { createStravaMock, STRAVA_MOCK_ACTIVITIES } from './strava.mock';
import { createWithingsMock } from './withings.mock';
import { createMemoryIntegrationTokenStore, createMemoryStravaLinkStore } from './stores';
import { IntegrationNotConnectedError, type Integrations, type OAuthTokens } from './types';
import { createMemoryStore } from '../store/memory';
import { fixedClock } from '../clock';
import { nullLogger } from '../logger';
import { sequenceRandom } from '../random';
import type { ActivitySummary } from '../store/types';

const clock = fixedClock(new Date('2026-08-08T12:00:00Z'));
const TOKENS: OAuthTokens = {
  accessToken: 'a',
  refreshToken: null,
  expiresAt: null,
  scope: null,
  providerUserId: 'p1'
};

function garminFor(a: (typeof STRAVA_MOCK_ACTIVITIES)[number]): ActivitySummary {
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

function makeDeps(): Integrations {
  return {
    store: createMemoryStore(),
    tokens: createMemoryIntegrationTokenStore(),
    links: createMemoryStravaLinkStore(),
    strava: createStravaMock(),
    withings: createWithingsMock(),
    random: sequenceRandom('r'),
    clock,
    logger: nullLogger
  };
}

describe('syncWithingsWeight', () => {
  let deps: Integrations;
  beforeEach(() => {
    deps = makeDeps();
  });

  it('throws when Withings is not connected', async () => {
    await expect(syncWithingsWeight(deps, 'u1')).rejects.toBeInstanceOf(IntegrationNotConnectedError);
  });

  it('imports the weekly series into the store as source=withings', async () => {
    await deps.tokens.set('u1', 'withings', TOKENS);
    const res = await syncWithingsWeight(deps, 'u1');
    expect(res.imported).toBe(10);
    expect(res.firstDay).toBe('2026-06-01');

    const stored = await deps.store.getWeightRange('u1', '2026-01-01', '2026-12-31');
    expect(stored).toHaveLength(10);
    expect(stored.every((p) => p.source === 'withings')).toBe(true);
    expect(stored[0]!.weightKg).toBeCloseTo(82.5, 3);
  });

  it('is idempotent — re-running does not duplicate weigh-ins', async () => {
    await deps.tokens.set('u1', 'withings', TOKENS);
    await syncWithingsWeight(deps, 'u1');
    await syncWithingsWeight(deps, 'u1');
    const stored = await deps.store.getWeightRange('u1', '2026-01-01', '2026-12-31');
    expect(stored).toHaveLength(10);
  });

  it('isolates users', async () => {
    await deps.tokens.set('u1', 'withings', TOKENS);
    await syncWithingsWeight(deps, 'u1');
    const other = await deps.store.getWeightRange('u2', '2026-01-01', '2026-12-31');
    expect(other).toHaveLength(0);
  });
});

describe('linkStravaActivities', () => {
  let deps: Integrations;
  beforeEach(() => {
    deps = makeDeps();
  });

  it('throws when Strava is not connected', async () => {
    await expect(linkStravaActivities(deps, 'u1')).rejects.toBeInstanceOf(IntegrationNotConnectedError);
  });

  it('links Strava activities to matching Garmin activities and persists them', async () => {
    await deps.tokens.set('u1', 'strava', TOKENS);
    // Seed two of the three mock Strava activities as Garmin rows.
    await deps.store.putActivities('u1', [
      garminFor(STRAVA_MOCK_ACTIVITIES[0]!),
      garminFor(STRAVA_MOCK_ACTIVITIES[1]!)
    ]);

    const res = await linkStravaActivities(deps, 'u1');
    expect(res.scanned).toBe(3);
    expect(res.matched).toBe(2);
    expect(res.links.map((l) => l.stravaId).sort()).toEqual(['9001', '9002']);
    expect(res.links.every((l) => l.permalink.startsWith('https://www.strava.com/activities/'))).toBe(true);

    const persisted = await deps.links.list('u1');
    expect(persisted).toHaveLength(2);
  });

  it('returns no links when there are no Garmin activities to match', async () => {
    await deps.tokens.set('u1', 'strava', TOKENS);
    const res = await linkStravaActivities(deps, 'u1');
    expect(res.matched).toBe(0);
    expect(res.links).toHaveLength(0);
  });
});
