import { json, type RequestHandler } from '@sveltejs/kit';
import { createTranslator } from '$lib/i18n';
import { listFeatures, postFeature } from '$modules/features/features.api';

export const GET: RequestHandler = async ({ locals }) => {
  return json(await listFeatures(locals.features));
};

export const POST: RequestHandler = async ({ locals, request }) => {
  const body = await request.json().catch(() => null);
  const result = await postFeature(locals.features, body, createTranslator(locals.locale));
  if (!result.ok) return json({ error: result.error }, { status: result.status });
  return json(result.body);
};
