import { json, type RequestHandler } from '@sveltejs/kit';
import { deleteGoal, updateGoal, type SeasonDeps } from '$modules/season/season.api';
import type { RequestEvent } from './$types';

function deps({ locals }: RequestEvent): SeasonDeps {
  const c = locals.container;
  return {
    store: c.store,
    settings: c.repo.settings,
    clock: c.clock,
    random: c.random
  };
}

export const PATCH: RequestHandler = async (event) => {
  const e = event as RequestEvent;
  const body = await event.request.json().catch(() => null);
  const result = await updateGoal(deps(e), event.locals.user!.id, e.params.id, body);
  if (!result.ok) return json({ error: result.error }, { status: result.status });
  return json({ goal: result.goal });
};

export const DELETE: RequestHandler = async (event) => {
  const e = event as RequestEvent;
  const result = await deleteGoal(deps(e), event.locals.user!.id, e.params.id);
  if (!result.ok) return json({ error: result.error }, { status: result.status });
  return json({ deleted: true });
};
