/**
 * The workout library (spec 069) — list and create. Thin per AGENTS.md §5: deps from the container,
 * policy in the module.
 */
import { json, type RequestHandler } from '@sveltejs/kit';
import { createTemplate, listTemplates, workoutErrorStatus } from '$modules/workouts/workouts.api';
import type { WorkoutTemplateDraft } from '$modules/workouts/workouts.types';

export const GET: RequestHandler = async ({ locals }) => {
  const user = locals.user;
  if (!user) return json({ error: 'unauthorized' }, { status: 401 });
  const c = locals.container;
  const templates = await listTemplates(
    { store: c.store, clock: c.clock, random: c.random, features: locals.features },
    user.id
  );
  return json({ templates });
};

export const POST: RequestHandler = async ({ locals, request }) => {
  const user = locals.user;
  if (!user) return json({ error: 'unauthorized' }, { status: 401 });

  const body = (await request.json().catch(() => null)) as WorkoutTemplateDraft | null;
  if (!body) return json({ error: 'invalid JSON body' }, { status: 400 });

  const c = locals.container;
  try {
    const created = await createTemplate(
      { store: c.store, clock: c.clock, random: c.random, features: locals.features },
      user.id,
      body
    );
    return json(created, { status: 201 });
  } catch (err) {
    const mapped = workoutErrorStatus(err);
    if (!mapped) throw err;
    return json({ error: mapped.error }, { status: mapped.status });
  }
};
