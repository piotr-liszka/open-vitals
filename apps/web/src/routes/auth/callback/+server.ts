/** GET /auth/callback — validate state, exchange + verify the id_token, provision user, set session. */
import { redirect, type RequestHandler } from '@sveltejs/kit';
import { completeCallback, OAUTH_COOKIES } from '$modules/auth/auth.api';

export const GET: RequestHandler = async ({ locals, cookies, url, request, getClientAddress }) => {
  const redirectUri = `${locals.container.config.publicBaseUrl}/auth/callback`;

  const tx = {
    state: cookies.get(OAUTH_COOKIES.state) ?? '',
    nonce: cookies.get(OAUTH_COOKIES.nonce) ?? '',
    codeVerifier: cookies.get(OAUTH_COOKIES.verifier) ?? ''
  };
  // The transaction is single-use: clear it no matter the outcome.
  for (const name of Object.values(OAUTH_COOKIES)) cookies.delete(name, { path: '/' });

  const result = await completeCallback(locals.container, {
    locale: locals.locale,
    code: url.searchParams.get('code'),
    state: url.searchParams.get('state'),
    redirectUri,
    transaction: tx.state ? tx : null,
    userAgent: request.headers.get('user-agent'),
    ipAddress: getClientAddress()
  });

  if (!result.ok) {
    // Never surface the raw token/error — a friendly message on /login only.
    throw redirect(303, `/login?error=${encodeURIComponent(result.error)}`);
  }

  cookies.set(result.session.cookieName, result.session.id, {
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    // Always Secure in prod: internet-facing behind a TLS proxy, where Node may see http.
    secure: locals.container.config.isProd || url.protocol === 'https:',
    maxAge: result.session.maxAge
  });
  throw redirect(303, result.location);
};
