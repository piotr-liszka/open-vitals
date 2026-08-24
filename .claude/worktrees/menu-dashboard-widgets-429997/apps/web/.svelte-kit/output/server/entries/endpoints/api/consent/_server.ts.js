import { json } from "@sveltejs/kit";
import { l as listConsent, p as postConsent } from "../../../../chunks/consent.api.js";
const GET = async ({ locals }) => {
  return json(await listConsent(locals.consent));
};
const POST = async ({ locals, request }) => {
  const body = await request.json().catch(() => null);
  const result = await postConsent(locals.consent, body);
  if (!result.ok) return json({ error: result.error }, { status: result.status });
  return json(result.body);
};
export {
  GET,
  POST
};
