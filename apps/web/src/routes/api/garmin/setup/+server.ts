import { json, type RequestHandler } from '@sveltejs/kit';
import { setupGarmin } from '$modules/garmin-setup/setup.api';
import { createTranslator } from '$lib/i18n';

export const POST: RequestHandler = async ({ request, locals }) => {
  // Throttle Garmin credential submissions per user (protects the real Garmin account from
  // credential-stuffing / lockout, and the sidecar from abuse).
  const key = `garmin-setup:${locals.user?.id ?? 'anon'}`;
  const gate = locals.container.setupRateLimiter.check(key);
  if (!gate.allowed) {
    return json(
      { error: createTranslator(locals.locale)('error.tooManyAttempts') },
      { status: 429, headers: { 'Retry-After': String(gate.retryAfterSeconds) } }
    );
  }

  const body = await request.json().catch(() => null);
  const result = await setupGarmin(locals.garmin, body, locals.locale);
  return json(result.body, { status: result.status });
};
