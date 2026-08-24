/** Liveness endpoint (public). Reports the web service is up; does not call Garmin. */
import { json, type RequestHandler } from '@sveltejs/kit';

export const GET: RequestHandler = ({ locals }) => {
  return json({
    status: 'ok',
    service: 'openvitals-web',
    time: locals.container.clock.now().toISOString()
  });
};
