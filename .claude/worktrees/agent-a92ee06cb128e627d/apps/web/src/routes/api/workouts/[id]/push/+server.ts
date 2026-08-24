/**
 * `POST /api/workouts/<id>/push` — send this one session to Garmin now (spec 083).
 *
 * Exists so the athlete does not have to wait for the background push phase, and so turning the
 * automation off (`workout_auto_push`) leaves a way to get a session onto the watch deliberately.
 */
import { json, type RequestHandler } from '@sveltejs/kit';
import { pushWorkoutNow, workoutErrorStatus } from '$modules/workouts/workouts.api';

export const POST: RequestHandler = async ({ locals, params }) => {
  const user = locals.user;
  if (!user) return json({ error: 'unauthorized' }, { status: 401 });

  const c = locals.container;
  // One click is one write against a third-party API; the limit is what stops a stuck button from
  // becoming a loop against Garmin.
  const limit = c.workoutPushRateLimiter.check(user.id);
  if (!limit.allowed) {
    return json(
      { error: 'zbyt wiele wysyłek — spróbuj za chwilę' },
      { status: 429, headers: { 'Retry-After': String(limit.retryAfterSeconds) } }
    );
  }

  try {
    const pushed = await pushWorkoutNow(
      {
        store: c.store,
        clock: c.clock,
        random: c.random,
        features: locals.features,
        source: c.garminSyncFor(user.id)
      },
      user.id,
      params.id!
    );
    // Null means the id is not this user's — indistinguishable from "does not exist", on purpose.
    return pushed === null ? json({ error: 'not found' }, { status: 404 }) : json(pushed);
  } catch (err) {
    const mapped = workoutErrorStatus(err);
    if (!mapped) throw err;
    return json({ error: mapped.error }, { status: mapped.status });
  }
};
