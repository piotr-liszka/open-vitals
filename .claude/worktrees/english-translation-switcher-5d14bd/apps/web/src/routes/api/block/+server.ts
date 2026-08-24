import { json, type RequestHandler } from '@sveltejs/kit';
import { createBlock, listBlockSummaries, type BlockDeps } from '$modules/block/block.api';
import type { RequestEvent } from './$types';

/** Every handler here takes the same injected ports (AGENTS.md §2 rule 4). */
function deps({ locals }: RequestEvent): BlockDeps {
  const c = locals.container;
  return { store: c.store, clock: c.clock, random: c.random, timeZone: c.config.appTimeZone };
}

export const GET: RequestHandler = async (event) => {
  const e = event as RequestEvent;
  const goalId = e.url.searchParams.get('goalId');
  return json(await listBlockSummaries(deps(e), event.locals.user!.id, goalId ? { goalId } : {}));
};

export const POST: RequestHandler = async (event) => {
  const body = await event.request.json().catch(() => null);
  const result = await createBlock(deps(event as RequestEvent), event.locals.user!.id, body);
  if (!result.ok) return json({ error: result.error }, { status: result.status });
  return json({ block: result.block });
};
