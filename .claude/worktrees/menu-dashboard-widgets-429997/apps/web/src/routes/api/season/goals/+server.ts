import { json, type RequestHandler } from '@sveltejs/kit';
import { createGoal, loadSeason, type SeasonDeps } from '$modules/season/season.api';
import type { RequestEvent } from './$types';

/** Every handler here takes the same injected ports (AGENTS.md §2 rule 4). */
function deps({ locals }: RequestEvent): SeasonDeps {
  const c = locals.container;
  return {
    store: c.store,
    settings: c.repo.settings,
    consent: locals.consent,
    clock: c.clock,
    random: c.random
  };
}

export const GET: RequestHandler = async (event) => {
  return json(await loadSeason(deps(event as RequestEvent), { userId: event.locals.user!.id }));
};

export const POST: RequestHandler = async (event) => {
  const body = await event.request.json().catch(() => null);
  const result = await createGoal(deps(event as RequestEvent), event.locals.user!.id, body);
  if (!result.ok) return json({ error: result.error }, { status: result.status });
  return json({ goal: result.goal });
};
