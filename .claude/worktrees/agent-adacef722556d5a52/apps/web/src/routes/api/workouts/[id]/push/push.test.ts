/**
 * Route-level contract for `POST /api/workouts/<id>/push` (spec 083).
 *
 * The handler logic is covered by `pushWorkoutNow`'s own tests; what only exists at this layer is the
 * gate order — unauthenticated before anything, the rate limit before the store, and the mapping of
 * the module's errors onto status codes.
 */
import { describe, it, expect } from 'vitest';
import type { RequestEvent } from '@sveltejs/kit';
import { POST } from './+server';
import { createTestContainer } from '$lib/server/container';
import { createRateLimiter } from '$lib/server/rate-limit';
import { fixedClock } from '$lib/server/clock';
import type { FeatureService } from '$lib/server/features/types';

const clock = fixedClock(new Date('2026-08-15T10:00:00Z'));

function featuresStub(enabled: boolean): FeatureService {
  return {
    async list() {
      return [];
    },
    async isEnabled() {
      return enabled;
    },
    async setEnabled() {
      throw new Error('unused');
    }
  } as unknown as FeatureService;
}

function event(opts: { user?: { id: string } | null; writeEnabled?: boolean; limit?: number } = {}) {
  const container = createTestContainer({
    clock,
    workoutPushRateLimiter: createRateLimiter({
      limit: opts.limit ?? 20,
      windowMs: 60_000,
      now: () => clock.now().getTime()
    })
  });
  return {
    locals: {
      container,
      user: opts.user === undefined ? { id: 'u1' } : opts.user,
      features: featuresStub(opts.writeEnabled ?? true)
    },
    params: { id: 'w1' }
  } as unknown as RequestEvent;
}

describe('POST /api/workouts/[id]/push', () => {
  it('is 401 without a session', async () => {
    const res = await POST(event({ user: null }));
    expect(res.status).toBe(401);
  });

  it('is 404 for a workout this user does not have', async () => {
    const res = await POST(event());
    expect(res.status).toBe(404);
  });

  it('is 403 when the write switch is off', async () => {
    const res = await POST(event({ writeEnabled: false }));
    expect(res.status).toBe(403);
  });

  it('is 429 with a Retry-After once the per-user limit is spent', async () => {
    // The limit is checked BEFORE the store is touched: one stuck button must not become a loop of
    // writes against Garmin.
    const e = event({ limit: 1 });
    expect((await POST(e)).status).toBe(404);

    const blocked = await POST(e);
    expect(blocked.status).toBe(429);
    expect(blocked.headers.get('Retry-After')).toBeTruthy();
  });
});
