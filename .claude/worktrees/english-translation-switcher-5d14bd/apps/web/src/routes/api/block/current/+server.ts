import { json, type RequestHandler } from '@sveltejs/kit';
import { loadCurrentWeek, type BlockDeps } from '$modules/block/block.api';
import type { RequestEvent } from './$types';

function deps({ locals }: RequestEvent): BlockDeps {
  const c = locals.container;
  return { store: c.store, clock: c.clock, random: c.random, timeZone: c.config.appTimeZone };
}

export const GET: RequestHandler = async (event) => {
  return json(await loadCurrentWeek(deps(event as RequestEvent), event.locals.user!.id));
};
