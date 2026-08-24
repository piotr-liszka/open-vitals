/** Edit or remove one library workout (spec 069). */
import { json, type RequestHandler } from '@sveltejs/kit';
import { deleteTemplate, updateTemplate, workoutErrorStatus } from '$modules/workouts/workouts.api';
import type { WorkoutTemplateDraft } from '$modules/workouts/workouts.types';

export const PATCH: RequestHandler = async ({ locals, params, request }) => {
  const user = locals.user;
  if (!user) return json({ error: 'unauthorized' }, { status: 401 });

  const body = (await request.json().catch(() => null)) as WorkoutTemplateDraft | null;
  if (!body) return json({ error: 'invalid JSON body' }, { status: 400 });

  const c = locals.container;
  try {
    const updated = await updateTemplate(
      { store: c.store, clock: c.clock, random: c.random, features: locals.features },
      user.id,
      params.id!,
      body
    );
    // Null means the id is not this user's — indistinguishable from "does not exist" on purpose, so a
    // probe cannot confirm another user's row exists (AGENTS.md §10).
    return updated === null ? json({ error: 'not found' }, { status: 404 }) : json(updated);
  } catch (err) {
    const mapped = workoutErrorStatus(err);
    if (!mapped) throw err;
    return json({ error: mapped.error }, { status: mapped.status });
  }
};

export const DELETE: RequestHandler = async ({ locals, params }) => {
  const user = locals.user;
  if (!user) return json({ error: 'unauthorized' }, { status: 401 });

  const c = locals.container;
  try {
    const removed = await deleteTemplate(
      { store: c.store, clock: c.clock, random: c.random, features: locals.features },
      user.id,
      params.id!
    );
    return removed === null ? json({ error: 'not found' }, { status: 404 }) : json({ deleted: true });
  } catch (err) {
    const mapped = workoutErrorStatus(err);
    if (!mapped) throw err;
    return json({ error: mapped.error }, { status: mapped.status });
  }
};
