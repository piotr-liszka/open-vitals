import { json, type RequestHandler } from '@sveltejs/kit';
import { listConsent, postConsent } from '$modules/consent/consent.api';

export const GET: RequestHandler = async ({ locals }) => {
  return json(await listConsent(locals.consent));
};

export const POST: RequestHandler = async ({ locals, request }) => {
  const body = await request.json().catch(() => null);
  const result = await postConsent(locals.consent, body);
  if (!result.ok) return json({ error: result.error }, { status: result.status });
  return json(result.body);
};
