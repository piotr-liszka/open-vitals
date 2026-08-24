/**
 * `POST /api/workouts` — create an authored session (spec 066).
 *
 * Thin, per AGENTS.md §5: it builds deps from the container and calls the module handler. All the
 * policy — validation, the consent gate, the push-state reset — lives there and is shared with the MCP
 * tools rather than re-implemented for the browser.
 */
import { json, type RequestHandler } from '@sveltejs/kit';
import { createWorkout, scheduleFromTemplate, workoutErrorStatus } from '$modules/workouts/workouts.api';
import type { WorkoutDraft } from '$modules/workouts/workouts.types';

/** Scheduling a library workout onto a day (spec 069) — a create whose steps came from the library. */
interface ScheduleBody {
  templateId: string;
  day: string;
  time?: string | null;
}

const isSchedule = (body: unknown): body is ScheduleBody =>
  typeof body === 'object' && body !== null && typeof (body as ScheduleBody).templateId === 'string';

export const POST: RequestHandler = async ({ locals, request }) => {
  const user = locals.user;
  if (!user) return json({ error: 'unauthorized' }, { status: 401 });

  const body = (await request.json().catch(() => null)) as WorkoutDraft | ScheduleBody | null;
  if (!body) return json({ error: 'invalid JSON body' }, { status: 400 });

  const c = locals.container;
  const deps = { store: c.store, clock: c.clock, random: c.random, features: locals.features };

  try {
    /*
     * Scheduling from the library is a CREATE, not a verb of its own (spec 069) — the only difference
     * is where the steps came from, so it shares this endpoint rather than adding `/schedule`.
     */
    if (isSchedule(body)) {
      const scheduled = await scheduleFromTemplate(
        deps,
        user.id,
        body.templateId,
        body.day,
        body.time ?? null
      );
      return scheduled === null
        ? json({ error: 'not found' }, { status: 404 })
        : json(scheduled, { status: 201 });
    }

    const created = await createWorkout(deps, user.id, body);
    return json(created, { status: 201 });
  } catch (err) {
    const mapped = workoutErrorStatus(err);
    if (!mapped) throw err;
    return json({ error: mapped.error }, { status: mapped.status });
  }
};
