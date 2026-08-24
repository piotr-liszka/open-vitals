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
import { createTestContainer, type AppContainer } from '$lib/server/container';
import { createRateLimiter } from '$lib/server/rate-limit';
import { fixedClock } from '$lib/server/clock';
import type { FeatureService } from '$lib/server/features/types';
import type {
  GarminSyncSource,
  GarminWorkoutDeleteResult,
  GarminWorkoutScheduleResult,
  GarminWorkoutWriteResult
} from '$lib/server/interfaces';

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

/**
 * A pushed row exercises the delete+recreate branch (spec 092) — the fix for the "stuck forever"
 * symptom. Built with its own container (rather than the thin `event()` helper above) so the test can
 * both seed the row directly in the store AND inspect what reached the mock Garmin source.
 */
describe('POST /api/workouts/[id]/push — re-push of an already-pushed row (spec 092)', () => {
  function mockGarmin(): GarminSyncSource & {
    created: string[];
    scheduled: string[];
    deleted: string[];
  } {
    const log = { created: [] as string[], scheduled: [] as string[], deleted: [] as string[] };
    const source: GarminSyncSource = {
      async login() {
        throw new Error('unused');
      },
      async getStatus() {
        return { authenticated: true };
      },
      async getMetric() {
        return null;
      },
      async getMetricRange(metric, start, end) {
        return { metric, start, end, days: [] };
      },
      async disconnect() {
        throw new Error('unused');
      },
      async listActivitiesPage() {
        return [];
      },
      async getActivityDetails(activityId) {
        return { activityId };
      },
      async getWeightRange() {
        return [];
      },
      async createWorkout(): Promise<GarminWorkoutWriteResult> {
        const workoutId = `g-${log.created.length + 1}`;
        log.created.push(workoutId);
        return { supported: true, workoutId, reason: null };
      },
      async scheduleWorkout(id): Promise<GarminWorkoutScheduleResult> {
        log.scheduled.push(id);
        return { supported: true, scheduleId: `s-${id}`, reason: null };
      },
      async deleteWorkout(id): Promise<GarminWorkoutDeleteResult> {
        log.deleted.push(id);
        return { supported: true, removed: true };
      }
    };
    return Object.assign(source, log);
  }

  async function seededEvent(garmin: GarminSyncSource): Promise<{
    req: RequestEvent;
    container: AppContainer;
  }> {
    const container = createTestContainer({
      clock,
      garmin,
      workoutPushRateLimiter: createRateLimiter({
        limit: 20,
        windowMs: 60_000,
        now: () => clock.now().getTime()
      })
    });
    await container.store.createWorkout('u1', {
      id: 'w1',
      day: '2026-08-20',
      time: '18:00',
      sport: 'cycling',
      title: '4x8 FTP',
      steps: [],
      note: null,
      createdAt: clock.now().toISOString()
    });
    await container.store.updateWorkout('u1', 'w1', {
      pushState: 'pushed',
      garminWorkoutId: 'g-old',
      garminScheduleId: 's-old',
      contentPushed: true,
      updatedAt: clock.now().toISOString()
    });
    const req = {
      locals: { container, user: { id: 'u1' }, features: featuresStub(true) },
      params: { id: 'w1' }
    } as unknown as RequestEvent;
    return { req, container };
  }

  it('deletes the stale upstream copy, creates + schedules fresh, and answers 200 with new ids', async () => {
    const garmin = mockGarmin();
    const { req, container } = await seededEvent(garmin);

    const res = await POST(req);

    expect(res.status).toBe(200);
    const body = (await res.json()) as { pushState: string; onGarmin: boolean };
    expect(body.pushState).toBe('pushed');
    expect(body.onGarmin).toBe(true);
    expect(garmin.deleted).toEqual(['g-old']);
    expect(garmin.created).toEqual(['g-1']);
    expect(garmin.scheduled).toEqual(['g-1']);

    const stored = await container.store.getWorkout('u1', 'w1');
    expect(stored?.garminWorkoutId).toBe('g-1');
    expect(stored?.garminWorkoutId).not.toBe('g-old');
    expect(stored?.contentPushed).toBe(true);
  });
});
