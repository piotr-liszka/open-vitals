import { json, type RequestHandler } from '@sveltejs/kit';
import { removeEntry, type JournalDeps } from '$modules/journal/journal.api';
import type { RequestEvent } from './$types';

function deps({ locals }: RequestEvent): JournalDeps {
  const c = locals.container;
  return { store: c.store, clock: c.clock, random: c.random, timeZone: c.config.appTimeZone };
}

export const DELETE: RequestHandler = async (event) => {
  const e = event as RequestEvent;
  const result = await removeEntry(deps(e), event.locals.user!.id, e.params.id);
  if (!result.ok) return json({ error: result.error }, { status: result.status });
  return json({ deleted: true });
};
