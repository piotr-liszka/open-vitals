import { json, type RequestHandler } from '@sveltejs/kit';
import { getHealth } from '$modules/healthcheck/health.api';

export const GET: RequestHandler = async ({ locals }) => {
  return json(await getHealth(locals.garmin));
};
