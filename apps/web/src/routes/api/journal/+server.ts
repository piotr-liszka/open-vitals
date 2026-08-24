import { json, type RequestHandler } from '@sveltejs/kit';
import { createTranslator } from '$lib/i18n';
import { loadJournal, logEntry, type JournalDeps } from '$modules/journal/journal.api';
import type { RequestEvent } from './$types';

/** Every handler here takes the same injected ports (AGENTS.md §2 rule 4). */
function deps({ locals }: RequestEvent): JournalDeps {
  const c = locals.container;
  return { store: c.store, clock: c.clock, random: c.random, timeZone: c.config.appTimeZone };
}

export const GET: RequestHandler = async (event) => {
  const e = event as RequestEvent;
  const from = e.url.searchParams.get('from');
  const to = e.url.searchParams.get('to');
  return json(
    await loadJournal(deps(e), event.locals.user!.id, {
      ...(from ? { from } : {}),
      ...(to ? { to } : {})
    })
  );
};

export const PUT: RequestHandler = async (event) => {
  const body = await event.request.json().catch(() => null);
  const result = await logEntry(
    deps(event as RequestEvent),
    event.locals.user!.id,
    body,
    createTranslator(event.locals.locale)
  );
  if (!result.ok) return json({ error: result.error }, { status: result.status });
  return json({ entry: result.entry, fields: result.fields });
};
