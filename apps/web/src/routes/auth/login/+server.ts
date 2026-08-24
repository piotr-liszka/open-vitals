/**
 * GET /auth/login — start Google OIDC (or short-circuit to a dev session in mock mode).
 * POST /auth/login — username/email + password sign-in (spec 094).
 */
import { json, redirect, type RequestHandler } from '@sveltejs/kit';
import { beginLogin, loginWithPassword, OAUTH_COOKIES, OAUTH_TX_MAX_AGE } from '$modules/auth/auth.api';

export const GET: RequestHandler = async ({ locals, cookies, url, request, getClientAddress }) => {
  const redirectUri = `${locals.container.config.publicBaseUrl}/auth/callback`;
  const result = await beginLogin(locals.container, redirectUri, {
    userAgent: request.headers.get('user-agent'),
    ipAddress: getClientAddress()
  });
  // Always Secure in prod: internet-facing behind a TLS proxy, where Node may see http.
  const secure = locals.container.config.isProd || url.protocol === 'https:';

  if (result.kind === 'session') {
    // Mock mode: dev user is provisioned + signed in immediately.
    cookies.set(result.session.cookieName, result.session.id, {
      path: '/',
      httpOnly: true,
      sameSite: 'lax',
      secure,
      maxAge: result.session.maxAge
    });
    throw redirect(303, result.location);
  }

  const opts = { path: '/', httpOnly: true, sameSite: 'lax', secure, maxAge: OAUTH_TX_MAX_AGE } as const;
  cookies.set(OAUTH_COOKIES.state, result.transaction.state, opts);
  cookies.set(OAUTH_COOKIES.nonce, result.transaction.nonce, opts);
  cookies.set(OAUTH_COOKIES.verifier, result.transaction.codeVerifier, opts);
  throw redirect(302, result.location);
};

/** POST /auth/login — username/email + password sign-in (spec 094). JSON in, JSON out. */
export const POST: RequestHandler = async ({ locals, cookies, url, request, getClientAddress }) => {
  const body = (await request.json().catch(() => null)) as {
    identifier?: unknown;
    password?: unknown;
  } | null;
  const identifier = typeof body?.identifier === 'string' ? body.identifier : '';
  const password = typeof body?.password === 'string' ? body.password : '';

  const result = await loginWithPassword(locals.container, {
    identifier,
    password,
    userAgent: request.headers.get('user-agent'),
    ipAddress: getClientAddress(),
    locale: locals.locale
  });

  if (!result.ok) return json({ error: result.error }, { status: result.status });

  cookies.set(result.session.cookieName, result.session.id, {
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    secure: locals.container.config.isProd || url.protocol === 'https:',
    maxAge: result.session.maxAge
  });
  return json({ ok: true });
};
