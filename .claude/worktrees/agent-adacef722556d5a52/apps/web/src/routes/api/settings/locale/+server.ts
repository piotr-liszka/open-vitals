import { json, type RequestHandler } from '@sveltejs/kit';
import { LOCALE_COOKIE } from '$lib/i18n';
import { setLocale } from '$modules/locale/locale.api';

/** A year: long enough that the choice survives, short enough to expire on an abandoned device. */
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export const PUT: RequestHandler = async ({ locals, request, cookies, url }) => {
  const body = await request.json().catch(() => null);
  const result = await setLocale(locals.container.repo.settings, locals.user?.id ?? null, body);
  if (!result.ok) return json({ error: result.error }, { status: result.status });

  // Not httpOnly on purpose: this is a display preference, not a credential, and the client reads it
  // to keep its own state honest. `SameSite=Lax` still keeps it off cross-site requests.
  cookies.set(LOCALE_COOKIE, result.body.locale, {
    path: '/',
    maxAge: COOKIE_MAX_AGE,
    sameSite: 'lax',
    httpOnly: false,
    // Always Secure in prod: internet-facing behind a TLS proxy, where Node may see http.
    secure: locals.container.config.isProd || url.protocol === 'https:'
  });
  return json(result.body);
};
