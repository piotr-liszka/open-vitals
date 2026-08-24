import { json, type RequestHandler } from '@sveltejs/kit';
import { GarminUnavailableError } from '$lib/server/interfaces';

export const POST: RequestHandler = async ({ locals }) => {
  try {
    await locals.garmin.disconnect();
    return json({ ok: true });
  } catch (err) {
    if (err instanceof GarminUnavailableError) {
      return json({ ok: false, error: 'Garmin service unavailable.' }, { status: 503 });
    }
    throw err;
  }
};
