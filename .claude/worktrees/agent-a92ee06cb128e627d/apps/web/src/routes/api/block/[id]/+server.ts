import { json, type RequestHandler } from '@sveltejs/kit';
import { patchBlock, removeBlock, type BlockDeps } from '$modules/block/block.api';
import type { RequestEvent } from './$types';

function deps({ locals }: RequestEvent): BlockDeps {
  const c = locals.container;
  return { store: c.store, clock: c.clock, random: c.random, timeZone: c.config.appTimeZone };
}

export const PATCH: RequestHandler = async (event) => {
  const e = event as RequestEvent;
  const body = await event.request.json().catch(() => null);
  const result = await patchBlock(deps(e), event.locals.user!.id, e.params.id, body);
  if (!result.ok) return json({ error: result.error }, { status: result.status });
  return json({ block: result.block, weekTargets: result.weekTargets });
};

export const DELETE: RequestHandler = async (event) => {
  const e = event as RequestEvent;
  const result = await removeBlock(deps(e), event.locals.user!.id, e.params.id);
  if (!result.ok) return json({ error: result.error }, { status: result.status });
  return json({ deleted: true });
};
